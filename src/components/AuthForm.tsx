"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, LockKeyhole, MapPin, MessageSquareText, ShieldCheck, Truck } from "lucide-react";
import { db } from "@/lib/supabase";
import type { Role } from "@/lib/types";

export default function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [role, setRole] = useState<Extract<Role,"customer"|"driver">>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (signup) {
        const { data, error } = await db().auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim(), requested_role: role } }
        });
        if (error) throw error;
        if (!data.session) setNotice("Pendaftaran dikirim. Cek email dan klik tautan konfirmasi, lalu masuk.");
      } else {
        const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }

  return <div className="auth-page">
    <div className="auth-hero">
      <div className="auth-grid" />
      <div className="brand brand-light"><div className="brand-mark"><Truck size={24} strokeWidth={2.6}/></div><div><b>fleettrack</b><small>LOGISTICS OS</small></div></div>
      <div className="auth-hero-content">
        <div className="eyebrow"><CircleDot size={14} /> NEXT-GEN LOGISTICS PLATFORM</div>
        <h1>Semua pengiriman.<br/><em>Dalam satu kendali.</em></h1>
        <p>Pantau lokasi kurir secara langsung, kelola pesanan dengan mudah, dan terhubung melalui live chat.</p>
        <div className="feature-pills"><span><MapPin size={15}/> Live GPS</span><span><MessageSquareText size={15}/> Driver chat</span><span><ShieldCheck size={15}/> Secure access</span></div>
      </div>
      <div className="auth-bottom"><div className="pulse-dot" /> REAL-TIME OPERATIONS <span>Built for your portfolio</span></div>
    </div>
    <div className="auth-form-wrap"><div className="auth-panel">
      <div className="auth-mobile-brand"><Truck size={21}/> fleettrack</div>
      <div className="overline">WELCOME TO FLEETTRACK</div>
      <h2>{signup ? "Buat akun baru" : "Masuk ke dashboard"}</h2>
      <p className="text-muted intro">{signup ? "Daftar sebagai pelanggan atau driver untuk mencoba alur pengiriman." : "Kelola operasional dan lacak pengiriman di satu tempat."}</p>
      <div className="auth-tabs"><button type="button" className={!signup ? "active" : ""} onClick={() => {setSignup(false);setError("");setNotice("");}}>Masuk</button><button type="button" className={signup ? "active" : ""} onClick={() => {setSignup(true);setError("");setNotice("");}}>Daftar</button></div>
      <form onSubmit={submit} className="form-stack">
        {signup && <><label>Nama lengkap<input autoComplete="name" minLength={2} maxLength={80} required value={name} onChange={e=>setName(e.target.value)} placeholder="Nama Anda" /></label><label>Daftar sebagai</label><div className="role-grid"><button type="button" onClick={()=>setRole("customer")} className={role==="customer"?"selected":""}><span>Pelanggan</span><small>Buat dan lacak pesanan</small></button><button type="button" onClick={()=>setRole("driver")} className={role==="driver"?"selected":""}><span>Driver</span><small>Terima tugas & bagikan lokasi</small></button></div></>}
        <label>Alamat email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" /></label>
        <label>Password<input type="password" autoComplete={signup?"new-password":"current-password"} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter" /></label>
        {error && <div role="alert" className="form-alert error">{error}</div>}
        {notice && <div role="status" className="form-alert success"><CheckCircle2 size={16}/>{notice}</div>}
        <button className="primary-btn wide" type="submit" disabled={busy}>{busy ? "Memproses..." : signup ? "Buat akun" : "Masuk dashboard"}<ArrowRight size={17}/></button>
      </form>
      <div className="auth-tip"><LockKeyhole size={14}/> Login dengan Supabase Auth. Tidak ada password contoh yang disimpan dalam source code.</div>
    </div></div>
  </div>;
}
