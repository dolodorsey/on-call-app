import { useEffect,useMemo,useState } from 'react'
import { supabase } from './supabase'

type CoverageRow={service_id:string;service_name:string;has_verified_supply:boolean}
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ')

export default function CustomerCoverageStatusHost(){
 const[rows,setRows]=useState<CoverageRow[]>([])
 const[notice,setNotice]=useState('')
 const map=useMemo(()=>new Map(rows.map(row=>[normalize(row.service_name),row.has_verified_supply])),[rows])
 const covered=rows.filter(row=>row.has_verified_supply).length

 useEffect(()=>{
   let alive=true
   const load=async()=>{const{data,error}=await supabase.rpc('oc_public_service_coverage');if(!alive||error)return;setRows((data||[]) as CoverageRow[])}
   load();const timer=window.setInterval(load,60000);return()=>{alive=false;window.clearInterval(timer)}
 },[])

 useEffect(()=>{
   if(!rows.length)return
   const apply=()=>{
     const buttons=[...document.querySelectorAll<HTMLButtonElement>('.oc2-service-list>button,.oc2-popular-grid>button')]
     for(const button of buttons){
       const strong=button.querySelector('strong');if(!strong)continue
       const key=normalize(strong.textContent||'');if(!map.has(key))continue
       const available=Boolean(map.get(key));button.dataset.verifiedCoverage=available?'active':'activating'
       button.classList.toggle('oc-coverage-unavailable',!available)
       let badge=button.querySelector<HTMLSpanElement>('.oc-coverage-badge')
       if(!badge){badge=document.createElement('span');badge.className='oc-coverage-badge';button.appendChild(badge)}
       badge.textContent=available?'Verified coverage':'Coverage activating'
     }
   }
   apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});
   const block=(event:Event)=>{const target=event.target as HTMLElement|null;const button=target?.closest?.('button.oc-coverage-unavailable') as HTMLButtonElement|null;if(!button)return;event.preventDefault();event.stopImmediatePropagation();setNotice('Verified ON CALL provider coverage is not active for this service yet. No booking was created.')}
   document.addEventListener('click',block,true)
   return()=>{observer.disconnect();document.removeEventListener('click',block,true)}
 },[rows,map])

 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4200);return()=>window.clearTimeout(timer)},[notice])
 if(!rows.length)return null
 return <>{covered===0&&<aside className="oc-coverage-banner"><span/> <div><strong>Provider coverage is activating.</strong><small>You can browse all {rows.length} services now. Requests unlock service-by-service as verified providers complete onboarding.</small></div></aside>}{notice&&<div className="oc-coverage-toast">{notice}</div>}</>
}
