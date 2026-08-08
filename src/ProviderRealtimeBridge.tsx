import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Alert = { id?: number; title?: string; body?: string; action_url?: string; type?: string }

export default function ProviderRealtimeBridge() {
  const [permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission)
  const [alert,setAlert]=useState<Alert|null>(null)

  useEffect(() => {
    let disposed = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const notify = (row: Alert) => {
      setAlert(row)
      window.setTimeout(()=>setAlert(current=>current?.id===row.id?null:current),4200)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(row.title || 'ON CALL Provider Command', {
          body: row.body || 'Your provider network has an update.',
          tag: row.id ? `oc-${row.id}` : `oc-${Date.now()}`,
          icon: '/favicon.svg',
        })
        n.onclick=()=>{window.focus();if(row.action_url)window.location.assign(row.action_url)}
      }
    }

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || disposed) return

      supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel(`oc-provider-command:${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_bookings' }, () => window.dispatchEvent(new Event('focus')))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_booking_payments' }, () => window.dispatchEvent(new Event('focus')))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_provider_locations' }, () => window.dispatchEvent(new Event('focus')))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'oc_notifications' }, payload => {
          const row=payload.new as Alert
          notify(row)
          window.dispatchEvent(new Event('focus'))
        })
        .subscribe()
    }

    connect().catch(error => console.warn('ON CALL Provider Realtime unavailable; polling fallback remains active.', error))
    return () => { disposed = true; if (channel) supabase.removeChannel(channel) }
  }, [])

  const enable=async()=>{
    if(typeof Notification==='undefined')return
    const next=await Notification.requestPermission()
    setPermission(next)
    if(next==='granted')setAlert({title:'Job alerts enabled',body:'Provider Command can alert you when matching work or payment updates arrive.'})
  }

  return <>
    {permission==='default'&&<button type="button" onClick={enable} style={{position:'fixed',right:18,bottom:84,zIndex:1200,border:0,borderRadius:999,padding:'11px 15px',background:'#0d1722',color:'#fff',boxShadow:'0 12px 40px rgba(0,0,0,.28)',fontSize:11,fontWeight:900,letterSpacing:'.04em',cursor:'pointer'}}>ENABLE JOB ALERTS</button>}
    {alert&&<div role="status" aria-live="polite" style={{position:'fixed',right:18,top:82,zIndex:1300,width:'min(360px,calc(100vw - 36px))',padding:'14px 16px',borderRadius:16,background:'#0d1722',color:'#fff',boxShadow:'0 18px 60px rgba(0,0,0,.34)',border:'1px solid rgba(255,255,255,.10)'}}><strong style={{display:'block',fontSize:13}}>{alert.title||'ON CALL update'}</strong><span style={{display:'block',marginTop:4,fontSize:12,lineHeight:1.45,color:'rgba(255,255,255,.70)'}}>{alert.body}</span></div>}
  </>
}
