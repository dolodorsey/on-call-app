import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type ProviderLocation = { provider_id?: string; lat?: number | string | null; lng?: number | string | null; updated_at?: string | null }

export default function CustomerRealtimeBridge(){
  const [connection,setConnection]=useState<'connecting'|'live'|'fallback'>('connecting')

  useEffect(()=>{
    let disposed=false
    let channel:any=null
    ;(async()=>{
      const {data:{session}}=await supabase.auth.getSession()
      if(disposed||!session?.access_token)return
      supabase.realtime.setAuth(session.access_token)
      const refresh=()=>window.dispatchEvent(new Event('oncall:booking-refresh'))
      channel=supabase.channel(`oncall-customer-live-${session.user.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_bookings'},refresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_booking_payments'},refresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_provider_locations'},payload=>{
          const row=(payload.new||payload.old||{}) as ProviderLocation
          const lat=Number(row.lat),lng=Number(row.lng)
          if(row.provider_id&&Number.isFinite(lat)&&Number.isFinite(lng)){
            window.dispatchEvent(new CustomEvent('oncall:provider-location',{detail:{providerId:row.provider_id,lat,lng,updatedAt:row.updated_at||new Date().toISOString()}}))
          }
        })
        .subscribe(status=>{
          if(disposed)return
          if(status==='SUBSCRIBED')setConnection('live')
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setConnection('fallback')
        })
    })()
    return()=>{disposed=true;if(channel)supabase.removeChannel(channel)}
  },[])

  return <div aria-live="polite" title="ON CALL live data connection" style={{position:'fixed',right:12,bottom:12,zIndex:2400,padding:'7px 10px',borderRadius:999,background:'rgba(7,16,29,.9)',border:'1px solid rgba(111,220,255,.22)',color:connection==='live'?'#80e8b7':'#6fdcff',fontSize:8,fontWeight:900,letterSpacing:'.12em',pointerEvents:'none'}}>{connection==='live'?'LIVE DATA':connection==='fallback'?'POLLING FALLBACK':'CONNECTING'}</div>
}
