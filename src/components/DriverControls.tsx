"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, MapPin, Navigation, Play, RadioTower, Square, Truck } from "lucide-react";
import { db } from "@/lib/supabase";
import { stepAfter, statusLabel, type Order, type OrderStatus } from "@/lib/types";

type Props={order:Order; refresh:()=>void};
const simRoute:[number,number][]=[
  [-6.2070,106.8166],[-6.2089,106.8213],[-6.2110,106.8265],[-6.2135,106.8315],
  [-6.2175,106.8341],[-6.2220,106.8370],[-6.2263,106.8430],[-6.2310,106.8488],
  [-6.2357,106.8517],[-6.2411,106.8553],[-6.2466,106.8584]
];
export default function DriverControls({order,refresh}:Props){
  const [tracking,setTracking]=useState<"off"|"gps"|"demo">("off");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const watchId=useRef<number|null>(null);
  const timerId=useRef<ReturnType<typeof setInterval>|null>(null);
  const last=useRef(0);
  const index=useRef(0);
  const active=["accepted","picked_up","on_the_way"].includes(order.status);
  const sendCoords=useCallback(async(latitude:number,longitude:number)=>{
    if(Date.now()-last.current<1500)return;
    last.current=Date.now();
    const {error}=await db().from("driver_locations").upsert({order_id:order.id,driver_id:order.driver_id,latitude,longitude},{onConflict:"order_id"});
    if(error)setError(`Lokasi gagal dikirim: ${error.message}`);
    else setSuccess(`Lokasi terkirim ${new Date().toLocaleTimeString("id-ID")}`);
  },[order.id,order.driver_id]);
  function stop(){
    if(watchId.current!==null){navigator.geolocation.clearWatch(watchId.current);watchId.current=null;}
    if(timerId.current){clearInterval(timerId.current);timerId.current=null;}
    setTracking("off");
  }
  useEffect(()=>()=>{
    if(watchId.current!==null && typeof navigator!=="undefined" && navigator.geolocation)navigator.geolocation.clearWatch(watchId.current);
    if(timerId.current)clearInterval(timerId.current);
  },[]);
  useEffect(()=>{if(!active)stop();},[active]);
  function startGps(){
    stop();setError("");setSuccess("");
    if(!navigator.geolocation){setError("GPS tidak didukung oleh browser ini.");return;}
    watchId.current=navigator.geolocation.watchPosition(
      loc=>{void sendCoords(loc.coords.latitude,loc.coords.longitude);},
      e=>{setError(`GPS: ${e.message}`);stop();},
      {enableHighAccuracy:true,maximumAge:2000,timeout:15000}
    );
    setTracking("gps");
  }
  function startDemo(){
    stop();setError("");setSuccess("");index.current=0;
    const tick=()=>{const [lat,lng]=simRoute[index.current%simRoute.length];index.current++;void sendCoords(lat,lng);};
    tick();timerId.current=setInterval(tick,3000);setTracking("demo");
  }
  async function updateStatus(next:OrderStatus){
    if(next === "delivered" && tracking!=="off")stop();
    setBusy(true);setError("");
    const {error}=await db().rpc("driver_update_status",{p_order_id:order.id,p_status:next});
    if(error)setError(error.message);else refresh();
    setBusy(false);
  }
  const next=stepAfter[order.status];
  return <div className="driver-control-panel">
    <div className="driver-panel-title"><Truck size={20}/><div><strong>Panel driver</strong><small>Ubah status & bagikan lokasi secara sukarela</small></div></div>
    {next&&<button onClick={()=>void updateStatus(next)} disabled={busy} className="primary-btn wide"><Check size={17}/>{busy?"Memproses...":`Tandai: ${statusLabel[next]}`}</button>}
    {order.status==="delivered"&&<p className="hint"><Check size={15}/> Pengantaran telah selesai.</p>}
    {active&&<><div className="tracking-toolbar"><div><b>Live location</b><small>{tracking==="off"?"Tracking nonaktif":tracking==="gps"?"GPS asli sedang dibagikan":"Simulasi lokasi sedang berjalan"}</small></div><span className={`tracking-dot ${tracking!=="off"?"running":""}`}/></div>
      <div className="driver-buttons">{tracking==="off"?<><button className="outline-btn" onClick={startGps}><Navigation size={15}/> Gunakan GPS</button><button className="outline-btn" onClick={startDemo}><Play size={15}/> Demo route</button></>:<button className="stop-btn" onClick={stop}><Square size={14}/> Hentikan lokasi</button>}</div>
      <p className="privacy-note"><RadioTower size={15}/> GPS hanya dikirim setelah Anda memilih “Gunakan GPS”. Lokasi dapat dilihat oleh customer pesanan dan admin.</p>
    </>}
    {error&&<p className="form-alert error" role="alert"><AlertTriangle size={15}/>{error}</p>}
    {!error&&success&&tracking!=="off"&&<p className="location-success"><MapPin size={14}/>{success}</p>}
  </div>;
}
