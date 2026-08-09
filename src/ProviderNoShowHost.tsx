import { useEffect,useState } from 'react'
import { supabase } from './supabase'

type Job={id:string;service_name:string;status:string;arrived_at?:string|null}
type Quote={canSettle:boolean;secondsRemaining:number;waitMinutes:number;feeAmount:number;providerCompensation:number}
const clock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`

export default function ProviderNoShowHost(){
 const[job,setJob]=useState<Job|null>(null),[quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const load=async()=>{
  const{data:{session}}=await supabase.auth.getSession();if(!session?.user){setJob(null);setQuote(null);return}
  const{data:u}=await supabase.from('oc_users').select('id,role').eq('auth_id',session.user.id).maybeSingle();if(!u||u.role!=='provider'){setJob(null);setQuote(null);return}
  const{data:p}=await supabase.from('oc_provider_profiles').select('id').eq('user_id',u.id).maybeSingle();if(!p){setJob(null);setQuote(null);return}
  const{data:rows}=await supabase.from('oc_bookings').select('id,service_name,status,arrived_at').eq('provider_id',p.id).eq('status','on_site').order('arrived_at',{ascending:false}).limit(1)
  const next=(rows?.[0]||null) as Job|null;setJob(next)
  if(!next){setQuote(null);return}
  const{data,error}=await supabase.functions.invoke('oc-customer-no-show',{body:{bookingId:next.id,action:'quote'}})
  if(!error&&!data?.error)setQuote(data as Quote)
 }
 useEffect(()=>{let disposed=false;const run=()=>{if(!disposed)load().catch(()=>{})};run();const t=window.setInterval(run,5000);return()=>{disposed=true;window.clearInterval(t)}},[])
 const settle=async()=>{
  if(!job||!quote?.canSettle||busy)return
  if(!window.confirm(`Close this job as a customer no-show?\n\nON CALL will capture a $${Number(quote.feeAmount||0).toFixed(2)} no-show fee. Your compensation is $${Number(quote.providerCompensation||0).toFixed(2)}.`))return
  setBusy(true);setNotice('')
  const{data,error}=await supabase.functions.invoke('oc-customer-no-show',{body:{bookingId:job.id,action:'settle',expectedFeeAmount:Number(quote.feeAmount||0)}})
  setBusy(false)
  if(error||data?.error)setNotice(data?.error||error?.message||'No-show settlement failed.')
  else{setNotice(`Customer no-show recorded. $${Number(data.providerCompensation||0).toFixed(2)} compensation is processing.`);setJob(null);setQuote(null);window.dispatchEvent(new Event('focus'))}
  window.setTimeout(()=>setNotice(''),5000)
 }
 if(!job&&!notice)return null
 const remaining=Math.max(0,Math.ceil(Number(quote?.secondsRemaining||0)))
 return <div style={{position:'fixed',left:18,bottom:190,zIndex:1280,display:'grid',gap:7}}>
  {job&&quote&&!quote.canSettle&&<div style={{padding:'10px 13px',borderRadius:999,background:'rgba(11,23,39,.95)',color:'#fff',border:'1px solid rgba(255,255,255,.12)',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}>CUSTOMER NO-SHOW · {clock(remaining)}</div>}
  {job&&quote?.canSettle&&<button type="button" onClick={settle} disabled={busy} style={{border:'1px solid rgba(255,183,71,.35)',borderRadius:999,padding:'10px 13px',background:'#34230a',color:'#ffdca5',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)',cursor:'pointer'}}>{busy?'SETTLING…':`CUSTOMER NO-SHOW · $${Number(quote.providerCompensation||0).toFixed(2)} COMP`}</button>}
  {notice&&<div role="status" style={{maxWidth:330,padding:'10px 12px',borderRadius:12,background:'#111827',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}>{notice}</div>}
 </div>
}
