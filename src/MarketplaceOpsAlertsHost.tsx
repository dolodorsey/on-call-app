import { useEffect,useMemo,useState } from 'react'
import { supabase } from './supabase'

type Alert={id:string;product_key:'on_call'|'sos';alert_type:string;entity_id?:string|null;title:string;body?:string|null;metadata?:Record<string,unknown>;created_at:string;is_read:boolean}
const when=(value:string)=>new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})

export default function MarketplaceOpsAlertsHost(){
 const[alerts,setAlerts]=useState<Alert[]>([]),[open,setOpen]=useState(false),[error,setError]=useState('')
 const unread=useMemo(()=>alerts.filter(item=>!item.is_read).length,[alerts])
 const load=async()=>{const{data,error}=await supabase.rpc('marketplace_ops_alert_feed',{p_limit:60});if(error)throw error;setAlerts((data||[]) as Alert[])}
 useEffect(()=>{let alive=true;const refresh=()=>load().catch(()=>{});supabase.auth.getSession().then(({data})=>{if(alive&&data.session)refresh()});const timer=window.setInterval(refresh,12000);const{data}=supabase.auth.onAuthStateChange((_e,s)=>{if(alive&&s)refresh()});return()=>{alive=false;clearInterval(timer);data.subscription.unsubscribe()}},[])
 const read=async(item:Alert)=>{setError('');try{const{error}=await supabase.rpc('marketplace_ops_mark_alert_read',{p_alert_id:item.id});if(error)throw error;setAlerts(current=>current.map(row=>row.id===item.id?{...row,is_read:true}:row))}catch(e){setError(e instanceof Error?e.message:'Alert could not be marked read')}}
 const openTarget=async(item:Alert)=>{await read(item);if(item.product_key==='sos')window.location.assign('https://thesuperherosonstandby.com/ops/heroes');else window.location.assign('/ops')}
 if(!alerts.length&&!open)return null
 return <><button className="ocoi-launch" onClick={()=>setOpen(true)}><span>OPS INBOX</span>{unread>0&&<b>{unread}</b>}</button>{open&&<div className="ocoi-backdrop" onMouseDown={()=>setOpen(false)}><section className="ocoi-sheet" onMouseDown={e=>e.stopPropagation()}><header><div><span>MARKETPLACE OPERATIONS</span><h2>Application activity.</h2><p>New ON CALL provider and S.O.S. Hero applications, plus review-status changes, appear here automatically.</p></div><button onClick={()=>setOpen(false)}>×</button></header>{error&&<div className="ocoi-error">{error}</div>}<div className="ocoi-list">{alerts.length===0?<div className="ocoi-empty">No operator alerts yet.</div>:alerts.map(item=><button key={item.id} className={item.is_read?'read':''} onClick={()=>openTarget(item)}><i className={item.product_key}/><div><small>{item.product_key==='on_call'?'ON CALL':'S.O.S.'} · {when(item.created_at)}</small><strong>{item.title}</strong><span>{item.body||'Application activity updated.'}</span></div>{!item.is_read&&<em>NEW</em>}</button>)}</div><p className="ocoi-truth">Read state is per operator. This inbox never exposes verification documents or credentials; it contains application activity only.</p></section></div>}</>
}
