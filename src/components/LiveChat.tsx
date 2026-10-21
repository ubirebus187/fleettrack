"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, Radio } from "lucide-react";
import { db } from "@/lib/supabase";
import { initials } from "@/lib/utils";
import type { ChatMessage, Profile } from "@/lib/types";

type Props = { orderId: string; me: Profile; profiles: Profile[]; enabled: boolean };
export default function LiveChat({orderId, me, profiles, enabled}: Props) {
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [draft,setDraft] = useState("");
  const [error,setError] = useState("");
  const [sending,setSending] = useState(false);
  const [connected,setConnected] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let mounted = true;
    const supabase = db();
    const load = async () => {
      const {data,error} = await supabase.from("messages").select("*").eq("order_id",orderId).order("created_at",{ascending:true}).limit(200);
      if (!mounted) return;
      if (error) setError(error.message); else setMessages((data || []) as ChatMessage[]);
    };
    void load();
    const channel = supabase.channel(`chat-${orderId}-${me.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`order_id=eq.${orderId}`},payload=>{
        const incoming=payload.new as ChatMessage;
        setMessages(prev=>prev.some(m=>m.id===incoming.id)?prev:[...prev,incoming]);
      }).subscribe(status=>setConnected(status === "SUBSCRIBED"));
    return ()=>{mounted=false;setConnected(false);void supabase.removeChannel(channel);};
  },[orderId,me.id]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth",block:"end"});},[messages.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); const body=draft.trim(); if(!body || sending || !enabled) return;
    setSending(true);setError("");
    const {data,error} = await db().from("messages").insert({order_id:orderId,sender_id:me.id,body}).select().single();
    if (error) setError(error.message); else {setDraft("");if(data) setMessages(prev=>prev.some(m=>m.id===data.id)?prev:[...prev,data as ChatMessage]);}
    setSending(false);
  }
  const nameFor=(id:string)=>profiles.find(x=>x.id===id)?.display_name || (id===me.id?me.display_name:"Pengguna");
  return <div className="chat-card"><div className="chat-head"><div className="section-icon"><MessageCircle size={19}/></div><div><strong>Live chat</strong><small>Customer ↔ Driver ↔ Admin</small></div><span className={`connection ${connected?"online":""}`}><Radio size={11}/>{connected?"Live":"Connecting"}</span></div>
    <div className="chat-history">
      {messages.length===0 && <div className="chat-blank"><MessageCircle size={27}/><b>Belum ada pesan</b><span>Mulai percakapan untuk koordinasi pengiriman.</span></div>}
      {messages.map(message=>{ const mine=message.sender_id===me.id;return <div key={message.id} className={`chat-line ${mine?"mine":""}`}>{!mine&&<div className="chat-avatar">{initials(nameFor(message.sender_id))}</div>}<div className="chat-bubble-wrap">{!mine&&<small>{nameFor(message.sender_id)}</small>}<div className="chat-bubble">{message.body}</div><time>{new Date(message.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</time></div></div>;})}
      <div ref={bottom}/>
    </div>
    {error&&<div className="chat-error" role="alert">{error}</div>}
    <form onSubmit={send} className="chat-send"><input aria-label="Tulis pesan" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1500} disabled={!enabled} placeholder={enabled?"Ketik pesan...":"Chat aktif setelah driver ditugaskan"}/><button aria-label="Kirim pesan" type="submit" disabled={!enabled||!draft.trim()||sending}><ArrowUp size={20}/></button></form>
  </div>;
}
