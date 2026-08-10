import { useEffect } from 'react'

const COVERAGE_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/marketplace-public-coverage'
const normalize=(value:unknown)=>String(value||'').replace(/\s+/g,' ').trim()
const FALLBACK_MARKERS=['marker=33.749%2C-84.388','marker=33.749,-84.388','marker=33.749%2c-84.388']

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
      })

      for(const button of document.querySelectorAll<HTMLButtonElement>('.oc2-popular-grid>button,.oc2-service-list>button')){
        const small=button.querySelector('small')
        if(!small)continue
        if(!small.dataset.ocOriginalCopy)small.dataset.ocOriginalCopy=small.textContent||''
        const state=button.dataset.verifiedCoverage
        if(state==='active')small.textContent='Verified provider coverage'
        else if(state==='activating')small.textContent='Verified coverage activating'
        else small.textContent='Checking verified coverage'
      }

      document.querySelectorAll('p').forEach(node=>{
        const text=normalize(node.textContent)
        if(text==='Book trusted help now, schedule it later, or make it recurring.'){
          node.textContent='Browse services now, then book where verified provider coverage is active.'
        }
        if(text==='Book now, schedule later, or set it to repeat.'){
          node.textContent=hasVerifiedSupply?'Book where verified coverage is active, schedule later, or set eligible services to repeat.':'Browse the service catalog now. Booking unlocks service-by-service as verified coverage activates.'
        }
      })

      const trackerFrame=document.querySelector<HTMLIFrameElement>('.oc2-tracker-map iframe')
      if(trackerFrame){
        const src=trackerFrame.getAttribute('src')||trackerFrame.src||''
        const fallback=FALLBACK_MARKERS.some(marker=>src.includes(marker))
        const pin=document.querySelector<HTMLElement>('.oc2-tracker-map .oc2-map-pin')
        if(fallback){
          trackerFrame.style.visibility='hidden'
          trackerFrame.setAttribute('aria-hidden','true')
          trackerFrame.dataset.ocMapState='address-without-coordinates'
          if(pin)pin.style.visibility='hidden'
        }else{
          trackerFrame.style.visibility='visible'
          trackerFrame.setAttribute('aria-hidden','false')
          trackerFrame.dataset.ocMapState='booking-coordinates'
          if(pin)pin.style.visibility='visible'
        }
      }
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
      observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-verified-coverage','src']})
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
