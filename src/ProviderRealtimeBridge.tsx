import { useEffect } from 'react'
import { supabase } from './supabase'

export default function ProviderRealtimeBridge() {
  useEffect(() => {
    let disposed = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || disposed) return

      supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel(`oc-provider-command:${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_bookings' }, () => {
          window.dispatchEvent(new Event('focus'))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_booking_payments' }, () => {
          window.dispatchEvent(new Event('focus'))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_provider_locations' }, () => {
          window.dispatchEvent(new Event('focus'))
        })
        .subscribe()
    }

    connect().catch(error => console.warn('ON CALL Provider Realtime unavailable; polling fallback remains active.', error))

    return () => {
      disposed = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return null
}
