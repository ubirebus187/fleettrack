# FleetTrack — Logistics Dashboard + GPS Realtime + Live Chat

**FleetTrack** adalah proyek portofolio aplikasi logistik berbasis **Next.js + TypeScript + Supabase + Leaflet** yang bisa di-deploy ke **Vercel**. Ini bukan UI statis: database, autentikasi, CRUD pengiriman, realtime location, dan chat terhubung melalui Supabase.

> **Penting:** ZIP ini berisi source code, bukan layanan Supabase yang sudah dibuat. Aplikasi akan aktif setelah Anda memasang dependencies, menjalankan SQL, mengisi environment variables, dan membuat akun. Tidak ada akun/password atau database yang disertakan.

## Fitur

- Auth email/password, daftar sebagai **Customer** atau **Driver**; **Admin** dipromosikan lewat SQL.
- Dashboard statistik pesanan dan daftar pengiriman, filter status, pencarian kode/alamat.
- Customer membuat pesanan, memilih driver, dan membatalkan pesanan yang masih menunggu.
- Driver menerima pesanan, menandai paket dijemput, dalam perjalanan, dan selesai.
- Peta OpenStreetMap/Leaflet dengan **lokasi driver langsung** tanpa refresh.
- Driver membagikan GPS asli **hanya setelah menekan tombol** atau menjalankan **simulasi rute Jakarta** untuk demo.
- Lokasi terakhir disimpan per pesanan (tanpa GPS location history). Lokasi dihapus ketika driver diganti atau paket selesai.
- **Live chat** antara customer, driver yang ditugaskan, dan admin, per pesanan.
- SQL **Row Level Security**: pesan/lokasi/pesanan hanya bisa dibaca oleh pihak terkait + admin.
- `/api/health` endpoint Next.js (return JSON) untuk sanity check.
- Responsif desktop dan mobile, siap deploy Vercel.

## Struktur

```text
fleettrack/
├── src/
│   ├── app/
│   │   ├── page.tsx                # Auth state, dashboard, daftar, navigasi
│   │   ├── globals.css             # Design system responsif
│   │   ├── layout.tsx
│   │   └── api/health/route.ts     # Health endpoint
│   ├── components/
│   │   ├── AuthForm.tsx             # Login / daftar
│   │   ├── CreateOrderModal.tsx     # Form pesanan
│   │   ├── OrderDetails.tsx         # Detail + lokasi + chat
│   │   ├── TrackingMap.tsx         # Leaflet map, marker bergerak
│   │   ├── DriverControls.tsx      # GPS asli / demo / status
│   │   └── LiveChat.tsx            # Supabase Realtime messages
│   └── lib/{supabase,types,utils}.ts
├── supabase/schema.sql            # Database backend + policy + RPC + realtime
├── .env.example
├── package.json
└── README.md
```

## 1. Persyaratan

- Node.js versi **20.9+** (direkomendasikan Node 22).
- Akun Supabase: https://supabase.com
- Akun Vercel untuk deployment: https://vercel.com
- Akun GitHub untuk menyimpan kode (opsional jika deploy menggunakan Vercel CLI).

## 2. Membuat backend Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka **SQL Editor** → New query.
3. Salin **seluruh isi** `supabase/schema.sql`, lalu klik **Run** (jalankan sekali pada project baru). File ini membuat tabel, trigger, fungsi, RLS, dan publication Realtime.
4. Buka **Project Settings → API** (atau **Connect** pada UI Supabase terbaru). Salin **Project URL** dan **publishable/anon key**. Gunakan *public* key, **jangan** masukkan service-role/secret key ke frontend.
5. Pada **Authentication → Providers → Email**, aktifkan email/password. Jika konfirmasi email diaktifkan, setiap akun perlu membuka link verifikasi sebelum login. Untuk pengujian cepat, Anda bisa memakai email asli dan melakukan verifikasi normal.

Tabel backend: `profiles`, `orders`, `messages`, `driver_locations`.

**Catatan RLS:** Pendaftaran publik memungkinkan memilih customer/driver agar demo mudah diuji. Untuk produksi, sebaiknya verifikasi/approval driver, validasi profil, rate limiting, audit logs, dan verifikasi alamat ditambahkan.

## 3. Menjalankan di lokal

Ekstrak ZIP lalu jalankan di terminal:

```bash
cd fleettrack
npm install
cp .env.example .env.local
```

