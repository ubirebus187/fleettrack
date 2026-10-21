"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Copy, MapPin, Navigation, Package, Route, UserRound, XCircle } from "lucide-react";
import type { DriverLocation, Order, Profile } from "@/lib/types";
import { statusLabel, statusTone } from "@/lib/types";
import { db } from "@/lib/supabase";
import { niceDate } from "@/lib/utils";
import TrackingMap from "./TrackingMap";
import LiveChat from "./LiveChat";
import DriverControls from "./DriverControls";

type Props={order:Order;me:Profile;profiles:Profile[];back:()=>void;refresh:()=>void};
const stages=["pending","accepted","picked_up","on_the_way","delivered"] as const;
export default function OrderDetails({order,me,profiles,back,refresh}:Props){
  const [location,setLocation]=useState<DriverLocation|null>(null);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    let mounted=true;
    const client=db();
    async function load(){
      const {data}=await client.from("driver_locations").select("*").eq("order_id",order.id).maybeSingle();
      if(mounted)setLocation(data as DriverLocation|null);
    }
    void load();
    const channel=client.channel(`location-${order.id}-${me.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"driver_locations",filter:`order_id=eq.${order.id}`},payload=>{
        if(payload.eventType==="DELETE")setLocation(null);else setLocation(payload.new as DriverLocation);
      }).subscribe();
    return ()=>{mounted=false;void client.removeChannel(channel);};
  },[order.id,me.id]);
  useEffect(()=>{
    setLocation(null);
  },[order.driver_id]);
  useEffect(()=>{
    if(order.status === "delivered" || order.status === "cancelled")setLocation(null);
  },[order.status]);
  async function assignDriver(id:string){
    setSaving(true);setError("");
    const {error}=await db().from("orders").update({driver_id:id||null}).eq("id",order.id);
    if(error)setError(error.message);else refresh();
    setSaving(false);
  }
  async function cancelOrder(){
    if(!window.confirm("Batalkan pesanan yang masih menunggu?"))return;
    setSaving(true);setError("");
    const {error}=await db().rpc("customer_cancel_order",{p_order_id:order.id});
    if(error)setError(error.message);else refresh();
    setSaving(false);
  }
  const nameFor=(id:string|null)=>profiles.find(p=>p.id===id)?.display_name||"Belum ditugaskan";
  const stepIdx=stages.indexOf(order.status as (typeof stages)[number]);
  const driver=profiles.find(p=>p.id===order.driver_id);
  return <div className="details-page">
    <button className="breadcrumb" onClick={back}><ArrowLeft size={16}/> Kembali ke daftar pesanan</button>
    <div className="details-heading"><div><div className="overline">ORDER DETAILS / {order.tracking_code}</div><h1>Tracking Pengiriman</h1><p className="text-muted">Pantau progres dan koordinasi pengiriman dalam satu halaman.</p></div><div className="heading-actions"><button type="button" className="copy-btn" onClick={()=>navigator.clipboard.writeText(order.tracking_code)}><Copy size={15}/> Salin ID</button><span className={`status-pill ${statusTone[order.status]}`}>{statusLabel[order.status]}</span></div></div>
    <div className="detail-main">
      <div className="detail-left">
        <div className="card map-card"><div className="card-top"><div><h3>Lokasi Driver</h3><p>Pemantauan posisi terakhir yang dibagikan driver</p></div><span className="live-indicator"><span/> LIVE MAP</span></div><TrackingMap location={location}/><div className="map-footer"><MapPin size={15}/>{location?<span>Update terakhir: {niceDate(location.updated_at)} · {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>:<span>Menunggu driver membagikan lokasi</span>}</div></div>
        <div className="card shipment-card"><div className="card-top"><div><h3>Detail Pengiriman</h3><p>Informasi paket dan tujuan pengiriman</p></div><Package size={19}/></div>
          <div className="delivery-route"><div className="route-icons"><div className="route-start"/><div className="route-line"/><div className="route-end"/></div><div className="route-details"><div><small>ALAMAT PICKUP</small><strong>{order.pickup_address}</strong></div><div><small>ALAMAT PENGIRIMAN</small><strong>{order.delivery_address}</strong></div></div></div>
          <div className="shipment-meta"><div><Package size={16}/><span>{order.item_description}</span></div><div><CalendarDays size={16}/><span>{niceDate(order.created_at)}</span></div><div><UserRound size={16}/><span>{driver?.display_name||"Driver belum dipilih"}</span></div></div>
        </div>
        <div className="card progress-card"><div className="card-top"><div><h3>Progress Pengiriman</h3><p>Status otomatis tersinkronisasi melalui Supabase Realtime</p></div><Route size={20}/></div><div className="steps">{stages.map((stage,index)=><div className={`step ${stepIdx>=index?"done":""}`} key={stage}><span className="step-dot">{stepIdx>=index?<CheckCircle2 size={18}/>:<Clock3 size={17}/>}</span><div><strong>{statusLabel[stage]}</strong><small>{index===0?"Pesanan dibuat":index===1?"Driver menerima pekerjaan":index===2?"Paket diambil dari pengirim":index===3?"Driver mengantar ke tujuan":"Paket diterima"}</small></div></div>)}</div>{order.status==="cancelled"&&<p className="cancelled-note"><XCircle size={16}/> Pesanan telah dibatalkan.</p>}</div>
      </div>
      <div className="detail-right">
        <div className="card driver-card"><div className="card-top"><div><h3>Informasi Driver</h3><p>Kurir yang menangani pesanan</p></div><Navigation size={19}/></div><div className="driver-mini"><div className="driver-big-avatar">{driver?.display_name.charAt(0).toUpperCase()||"?"}</div><div><strong>{nameFor(order.driver_id)}</strong><small>{order.driver_id?"Assigned driver":"Belum ada driver"}</small></div></div>
          {me.role==="admin"&&<label className="driver-assign">Atur penugasan<select disabled={saving} value={order.driver_id||""} onChange={e=>void assignDriver(e.target.value)}><option value="">Tidak ada driver</option>{profiles.filter(p=>p.role==="driver").map(d=><option value={d.id} key={d.id}>{d.display_name}</option>)}</select></label>}
          {error&&<div className="form-alert error" role="alert">{error}</div>}
          {me.role==="customer"&&order.status==="pending"&&<button className="text-danger-btn" onClick={()=>void cancelOrder()} disabled={saving}>Batalkan pesanan</button>}
        </div>
        {me.role==="driver"&&order.driver_id===me.id&&<div className="card"><DriverControls order={order} refresh={refresh}/></div>}
        <LiveChat key={order.id} orderId={order.id} me={me} profiles={profiles} enabled={Boolean(order.driver_id)}/>
      </div>
    </div>
  </div>;
}
