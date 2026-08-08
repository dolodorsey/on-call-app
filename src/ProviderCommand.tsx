import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { acceptOffer, getSession, resetPassword, signIn, signOut, signUp, startProviderOnboarding, supabase, transitionBooking } from './supabase'
import './provider-command.css'

type Session = Awaited<ReturnType<typeof getSession>>
type Snapshot = {
  user?: { id?: string; name?: string; email?: string; phone?: string; city?: string; state?: string }
  provider?: {
    id?: string
    available?: boolean
    approval_status?: string
    background_check_status?: string
    rating?: number
    total_jobs?: number
    service_area_radius?: number
    stripe_onboarding_complete?: boolean
    stripe_payouts_enabled?: boolean
    identity_verified?: boolean
    license_verified?: boolean
    insurance_verified?: boolean
    service_area_verified?: boolean
  }
  counts?: { services?: number; opportunities?: number; active_jobs?: number; completed_jobs?: number }
  earnings?: { today?: number; week?: number; total?: number; pending?: number }
  location?: { lat?: number; lng?: number; accuracy_meters?: number; updated_at?: string } | null
}
type Opportunity = {
  booking_id: string
  service_name: string
  category_name?: string
  request_type?: string
  market_city?: string
  market_state?: string
  scheduled_at?: string | null
  customer_total?: number
  estimated_provider_payout?: number
  created_at?: string
}
type Job = {
  id: string
  service_name: string
  category_name?: string
  status: string
  request_type?: string
  service_address?: string
  address?: string
  market_city?: string
  market_state?: string
  service_city?: string
  service_state?: string
  scheduled_at?: string | null
  total_price?: number
  final_price?: number
  estimated_price?: number
  created_at?: string
  accepted_at?: string | null
  completed_at?: string | null
  rating?: number | null
}
type JobDetail = {
  id: string
  service_name: string
  category_name?: string
  status: string
  request_type?: string
  address?: string
  city?: string
  state?: string
  lat?: number | null
  lng?: number | null
  scheduled_at?: string | null
  total_price?: number
  notes?: string | null
  duration_minutes?: number | null
  customer?: { first_name?: string; last_initial?: string | null; phone?: string | null }
  payment?: { status?: string; provider_amount?: number; authorized_at?: string | null; captured_at?: string | null; transferred_at?: string | null } | null
}
type Earning = { payment_id: string; booking_id: string; service_name: string; status: string; provider_amount: number; platform_fee: number; created_at?: string; paid_at?: string | null }
type PortalStatus = { state: 'provider' | 'application' | 'no_application' | 'account_missing'; application_number?: string; application_status?: string; submitted_at?: string; approval_status?: string; background_check_status?: string; payout_ready?: boolean }

const money = (value: unknown) => `$${Number(value || 0).toFixed(2)}`
const when = (value?: string | null) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'On demand'
const statusLabel = (status?: string) => ({
  assigned: 'Accepted', en_route: 'En route', on_site: 'On site', working: 'In service', completed: 'Completed',
  pending: 'Searching', matching: 'Matching', authorized: 'Authorized', transferred: 'Paid', transfer_pending: 'Processing payout', captured: 'Captured',
}[status || ''] || (status || 'Unknown').replaceAll('_', ' '))

const nextStep: Record<string, { status: string; label: string; help: string }> = {
  assigned: { status: 'en_route', label: 'Start route', help: 'Customer payment must be authorized first.' },
  en_route: { status: 'on_site', label: 'I arrived', help: 'Confirm when you reach the service location.' },
  on_site: { status: 'working', label: 'Start service', help: 'Begin only after you and the customer are ready.' },
  working: { status: 'completed', label: 'Complete service', help: 'Completion captures the authorized customer payment.' },
}

const providerRpc = async <T,>(name: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}

function Mark() {
  return <div className="ocp-brand"><div className="ocp-mark">OC</div><div><strong>ON CALL</strong><span>PROVIDER COMMAND</span></div></div>
}

