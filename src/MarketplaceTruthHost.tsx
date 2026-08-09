import { useEffect } from 'react'
import { supabase } from './supabase'

const normalize=(value:unknown)=>String(value||'').replace(/\s+/g,' ').trim()

export default function MarketplaceTruthHost(){
  useEffect(()=>{
    let stopped=false
    let observer:MutationObserver|undefined

    const applyTruth=(hasVerifiedSupply:boolean)=>{
      if(stopped)return
      const replacements:Record<string,string>={
        'LIVE SERVICE TYPES':'CATALOG SERVICE TYPES',
        'LAUNCH MARKETS':'TARGET MARKETS',
        'POPULAR NOW':'POPULAR SERVICES',
      }
      document.querySelectorAll('span,small').forEach(node=>{
        const text=normalize(node.textContent)
        if(replacements[text])node.textContent=replacements[text]
        if(!hasVerifiedSupply&&text==='Available now')node.textContent='On-demand enabled'
      })
    }

    ;(async()=>{
      let hasVerifiedSupply=false
      try{
        const {data,error}=await supabase.rpc('oc_public_service_coverage')
        if(!error&&Array.isArray(data))hasVerifiedSupply=data.some((row:any)=>Boolean(row?.has_verified_supply))
      }catch{}
      applyTruth(hasVerifiedSupply)
      observer=new MutationObserver(()=>applyTruth(hasVerifiedSupply))
      observer.observe(document.body,{childList:true,subtree:true,characterData:true})
    })()

    return()=>{stopped=true;observer?.disconnect()}
  },[])
  return null
}
