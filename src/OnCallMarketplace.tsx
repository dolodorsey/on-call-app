import React, { useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { supabase, createBookingPayment } from './supabase'
import {
  bookingStage,
  cancelMarketplaceBooking,
  createMarketplaceBooking,
  loadMarketplaceBookings,
  loadMarketplaceCatalog,
  loadMarketplaceProfile,
  rateMarketplaceBooking,
  type MarketplaceBooking,
  type MarketplaceCategory,
  type MarketplaceService,
} from './marketplace-client'

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

const CATEGORY_SYMBOLS: Record<string,string> = {
  home_care: '⌂', repairs: '⌁', outdoor: '✤', auto: '◉', moving: '▣', personal: '✦',
  family_pet: '♡', events: '◇', business: '▤', tech: '⌁', wellness: '◌', premium: '♛',
}
const CATEGORY_TONES: Record<string,string> = {
  home_care:'blue',repairs:'orange',outdoor:'green',auto:'cyan',moving:'violet',personal:'rose',
  family_pet:'pink',events:'amber',business:'slate',tech:'indigo',wellness:'teal',premium:'gold',
}
const STATUS_LABEL: Record<string,string> = {
  pending:'Request received',matching:'Finding a provider',assigned:'Provider assigned',en_route:'Provider en route',
  on_site:'Provider arrived',working:'Service in progress',completed:'Service completed',canceled:'Canceled',
}
const TRACK_STEPS = ['requested','matching','assigned','en_route','on_site','working','completed']
const stageRank = (status:string) => Math.max(0,TRACK_STEPS.indexOf(bookingStage(status)))
const openProfileTool=(tool:'addresses'|'payments'|'recurring')=>window.dispatchEvent(new CustomEvent('oncall:open-profile-tool',{detail:{tool}}))
const currentLocation = () => new Promise<{latitude:number|null;longitude:number|null;label:string}>(resolve => {
  if (!navigator.geolocation) { resolve({latitude:null,longitude:null,label:'Enter service address'}); return }
  navigator.geolocation.getCurrentPosition(
    position => resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,label:`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`}),
    () => resolve({latitude:null,longitude:null,label:'Enter service address'}),
    { enableHighAccuracy:true, timeout:10000, maximumAge:30000 },
  )
})

function Brand() {
  return <div className="oc2-brand"><div className="oc2-mark"><span>OC</span></div><div><strong>ON CALL</strong><small>Your button for everything</small></div></div>
}

function ServiceSymbol({ service }: { service: MarketplaceService }) {
  return <span className={`oc2-symbol ${CATEGORY_TONES[service.category_id] || 'blue'}`}>{CATEGORY_SYMBOLS[service.category_id] || '•'}</span>
}