function AuthPanel({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
        const result = await signUp(email.trim(), password, name.trim(), 'provider')
        if (!result.session) {
          setNotice('Provider account created. Confirm your email, then sign in here using the same email as your provider application.')
          setMode('signin')
          return
        }
      } else {
        await signIn(email.trim(), password)
      }
      onReady()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provider account could not be opened.')
    } finally { setBusy(false) }
  }

  return <main className="ocp-auth">
    <section className="ocp-auth-art">
      <a className="ocp-back" href="/">← Customer marketplace</a>
      <Mark />
      <div className="ocp-auth-copy"><span>WORK ON YOUR TERMS</span><h1>Your command center for booked work.</h1><p>Go online, see qualified opportunities, accept the work you want, run the job, and track your real earnings.</p></div>
      <div className="ocp-auth-proof"><div><b>01</b><span>Apply + get approved</span></div><div><b>02</b><span>Complete payout setup</span></div><div><b>03</b><span>Go online + accept work</span></div></div>
    </section>
    <form className="ocp-auth-card" onSubmit={submit}>
      <div className="ocp-segment"><button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>
      {mode === 'signup' && <label>Full name<input required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>}
      <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Same email as your application" /></label>
      <label>Password<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" /></label>
      {error && <div className="ocp-message error">{error}</div>}{notice && <div className="ocp-message notice">{notice}</div>}
      <button className="ocp-primary" disabled={busy}>{busy ? 'Opening Provider Command…' : mode === 'signin' ? 'Enter Provider Command' : 'Create provider account'}</button>
      <button type="button" className="ocp-link" onClick={async () => { if (!email.trim()) return setError('Enter your email first.'); try { await resetPassword(email.trim()); setNotice('Password reset email sent.') } catch (e) { setError(e instanceof Error ? e.message : 'Reset failed.') } }}>Forgot password?</button>
      <div className="ocp-divider"><span>NEW TO THE NETWORK?</span></div>
      <a className="ocp-apply" href="/apply">Apply to become a provider →</a>
    </form>
  </main>
}

function PortalGate({ status, refresh }: { status: PortalStatus; refresh: () => void }) {
  const state = status.application_status || ''
  const pending = ['submitted', 'reviewing', 'background_check', 'pending'].includes(state)
  const declined = ['declined', 'rejected'].includes(state)
  return <main className="ocp-gate"><div className="ocp-gate-card"><Mark />
    {status.state === 'no_application' ? <><span className="ocp-kicker">APPLICATION REQUIRED</span><h1>Your provider account is ready. Your application is next.</h1><p>Provider access only opens after your services and verification are approved.</p><a className="ocp-primary anchor" href="/apply">Start provider application</a></> :
      status.state === 'application' ? <><span className="ocp-kicker">APPLICATION {pending ? 'IN REVIEW' : declined ? 'NOT APPROVED' : state.toUpperCase()}</span><h1>{pending ? 'We have your application.' : declined ? 'Provider access is not active.' : 'Your application status changed.'}</h1><p>{pending ? 'Once the application is approved, sign back in here and Provider Command will activate automatically.' : declined ? 'Review your application details before submitting a new application.' : 'Refresh Provider Command to activate any newly approved access.'}</p><div className="ocp-app-number">{status.application_number || 'APPLICATION'}</div><button className="ocp-primary" onClick={refresh}>Refresh status</button>{declined && <a className="ocp-secondary anchor" href="/apply">Submit a new application</a>}</> :
      <><span className="ocp-kicker">ACCOUNT SETUP</span><h1>Provider access is not connected yet.</h1><p>Reload your account session. If this persists, use the same verified email used on your application.</p><button className="ocp-primary" onClick={refresh}>Reload provider access</button></>}
    <button className="ocp-link" onClick={() => signOut().then(() => window.location.reload())}>Sign out</button>
  </div></main>
}

