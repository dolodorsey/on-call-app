import { useEffect,useState } from 'react'
import { supabase } from './supabase'

type Job={id:string;service_name:string;status:string}

export default function ProviderIssueHost(){
 const[job,setJob]=useState<Job|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{
  let disposed=false
  const load=async()=>{
   const{data:{session}}=await supabase.auth.getSession();if(!session?.user||disposed)return
   const{data:u}=await supabase.from('oc_users').select('id,role').eq('auth_id',session.user.id).maybeSingle();if(!u||u.role!=='provider')return
   const{data:p}=await supabase.from('oc_provider_profiles').select('id').eq('user_id',u.id).maybeSingle();if(!p)return
   const{data:rows}=await supabase.from('oc_bookings').select('id,service_name,status').eq('provider_id',p.id).in('status',['assigned','en_route','on_site','working']).order('accepted_at',{ascending:false}).limit(1)
   if(!disposed)setJob((rows?.[0]||null) as Job|null)
  }
  load().catch(()=>{})
  const onFocus=()=>load().catch(()=>{});window.addEventListener('focus',onFocus);return()=>{disposed=true;window.removeEventListener('focus',onFocus)}
 },[])
 const report=async()=>{
  if(!job||busy)return
  const issue=window.prompt('Issue type: customer_no_show, safety, damage, access_problem, payment, service_quality, or other',job.status==='on_site'?'customer_no_show':'other')?.trim();if(!issue)return
  const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return
  setBusy(true);setNotice('')
  const{data,error}=await supabase.rpc('oc_report_booking_issue',{p_booking_id:job.id,p_issue_type:issue,p_description:description,p_severity:issue==='safety'?'high':'low'})
  setBusy(false)
  if(error)setNotice(error.message);else{const row=Array.isArray(data)?data[0]:data;setNotice(row?.incident_number?`Case ${row.incident_number} opened.`:'Issue recorded.');setTimeout(()=>setNotice(''),4200)}
 }
 if(!job&&!notice)return null
 return <div style={{position:'fixed',left:18,bottom:84,zIndex:1250}}>{job&&<button type="button" onClick={report} disabled={busy} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:999,padding:'10px 13px',background:'#111827',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.28)',cursor:'pointer'}}>{busy?'SENDING…':'REPORT JOB ISSUE'}</button>}{notice&&<div role="status" style={{marginTop:8,maxWidth:300,padding:'10px 12px',borderRadius:12,background:'#111827',color:'#fff',fontSize:11,boxShadow:'0 12px 36px rgba(0,0,0,.28)'}}>{notice}</div>}</div>
}