function PaymentAuthorization({ clientSecret, onAuthorized }: { clientSecret:string; onAuthorized:()=>void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const submit = async () => {
    if (!stripe || !elements || busy) return
    setBusy(true);setError('')
    const result = await stripe.confirmPayment({ elements, redirect:'if_required' })
    if (result.error) setError(result.error.message || 'Payment authorization failed')
    else onAuthorized()
    setBusy(false)
  }
  return <div className="oc2-payment-panel"><PaymentElement/><button onClick={submit} disabled={!stripe||busy}>{busy?'Authorizing…':'Authorize service total'}</button>{error&&<p>{error}</p>}<small>Your card is authorized now and captured after the provider completes the work.</small></div>
}

function Tracker({ booking, token, onClose, onChanged }: { booking:MarketplaceBooking; token:string; onClose:()=>void; onChanged:(booking:MarketplaceBooking)=>void }) {
  const [current,setCurrent] = useState(booking)
  const [error,setError] = useState('')
  const [canceling,setCanceling] = useState(false)
  const rank = stageRank(current.status)
  const provider = current.provider
  const providerName = provider?.user?.full_name || 'Assigned ON CALL provider'
  const mapLat = current.lat ?? 33.749
  const mapLng = current.lng ?? -84.388
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng-.04}%2C${mapLat-.03}%2C${mapLng+.04}%2C${mapLat+.03}&layer=mapnik&marker=${mapLat}%2C${mapLng}`

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const { data, error: refreshError } = await supabase
        .from('oc_bookings')
        .select('*,provider:oc_provider_profiles!oc_bookings_provider_id_fkey(id,rating,total_jobs,user:oc_users!oc_provider_profiles_user_id_fkey(full_name))')
        .eq('id', current.id)
        .single()
      if (!active) return
      if (refreshError) setError(refreshError.message)
      else { setCurrent(data as MarketplaceBooking); onChanged(data as MarketplaceBooking) }
    }
    refresh()
    const timer = window.setInterval(refresh,5000)
    return () => { active=false;window.clearInterval(timer) }
  },[current.id,onChanged])

  const cancel = async () => {
    setCanceling(true);setError('')
    try { const next = await cancelMarketplaceBooking(current.id);setCurrent(next);onChanged(next) }
    catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel') }
    finally { setCanceling(false) }
  }

  return <div className="oc2-tracker" role="dialog" aria-modal="true">
    <div className="oc2-tracker-map"><iframe title="ON CALL service map" src={mapUrl}/><div className="oc2-map-shade"/><div className="oc2-map-pin"><span>OC</span><i/></div><div className="oc2-live-pill"><span/> LIVE BOOKING</div></div>
    <section className="oc2-tracker-sheet"><div className="oc2-handle"/><div className="oc2-tracker-head"><div><small>{current.category_name || 'ON CALL SERVICE'}</small><h2>{STATUS_LABEL[current.status] || current.status}</h2><p>{current.status==='matching'?'Your request is visible to approved providers qualified for this service.':current.provider_id?`${providerName} is connected to your booking.`:'Your request is active. Provider assignment will appear only after a qualified provider accepts.'}</p></div><button onClick={onClose}>—</button></div>
      {provider&&<div className="oc2-provider-card"><div>{providerName.split(' ').map(part=>part[0]).slice(0,2).join('')}</div><span><small>APPROVED PROVIDER</small><strong>{providerName}</strong><em>★ {Number(provider.rating||5).toFixed(1)} · {provider.total_jobs||0} jobs</em></span></div>}
      <div className="oc2-progress">{TRACK_STEPS.map((step,index)=><div key={step} className={`${index<=rank?'done':''} ${index===rank?'current':''}`}><span>{index<rank?'✓':index+1}</span><small>{step.replace('_',' ')}</small></div>)}</div>
      <div className="oc2-booking-facts"><div><small>SERVICE</small><strong>{current.service_name}</strong></div><div><small>{current.request_type==='recurring'?'RECURRING':current.scheduled_at?'SCHEDULED':'STARTING TOTAL'}</small><strong>{current.request_type==='recurring'?current.recurring_rule:current.scheduled_at?new Date(current.scheduled_at).toLocaleString():`$${Number(current.total_price).toFixed(0)}`}</strong></div></div>
      {error&&<div className="oc2-inline-error">{error}</div>}
      {['pending','matching','assigned'].includes(current.status)&&<button className="oc2-cancel" onClick={cancel} disabled={canceling}>{canceling?'Canceling…':'Cancel booking'}</button>}
      <p className="oc2-truth">Provider identity, movement, payment, and completion states appear only from live booking records.</p>
    </section>
  </div>
}

export default function OnCallMarketplace() {
  const [booting,setBooting] = useState(true)
  const [session,setSession] = useState<any>(null)
  const [profile,setProfile] = useState<any>(null)
  const [categories,setCategories] = useState<MarketplaceCategory[]>([])
  const [services,setServices] = useState<MarketplaceService[]>([])
  const [bookings,setBookings] = useState<MarketplaceBooking[]>([])
  const [activeBooking,setActiveBooking] = useState<MarketplaceBooking|null>(null)
  const [trackerOpen,setTrackerOpen] = useState(false)
  const [tab,setTab] = useState<'home'|'services'|'bookings'|'profile'>('home')
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('all')
  const [selected,setSelected] = useState<MarketplaceService|null>(null)
  const [mode,setMode] = useState<'now'|'schedule'|'recurring'>('now')
  const [address,setAddress] = useState('')
  const [latitude,setLatitude] = useState<number|null>(null)
  const [longitude,setLongitude] = useState<number|null>(null)
  const [schedule,setSchedule] = useState('')
  const [recurrence,setRecurrence] = useState('weekly')
  const [notes,setNotes] = useState('')
  const [bookingBusy,setBookingBusy] = useState(false)
  const [bookingError,setBookingError] = useState('')
  const [authMode,setAuthMode] = useState<'signin'|'signup'>('signin')
  const [authName,setAuthName] = useState('')
  const [authEmail,setAuthEmail] = useState('')
  const [authPassword,setAuthPassword] = useState('')
  const [authBusy,setAuthBusy] = useState(false)
  const [authError,setAuthError] = useState('')
  const [payment,setPayment] = useState<{bookingId:string;clientSecret:string}|null>(null)
  const [toast,setToast] = useState('')

  const refreshBookings = async (nextProfile=profile) => {
    if (!nextProfile?.id) return
    const next = await loadMarketplaceBookings(nextProfile.id)
    setBookings(next)
    const live = next.find(booking=>!['completed','canceled'].includes(booking.status)) || null
    setActiveBooking(live)
  }

  useEffect(() => {
    let active=true
    ;(async()=>{
      try {
        const [{categories:nextCategories,services:nextServices},{data:{session:nextSession}}] = await Promise.all([loadMarketplaceCatalog(),supabase.auth.getSession()])
        if (!active) return
        setCategories(nextCategories);setServices(nextServices);setSession(nextSession)
        if (nextSession?.user) {
          const nextProfile = await loadMarketplaceProfile(nextSession.user.id)
          if (nextProfile.role==='provider') { window.location.assign('/provider');return }
          setProfile(nextProfile);await refreshBookings(nextProfile)
        }
      } catch (error) { setAuthError(error instanceof Error?error.message:'ON CALL could not start') }
      finally { if(active)setBooting(false) }
    })()
    const {data} = supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession))
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2200);return()=>clearTimeout(timer)},[toast])

  const popular = useMemo(()=>['deep_clean','handyman','lawn_cut','mobile_detail','pickup_delivery','personal_assistant','massage','urgent_request'].map(id=>services.find(service=>service.id===id)).filter(Boolean) as MarketplaceService[],[services])
  const filtered = useMemo(()=>services.filter(service=>(category==='all'||service.category_id===category)&&(!query||`${service.name} ${service.description||''} ${service.category_id}`.toLowerCase().includes(query.toLowerCase()))),[services,category,query])

  const authenticate = async (event:React.FormEvent) => {
    event.preventDefault();if(authBusy)return;setAuthBusy(true);setAuthError('')
    try {
      if(authMode==='signup') {
        const {error} = await supabase.auth.signUp({email:authEmail,password:authPassword,options:{data:{full_name:authName,app:'on_call'}}})
        if(error)throw error
      }
      const {data,error} = await supabase.auth.signInWithPassword({email:authEmail,password:authPassword})
      if(error)throw error
      const nextProfile = await loadMarketplaceProfile(data.user.id)
      setSession(data.session);setProfile(nextProfile);await refreshBookings(nextProfile)
    } catch (error) { setAuthError(error instanceof Error?error.message:'Authentication failed') }
    finally { setAuthBusy(false) }
  }

  const useLocation = async () => {
    const location = await currentLocation();setLatitude(location.latitude);setLongitude(location.longitude)
    if (location.latitude!=null && !address) setAddress(location.label)
    if (location.latitude==null) setToast('Enter the service address manually.')
  }

  const openService = (service:MarketplaceService) => {
    setSelected(service);setBookingError('');setMode(service.on_demand_available?'now':'schedule');setSchedule('');setRecurrence('weekly');setNotes('')
  }

  const submitBooking = async () => {
    if(!selected||bookingBusy)return
    setBookingBusy(true);setBookingError('')
    try {
      if(address.trim().length<3)throw new Error('Enter the full service address.')
      if(mode==='schedule'&&!schedule)throw new Error('Choose a service date and time.')
      const next = await createMarketplaceBooking({
        serviceId:selected.id,address:address.trim(),latitude,longitude,
        scheduledAt:mode==='now'?null:new Date(schedule).toISOString(),
        recurringRule:mode==='recurring'?recurrence:null,notes,
      })
      setSelected(null);setActiveBooking(next);setTrackerOpen(true);setToast('Your ON CALL request is live.');await refreshBookings(profile)
    } catch (error) { setBookingError(error instanceof Error?error.message:'Booking could not be created') }
    finally { setBookingBusy(false) }
  }

  const startPayment = async (booking:MarketplaceBooking) => {
    try {
      const result = await createBookingPayment(booking.id)
      setPayment({bookingId:booking.id,clientSecret:result.clientSecret})
    } catch (error) { setToast(error instanceof Error?error.message:'Payment authorization is unavailable') }
  }

  if(booting)return <div className="oc2-loading"><div className="oc2-loader-mark">OC</div><div className="oc2-loader-line"/><span>Opening your service network</span></div>
  if(!session)return <div className="oc2-auth"><div className="oc2-auth-scene"><div className="oc2-orbit"><i/><i/><i/><span>OC</span></div><Brand/><div className="oc2-auth-copy"><span>ONE APP. EVERYDAY LIFE.</span><h1>Whatever you need.<br/><em>Put it ON CALL.</em></h1><p>Book trusted help now, schedule it later, or make it recurring.</p></div></div><form onSubmit={authenticate} className="oc2-auth-panel"><div className="oc2-segmented"><button type="button" className={authMode==='signin'?'active':''} onClick={()=>setAuthMode('signin')}>Sign in</button><button type="button" className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div>{authMode==='signup'&&<label>Full name<input required value={authName} onChange={event=>setAuthName(event.target.value)}/></label>}<label>Email<input required type="email" value={authEmail} onChange={event=>setAuthEmail(event.target.value)}/></label><label>Password<input required minLength={8} type="password" value={authPassword} onChange={event=>setAuthPassword(event.target.value)}/></label>{authError&&<div className="oc2-error">{authError}</div>}<button className="oc2-primary" disabled={authBusy}>{authBusy?'Connecting…':authMode==='signin'?'Enter ON CALL':'Create account'}</button><a className="oc2-provider-link" href="/apply">Want to earn with ON CALL? Apply as a provider →</a></form></div>

  return <div className="oc2-app">
    <header className="oc2-topbar"><Brand/><div className="oc2-desktop-actions"><button onClick={useLocation}>⌖ <span>{address||'Set location'}</span></button><button onClick={()=>setTab('services')}>⌕ <span>Search</span></button><button onClick={()=>setTab('bookings')}>▣ <span>Bookings</span></button><button onClick={()=>setTab('profile')}>● <span>Account</span></button></div><button className="oc2-avatar" onClick={()=>setTab('profile')}>{profile?.full_name?.[0]||session.user.email?.[0]||'U'}</button></header>
    <main className="oc2-content">
      {tab==='home'&&<>
        <section className="oc2-home-hero"><div className="oc2-city-grid"><i/><i/><i/><i/><i/></div><div className="oc2-home-copy"><span>72 SERVICES · TRUSTED PROFESSIONALS</span><h1>What do you need done?</h1><p>On demand or on your schedule.</p><button className="oc2-search-launch" onClick={()=>setTab('services')}><span>⌕</span><strong>Describe what you need…</strong><em>›</em></button><div className="oc2-home-modes"><button onClick={()=>setTab('services')}><b>ϟ</b><span><strong>Get Help Now</strong><small>On-demand · Fastest</small></span></button><button onClick={()=>setTab('services')}><b>▣</b><span><strong>Schedule for Later</strong><small>Pick date &amp; time</small></span></button></div></div></section>
        {activeBooking&&<button className="oc2-active-booking" onClick={()=>setTrackerOpen(true)}><span><small>LIVE BOOKING</small><strong>{activeBooking.service_name}</strong><em>{STATUS_LABEL[activeBooking.status]||activeBooking.status}</em></span><b>OPEN</b></button>}
        <section className="oc2-popular"><div className="oc2-section-title"><span>POPULAR NOW</span><h2>Tap. Book. Done.</h2></div><div className="oc2-popular-grid">{popular.map(service=><button key={service.id} onClick={()=>openService(service)}><ServiceSymbol service={service}/><strong>{service.name}</strong><small>{service.on_demand_available?'Available now':'Schedule'}</small><em>${Number(service.base_price).toFixed(0)}+</em></button>)}</div></section>
        <section className="oc2-category-section"><div className="oc2-section-title"><span>EVERYTHING ON CALL</span><h2>Browse the network</h2></div><div className="oc2-category-grid">{categories.map(item=><button key={item.id} onClick={()=>{setCategory(item.id);setTab('services')}}><span className={`oc2-category-symbol ${CATEGORY_TONES[item.id]||'blue'}`}>{CATEGORY_SYMBOLS[item.id]||'•'}</span><strong>{item.name}</strong><small>{services.filter(service=>service.category_id===item.id).length} services</small></button>)}</div></section>
        <section className="oc2-provider-banner"><div><span>PROVIDER NETWORK</span><h2>Turn your skills<br/>into income.</h2><p>Apply, get verified, choose your services, and accept work on your schedule.</p></div><a href="/apply">Apply to provide</a></section>
      </>}
      {tab==='services'&&<section className="oc2-screen"><div className="oc2-screen-head"><span>SERVICE MARKETPLACE</span><h1>Browse Services</h1><p>Find trusted professionals for any job, on your schedule. · {filtered.length} services across {categories.length} categories.</p></div><div className="oc2-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Clean, repair, move, style, staff…"/>{query&&<button onClick={()=>setQuery('')}>×</button>}</div><div className="oc2-filter-rail"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>All</button>{categories.map(item=><button key={item.id} className={category===item.id?'active':''} onClick={()=>setCategory(item.id)}>{item.name}</button>)}</div><div className="oc2-service-list">{filtered.map(service=><button key={service.id} onClick={()=>openService(service)}><ServiceSymbol service={service}/><div><strong>{service.name}</strong><p>{service.description}</p><small>{service.on_demand_available?'ON DEMAND':''}{service.on_demand_available&&service.scheduled_available?' · ':''}{service.scheduled_available?'SCHEDULED':''}{service.recurring_available?' · RECURRING':''}</small></div><em>${Number(service.base_price).toFixed(0)}+</em></button>)}</div></section>}
      {tab==='bookings'&&<section className="oc2-screen"><div className="oc2-screen-head"><span>MY ON CALL</span><h1>Bookings.</h1><p>Requests, assignments, payments, and completed work.</p></div>{bookings.length===0?<div className="oc2-empty"><span>◎</span><h2>No bookings yet.</h2><p>Your services will appear here from request through completion.</p><button onClick={()=>setTab('services')}>Browse services</button></div>:<div className="oc2-booking-list">{bookings.map(booking=><article key={booking.id}><button className="oc2-booking-main" onClick={()=>{setActiveBooking(booking);setTrackerOpen(true)}}><span className={`oc2-status ${booking.status}`}/><div><strong>{booking.service_name}</strong><p>{booking.address}</p><small>{new Date(booking.created_at).toLocaleString()} · {STATUS_LABEL[booking.status]||booking.status}</small></div><em>${Number(booking.total_price).toFixed(0)}</em></button>{booking.status==='assigned'&&<button className="oc2-pay-action" onClick={()=>startPayment(booking)}>Authorize payment</button>}{booking.status==='completed'&&!booking.rating&&<div className="oc2-rating">Rate service {[1,2,3,4,5].map(value=><button key={value} onClick={async()=>{await rateMarketplaceBooking(booking.id,value);await refreshBookings();setToast('Rating saved.')}}>★</button>)}</div>}</article>)}</div>}</section>}
      {tab==='profile'&&<section className="oc2-screen"><div className="oc2-profile"><div>{profile?.full_name?.split(' ').map((part:string)=>part[0]).slice(0,2).join('')||'OC'}</div><span>CUSTOMER ACCOUNT</span><h1>{profile?.full_name||session.user.email}</h1><p>{session.user.email}</p></div><div className="oc2-menu"><button onClick={()=>openProfileTool('addresses')}><span>⌂</span><div><strong>Saved addresses</strong><small>Home, work, and service locations</small></div><em>›</em></button><button onClick={()=>openProfileTool('payments')}><span>▣</span><div><strong>Payment methods</strong><small>Secure service authorizations</small></div><em>›</em></button><button onClick={()=>openProfileTool('recurring')}><span>↻</span><div><strong>Recurring services</strong><small>Manage weekly and monthly work</small></div><em>›</em></button><a href="/apply"><span>＋</span><div><strong>Become a provider</strong><small>Apply to earn through ON CALL</small></div><em>›</em></a><button className="danger" onClick={async()=>{await supabase.auth.signOut();setSession(null);setProfile(null);setBookings([])}}><span>↪</span><div><strong>Sign out</strong><small>End this session</small></div><em>›</em></button></div></section>}
    </main>
    <nav className="oc2-nav">{([['home','⌂','Home'],['services','◇','Services'],['bookings','◎','Bookings'],['profile','○','Profile']] as const).map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>
    {selected&&<div className="oc2-backdrop" onMouseDown={()=>setSelected(null)}><section className="oc2-service-sheet" onMouseDown={event=>event.stopPropagation()}><div className="oc2-handle"/><button className="oc2-close" onClick={()=>setSelected(null)}>×</button><ServiceSymbol service={selected}/><span>{categories.find(item=>item.id===selected.category_id)?.name||'ON CALL SERVICE'}</span><h2>{selected.name}</h2><p>{selected.description}</p><div className="oc2-mode-tabs">{selected.on_demand_available&&<button className={mode==='now'?'active':''} onClick={()=>setMode('now')}>Now</button>}{selected.scheduled_available&&<button className={mode==='schedule'?'active':''} onClick={()=>setMode('schedule')}>Schedule</button>}{selected.recurring_available&&<button className={mode==='recurring'?'active':''} onClick={()=>setMode('recurring')}>Recurring</button>}</div><div className="oc2-price-row"><div><small>STARTING PRICE</small><strong>${Number(selected.base_price).toFixed(0)}</strong><em>{selected.pricing_unit}</em></div><div><small>ESTIMATED TIME</small><strong>{selected.duration_minutes||'—'}</strong><em>minutes</em></div></div><label className="oc2-field">Service address<div><input value={address} onChange={event=>setAddress(event.target.value)} placeholder="Full address"/><button onClick={useLocation}>⌖</button></div></label>{mode!=='now'&&<label className="oc2-field">Date and time<input type="datetime-local" value={schedule} onChange={event=>setSchedule(event.target.value)}/></label>}{mode==='recurring'&&<label className="oc2-field">Repeat<select value={recurrence} onChange={event=>setRecurrence(event.target.value)}><option value="weekly">Every week</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Every month</option></select></label>}<label className="oc2-field">Instructions<textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Access, preferences, details…"/></label>{bookingError&&<div className="oc2-error">{bookingError}</div>}<button className="oc2-primary" disabled={bookingBusy} onClick={submitBooking}>{bookingBusy?'Creating your booking…':mode==='now'?'Request ON CALL provider':'Book service'}</button><p className="oc2-truth">Provider identity and arrival timing appear only after a qualified provider accepts. Final pricing may change only through disclosed approved adjustments.</p></section></div>}
    {trackerOpen&&activeBooking&&<Tracker booking={activeBooking} token={session.access_token} onClose={()=>{setTrackerOpen(false);refreshBookings()}} onChanged={next=>setActiveBooking(next)}/>} 
    {payment&&stripePromise&&<div className="oc2-backdrop" onMouseDown={()=>setPayment(null)}><section className="oc2-payment-sheet" onMouseDown={event=>event.stopPropagation()}><div className="oc2-handle"/><button className="oc2-close" onClick={()=>setPayment(null)}>×</button><span>SECURE AUTHORIZATION</span><h2>Authorize your ON CALL service.</h2><Elements stripe={stripePromise} options={{clientSecret:payment.clientSecret,appearance:{theme:'night'}}}><PaymentAuthorization clientSecret={payment.clientSecret} onAuthorized={()=>{setPayment(null);refreshBookings();setToast('Payment authorized.')}}/></Elements></section></div>}
    {toast&&<div className="oc2-toast">{toast}</div>}
  </div>
}
