import { useEffect,useRef,useState } from 'react'
import { acceptOffer,supabase } from './supabase'

type Match={booking_id:string;service_name:string;category_name?:string;request_type?:string;market_city?:string;market_state?:string;customer_total?:number;estimated_provider_payout?:number;distance_miles?:number|null;eta_minutes?:number|null;match_score?:number|null}
const money=(v?:number)=>`$${Number(v||0).toFixed(2)}`

export default function ProviderMatchHost(){
 const[item,setItem]=useState<Match|null>(null),[busy,setBusy]=useState(''),[notice,setNotice]=useState('')
 const[permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission)
 const lastNotified=useRef<string>('')
 const announce=(next:Match|null)=>{
   if(!next||typeof Notification==='undefined'||Notification.permission!=='granted'||lastNotified.current===next.booking_id)return
   lastNotified.current=next.booking_id
   const n=new Notification(`ON CALL · ${Math.round(Number(next.match_score||0))}% match`,{
     body:`${next.service_name} · ${next.distance_miles==null?'nearby':`${Number(next.distance_miles).toFixed(1)} mi`} · est. ${money(next.estimated_provider_payout)}`,
     tag:`oc-offer-${next.booking_id}`,icon:'/favicon.svg',requireInteraction:true,
   })
   n.onclick=()=>{window.focus();n.close()}
 }
 const load=async()=>{const{data,error}=await supabase.rpc('oc_provider_opportunities');if(error){setItem(null);return}const next=(data?.[0]||null) as Match|null;setItem(next);announce(next)}
 useEffect(()=>{let disposed=false;const run=async()=>{if(disposed)return;await load()};run();const onFocus=()=>run();window.addEventListener('focus',onFocus);const t=window.setInterval(run,8000);return()=>{disposed=true;clearInterval(t);window.removeEventListener('focus',onFocus)}},[])
 const accept=async()=>{if(!item||busy)return;setBusy('accept');try{await acceptOffer(item.booking_id);setNotice('Accepted. The job is now in your active Jobs queue.');setItem(null);window.dispatchEvent(new Event('focus'));setTimeout(()=>setNotice(''),4200)}catch(e){setNotice(e instanceof Error?e.message:'That opportunity is no longer available.');await load()}finally{setBusy('')}}
 const decline=async()=>{if(!item||busy)return;setBusy('decline');const{error}=await supabase.rpc('oc_provider_decline_opportunity',{p_booking_id:item.booking_id,p_reason:'Provider declined from match card'});if(error)setNotice(error.message);else{setNotice('Passed. Finding your next best match…');await load();setTimeout(()=>setNotice(''),2600)}setBusy('')}
 const enable=async()=>{if(typeof Notification==='undefined')return;const result=await Notification.requestPermission();setPermission(result);if(result==='granted'){setNotice('Best-match alerts are on.');announce(item)}}
 if(!item&&!notice&&permission!=='default')return null
 return <div style={{position:'fixed',left:'50%',transform:'translateX(-50%)',top:82,zIndex:1325,width:'min(520px,calc(100vw - 28px))'}}>
  {permission==='default'&&<button type="button" onClick={enable} style={{display:'block',margin:'0 auto 8px',border:0,borderRadius:999,padding:'9px 12px',background:'#0b1727',color:'#fff',fontSize:9,fontWeight:900,letterSpacing:'.08em',boxShadow:'0 12px 34px rgba(0,0,0,.25)'}}>ENABLE NEW JOB ALERTS</button>}
  {item&&<section style={{borderRadius:22,padding:16,background:'rgba(9,20,34,.97)',color:'#fff',boxShadow:'0 24px 80px rgba(0,0,0,.38)',border:'1px solid rgba(91,188,255,.22)',backdropFilter:'blur(18px)'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start'}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.14em',color:'#5bbcff'}}>BEST MATCH · {Math.round(Number(item.match_score||0))}%</small><strong style={{display:'block',fontSize:17,marginTop:5}}>{item.service_name}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.64)'}}>{item.category_name||'ON CALL service'} · {[item.market_city,item.market_state].filter(Boolean).join(', ')||'Your service area'}</span></div><div style={{textAlign:'right'}}><strong style={{display:'block',fontSize:22}}>{money(item.estimated_provider_payout)}</strong><small style={{fontSize:8,letterSpacing:'.1em',color:'rgba(255,255,255,.5)'}}>EST. PAYOUT</small></div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:14}}><div style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.06)'}}><small style={{fontSize:8,color:'rgba(255,255,255,.5)'}}>DISTANCE</small><b style={{display:'block',fontSize:12,marginTop:2}}>{item.distance_miles==null?'Nearby':`${Number(item.distance_miles).toFixed(1)} mi`}</b></div><div style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.06)'}}><small style={{fontSize:8,color:'rgba(255,255,255,.5)'}}>ETA</small><b style={{display:'block',fontSize:12,marginTop:2}}>{item.eta_minutes?`${item.eta_minutes} min`:'After GPS'}</b></div><div style={{padding:10,borderRadius:12,background:'rgba(255,255,255,.06)'}}><small style={{fontSize:8,color:'rgba(255,255,255,.5)'}}>TYPE</small><b style={{display:'block',fontSize:12,marginTop:2,textTransform:'capitalize'}}>{(item.request_type||'on demand').replaceAll('_',' ')}</b></div></div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1.7fr',gap:8,marginTop:12}}><button type="button" onClick={decline} disabled={!!busy} style={{border:'1px solid rgba(255,255,255,.14)',borderRadius:13,padding:12,background:'transparent',color:'#fff',fontWeight:800,cursor:'pointer'}}>{busy==='decline'?'Passing…':'Decline'}</button><button type="button" onClick={accept} disabled={!!busy} style={{border:0,borderRadius:13,padding:12,background:'#1a6bff',color:'#fff',fontWeight:900,cursor:'pointer'}}>{busy==='accept'?'Accepting…':'Accept best match'}</button></div>
  </section>}
  {notice&&<div role="status" style={{marginTop:8,padding:'10px 13px',borderRadius:13,background:'#111827',color:'#fff',fontSize:11,boxShadow:'0 12px 40px rgba(0,0,0,.3)'}}>{notice}</div>}
 </div>
}
