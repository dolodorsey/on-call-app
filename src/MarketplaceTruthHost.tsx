import { useEffect } from 'react'

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage'
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
        const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'}})
        const data=await response.json().catch(()=>null)
        if(response.ok)hasVerifiedSupply=Boolean(data?.on_call?.has_verified_supply)
      }catch{}
      applyTruth(hasVerifiedSupply)
      observer=new MutationObserver(()=>applyTruth(hasVerifiedSupply))
      observer.observe(document.body,{childList:true,subtree:true,characterData:true})
    })()

    return()=>{stopped=true;observer?.disconnect()}
  },[])
  return null
}
