import { useEffect } from 'react'

const ON_CALL_MOTION = 'https://woqlhjodiedyqfvzweoe.supabase.co/storage/v1/object/public/animations/on-call-ani-.mp4'

function buildMotionStage(className:string){
  const stage=document.createElement('section')
  stage.className=className
  stage.setAttribute('aria-label','ON CALL brand motion')
  const video=document.createElement('video')
  video.src=ON_CALL_MOTION
  video.autoplay=true
  video.muted=true
  video.loop=true
  video.playsInline=true
  video.preload='metadata'
  video.setAttribute('aria-hidden','true')
  stage.appendChild(video)
  return stage
}

export default function OnCallVisualUpgradeHost(){
  useEffect(()=>{
    const sync=()=>{
      const marketplaceHero=document.querySelector('.oc2-home-hero')
      const marketplaceStage=document.querySelector('.oc2-motion-stage')
      if(marketplaceHero&&!marketplaceStage){marketplaceHero.parentElement?.insertBefore(buildMotionStage('oc2-motion-stage'),marketplaceHero)}
      if(!marketplaceHero&&marketplaceStage)marketplaceStage.remove()

      const entryHero=document.querySelector('.oce-hero')
      const entryStage=document.querySelector('.oce-motion-stage')
      if(entryHero&&!entryStage){entryHero.parentElement?.insertBefore(buildMotionStage('oce-motion-stage'),entryHero)}
      if(!entryHero&&entryStage)entryStage.remove()
    }
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>observer.disconnect()
  },[])
  return null
}
