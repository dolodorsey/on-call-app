import { useEffect,useMemo,useState } from 'react'

type CoverageRow={service_id:string;service_name:string;has_verified_supply:boolean}
const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage'
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ')

export default function CustomerCoverageStatusHost(){
 const[rows,setRows]=useState<CoverageRow[]>([])
 const[loaded,setLoaded]=useState(false)
 const[notice,setNotice]=useState('')
 const map=useMemo(()=>new Map(rows.map(row=>[normalize(row.service_name),row.has_verified_supply])),[rows])
 const covered=rows.filter(row=>row.has_verified_supply).length

 useEffect(()=>{
   let alive=true
   const load=async()=>{try{const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store'});const body=await response.json().catch(()=>null);if(!alive)return;if(!response.ok)throw new Error('Coverage status unavailable');setRows((body?.on_call?.services||[]) as CoverageRow[]);setLoaded(true)}catch{if(alive){setRows([]);setLoaded(true)}}}
   load();const timer=window.setInterval(load,60000);return()=>{alive=false;window.clearInterval(timer)}
 },[])

 useEffect(()=>{
   if(!loaded)return
   const apply=()=>{
     const buttons=[...document.querySelectorAll<HTMLButtonElement>('.oc2-service-list>button,.oc2-popular-grid>button')]
     for(const button of buttons){
       const strong=button.querySelector('strong');if(!strong)continue
       const key=normalize(strong.textContent||'');const available=map.has(key)&&Boolean(map.get(key));
       button.dataset.verifiedCoverage=available?'active':'activating'
       button.classList.toggle('oc-coverage-unavailable',!available)
       let badge=button.querySelector<HTMLSpanElement>('.oc-coverage-badge')
       if(!badge){badge=document.createElement('span');badge.className='oc-coverage-badge';button.appendChild(badge)}
       badge.textContent=available?'Verified coverage':'Coverage activating'
     }
   }
   apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});
   const block=(event:Event)=>{const target=event.target as HTMLElement|null;const button=target?.closest?.('button.oc-coverage-unavailable') as HTMLButtonElement|null;if(!button)return;event.preventDefault();event.stopImmediatePropagation();setNotice(rows.length?'Verified ON CALL provider coverage is not active for this service yet. No booking was created.':'ON CALL coverage status is temporarily unavailable. No booking was created.')}
   document.addEventListener('click',block,true)
   return()=>{observer.disconnect();document.removeEventListener('click',block,true)}
 },[loaded,rows,map])

 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4200);return()=>window.clearTimeout(timer)},[notice])
 if(!loaded)return null
 return <>{covered===0&&<aside className="oc-coverage-banner"><span/> <div><strong>{rows.length?'Provider coverage is activating.':'Coverage check unavailable.'}</strong><small>{rows.length?`You can browse all ${rows.length} services now. Requests unlock service-by-service as verified providers complete onboarding.`:'Service requests stay locked until verified coverage can be confirmed.'}</small></div></aside>}{notice&&<div className="oc-coverage-toast">{notice}</div>}</>
}
