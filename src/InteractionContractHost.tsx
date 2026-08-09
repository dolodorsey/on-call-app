import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type Panel = 'profile' | 'settings' | 'safety' | 'support' | null

type Profile = {
  id: string
  auth_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  phone_verified: boolean | null
  notification_prefs: Record<string, boolean> | null
}

const normalize = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()
const supportEmail = 'thedoctordorsey@gmail.com'

function findChatButton() {
  return [...document.querySelectorAll('button')].find(button => /^CHAT(?:\s|$)/i.test(normalize(button.textContent))) as HTMLButtonElement | undefined
}

export default function InteractionContractHost() {
  const [panel, setPanel] = useState<Panel>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, push: true, sms: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const fullName = useMemo(() => [firstName, lastName].filter(Boolean).join(' ').trim(), [firstName, lastName])

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('Sign in to manage your ON CALL account.')
    const { data, error } = await supabase
      .from('oc_users')
      .select('id,auth_id,first_name,last_name,full_name,email,phone,phone_verified,notification_prefs')
      .eq('auth_id', session.user.id)
      .single()
    if (error) throw error
    const row = data as Profile
    setProfile(row)
    setFirstName(row.first_name || row.full_name?.split(' ')[0] || '')
    setLastName(row.last_name || row.full_name?.split(' ').slice(1).join(' ') || '')
    setPhone(row.phone || '')
    setPrefs({ email: true, push: true, sms: false, ...(row.notification_prefs || {}) })
  }

  const openPanel = (next: Exclude<Panel, null>) => {
    setError('')
    setNotice('')
    setPanel(next)
    loadProfile().catch(err => setError(err.message || 'Account settings are unavailable.'))
  }

  const openChat = () => {
    const chat = findChatButton()
    if (chat) {
      chat.click()
      return true
    }
    setNotice('Secure chat becomes available as soon as a provider is assigned to an active booking.')
    setPanel('support')
    return false
  }

  const activeBookingId = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) throw new Error('Sign in to contact your provider.')
    const { data: me, error: meError } = await supabase.from('oc_users').select('id,role').eq('auth_id', session.user.id).single()
    if (meError || !me) throw meError || new Error('ON CALL account not found.')
    let query = supabase.from('oc_bookings').select('id,status,provider_id').in('status', ['assigned','en_route','on_site','working']).order('created_at', { ascending: false }).limit(1)
    if (me.role === 'provider') {
      const { data: provider } = await supabase.from('oc_provider_profiles').select('id').eq('user_id', me.id).maybeSingle()
      if (!provider) throw new Error('Provider profile not found.')
      query = query.eq('provider_id', provider.id)
    } else {
      query = query.eq('customer_id', me.id)
    }
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data?.id) throw new Error('No active assigned booking is available to contact.')
    return data.id as string
  }

  const callPartner = async () => {
    setError('')
    setNotice('')
    try {
      const bookingId = await activeBookingId()
      const { data, error } = await supabase.rpc('oc_booking_partner_contact', { p_booking_id: bookingId })
      if (error) throw error
      const contact = Array.isArray(data) ? data[0] : data
      if (!contact?.can_call || !contact?.phone) {
        setNotice('Direct calling is not available until the booking partner has a verified phone number. Secure chat is available instead.')
        setPanel('support')
        openChat()
        return
      }
      const dial = String(contact.phone).replace(/[^0-9+]/g, '')
      window.location.assign(`tel:${dial}`)
    } catch (err: any) {
      setError(err?.message || 'Calling is unavailable for this booking.')
      setPanel('support')
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || target.closest('[data-oc-interaction-host="true"]')) return

      const button = target.closest('button') as HTMLButtonElement | null
      const buttonLabel = normalize(button?.textContent)
      if (buttonLabel === '📞 Call' || buttonLabel === 'Call') {
        event.preventDefault()
        event.stopImmediatePropagation()
        void callPartner()
        return
      }
      if (buttonLabel === '💬 Message' || buttonLabel === 'Message') {
        event.preventDefault()
        event.stopImmediatePropagation()
        openChat()
        return
      }

      let node: Element | null = target
      for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
        if (!(node instanceof HTMLElement) || node.style.cursor !== 'pointer') continue
        const label = normalize(node.textContent).replace(/→$/, '').trim()
        if (label === 'Payment Methods') {
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('oncall:open-profile-tool', { detail: { tool: 'payments' } }))
          return
        }
        if (label === 'My Profile') { event.preventDefault(); openPanel('profile'); return }
        if (label === 'App Settings') { event.preventDefault(); openPanel('settings'); return }
        if (label === 'Safety Settings') { event.preventDefault(); openPanel('safety'); return }
        if (label === 'Help & Support') { event.preventDefault(); openPanel('support'); return }
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  const saveProfile = async () => {
    if (!profile || busy) return
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.from('oc_users').update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      full_name: fullName || null,
      phone: phone.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id)
    if (error) setError(error.message)
    else { setNotice('Profile saved.'); await loadProfile().catch(() => {}) }
    setBusy(false)
  }

  const saveSettings = async (next: Record<string, boolean>) => {
    if (!profile) return
    setPrefs(next); setError(''); setNotice('')
    const { error } = await supabase.from('oc_users').update({ notification_prefs: next, updated_at: new Date().toISOString() }).eq('id', profile.id)
    if (error) setError(error.message)
    else setNotice('App settings saved.')
  }

  const requestLocation = () => {
    setError(''); setNotice('')
    if (!navigator.geolocation) { setError('Location services are not available on this device.'); return }
    navigator.geolocation.getCurrentPosition(
      () => setNotice('Precise location permission is working.'),
      () => setError('Location permission is blocked. Enable it in your browser or phone settings for accurate provider matching.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const requestNotifications = async () => {
    setError(''); setNotice('')
    if (typeof Notification === 'undefined') { setError('Notifications are not supported in this browser.'); return }
    const result = await Notification.requestPermission()
    if (result === 'granted') setNotice('Booking notifications are enabled on this device.')
    else setError('Notification permission was not granted.')
  }

  if (!panel) return null

  return <div data-oc-interaction-host="true" role="dialog" aria-modal="true" onMouseDown={() => setPanel(null)} style={{position:'fixed',inset:0,zIndex:3200,background:'rgba(7,14,26,.58)',display:'grid',placeItems:'end center',padding:12,backdropFilter:'blur(8px)'}}>
    <section onMouseDown={e=>e.stopPropagation()} style={{width:'min(560px,100%)',maxHeight:'84dvh',overflowY:'auto',borderRadius:24,background:'#fff',color:'#172033',boxShadow:'0 28px 100px rgba(0,0,0,.38)',padding:18}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:16}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#1765e8'}}>ON CALL ACCOUNT</small><h2 style={{margin:'4px 0 0',fontSize:22}}>{panel==='profile'?'My Profile':panel==='settings'?'App Settings':panel==='safety'?'Safety Settings':'Help & Support'}</h2></div><button type="button" onClick={()=>setPanel(null)} style={{width:36,height:36,border:0,borderRadius:12,background:'#eef2f7',fontSize:20}}>×</button></header>
      {error&&<div style={{padding:10,borderRadius:12,background:'#fff0f0',color:'#b42318',fontSize:12,marginBottom:10}}>{error}</div>}
      {notice&&<div style={{padding:10,borderRadius:12,background:'#edf9f1',color:'#18794e',fontSize:12,marginBottom:10}}>{notice}</div>}

      {panel==='profile'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <label style={{fontSize:11,fontWeight:700}}>First name<input value={firstName} onChange={e=>setFirstName(e.target.value)} style={field}/></label>
        <label style={{fontSize:11,fontWeight:700}}>Last name<input value={lastName} onChange={e=>setLastName(e.target.value)} style={field}/></label>
        <label style={{fontSize:11,fontWeight:700,gridColumn:'1 / -1'}}>Phone<input inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Mobile number" style={field}/></label>
        <div style={{gridColumn:'1 / -1',padding:11,borderRadius:12,background:'#f6f8fb',fontSize:11,color:'#64748b'}}>{profile?.email || 'Account email'} · {profile?.phone_verified?'phone verified':'phone not yet verified'}</div>
        <button type="button" disabled={busy} onClick={saveProfile} style={primary}>{busy?'Saving…':'Save profile'}</button>
      </div>}

      {panel==='settings'&&<div style={{display:'grid',gap:9}}>{[['push','Push booking updates'],['email','Email receipts & updates'],['sms','SMS booking updates']].map(([key,label])=><button type="button" key={key} onClick={()=>saveSettings({...prefs,[key]:!prefs[key]})} style={{...row,justifyContent:'space-between'}}><span>{label}</span><b style={{color:prefs[key]?'#10b981':'#94a3b8'}}>{prefs[key]?'ON':'OFF'}</b></button>)}<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('oncall:open-profile-tool',{detail:{tool:'recurring'}}))} style={row}>Manage recurring services <span>→</span></button></div>}

      {panel==='safety'&&<div style={{display:'grid',gap:9}}><button type="button" onClick={requestLocation} style={row}>Check precise location access <span>→</span></button><button type="button" onClick={requestNotifications} style={row}>Enable booking alerts <span>→</span></button><div style={{padding:12,borderRadius:14,background:'#fff8e7',fontSize:11,lineHeight:1.5,color:'#775a13'}}>For emergencies or immediate danger, use local emergency services. ON CALL is a service marketplace, not an emergency-response service.</div></div>}

      {panel==='support'&&<div style={{display:'grid',gap:9}}><button type="button" onClick={openChat} style={row}>Open secure booking chat <span>→</span></button><button type="button" onClick={()=>window.location.assign(`mailto:${supportEmail}?subject=ON%20CALL%20Support`)} style={row}>Email ON CALL support <span>→</span></button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('oncall:open-profile-tool',{detail:{tool:'payments'}}))} style={row}>Payment methods & payment status <span>→</span></button></div>}
    </section>
  </div>
}

const field: React.CSSProperties = {width:'100%',marginTop:5,padding:'12px 13px',border:'1px solid #dbe2ec',borderRadius:12,outline:'none',font:'inherit',boxSizing:'border-box'}
const primary: React.CSSProperties = {gridColumn:'1 / -1',border:0,borderRadius:13,padding:'13px 15px',background:'#1765e8',color:'#fff',fontSize:12,fontWeight:900}
const row: React.CSSProperties = {width:'100%',minHeight:52,padding:'0 14px',border:'1px solid #e4e9f0',borderRadius:14,background:'#f8fafc',color:'#1f2937',display:'flex',alignItems:'center',gap:10,textAlign:'left',fontSize:12,fontWeight:800,cursor:'pointer'}