Buka `.env.local` dan isi:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_PUBLISHABLE_OR_ANON_KEY
```

Setelah disimpan:

```bash
npm run dev
```

Buka **http://localhost:3000**. Untuk memeriksa endpoint Next.js, buka **http://localhost:3000/api/health**.

**Windows PowerShell:** gunakan `Copy-Item .env.example .env.local` sebagai pengganti `cp`.

## 4. Mencoba demo end-to-end (dua browser)

1. Browser A / Chrome: klik **Daftar**, buat akun **Driver** dengan email berbeda.
2. Browser B / Incognito: klik **Daftar**, buat akun **Customer**.
3. Pastikan kedua akun sudah diverifikasi via email jika Supabase memerlukannya, kemudian login masing-masing.
4. Pada akun Customer: klik **Buat Pengiriman**, isi pickup, tujuan, paket, lalu pilih akun Driver dari dropdown.
5. Pada akun Driver: buka **Pengiriman** → pilih order → klik **Tandai: Diterima**.
6. Pada akun Driver: klik **Demo route**; pada browser Customer, buka pesanan yang sama. **Marker truk akan bergerak setiap ~3 detik**. Jika ingin GPS asli, klik **Gunakan GPS** dan izinkan browser mengakses lokasi. Browser harus menggunakan HTTPS (Vercel) atau localhost.
7. Pada bagian **Live chat**, kirim pesan dari Customer. Pesan akan muncul secara realtime di browser Driver. Balas dari Driver untuk menguji dua arah.
8. Driver dapat melanjutkan status ke **Paket dijemput** → **Dalam perjalanan** → **Selesai**. Ketika selesai, GPS disetop oleh UI, dan posisi tersimpan di database dihapus oleh trigger.

Catatan: Simulasi adalah titik koordinat buatan di Jakarta, bukan perjalanan kurir sungguhan. Peta memakai tile OpenStreetMap dan butuh internet. Lokasi asli hanya akan dibagikan jika driver memilih memulainya.

## 5. Menambahkan akun admin (opsional)

Daftarkan satu akun biasa lewat UI. Buka SQL Editor Supabase, lalu ubah rolenya **hanya melalui editor yang berprivilege**:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin-anda@example.com'
);
```

Logout/login kembali di web. Admin akan melihat semua pesanan dan dapat memilih/mengganti driver di detail pesanan. **Jangan membuat endpoint publik untuk mengubah role ke admin.**

## 6. Deployment ke Vercel

1. Push folder `fleettrack` ke repository GitHub (tanpa `.env.local` atau secrets).
2. Pada https://vercel.com/new, import repo tersebut dan pilih preset **Next.js**.
3. Atur environment variables di **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Jika mengganti variabel environment, lakukan **redeploy** agar variabel `NEXT_PUBLIC_` dibundel ulang.
5. Supabase **Authentication → URL Configuration**: set **Site URL** ke alamat Vercel, dan tambahkan URL deploy + `http://localhost:3000/**` ke allowed redirect URLs jika perlu.
6. Login di domain Vercel lalu ulangi uji dua browser.

Vercel men-deploy frontend/API Next.js. **PostgreSQL, autentikasi, dan realtime WebSocket dikelola oleh Supabase**, bukan server persisten di Vercel.

## 7. Arsitektur / Security

```text
Browser Customer  ─── Next.js di Vercel ─── Browser Driver
       │                     │                    │
       └────────────── Supabase ───────────────────┘
                        ├── Auth
                        ├── Postgres + RLS
                        ├── RPC driver_update_status
                        └── Realtime (orders/messages/location)
```

- Hanya **customer pemilik**, **driver yang ditugaskan**, dan **admin** dapat membaca data pesanan.
- Hanya driver yang ditugaskan pada pesanan **aktif** dapat menulis lokasinya.
- Hanya pengirim dan pihak berwenang dapat melihat chat, dengan isi pesan divalidasi panjangnya.
- Fungsi perubahan status driver mengecek otorisasi dan transisi di database, bukan hanya frontend.
- Users tidak dapat mengubah `profiles.role` lewat frontend karena tidak ada kebijakan UPDATE RLS.
- Lokasi pelanggan lain tidak dapat dibaca memakai anon key berkat RLS.
- Tidak ada API key pribadi yang disisipkan pada kode atau ZIP.

### Batasan demo

Ini portofolio / MVP, **belum** sistem logistik produksi. Belum mencakup upload bukti serah terima, pembayaran, driver KYC, push notifications, dispatch otomatis, optimasi rute, geocoding alamat, atau audit lengkap. Simulasi GPS hanya bekerja saat tab driver terbuka. Tidak ada background tracking melalui service worker. Riwayat GPS tidak disimpan untuk privasi.

Penggunaan Supabase Postgres Changes dibuat untuk kemudahan demo; Supabase merekomendasikan Broadcast untuk skalabilitas lebih besar. Realtime tetap tunduk ke RLS. Periksa batasan tarif layanan saat akan digunakan secara publik.

## Perintah

```bash
npm run dev           # development
npm run build         # production build
npm run start         # production server
npm run typecheck     # TypeScript
npm run lint          # ESLint
```

## Lisensi

MIT — boleh dimodifikasi untuk portofolio pribadi.
