import { useEffect } from 'react'
import { supabase } from './supabase'

const CONFIG='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-push-config'
const toBytes=(value:string)=>{const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

export default function PushSubscriptionHost(){
 useEffect(()=>{
  let disposed=false
  const sync=async()=>{
   if(disposed||typeof window==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined'||Notification.permission!=='granted')return
   const{data:{session}}=await supabase.auth.getSession();if(!session?.user)return
   const{data:u}=await supabase.from('oc_users').select('id,status').eq('auth_id',session.user.id).maybeSingle();if(!u||u.status!=='active')return
   const r=await fetch(CONFIG,{cache:'no-store'});const cfg=await r.json().catch(()=>({}));if(!r.ok||!cfg.ready||!cfg.publicKey)return
   const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(cfg.publicKey)})
   const j=sub.toJSON();if(!j.endpoint||!j.keys?.p256dh||!j.keys?.auth)return
   await supabase.rpc('marketplace_register_push_subscription',{p_app:'on_call',p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_user_agent:navigator.userAgent})
  }
  sync().catch(()=>{})
  const t=window.setInterval(()=>sync().catch(()=>{}),30000)
  const focus=()=>sync().catch(()=>{});window.addEventListener('focus',focus);window.addEventListener('online',focus)
  const{data}=supabase.auth.onAuthStateChange(()=>setTimeout(()=>sync().catch(()=>{}),200))
  return()=>{disposed=true;clearInterval(t);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);data.subscription.unsubscribe()}
 },[])
 return null
}