function Readiness({ snapshot, startPayout }: { snapshot: Snapshot; startPayout: () => void }) {
  const p = snapshot.provider || {}; const c = snapshot.counts || {}
  const items = [
    ['Provider approval', p.approval_status === 'active'],
    ['Background clearance', p.background_check_status === 'passed'],
    ['Payout account', Boolean(p.stripe_onboarding_complete && p.stripe_payouts_enabled)],
    ['Approved services', Number(c.services || 0) > 0],
  ] as const
  return <div className="ocp-readiness"><div className="ocp-section-head"><div><span>LAUNCH READINESS</span><h2>Ready to take work?</h2></div><b>{items.filter(([, ok]) => ok).length}/{items.length}</b></div>
    <div className="ocp-checks">{items.map(([label, ok]) => <div className={ok ? 'done' : ''} key={label}><i>{ok ? '✓' : '!'}</i><span>{label}</span></div>)}</div>
    {!p.stripe_payouts_enabled && <button className="ocp-payout" onClick={startPayout}>Finish payout setup →</button>}
  </div>
}

function OpportunityCard({ item, busy, accept }: { item: Opportunity; busy: boolean; accept: () => void }) {
  return <article className="ocp-offer"><div className="ocp-offer-top"><div><span>{(item.request_type || 'on_demand').replaceAll('_', ' ').toUpperCase()}</span><h3>{item.service_name}</h3><p>{item.category_name || 'ON CALL service'} · {[item.market_city, item.market_state].filter(Boolean).join(', ') || 'Your service area'}</p></div><div className="ocp-offer-price"><strong>{money(item.estimated_provider_payout)}</strong><small>EST. EARNINGS</small></div></div><div className="ocp-offer-meta"><span>{item.scheduled_at ? `Scheduled ${when(item.scheduled_at)}` : 'Requested now'}</span><span>Customer total {money(item.customer_total)}</span></div><button disabled={busy} onClick={accept}>{busy ? 'Accepting…' : 'Accept opportunity'}</button></article>
}

