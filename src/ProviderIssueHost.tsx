import { useEffect,useState } from 'react'
import { supabase } from './supabase'

type Job={id:string;service_name:string;status:string;arrived_at?:string|null}
type NoShowQuote={canSettle?:boolean;remainingMinutes?:number;waitMinutes?:number;fee?:number;providerCompensation?:number;reason?:string}

export default function ProviderIssueHost(){
 const[job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[noShow,setNoShow]=useState<NoShowQuote|null>(null)
 const load=async()=>{
  const{data:{session}}=await supabase.auth.getSession();if(!session?.user)return
  const{data:u}=await supabase.from('oc_users').select('id,role').eq('auth_id',session.user.id).maybeSingle();if(!u||u.role!=='provider')return
  const{data:p}=await supabase.from('oc_provider_profiles').select('id').eq('user_id',u.id).maybeSingle();if(!p)return
  const{data:rows}=await supabase.from('oc_bookings').select('id,service_name,status,arrived_at').eq('provider_id',p.id).in('status',['assigned','en_route','on_site','working']).order('accepted_at',{ascending:false}).limit(1)
  const next=(rows?.[0]||null) as Job|null;setJob(next)
  if(next?.status==='on_site'){
    const{data}=await supabase.functions.invoke('oc-customer-no-show',{body:{bookingId:next.id,action:'quote'}})
    setNoShow(data?.error?null:data as NoShowQuote)
  }else setNoShow(null)
 }
 useEffect(()=>{let disposed=false;const run=()=>{if(!disposed)load().catch(()=>{})};run();const onFocus=()=>run();window.addEventListener('focus',onFocus);const t=window.setInterval(run,10000);return()=>{disposed=true;clearInterval(t);window.removeEventListener('focus',onFocus)}},[])
 const settleNoShow=async()=>{
  if(!job||job.status!=='on_site'||busy)return
  const quote=noShow
  if(!quote?.canSettle){setNotice(quote?.reason||'No-show settlement is not ready yet.');return}
  const fee=Number(quote.fee||0),comp=Number(quote.providerCompensation||0)
  if(!window.confirm(`Mark this customer as a no-show?\n\nA $${fee.toFixed(2)} no-show fee will be captured. $${comp.toFixed(2)} is allocated to your provider compensation.`))return
  setBusy('noshow');setNotice('')
  const{data,error}=await supabase.functions.invoke('oc-customer-no-show',{body:{bookingId:job.id,action:'settle'}})
  setBusy('')
  if(error||data?.error)setNotice(data?.error||error?.message||'No-show settlement failed.')
  else{setNotice(`No-show settled. $${Number(data.providerCompensation||0).toFixed(2)} allocated to your compensation.`);setJob(null);setNoShow(null);window.dispatchEvent(new Event('focus'));setTimeout(()=>setNotice(''),5000)}
 }
 const report=async()=>{
  if(!job||busy)return
  const issue=window.prompt('Issue type: safety, damage, access_problem, payment, service_quality, or other','other')?.trim();if(!issue)return
  const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return
  setBusy('report');setNotice('')
  const{data,error}=await supabase.rpc('oc_report_booking_issue',{p_booking_id:job.id,p_issue_type:issue,p_description:description,p_severity:issue==='safety'?'high':'low'})
  setBusy('')
  if(error)setNotice(error.message);else{const row=Array.isArray(data)?data[0]:data;setNotice(row?.incident_number?`Case ${row.incident_number} opened.`:'Issue recorded.');setTimeout(()=>setNotice(''),4200)}
 }
 const release=async()=>{
  if(!job||busy||job.status==='working')return
  const late=job.status==='en_route'||job.status==='on_site'
  if(late&&!window.confirm('Release this job after travel started? ON CALL will immediately reassign the customer, take you offline, and open a reliability review.'))return
  const reason=window.prompt('Why can’t you complete this job?','Unable to complete this service')?.trim();if(!reason)return
  setBusy('release');setNotice('')
  const{error}=await supabase.rpc('oc_provider_release_job',{p_booking_id:job.id,p_reason:reason})
  setBusy('')
  if(error)setNotice(error.message);else{setNotice(late?'Job released. Customer reassignment started and your availability was paused.':'Job released. Customer reassignment started.');setJob(null);setNoShow(null);window.dispatchEvent(new Event('focus'));setTimeout(()=>setNotice(''),5000)}
 }
 if(!job&&!notice)return null
 const noShowLabel=noShow?.canSettle?`CUSTOMER NO-SHOW · $${Number(noShow.providerCompensation||0).toFixed(2)} TO YOU`:noShow?.remainingMinutes?`NO-SHOW WAIT · ${noShow.remainingMinutes} MIN`:'CHECK NO-SHOW'
 return <div style={{position:'fixed',left:18,bottom:84,zIndex:1250,display:'grid',gap:7}}>
  {job?.status==='on_site'&&<button type="button" onClick={settleNoShow} disabled={!!busy||(!noShow?.canSettle&&Number(noShow?.remainingMinutes||0)>0)} style={{border:'1px solid rgba(91,188,255,.3)',borderRadius:999,padding:'10px 13px',background:noShow?.canSettle?'#0d3354':'#1a2633',color:'#dff4ff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)',cursor:noShow?.canSettle?'pointer':'default'}}>{busy==='noshow'?'SETTLING…':noShowLabel}</button>}
  {job&&job.status!=='working'&&<button type="button" onClick={release} disabled={!!busy} style={{border:'1px solid rgba(255,117,128,.32)',borderRadius:999,padding:'10px 13px',background:'#351319',color:'#ffd8dc',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)',cursor:'pointer'}}>{busy==='release'?'RELEASING…':'RELEASE JOB'}</button>}
  {job&&<button type="button" onClick={report} disabled={!!busy} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:999,padding:'10px 13px',background:'#111827',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)',cursor:'pointer'}}>{busy==='report'?'SENDING…':'REPORT JOB ISSUE'}</button>}
  {notice&&<div role="status" style={{maxWidth:320,padding:'10px 12px',borderRadius:12,background:'#111827',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}>{notice}</div>}
 </div>
}
