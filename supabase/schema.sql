-- FleetTrack schema. Jalankan seluruh file sekali di Supabase SQL Editor.
-- Pengguna admin tidak dapat dibuat melalui form signup; hanya promosi manual lewat SQL.
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'driver', 'admin');
create type public.delivery_status as enum ('pending','accepted','picked_up','on_the_way','delivered','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique default ('FT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 9))),
  customer_id uuid not null references public.profiles(id),
  driver_id uuid references public.profiles(id),
  pickup_address text not null check (char_length(pickup_address) between 3 and 240),
  delivery_address text not null check (char_length(delivery_address) between 3 and 240),
  item_description text not null check (char_length(item_description) between 3 and 240),
  status public.delivery_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_driver_idx on public.orders(driver_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index messages_order_idx on public.messages(order_id, created_at);

-- Satu posisi terbaru per pesanan (bukan riwayat GPS permanen).
create table public.driver_locations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_updated before update on public.orders
for each row execute function public.set_updated_at();
create trigger locations_updated before update on public.driver_locations
for each row execute function public.set_updated_at();

-- Signup metadata boleh meminta driver/customer saja, TIDAK pernah admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nickname text;
  account_role public.app_role;
begin
  nickname := coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'), 80), ''), split_part(new.email, '@', 1), 'Pengguna');
  if new.raw_user_meta_data->>'requested_role' = 'driver' then
    account_role := 'driver';
  else
    account_role := 'customer';
  end if;
  insert into public.profiles(id, display_name, role) values (new.id, nickname, account_role);
  return new;
end; $$;
create trigger auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
create function public.order_member(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and
      (o.customer_id = (select auth.uid()) or o.driver_id = (select auth.uid()) or public.is_admin())
  );
$$;

-- Menolak ID driver yang bukan akun dengan peran driver.
create function public.validate_driver() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.driver_id is not null and not exists (
    select 1 from public.profiles where id = new.driver_id and role = 'driver'
  ) then
    raise exception 'Akun tujuan bukan driver';
  end if;
  return new;
end; $$;
create trigger orders_valid_driver before insert or update of driver_id on public.orders
for each row execute function public.validate_driver();

-- Hindari posisi driver lama tertinggal ketika driver diganti atau pesanan selesai.
create function public.purge_old_location() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.driver_id is distinct from old.driver_id
    or new.status in ('delivered', 'cancelled') then
    delete from public.driver_locations where order_id = new.id;
  end if;
  return new;
end; $$;
create trigger orders_purge_location after update of driver_id, status on public.orders
for each row execute function public.purge_old_location();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.driver_locations enable row level security;

-- Profiles: dapat melihat diri sendiri, semua driver, admin dapat melihat semua,
-- serta profil yang terlibat pada pengiriman yang sama.
create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid()) or role = 'driver' or public.is_admin()
  or exists (
    select 1 from public.orders o
    where (o.customer_id = profiles.id or o.driver_id = profiles.id)
      and (o.customer_id = (select auth.uid()) or o.driver_id = (select auth.uid()))
  )
);
-- Tidak ada kebijakan UPDATE untuk profiles. User tak bisa menaikkan rolenya sendiri.

create policy orders_select on public.orders for select to authenticated
using (customer_id = (select auth.uid()) or driver_id = (select auth.uid()) or public.is_admin());
create policy orders_insert on public.orders for insert to authenticated
with check (
  customer_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'customer')
);
create policy orders_admin_update on public.orders for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy messages_select on public.messages for select to authenticated
using (public.order_member(order_id));
create policy messages_insert on public.messages for insert to authenticated
with check (sender_id = (select auth.uid()) and public.order_member(order_id));

create policy locations_select on public.driver_locations for select to authenticated
using (public.order_member(order_id));
create policy locations_insert on public.driver_locations for insert to authenticated
with check (
  driver_id = (select auth.uid()) and exists (
    select 1 from public.orders o where o.id = order_id
    and o.driver_id = (select auth.uid())
    and o.status in ('accepted','picked_up','on_the_way')
  )
);
create policy locations_update on public.driver_locations for update to authenticated
using (driver_id = (select auth.uid()))
with check (
  driver_id = (select auth.uid()) and exists (
    select 1 from public.orders o where o.id = order_id
    and o.driver_id = (select auth.uid())
    and o.status in ('accepted','picked_up','on_the_way')
  )
);

-- Driver hanya bisa maju menurut alur status; bukan mengubah ID pelanggan/driver.
create function public.driver_update_status(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_status public.delivery_status;
begin
  select status into current_status from public.orders
  where id = p_order_id and driver_id = auth.uid() for update;
  if not found then raise exception 'Pesanan tidak ditugaskan kepada Anda'; end if;
  if not (
    (current_status='pending' and p_status='accepted') or
    (current_status='accepted' and p_status='picked_up') or
    (current_status='picked_up' and p_status='on_the_way') or
    (current_status='on_the_way' and p_status='delivered')
  ) then raise exception 'Transisi status tidak valid'; end if;
  update public.orders set status = p_status::public.delivery_status where id = p_order_id;
end; $$;

create function public.customer_cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order_id and customer_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Hanya pesanan menunggu yang dapat dibatalkan'; end if;
end; $$;

revoke all on function public.is_admin() from public;
revoke all on function public.order_member(uuid) from public;
revoke all on function public.driver_update_status(uuid,text) from public;
revoke all on function public.customer_cancel_order(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.order_member(uuid) to authenticated;
grant execute on function public.driver_update_status(uuid,text) to authenticated;
grant execute on function public.customer_cancel_order(uuid) to authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update on public.driver_locations to authenticated;

-- Event realtime (perlu publication + RLS keduanya).
-- Nama publication biasanya sudah ada pada Supabase hosted.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_locations') then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end $$;
