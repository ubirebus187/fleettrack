"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes,
  ChevronDown, ChevronRight, Clock3, Command, LayoutDashboard,
  LogOut, MapPin, Menu, MessageSquare, Package, PackageCheck, PackagePlus,
  RefreshCw, Search, Settings2, ShieldCheck, Truck, Users, X
} from "lucide-react";
import { configured, db } from "@/lib/supabase";
import { initials, niceDate } from "@/lib/utils";
import { statusLabel, statusTone, type Order, type Profile } from "@/lib/types";
import AuthForm from "@/components/AuthForm";
import CreateOrderModal from "@/components/CreateOrderModal";
import OrderDetails from "@/components/OrderDetails";

type View="overview"|"orders"|"tracking"|"drivers"|"chat";
const navItems=[
  {key:"overview" as const, icon:LayoutDashboard,label:"Overview"},
  {key:"orders" as const, icon:Boxes,label:"Pengiriman"},
  {key:"tracking" as const, icon:MapPin,label:"Live Tracking"},
  {key:"chat" as const, icon:MessageSquare,label:"Live Chat"},
  {key:"drivers" as const, icon:Users,label:"Daftar Driver"}
];

export default function Page(){
  const [session,setSession]=useState<Session|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [profileError,setProfileError]=useState("");
  const [view,setView]=useState<View>("overview");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [dataLoading,setDataLoading]=useState(false);
  const [dataError,setDataError]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const [mobileNav,setMobileNav]=useState(false);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");

  useEffect(()=>{
    if(!configured()){setAuthLoading(false);return;}
    const supabase=db();let alive=true;
    void supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setAuthLoading(false);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{
      if(!alive)return;setSession(current);setAuthLoading(false);
      if(!current){setProfile(null);setOrders([]);setProfiles([]);setSelectedId(null);setView("overview");}
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!session?.user.id){setProfile(null);return;}
    let active=true;
    setProfileError("");setProfile(null);
    void db().from("profiles").select("*").eq("id",session.user.id).single()
      .then(({data,error})=>{
        if(!active)return;
        if(error){setProfileError("Profil gagal dimuat: "+error.message);}else setProfile(data as Profile);
      });
    return ()=>{active=false;};
  },[session?.user.id]);

  const refresh=useCallback(async()=>{
    if(!profile)return;
    const client=db();setDataLoading(true);setDataError("");
    const [orderResult,profilesResult]=await Promise.all([
      client.from("orders").select("*").order("created_at",{ascending:false}).limit(200),
      client.from("profiles").select("id,display_name,role,created_at").limit(500)
    ]);
    if(orderResult.error)setDataError(orderResult.error.message);
    else setOrders(orderResult.data as Order[]||[]);
    if(profilesResult.error)setDataError(prev=>prev||profilesResult.error!.message);
    else setProfiles(profilesResult.data as Profile[]||[]);
    setDataLoading(false);
  },[profile]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!profile)return;
    const client=db();
    const channel=client.channel(`orders-feed-${profile.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>{void refresh();})
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>{void refresh();})
      .subscribe();
    return ()=>{void client.removeChannel(channel);};
  },[profile,refresh]);

  const drivers=useMemo(()=>profiles.filter(p=>p.role==="driver"),[profiles]);
  const selected=useMemo(()=>orders.find(o=>o.id===selectedId)||null,[orders,selectedId]);
  const filtered=useMemo(()=>orders.filter(o=>{
    const needle=query.trim().toLowerCase();
    return (statusFilter==="all"||o.status===statusFilter) && (!needle || [o.tracking_code,o.pickup_address,o.delivery_address,o.item_description].join(" ").toLowerCase().includes(needle));
  }),[orders,query,statusFilter]);
  const activeCount=orders.filter(o=>["accepted","picked_up","on_the_way"].includes(o.status)).length;
  const deliveredCount=orders.filter(o=>o.status==="delivered").length;
  const pendingCount=orders.filter(o=>o.status==="pending").length;
  const lastOrder=orders.find(o=>o.driver_id)||orders[0];
  const customerCanCreate=profile?.role==="customer";
  const openOrder=(id:string,tab:View="tracking")=>{setSelectedId(id);setView(tab);setMobileNav(false);};
  const navigate=(v:View)=>{setView(v);setMobileNav(false);if((v==="tracking"||v==="chat")&&!selectedId && lastOrder)setSelectedId(lastOrder.id);};
  const createDone=(newOrder:Order)=>{setShowCreate(false);setOrders(prev=>[newOrder,...prev]);openOrder(newOrder.id);void refresh();};

  if(!configured())return <div className="standalone"><div className="brand"><div className="brand-mark"><Truck size={20}/></div><b>fleettrack</b></div><div className="setup-icon"><Settings2 size={30}/></div><h1>Setup Supabase terlebih dahulu</h1><p>Salin <code>.env.example</code> menjadi <code>.env.local</code>, isi kredensial Supabase, dan jalankan file <code>supabase/schema.sql</code> lewat SQL Editor. Ikuti README.md di paket ZIP.</p><code className="setup-code">npm install<br/>npm run dev</code></div>;
  if(authLoading|| (session&&!profile&&!profileError))return <div className="screen-loader"><div className="brand-mark"><Truck size={25}/></div><div className="loading-spin"/><p>Memuat FleetTrack...</p></div>;
  if(!session)return <AuthForm/>;
  if(profileError)return <div className="standalone"><h1>Profil belum tersedia</h1><p>{profileError}</p><button className="primary-btn" onClick={()=>window.location.reload()}>Muat ulang</button><button className="secondary-btn" onClick={()=>void db().auth.signOut()}>Keluar</button></div>;
  if(!profile)return null;

  const roleLabel=profile.role==="admin"?"Administrator":profile.role==="driver"?"Driver account":"Customer account";
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"show":""}`}>
      <div className="brand side-brand"><div className="brand-mark"><Truck size={23} strokeWidth={2.5}/></div><div><b>fleettrack</b><small>LOGISTICS OS</small></div><button className="sidebar-close" onClick={()=>setMobileNav(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Navigasi utama">{navItems.map(item=><button key={item.key} onClick={()=>navigate(item.key)} className={view===item.key?"active":""}><item.icon size={19}/><span>{item.label}</span>{item.key==="orders"&&orders.length>0&&<small className="nav-count">{orders.length}</small>}</button>)}</nav>
      <div className="sidebar-fill"/>
      <div className="sidebar-status"><div className="sidebar-status-top"><div className="green-dot"/><strong>System operational</strong></div><p>Realtime powered by Supabase</p><div className="sidebar-status-bottom"><Activity size={14}/> All systems online</div></div>
      <div className="sidebar-user"><div className="avatar">{initials(profile.display_name)}</div><div><strong>{profile.display_name}</strong><small>{roleLabel}</small></div><button title="Keluar" aria-label="Keluar" onClick={()=>void db().auth.signOut()}><LogOut size={18}/></button></div>
    </aside>
    {mobileNav&&<button className="mobile-backdrop" aria-label="Tutup navigasi" onClick={()=>setMobileNav(false)}/>}
    <div className="app-main">
      <header className="topbar"><div className="top-left"><button onClick={()=>setMobileNav(true)} className="mobile-menu" aria-label="Buka menu"><Menu size={22}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{navItems.find(n=>n.key===view)?.label}</strong></div><div className="top-actions"><span className="workspace-badge"><span/> Operational</span><button className="top-icon" aria-label="Muat ulang data" title="Refresh" onClick={()=>void refresh()}><RefreshCw size={17} className={dataLoading?"spin":""}/></button><div className="top-avatar">{initials(profile.display_name)}</div></div></header>
      <main className="content">
        {(view==="tracking"||view==="chat")&&selected ? <OrderDetails key={selected.id} order={selected} me={profile} profiles={profiles} back={()=>navigate("orders")} refresh={()=>void refresh()}/> : <>
          {view==="overview"&&<><div className="welcome-banner"><div><div className="overline">OPERATIONS DASHBOARD <span className="overline-line"/></div><h1>Selamat datang, {profile.display_name.split(" ")[0]} <span className="wave-mark">↗</span></h1><p>Pantau pesanan, driver, dan aktivitas pengiriman secara real-time.</p></div>{customerCanCreate&&<button className="primary-btn" onClick={()=>setShowCreate(true)}><PackagePlus size={17}/> Buat Pengiriman</button>}</div>
            <div className="metrics-grid"><Metric icon={Package} label="Total Pengiriman" value={orders.length} detail="Semua pesanan" color="blue" trend="Total"/><Metric icon={Truck} label="Dalam Perjalanan" value={activeCount} detail="Pengiriman aktif" color="lime" trend="Live"/><Metric icon={PackageCheck} label="Terselesaikan" value={deliveredCount} detail="Berhasil diantar" color="purple" trend="Selesai"/><Metric icon={Clock3} label="Menunggu Driver" value={pendingCount} detail="Perlu diproses" color="orange" trend="Pending"/></div>
            <div className="overview-grid"><div className="card recent-card"><div className="card-top"><div><h3>Pengiriman Terbaru</h3><p>Aktivitas pesanan yang perlu dipantau</p></div><button className="link-btn" onClick={()=>navigate("orders")}>Lihat semua <ArrowRight size={15}/></button></div><OrderTable orders={orders.slice(0,6)} profiles={profiles} click={openOrder} compact/></div><div className="right-stack"><div className="card quick-card"><div className="card-top"><div><h3>Quick Actions</h3><p>Akses pekerjaan lebih cepat</p></div><Command size={18}/></div><button onClick={()=>navigate("orders")}><div className="quick-icon blue-bg"><Boxes size={19}/></div><span><strong>Kelola Pesanan</strong><small>Cek dan ubah status pengiriman</small></span><ChevronRight size={17}/></button><button onClick={()=>navigate("tracking")}><div className="quick-icon lime-bg"><MapPin size={19}/></div><span><strong>Live Tracking</strong><small>Lihat posisi driver di peta</small></span><ChevronRight size={17}/></button><button onClick={()=>navigate("chat")}><div className="quick-icon purple-bg"><MessageSquare size={19}/></div><span><strong>Chat Driver</strong><small>Koordinasi pesanan aktif</small></span><ChevronRight size={17}/></button></div><div className="card account-card"><div className="account-icon"><ShieldCheck size={22}/></div><strong>Role: {profile.role}</strong><p>{profile.role==="driver"?"Buka pesanan dan terima tugas sebelum mengirim GPS.":profile.role==="customer"?"Buat pesanan, pilih driver, dan pantau lokasi.":"Akses semua pesanan dan penugasan driver."}</p></div></div></div>
          </>}
          {view==="orders"&&<><div className="page-heading"><div><div className="overline">DELIVERY MANAGEMENT</div><h1>Pengiriman</h1><p className="text-muted">Kelola, lacak, dan pantau seluruh pesanan.</p></div>{customerCanCreate&&<button className="primary-btn" onClick={()=>setShowCreate(true)}><PackagePlus size={17}/> Buat Pengiriman</button>}</div><div className="card order-list-card"><div className="list-tools"><div className="search-field"><Search size={17}/><input aria-label="Cari pesanan" placeholder="Cari ID, alamat, atau paket..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="select-field"><select aria-label="Filter status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option>{Object.entries(statusLabel).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select><ChevronDown size={16}/></div><button className="refresh-btn" onClick={()=>void refresh()} title="Refresh"><RefreshCw size={17}/></button></div><OrderTable orders={filtered} profiles={profiles} click={openOrder}/><div className="table-footer">Menampilkan {filtered.length} dari {orders.length} pesanan (maksimal 200 terbaru).</div></div></>}
          {view==="drivers"&&<><div className="page-heading"><div><div className="overline">DRIVER DIRECTORY</div><h1>Daftar Driver</h1><p className="text-muted">Akun driver terdaftar yang dapat dipilih untuk pengiriman.</p></div><div className="info-counter"><Users size={18}/>{drivers.length} Driver</div></div><div className="driver-grid">{drivers.length?drivers.map((driver,i)=><div className="card driver-list-card" key={driver.id}><div className={`driver-profile-avatar tone-${i%4}`}>{initials(driver.display_name)}</div><strong>{driver.display_name}</strong><span>Verified role: Driver</span><div className="driver-card-footer"><div className="green-dot"/> Terdaftar <span>{new Date(driver.created_at).toLocaleDateString("id-ID")}</span></div></div>):<div className="card empty-card"><Users size={30}/><h3>Belum ada driver</h3><p>Daftar akun kedua dengan role Driver untuk mencoba demo.</p></div>}</div></>}
          {(view==="tracking"||view==="chat")&&!selected&&<div className="card empty-card full-empty"><MapPin size={34}/><h2>Belum ada pengiriman untuk ditampilkan</h2><p>{profile.role==="customer"?"Buat pengiriman dan pilih driver terlebih dahulu.":"Tunggu sampai ada pesanan yang ditugaskan ke akun ini."}</p>{customerCanCreate&&<button className="primary-btn" onClick={()=>setShowCreate(true)}>Buat Pengiriman</button>}</div>}
        </>}
        {dataError&&<div className="floating-error" role="alert">Gagal memuat data: {dataError}<button onClick={()=>setDataError("")} aria-label="Tutup"><X size={16}/></button></div>}
      </main>
    </div>
    {showCreate&&customerCanCreate&&<CreateOrderModal me={profile} drivers={drivers} close={()=>setShowCreate(false)} created={createDone}/>} 
  </div>;
}

function Metric({icon:Icon,label,value,detail,color,trend}: {icon:typeof Package;label:string;value:number;detail:string;color:string;trend:string}){
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${color}`}><Icon size={21}/></span><span className="metric-chip">{trend==="Live"?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {trend}</span></div><div className="metric-number">{value.toLocaleString("id-ID")}</div><strong>{label}</strong><small>{detail}</small></div>;
}
function OrderTable({orders,profiles,click,compact=false}:{orders:Order[];profiles:Profile[];click:(id:string,tab?:View)=>void;compact?:boolean}){
  const lookup=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||"Belum ada driver";
  if(!orders.length)return <div className="empty-table"><div><Package size={27}/></div><h3>Belum ada pesanan</h3><p>Buat pesanan pertama atau tunggu pengiriman ditugaskan.</p></div>;
  return <div className="table-scroll"><table className="orders-table"><thead><tr><th>ORDER ID</th><th>RUTE / PAKET</th><th>DRIVER</th><th>STATUS</th>{!compact&&<th>DIBUAT</th>}<th/></tr></thead><tbody>{orders.map(order=><tr key={order.id} onClick={()=>click(order.id)} tabIndex={0} role="button" onKeyDown={e=>{if(e.key==="Enter")click(order.id);}}><td><strong className="order-code">{order.tracking_code}</strong></td><td><div className="route-cell"><strong>{order.item_description}</strong><span>{order.pickup_address} → {order.delivery_address}</span></div></td><td><div className="driver-table"><div className="tiny-avatar">{lookup(order.driver_id).charAt(0)}</div><span>{lookup(order.driver_id)}</span></div></td><td><span className={`status-pill ${statusTone[order.status]}`}>{statusLabel[order.status]}</span></td>{!compact&&<td className="date-cell">{niceDate(order.created_at)}</td>}<td><button className="table-open" aria-label={`Lihat ${order.tracking_code}`} onClick={e=>{e.stopPropagation();click(order.id);}}><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>;
}
