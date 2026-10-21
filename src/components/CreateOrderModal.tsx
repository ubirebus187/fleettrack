"use client";
import { useState } from "react";
import { ArrowRight, PackagePlus, X } from "lucide-react";
import { db } from "@/lib/supabase";
import type { Order, Profile } from "@/lib/types";

type Props={ me:Profile; drivers:Profile[]; close:()=>void; created:(order:Order)=>void; };
export default function CreateOrderModal({me,drivers,close,created}:Props) {
  const [pickup,setPickup]=useState("");
  const [delivery,setDelivery]=useState("");
  const [description,setDescription]=useState("");
  const [driverId,setDriverId]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");
    const {data,error}=await db().from("orders").insert({customer_id:me.id,driver_id:driverId||null,pickup_address:pickup.trim(),delivery_address:delivery.trim(),item_description:description.trim()}).select().single();
    if(error) setError(error.message); else created(data as Order);
    setBusy(false);
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-order-title"><div className="modal-head"><div className="modal-title-icon"><PackagePlus size={24}/></div><button className="icon-btn" onClick={close} aria-label="Tutup"><X size={20}/></button></div>
    <h2 id="new-order-title">Buat pengiriman baru</h2><p className="text-muted">Masukkan detail paket. Pilih driver untuk mengaktifkan alur tracking dan live chat.</p>
    <form className="form-stack" onSubmit={submit}>
      <label>Alamat penjemputan<textarea required minLength={3} maxLength={240} rows={2} value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Jl. Sudirman No. 10, Jakarta Pusat"/></label>
      <label>Alamat pengantaran<textarea required minLength={3} maxLength={240} rows={2} value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="Jl. Kemang Raya No. 12, Jakarta Selatan"/></label>
      <label>Deskripsi paket<input required minLength={3} maxLength={240} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Dokumen, barang elektronik, dll."/></label>
      <label>Driver (opsional)<select value={driverId} onChange={e=>setDriverId(e.target.value)}><option value="">Belum ditugaskan</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.display_name}</option>)}</select></label>
      {drivers.length===0&&<div className="hint">Belum ada akun driver. Daftar akun kedua dengan peran Driver terlebih dahulu.</div>}
      {error&&<div className="form-alert error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Batal</button><button type="submit" className="primary-btn" disabled={busy}>{busy?"Menyimpan...":"Buat pesanan"}<ArrowRight size={16}/></button></div>
    </form></div></div>;
}