function JobCommand({ detail, busy, advance, close }: { detail: JobDetail; busy: boolean; advance: () => void; close: () => void }) {
  const step = nextStep[detail.status]
  const authorized = detail.payment?.status === 'authorized' || ['captured', 'transfer_pending', 'transferred'].includes(detail.payment?.status || '')
  const canAdvance = detail.status !== 'assigned' || authorized
  const destination = detail.lat != null && detail.lng != null ? `${detail.lat},${detail.lng}` : encodeURIComponent([detail.address, detail.city, detail.state].filter(Boolean).join(', '))
  return <div className="ocp-job-overlay"><section className="ocp-job-command"><header><div><span>ACTIVE SERVICE</span><h2>{detail.service_name}</h2><p>{statusLabel(detail.status)} · {detail.city}{detail.state ? `, ${detail.state}` : ''}</p></div><button onClick={close}>×</button></header>
    <div className="ocp-job-map"><div className="ocp-map-grid"/><div className="ocp-map-pin">OC</div><div className="ocp-map-copy"><span>DESTINATION</span><strong>{detail.address || 'Service address'}</strong><small>{detail.city}{detail.state ? `, ${detail.state}` : ''}</small></div></div>
    <div className="ocp-job-grid"><div><span>CUSTOMER</span><strong>{detail.customer?.first_name || 'Customer'}{detail.customer?.last_initial ? ` ${detail.customer.last_initial}.` : ''}</strong>{detail.customer?.phone && <a href={`tel:${detail.customer.phone}`}>{detail.customer.phone}</a>}</div><div><span>YOUR EARNINGS</span><strong>{detail.payment ? money(detail.payment.provider_amount) : 'After authorization'}</strong><small>{statusLabel(detail.payment?.status || 'pending')}</small></div></div>
    {detail.notes && <div className="ocp-job-notes"><span>CUSTOMER NOTES</span><p>{detail.notes}</p></div>}
    <div className="ocp-job-actions"><a href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`} target="_blank" rel="noreferrer">Open directions</a>{detail.customer?.phone && <a href={`sms:${detail.customer.phone}`}>Message customer</a>}</div>
    {detail.status === 'assigned' && !authorized && <div className="ocp-payment-gate"><b>PAYMENT AUTHORIZATION PENDING</b><span>Do not travel yet. The Start route control unlocks automatically after the customer authorizes payment.</span></div>}
    {step && <div className="ocp-next"><div><span>NEXT STEP</span><strong>{step.label}</strong><small>{step.help}</small></div><button disabled={busy || !canAdvance} onClick={advance}>{busy ? 'Updating…' : step.label}</button></div>}
    {detail.status === 'completed' && <div className="ocp-complete"><b>✓ Service completed</b><span>Payment capture and payout processing are handled by the ON CALL payment lifecycle.</span></div>}
  </section></div>
}

export default function ProviderCommand() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState<Session>(null)
  const [portal, setPortal] = useState<PortalStatus | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>({})
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [tab, setTab] = useState<'home' | 'opportunities' | 'jobs' | 'earnings' | 'account'>('home')
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const watchRef = useRef<number | null>(null)
  const locationWriteRef = useRef(0)

  const loadPortal = useCallback(async () => {
    const current = await getSession(); setSession(current)
    if (!current?.user) { setPortal(null); setBooting(false); return }
    let status = await providerRpc<PortalStatus>('oc_provider_portal_status')
    if (status.state === 'application' && ['approved', 'accepted', 'active'].includes(status.application_status || '')) {
      const activated = await providerRpc<{ activated?: boolean }>('oc_provider_activate_approved_application')
      if (activated.activated) status = await providerRpc<PortalStatus>('oc_provider_portal_status')
    }
    setPortal(status); setBooting(false)
  }, [])

  const refreshCommand = useCallback(async (quiet = false) => {
    if (!session?.user || portal?.state !== 'provider') return
    if (!quiet) setError('')
    try {
      const [snap, offers, pay, jobRows] = await Promise.all([
        providerRpc<Snapshot>('oc_provider_command_snapshot'),
        providerRpc<Opportunity[]>('oc_provider_opportunities'),
        providerRpc<Earning[]>('oc_provider_earnings_feed'),
        supabase.from('oc_bookings').select('id,service_name,category_name,status,request_type,service_address,address,market_city,market_state,service_city,service_state,scheduled_at,total_price,final_price,estimated_price,created_at,accepted_at,completed_at,rating').in('status', ['assigned', 'en_route', 'on_site', 'working', 'completed']).order('created_at', { ascending: false }).limit(50),
      ])
      if (jobRows.error) throw jobRows.error
      setSnapshot(snap || {}); setOpportunities(offers || []); setEarnings(pay || []); setJobs((jobRows.data || []) as Job[])
      if (jobDetail && !['completed'].includes(jobDetail.status)) {
        const updated = await providerRpc<JobDetail>('oc_provider_job_detail', { p_booking_id: jobDetail.id }).catch(() => null)
        if (updated) setJobDetail(updated)
      }
    } catch (e) { if (!quiet) setError(e instanceof Error ? e.message : 'Provider Command could not refresh.') }
  }, [jobDetail, portal?.state, session?.user])

  useEffect(() => { loadPortal().catch(e => { setError(e instanceof Error ? e.message : 'Provider access failed.'); setBooting(false) }) }, [loadPortal])
  useEffect(() => { if (portal?.state === 'provider') refreshCommand(); }, [portal?.state])
  useEffect(() => { if (portal?.state !== 'provider') return; const timer = window.setInterval(() => refreshCommand(true), 12000); const onFocus = () => refreshCommand(true); window.addEventListener('focus', onFocus); return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) } }, [portal?.state, refreshCommand])
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(t) }, [notice])
  useEffect(() => () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current) }, [])

  const writePresence = useCallback(async (available: boolean, position?: GeolocationPosition) => {
    const coords = position?.coords
    await providerRpc('oc_provider_set_presence', { p_available: available, p_lat: coords?.latitude ?? null, p_lng: coords?.longitude ?? null, p_accuracy_meters: coords?.accuracy ?? null, p_heading: coords?.heading ?? null, p_speed_mph: coords?.speed == null ? null : coords.speed * 2.23694 })
  }, [])

  const toggleOnline = async () => {
    if (busyId) return
    const goingOnline = !snapshot.provider?.available
    setBusyId('presence'); setError('')
    try {
      if (!goingOnline) {
        if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null }
        await writePresence(false); setNotice('You are offline.')
      } else {
        if (!navigator.geolocation) throw new Error('Location access is required to go online.')
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }))
        await writePresence(true, position); locationWriteRef.current = Date.now(); setNotice('You are online and available for work.')
        watchRef.current = navigator.geolocation.watchPosition(pos => { if (Date.now() - locationWriteRef.current < 15000) return; locationWriteRef.current = Date.now(); writePresence(true, pos).catch(() => {}) }, () => {}, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
      }
      await refreshCommand(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Availability could not be updated.') } finally { setBusyId('') }
  }

  const openJob = async (id: string) => { setBusyId(`job-${id}`); setError(''); try { setJobDetail(await providerRpc<JobDetail>('oc_provider_job_detail', { p_booking_id: id })) } catch (e) { setError(e instanceof Error ? e.message : 'Job details unavailable.') } finally { setBusyId('') } }
  const accept = async (item: Opportunity) => { setBusyId(item.booking_id); setError(''); try { const booked = await acceptOffer(item.booking_id); setNotice('Opportunity accepted.'); await refreshCommand(true); setTab('jobs'); await openJob(booked.id || item.booking_id) } catch (e) { setError(e instanceof Error ? e.message : 'Opportunity is no longer available.') } finally { setBusyId('') } }
  const advanceJob = async () => { if (!jobDetail) return; const step = nextStep[jobDetail.status]; if (!step) return; setBusyId(jobDetail.id); setError(''); try { await transitionBooking(jobDetail.id, step.status); setNotice(step.status === 'completed' ? 'Service completed. Payment capture started.' : `${step.label} confirmed.`); const updated = await providerRpc<JobDetail>('oc_provider_job_detail', { p_booking_id: jobDetail.id }); setJobDetail(updated); await refreshCommand(true) } catch (e) { setError(e instanceof Error ? e.message : 'Job status could not be updated.') } finally { setBusyId('') } }
  const payout = async () => { setBusyId('payout'); setError(''); try { await startProviderOnboarding() } catch (e) { setError(e instanceof Error ? e.message : 'Payout setup could not start.'); setBusyId('') } }
  const logout = async () => { if (snapshot.provider?.available) await writePresence(false).catch(() => {}); await signOut(); window.location.assign('/provider') }

  const activeJobs = useMemo(() => jobs.filter(j => ['assigned', 'en_route', 'on_site', 'working'].includes(j.status)), [jobs])
  const history = useMemo(() => jobs.filter(j => j.status === 'completed'), [jobs])
  const ready = snapshot.provider?.approval_status === 'active' && snapshot.provider?.background_check_status === 'passed' && snapshot.provider?.stripe_onboarding_complete && snapshot.provider?.stripe_payouts_enabled && Number(snapshot.counts?.services || 0) > 0

  if (booting) return <main className="ocp-loading"><div className="ocp-loading-mark">OC</div><div className="ocp-loading-line"/><span>Opening Provider Command</span></main>
  if (!session?.user) return <AuthPanel onReady={() => { setBooting(true); loadPortal().catch(() => setBooting(false)) }} />
  if (!portal || portal.state !== 'provider') return <PortalGate status={portal || { state: 'account_missing' }} refresh={() => { setBooting(true); loadPortal().catch(() => setBooting(false)) }} />

  const home = <><section className="ocp-hero"><div className="ocp-hero-bg"/><div className="ocp-hero-copy"><span>{snapshot.provider?.available ? 'YOU ARE ONLINE' : 'PROVIDER COMMAND'}</span><h1>{snapshot.provider?.available ? 'Ready for your next job.' : `Good to see you${snapshot.user?.name ? `, ${snapshot.user.name.split(' ')[0]}` : ''}.`}</h1><p>{snapshot.provider?.available ? `${snapshot.counts?.opportunities || 0} opportunities currently match your approved services.` : 'Go online when you are ready to receive qualified service opportunities.'}</p></div><button className={`ocp-online ${snapshot.provider?.available ? 'active' : ''}`} disabled={busyId === 'presence' || (!ready && !snapshot.provider?.available)} onClick={toggleOnline}><i/><span>{busyId === 'presence' ? 'UPDATING' : snapshot.provider?.available ? 'GO OFFLINE' : ready ? 'GO ONLINE' : 'SETUP REQUIRED'}</span></button></section>
    <section className="ocp-metrics"><div><span>TODAY</span><strong>{money(snapshot.earnings?.today)}</strong><small>paid earnings</small></div><div><span>THIS WEEK</span><strong>{money(snapshot.earnings?.week)}</strong><small>paid earnings</small></div><div><span>RATING</span><strong>{Number(snapshot.provider?.rating || 5).toFixed(1)}</strong><small>{snapshot.counts?.completed_jobs || 0} completed</small></div></section>
    {activeJobs.length > 0 && <section className="ocp-live"><div className="ocp-section-head"><div><span>ACTIVE NOW</span><h2>Finish what’s in motion.</h2></div><b>{activeJobs.length}</b></div>{activeJobs.map(job => <button key={job.id} onClick={() => openJob(job.id)}><i className={`status ${job.status}`}/><div><strong>{job.service_name}</strong><span>{statusLabel(job.status)} · {job.service_city || job.market_city || 'Service location'}</span></div><em>OPEN</em></button>)}</section>}
    {!ready && <Readiness snapshot={snapshot} startPayout={payout} />}
    <section className="ocp-home-grid"><button onClick={() => setTab('opportunities')}><span>OPPORTUNITIES</span><strong>{snapshot.counts?.opportunities || 0}</strong><small>Qualified requests</small></button><button onClick={() => setTab('earnings')}><span>PENDING PAYOUT</span><strong>{money(snapshot.earnings?.pending)}</strong><small>Authorized / processing</small></button><button onClick={() => setTab('jobs')}><span>COMPLETED</span><strong>{snapshot.counts?.completed_jobs || 0}</strong><small>Service history</small></button><button onClick={() => setTab('account')}><span>APPROVED SERVICES</span><strong>{snapshot.counts?.services || 0}</strong><small>{snapshot.provider?.service_area_radius || 25} mile radius</small></button></section>
  </>

  return <div className="ocp-app"><header className="ocp-top"><Mark/><div className="ocp-top-actions"><div className={`ocp-live-dot ${snapshot.provider?.available ? 'active' : ''}`}><i/>{snapshot.provider?.available ? 'ONLINE' : 'OFFLINE'}</div><button onClick={() => setTab('account')}>{snapshot.user?.name?.[0] || 'P'}</button></div></header>
    <aside className="ocp-desktop-nav"><Mark/>{[['home','⌂','Home'],['opportunities','◎','Opportunities'],['jobs','▤','Jobs'],['earnings','$','Earnings'],['account','◉','Account']].map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}><b>{icon}</b><span>{label}</span>{id === 'opportunities' && Number(snapshot.counts?.opportunities || 0) > 0 && <em>{snapshot.counts?.opportunities}</em>}</button>)}</aside>
    <main className="ocp-content">{error && <div className="ocp-global-error">{error}<button onClick={() => setError('')}>×</button></div>}{notice && <div className="ocp-toast">{notice}</div>}
      {tab === 'home' && home}
      {tab === 'opportunities' && <section className="ocp-screen"><div className="ocp-screen-head"><span>LIVE OPPORTUNITIES</span><h1>Work that matches you.</h1><p>Only jobs mapped to your approved services appear here. Precise customer details unlock after acceptance.</p></div>{!snapshot.provider?.available ? <div className="ocp-empty"><b>OFFLINE</b><h2>Go online to receive work.</h2><p>Your service catalog stays ready without exposing customer requests while you are offline.</p><button disabled={!ready} onClick={toggleOnline}>{ready ? 'Go online' : 'Complete setup first'}</button></div> : opportunities.length === 0 ? <div className="ocp-empty"><b>LIVE</b><h2>No matching requests right now.</h2><p>Provider Command refreshes automatically while you stay online.</p></div> : <div className="ocp-offer-grid">{opportunities.map(item => <OpportunityCard key={item.booking_id} item={item} busy={busyId === item.booking_id} accept={() => accept(item)} />)}</div>}</section>}
      {tab === 'jobs' && <section className="ocp-screen"><div className="ocp-screen-head"><span>YOUR JOBS</span><h1>Run every service cleanly.</h1><p>Payment-gated routing, live status, customer contact, and completed history.</p></div>{activeJobs.length > 0 && <><div className="ocp-subhead">ACTIVE</div><div className="ocp-job-list">{activeJobs.map(job => <button key={job.id} onClick={() => openJob(job.id)}><i className={`status ${job.status}`}/><div><strong>{job.service_name}</strong><span>{statusLabel(job.status)} · {job.service_city || job.market_city || 'Service location'}</span><small>{when(job.scheduled_at || job.accepted_at)}</small></div><em>→</em></button>)}</div></>}{history.length > 0 && <><div className="ocp-subhead">COMPLETED</div><div className="ocp-job-list completed">{history.map(job => <button key={job.id} onClick={() => openJob(job.id)}><i className="status completed"/><div><strong>{job.service_name}</strong><span>{job.service_city || job.market_city || 'Service location'} · {job.rating ? `${job.rating}/5 rating` : 'Not rated yet'}</span><small>{when(job.completed_at || job.created_at)}</small></div><em>{money(job.total_price || job.final_price || job.estimated_price)}</em></button>)}</div></>}{jobs.length === 0 && <div className="ocp-empty"><b>0 JOBS</b><h2>Your accepted work will live here.</h2><p>Go online and accept a qualified opportunity to start your first service.</p></div>}</section>}
      {tab === 'earnings' && <section className="ocp-screen"><div className="ocp-screen-head"><span>EARNINGS</span><h1>Know exactly what you made.</h1><p>Numbers come from the real ON CALL payment ledger—no estimated history or placeholder income.</p></div><div className="ocp-earnings-hero"><span>PAID TO DATE</span><strong>{money(snapshot.earnings?.total)}</strong><div><b>{money(snapshot.earnings?.week)}</b><small>This week</small><b>{money(snapshot.earnings?.pending)}</b><small>Pending</small></div></div>{earnings.length === 0 ? <div className="ocp-empty"><b>$0</b><h2>No payment history yet.</h2><p>Completed paid services will appear here automatically.</p></div> : <div className="ocp-earning-list">{earnings.map(row => <article key={row.payment_id}><div><strong>{row.service_name}</strong><span>{when(row.paid_at || row.created_at)}</span></div><div><b>{money(row.provider_amount)}</b><small>{statusLabel(row.status)}</small></div></article>)}</div>}</section>}
      {tab === 'account' && <section className="ocp-screen"><div className="ocp-profile-card"><div className="ocp-profile-avatar">{snapshot.user?.name?.[0] || 'P'}</div><span>ON CALL PROVIDER</span><h1>{snapshot.user?.name || 'Provider'}</h1><p>{snapshot.user?.email}</p><div className="ocp-profile-stats"><div><strong>{Number(snapshot.provider?.rating || 5).toFixed(1)}</strong><span>Rating</span></div><div><strong>{snapshot.counts?.completed_jobs || 0}</strong><span>Jobs</span></div><div><strong>{snapshot.counts?.services || 0}</strong><span>Services</span></div></div></div><Readiness snapshot={snapshot} startPayout={payout} /><div className="ocp-account-list"><button onClick={toggleOnline}><span>{snapshot.provider?.available ? 'Go offline' : 'Availability'}</span><small>{snapshot.provider?.available ? 'Currently receiving matching opportunities' : 'Go online when ready to work'}</small><em>→</em></button><button onClick={payout}><span>Payout account</span><small>{snapshot.provider?.stripe_payouts_enabled ? 'Connected and ready' : 'Finish Stripe payout setup'}</small><em>→</em></button><button onClick={() => window.location.assign('/apply')}><span>Provider application</span><small>Services and verification intake</small><em>→</em></button><button className="danger" onClick={logout}><span>Sign out</span><small>End this Provider Command session</small><em>→</em></button></div></section>}
    </main>
    <nav className="ocp-mobile-nav">{[['home','⌂','Home'],['opportunities','◎','Offers'],['jobs','▤','Jobs'],['earnings','$','Earn'],['account','◉','Account']].map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}><b>{icon}</b><span>{label}</span>{id === 'opportunities' && Number(snapshot.counts?.opportunities || 0) > 0 && <em>{snapshot.counts?.opportunities}</em>}</button>)}</nav>
    {jobDetail && <JobCommand detail={jobDetail} busy={busyId === jobDetail.id} advance={advanceJob} close={() => setJobDetail(null)} />}
  </div>
}
