import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ProviderLocation = { provider_id?: string; lat?: number | string | null; lng?: number | string | null; updated_at?: string | null }
type BookingChange = { id?:string; status?:string; provider_id?:string|null; service_name?:string }
type PaymentChange = { booking_id?:string; status?:string }

const STATUS_LABEL:Record<string,string>={pending:'Request received',matching:'Finding a provider',assigned:'Provider assigned',en_route:'Provider en route',on_site:'Provider arrived',working:'Service in progress',completed:'Service completed',canceled:'Canceled'}
const mapUrl=(lat:number,lng:number)=>`https://www.openstreetmap.org/export/embed.html?bbox=${lng-.04}%2C${lat-.03}%2C${lng+.04}%2C${lat+.03}&layer=mapnik&marker=${lat}%2C${lng}`

export default function CustomerRealtimeBridge(){
  const [connection,setConnection]=useState<'connecting'|'live'|'fallback'>('connecting')

  useEffect(()=>{
    let disposed=false
    let channel:any=null
    let currentToken=''

    const disconnect=()=>{if(channel)supabase.removeChannel(channel);channel=null;currentToken=''}
    const refresh=()=>window.dispatchEvent(new Event('oncall:booking-refresh'))
    const applyBooking=(payload:any)=>{
      const row=(payload.new||payload.old||{}) as BookingChange
      refresh()
      if(!row.status)return
      const label=STATUS_LABEL[row.status]||String(row.status).replaceAll('_',' ')
      const activeStatus=document.querySelector('.oc2-active-booking em')
      if(activeStatus)activeStatus.textContent=label
      const trackerTitle=document.querySelector('.oc2-tracker-head h2')
      if(trackerTitle)trackerTitle.textContent=label
      if(row.provider_id&&row.status==='assigned'&&document.hidden&&'Notification'in window&&Notification.permission==='granted'){
        try{new Notification('Your ON CALL provider accepted',{body:row.service_name?`${row.service_name} is now assigned.`:'Open ON CALL to view your provider.'})}catch{}
      }
    }
    const applyPayment=(payload:any)=>{
      const row=(payload.new||payload.old||{}) as PaymentChange
      refresh()
      if(['authorized','captured','transferred','released'].includes(String(row.status||''))){
        const action=document.querySelector<HTMLButtonElement>('.oc2-pay-action')
        if(action){action.disabled=true;action.textContent='Payment authorized'}
      }
    }
    const applyProviderLocation=(payload:any)=>{
      const row=(payload.new||payload.old||{}) as ProviderLocation
      const lat=Number(row.lat),lng=Number(row.lng)
      if(!row.provider_id||!Number.isFinite(lat)||!Number.isFinite(lng))return
      const frame=document.querySelector<HTMLIFrameElement>('.oc2-tracker-map iframe')
      if(frame)frame.src=mapUrl(lat,lng)
      const pill=document.querySelector<HTMLElement>('.oc2-live-pill')
      if(pill)pill.innerHTML='<span></span> PROVIDER LIVE'
      window.dispatchEvent(new CustomEvent('oncall:provider-location',{detail:{providerId:row.provider_id,lat,lng,updatedAt:row.updated_at||new Date().toISOString()}}))
    }

    const connect=(session:any)=>{
      if(!session?.access_token){disconnect();setConnection('connecting');return}
      if(channel&&session.access_token===currentToken)return
      disconnect();currentToken=session.access_token
      supabase.realtime.setAuth(session.access_token)
      channel=supabase.channel(`oncall-customer-live-${session.user.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_bookings'},applyBooking)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_booking_payments'},applyPayment)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_provider_locations'},applyProviderLocation)
        .subscribe(status=>{
          if(disposed)return
          if(status==='SUBSCRIBED')setConnection('live')
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setConnection('fallback')
        })
    }

    supabase.auth.getSession().then(({data})=>{if(!disposed)connect(data.session)})
    const {data:auth}=supabase.auth.onAuthStateChange((_event,session)=>{if(!disposed)connect(session)})
    return()=>{disposed=true;auth.subscription.unsubscribe();disconnect()}
  },[])

  return <div aria-live="polite" title="ON CALL live data connection" style={{position:'fixed',right:12,bottom:12,zIndex:2400,padding:'7px 10px',borderRadius:999,background:'rgba(7,16,29,.9)',border:'1px solid rgba(111,220,255,.22)',color:connection==='live'?'#80e8b7':'#6fdcff',fontSize:8,fontWeight:900,letterSpacing:'.12em',pointerEvents:'none'}}>{connection==='live'?'LIVE DATA':connection==='fallback'?'POLLING FALLBACK':'CONNECTING'}</div>
}
