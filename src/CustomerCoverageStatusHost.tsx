import { useEffect,useMemo,useState } from 'react'

type CoverageRow={
  service_id:string
  service_name:string
  verified_supply_count:number
  live_supply_count:number
  has_verified_supply:boolean
  has_live_supply:boolean
}
const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage'
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ')

export default function CustomerCoverageStatusHost(){
 const[rows,setRows]=useState<CoverageRow[]>([])
 const[loaded,setLoaded]=useState(false)
 const[notice,setNotice]=useState('')
 const map=useMemo(()=>new Map(rows.map(row=>[normalize(row.service_name),row])),[rows])
 const verified=rows.filter(row=>row.has_verified_supply).length
 const live=rows.filter(row=>row.has_live_supply).length

 useEffect(()=>{
   let alive=true
   const load=async()=>{try{
     const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store'})
     const body=await response.json().catch(()=>null)
     if(!alive)return
     if(!response.ok)throw new Error('Coverage status unavailable')
     setRows((body?.on_call?.services||[]) as CoverageRow[])
     setLoaded(true)
   }catch{if(alive){setRows([]);setLoaded(true)}}}
   void load();const timer=window.setInterval(()=>void load(),60000);return()=>{alive=false;window.clearInterval(timer)}
 },[])

 useEffect(()=>{
   if(!loaded)return
   const apply=()=>{
     const buttons=[...document.querySelectorAll<HTMLButtonElement>('.oc2-service-list>button,.oc2-popular-grid>button')]
     for(const button of buttons){
       const strong=button.querySelector('strong');if(!strong)continue
       const key=normalize(strong.textContent||'');const coverage=map.get(key)
       const verifiedSupply=Boolean(coverage?.has_verified_supply)
       const liveSupply=Boolean(coverage?.has_live_supply)
       button.dataset.verifiedCoverage=verifiedSupply?'active':'activating'
       button.dataset.liveCoverage=liveSupply?'active':'offline'
       button.classList.toggle('oc-coverage-unavailable',!verifiedSupply)
       let badge=button.querySelector<HTMLSpanElement>('.oc-coverage-badge')
       if(!badge){badge=document.createElement('span');badge.className='oc-coverage-badge';button.appendChild(badge)}
       badge.textContent=!verifiedSupply?'Verified provider activating':liveSupply?`${coverage?.live_supply_count||1} verified provider${Number(coverage?.live_supply_count||0)===1?'':'s'} on duty`:'Verified provider · schedule ahead'
     }
   }
   apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true})
   const block=(event:Event)=>{
     const target=event.target as HTMLElement|null
     const button=target?.closest?.('button.oc-coverage-unavailable') as HTMLButtonElement|null
     if(!button)return
     event.preventDefault();event.stopImmediatePropagation()
     setNotice(rows.length?'No verified ON CALL provider can fulfill this service yet. No booking was created.':'ON CALL coverage status is temporarily unavailable. No booking was created.')
   }
   document.addEventListener('click',block,true)
   return()=>{observer.disconnect();document.removeEventListener('click',block,true)}
 },[loaded,rows,map])

 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4200);return()=>window.clearTimeout(timer)},[notice])
 if(!loaded)return null
 return <>
   {(verified===0||live===0)&&<aside className="oc-coverage-banner"><span/> <div><strong>{rows.length?verified===0?'Provider coverage is activating.':'Verified providers are currently off duty.':'Coverage check unavailable.'}</strong><small>{rows.length?verified===0?`You can browse all ${rows.length} services. Booking unlocks service-by-service only after a verified provider completes activation.`:`${verified} service${verified===1?' has':'s have'} verified supply; ${live} currently ${live===1?'has':'have'} an on-duty provider. Services without live supply can only be scheduled ahead.`:'Service requests stay locked until verified coverage can be confirmed.'}</small></div></aside>}
   {notice&&<div className="oc-coverage-toast">{notice}</div>}
 </>
}
