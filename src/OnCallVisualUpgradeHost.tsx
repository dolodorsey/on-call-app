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

function ensurePublicChrome(){
  const entry=document.querySelector('.oc-entry')
  if(!entry){document.querySelector('.oc-public-nav')?.remove();document.querySelector('.oc-public-utility')?.remove();return}
  if(!document.querySelector('.oc-public-nav')){
    const nav=document.createElement('nav')
    nav.className='oc-public-nav'
    nav.setAttribute('aria-label','ON CALL app navigation')
    nav.innerHTML='<button class="active" data-action="home"><span>⌂</span>Home</button><button data-action="services"><span>◇</span>Services</button><button data-action="bookings"><span>◎</span>Bookings</button><button data-action="profile"><span>○</span>Profile</button>'
    nav.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
      if(!target)return
      const action=target.dataset.action
      if(action==='home')window.scrollTo({top:0,behavior:'smooth'})
      if(action==='services')document.getElementById('services')?.scrollIntoView({behavior:'smooth',block:'start'})
      if(action==='bookings'||action==='profile')document.querySelector<HTMLButtonElement>('.oce-solid')?.click()
    })
    document.body.appendChild(nav)
  }
  if(!document.querySelector('.oc-public-utility')){
    const utility=document.createElement('div')
    utility.className='oc-public-utility'
    utility.innerHTML='<a href="/privacy">Privacy</a><i></i><a href="/terms">Terms</a><i></i><a href="/support">Support</a><i></i><a href="mailto:thedoctordorsey@gmail.com">Contact</a>'
    document.body.appendChild(utility)
  }
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
      ensurePublicChrome()
    }
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>{observer.disconnect();document.querySelector('.oc-public-nav')?.remove();document.querySelector('.oc-public-utility')?.remove()}
  },[])
  return null
}
