import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import OnCallMarketplace from './OnCallMarketplace'

type Category={id:string;name:string;description?:string;icon_key?:string}
type Service={id:string;category_id:string;name:string;description?:string;base_price:number;pricing_unit:string;duration_minutes?:number;on_demand_available:boolean}

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0))

export default function OnCallEntry(){
  const [session,setSession]=useState<any>(null)
  const [categories,setCategories]=useState<Category[]>([])
  const [services,setServices]=useState<Service[]>([])
  const [query,setQuery]=useState('')
  const [category,setCategory]=useState('all')
  const [routeCategory,setRouteCategory]=useState(()=>decodeURIComponent(location.pathname.match(/^\/services\/([^/]+)/)?.[1]||''))
  const [authOpen,setAuthOpen]=useState(false)
  const [selectedService,setSelectedService]=useState('')
  const [mode,setMode]=useState<'signin'|'signup'>('signin')
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    let active=true
    supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)})
    Promise.all([
      supabase.from('oc_service_categories').select('id,name,description,icon_key').eq('is_active',true).order('sort_order'),
      supabase.from('oc_service_catalog').select('id,category_id,name,description,base_price,pricing_unit,duration_minutes,on_demand_available').eq('is_active',true).order('sort_order'),
    ]).then(([cats,items])=>{if(!active)return;if(!cats.error)setCategories((cats.data||[]) as Category[]);if(!items.error)setServices((items.data||[]) as Service[])})
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next)})
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])

  useEffect(()=>{const sync=()=>{const next=decodeURIComponent(location.pathname.match(/^\/services\/([^/]+)/)?.[1]||'');setRouteCategory(next);setCategory(next||'all');setQuery('');window.scrollTo({top:0})};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[])

  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase()
    const selectedCategory=routeCategory||category
    return services.filter(service=>(selectedCategory==='all'||service.category_id===selectedCategory)&&(!needle||`${service.name} ${service.description||''}`.toLowerCase().includes(needle)))
  },[services,query,category,routeCategory])
  const activeCategory=categories.find(item=>item.id===routeCategory)
  const categoryCounts=useMemo(()=>new Map(categories.map(item=>[item.id,services.filter(service=>service.category_id===item.id).length])),[categories,services])
  const openCategory=(id:string)=>{history.pushState({onCallInternal:true},'',`/services/${encodeURIComponent(id)}`);setRouteCategory(id);setCategory(id);setQuery('');window.scrollTo({top:0,behavior:'smooth'})}
  const goHome=()=>{history.pushState({onCallInternal:true},'','/');setRouteCategory('');setCategory('all');setQuery('');window.scrollTo({top:0,behavior:'smooth'})}
  const goBack=()=>history.state?.onCallInternal?history.back():goHome()
  const openAuth=(service='')=>{setSelectedService(service);setAuthOpen(true);setError('');setNotice(service?`Sign in or create an account to request ${service}.`:'')}

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const cleanEmail=email.trim().toLowerCase()
      if(mode==='signup'){
        if(name.trim().length<2)throw new Error('Enter your full name.')
        const {data,error:signupError}=await supabase.auth.signUp({email:cleanEmail,password,options:{data:{full_name:name.trim(),app:'on_call'},emailRedirectTo:'https://oncallallday.com/auth/confirm'}})
        if(signupError)throw signupError
        if(data.session){setSession(data.session);return}
        setNotice('Account created. Check your email to confirm your address, then sign in.')
        setMode('signin');setPassword('');return
      }
      const {data,error:signinError}=await supabase.auth.signInWithPassword({email:cleanEmail,password})
      if(signinError)throw signinError
      setSession(data.session)
    }catch(authError){const message=authError instanceof Error?authError.message:'Authentication failed';setError(/email not confirmed/i.test(message)?'Confirm your email first, then sign in.':message)}
    finally{setBusy(false)}
  }

  if(session)return <OnCallMarketplace/>

  return <div className={`oc-entry ${routeCategory?'oc-category-page':'oc-home-page'}`}>
    <style>{`
      *{box-sizing:border-box}.oc-entry{min-height:100dvh;background:#f5f7fb;color:#111827;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.oc-entry button,.oc-entry input{font:inherit}.oce-top{background:radial-gradient(circle at 90% 0,#3b82f6 0,transparent 26%),linear-gradient(145deg,#06101f,#0c1d37 56%,#113d78);color:white;padding:24px 20px 40px}.oce-wrap{max-width:1100px;margin:auto}.oce-nav{display:flex;align-items:center;justify-content:space-between;gap:15px}.oce-logo{display:flex;align-items:center;gap:10px;font-weight:950;letter-spacing:-.04em}.oce-logo i{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:white;color:#0c1d37;font-style:normal;font-size:13px}.oce-nav-actions{display:flex;gap:8px}.oce-ghost,.oce-solid{border:0;border-radius:12px;padding:10px 14px;font-size:12px;font-weight:850;cursor:pointer}.oce-ghost{background:rgba(255,255,255,.1);color:white;border:1px solid rgba(255,255,255,.16)}.oce-solid{background:white;color:#0c1d37}.oce-hero{max-width:720px;padding:62px 0 22px}.oce-kicker{font-size:11px;font-weight:950;letter-spacing:.18em;color:#82b2ff}.oce-hero h1{font-size:clamp(44px,8vw,78px);line-height:.94;letter-spacing:-.065em;margin:12px 0 18px}.oce-hero p{font-size:16px;line-height:1.65;color:#c9d7ea;max-width:590px;margin:0}.oce-search{margin-top:28px;background:white;border-radius:18px;padding:7px;display:flex;box-shadow:0 20px 50px rgba(0,0,0,.18);max-width:650px}.oce-search input{flex:1;border:0;outline:0;padding:14px 15px;font-size:15px;min-width:0}.oce-search button{border:0;border-radius:13px;background:#1765e8;color:white;padding:0 18px;font-weight:900;cursor:pointer}.oce-main{max-width:1100px;margin:auto;padding:30px 20px 100px}.oce-statbar{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:-54px;margin-bottom:30px}.oce-stat{background:white;border:1px solid #e5eaf1;border-radius:18px;padding:18px;box-shadow:0 12px 30px rgba(15,23,42,.06)}.oce-stat strong{display:block;font-size:24px;letter-spacing:-.04em}.oce-stat span{font-size:11px;color:#758197;font-weight:750}.oce-section{margin:34px 0}.oce-title{display:flex;justify-content:space-between;align-items:end;gap:15px;margin-bottom:14px}.oce-title h2{font-size:25px;letter-spacing:-.04em;margin:0}.oce-title small{color:#758197}.oce-cats{display:flex;gap:8px;overflow:auto;padding-bottom:4px}.oce-chip{white-space:nowrap;border:1px solid #dde4ee;background:white;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:800;color:#526078;cursor:pointer}.oce-chip.active{background:#111827;color:white;border-color:#111827}.oce-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:11px}.oce-card{background:white;border:1px solid #e4e9f1;border-radius:18px;padding:17px;text-align:left;cursor:pointer;transition:.18s;min-height:142px}.oce-card:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(15,23,42,.08)}.oce-card-top{display:flex;justify-content:space-between;gap:10px}.oce-card h3{margin:0;font-size:16px;letter-spacing:-.02em}.oce-price{color:#1765e8;font-weight:950;white-space:nowrap}.oce-card p{font-size:12px;color:#758197;line-height:1.5;margin:10px 0 14px}.oce-meta{font-size:10px;font-weight:850;color:#8a96aa;text-transform:uppercase;letter-spacing:.08em}.oce-empty{padding:40px;text-align:center;color:#758197;background:white;border:1px dashed #dbe2ec;border-radius:18px}.oce-provider{display:flex;justify-content:space-between;align-items:center;gap:20px;background:#111827;color:white;border-radius:24px;padding:24px;margin-top:38px}.oce-provider h3{margin:0 0 5px;font-size:22px}.oce-provider p{margin:0;color:#aebbd0;font-size:13px}.oce-provider a{white-space:nowrap;background:white;color:#111827;text-decoration:none;padding:12px 15px;border-radius:13px;font-size:12px;font-weight:900}.oce-auth{position:fixed;inset:0;z-index:50;background:rgba(3,8,17,.72);backdrop-filter:blur(9px);display:grid;place-items:center;padding:18px}.oce-auth-card{width:min(460px,100%);background:white;border-radius:24px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.3)}.oce-auth-head{display:flex;justify-content:space-between;gap:15px}.oce-auth-head h2{margin:0;font-size:25px;letter-spacing:-.04em}.oce-close{border:0;background:#f0f3f7;width:34px;height:34px;border-radius:11px;font-size:18px;cursor:pointer}.oce-seg{display:grid;grid-template-columns:1fr 1fr;background:#eef2f7;border-radius:13px;padding:4px;margin:18px 0}.oce-seg button{border:0;background:transparent;padding:10px;border-radius:10px;font-size:12px;font-weight:850;cursor:pointer}.oce-seg button.active{background:white;box-shadow:0 2px 8px rgba(15,23,42,.08)}.oce-auth-card label{display:block;font-size:11px;font-weight:850;color:#65748d;margin-top:12px}.oce-auth-card input{width:100%;margin-top:6px;border:1px solid #dfe5ed;border-radius:13px;padding:13px 14px;outline:0}.oce-submit{width:100%;border:0;border-radius:14px;background:#1765e8;color:white;padding:14px;margin-top:16px;font-weight:950;cursor:pointer}.oce-message{font-size:12px;line-height:1.5;margin-top:12px;padding:11px;border-radius:11px;background:#edf5ff;color:#295689}.oce-error{background:#fff0f0;color:#b82b2b}.oce-mobile-cta{display:none}@media(max-width:640px){.oce-top{padding-top:17px}.oce-nav-actions .oce-ghost{display:none}.oce-hero{padding-top:48px}.oce-statbar{grid-template-columns:1fr;margin-top:-38px}.oce-stat:nth-child(n+2){display:none}.oce-provider{align-items:flex-start;flex-direction:column}.oce-mobile-cta{display:block;position:fixed;left:12px;right:12px;bottom:12px;z-index:20;border:0;border-radius:16px;background:#1765e8;color:white;padding:15px;font-weight:950;box-shadow:0 14px 36px rgba(23,101,232,.35)}}
    `}</style>
    <header className="oce-top"><div className="oce-wrap">
      <nav className="oce-nav"><button className="oce-logo" onClick={goHome}><i>OC</i><span>ON CALL</span></button><div className="oce-nav-actions"><button className="oce-ghost" onClick={()=>location.assign('/apply')}>Become a provider</button><button className="oce-solid" onClick={()=>openAuth()}>Sign in</button></div></nav>
      {routeCategory?<div className="oce-category-hero"><button className="oce-back" onClick={goBack}>‹ Back</button><div className="oce-kicker">ON CALL · SERVICE CATEGORY</div><h1>{activeCategory?.name||'Services'}</h1><p>{activeCategory?.description||'Choose the service you need and continue to secure booking.'}</p><div className="oce-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${activeCategory?.name||'services'}…`}/><button>Search</button></div></div>:<div className="oce-hero"><div className="oce-kicker">72 SERVICES · ORGANIZED FOR YOU</div><h1>Everyday life.<br/>Handled.</h1><p>Start with a category, then choose the exact service you need. Every booking keeps its own focused flow.</p></div>}
    </div></header>

    <main className="oce-main">
      {!routeCategory&&<><div className="oce-statbar"><div className="oce-stat"><strong>{categories.length||12}</strong><span>ORGANIZED CATEGORIES</span></div><div className="oce-stat"><strong>{services.length||72}</strong><span>LIVE SERVICE TYPES</span></div><div className="oce-stat"><strong>10</strong><span>LAUNCH MARKETS</span></div></div><section className="oce-section"><div className="oce-title"><div><h2>What do you need?</h2><small>Choose one category to open its service page</small></div></div><div className="oce-category-grid">{categories.map(item=><button key={item.id} className="oce-category-card" onClick={()=>openCategory(item.id)}><span>{String(categoryCounts.get(item.id)||0).padStart(2,'0')}</span><h3>{item.name}</h3><p>{item.description||'Verified help for your everyday needs.'}</p><b>View services →</b></button>)}</div></section></>}

      {routeCategory&&<section className="oce-section" id="services"><div className="oce-title"><div><h2>{query?'Search results':activeCategory?.name||'Services'}</h2><small>{filtered.length} services in this category</small></div></div>{filtered.length?<div className="oce-grid">{filtered.map(service=><button key={service.id} className="oce-card" onClick={()=>openAuth(service.name)}><div className="oce-card-top"><h3>{service.name}</h3><span className="oce-price">{money(service.base_price)}</span></div><p>{service.description}</p><span className="oce-meta">{service.on_demand_available?'On demand + scheduled':'Scheduled'} · {service.pricing_unit}</span></button>)}</div>:<div className="oce-empty">No service matches that search. Try a broader term.</div>}</section>}

      <section className="oce-provider"><div><h3>Good at something people need?</h3><p>Apply to join the ON CALL provider network. Approval and service access are verification-gated.</p></div><a href="/apply">Apply as a provider →</a></section>
    </main>

    <button className="oce-mobile-cta" onClick={()=>openAuth()}>Book a service</button>

    {authOpen&&<div className="oce-auth" onMouseDown={e=>{if(e.currentTarget===e.target)setAuthOpen(false)}}><form className="oce-auth-card" onSubmit={submit}><div className="oce-auth-head"><div><h2>{selectedService?`Book ${selectedService}`:'Enter ON CALL'}</h2><div style={{fontSize:12,color:'#758197',marginTop:4}}>Your account keeps requests, status and payments in one place.</div></div><button type="button" className="oce-close" onClick={()=>setAuthOpen(false)}>×</button></div><div className="oce-seg"><button type="button" className={mode==='signin'?'active':''} onClick={()=>{setMode('signin');setError('');setNotice('')}}>Sign in</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('');setNotice('')}}>Create account</button></div>{mode==='signup'&&<label>Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'}/></label>{notice&&<div className="oce-message">{notice}</div>}{error&&<div className="oce-message oce-error">{error}</div>}<button className="oce-submit" disabled={busy}>{busy?'Connecting…':mode==='signin'?'Continue to ON CALL':'Create my account'}</button></form></div>}
  </div>
}
