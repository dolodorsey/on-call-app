import { useEffect } from 'react'

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage'
const normalize=(value:unknown)=>String(value||'').replace(/\s+/g,' ').trim()

export default function MarketplaceTruthHost(){
  useEffect(()=>{
    let stopped=false
    let observer:MutationObserver|undefined
    let timer:number|undefined

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
        if(!hasVerifiedSupply&&(text==='Available now'||text==='On-demand enabled'))node.textContent='Verified coverage activating'
      })
    }

    const refresh=async()=>{
      let hasVerifiedSupply=false
      try{
        const response=await fetch(COVERAGE_URL,{headers:{Accept:'application/json'},cache:'no-store'})
        const data=await response.json().catch(()=>null)
        if(response.ok)hasVerifiedSupply=Boolean(data?.on_call?.has_verified_supply)
      }catch{}
      applyTruth(hasVerifiedSupply)
      observer?.disconnect()
      observer=new MutationObserver(()=>applyTruth(hasVerifiedSupply))
      observer.observe(document.body,{childList:true,subtree:true,characterData:true})
    }

    void refresh()
    timer=window.setInterval(()=>void refresh(),60000)

    return()=>{
      stopped=true
      observer?.disconnect()
      if(timer)window.clearInterval(timer)
    }
  },[])
  return null
}
