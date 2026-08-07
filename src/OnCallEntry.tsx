import React, { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from './supabase'

const OnCallMarketplace = lazy(() => import('./OnCallMarketplace'))

export default function OnCallEntry() {
  const [loading,setLoading] = useState(true)
  const [session,setSession] = useState<any>(null)
  const [mode,setMode] = useState<'signin'|'signup'>('signin')
  const [name,setName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  useEffect(() => {
    let active=true
    supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}})
    const {data} = supabase.auth.onAuthStateChange((_event,nextSession)=>{if(active)setSession(nextSession)})
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])

  const submit = async (event:React.FormEvent) => {
    event.preventDefault()
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try {
      if(mode==='signup') {
        const {data,error:signupError} = await supabase.auth.signUp({
          email:email.trim().toLowerCase(),
          password,
          options:{data:{full_name:name.trim(),app:'on_call'},emailRedirectTo:'https://oncallallday.com/auth/confirm'},
        })
        if(signupError)throw signupError
        if(data.session){setSession(data.session);return}
        setNotice('Account created. Check your email to confirm your address, then sign in to ON CALL.')
        setMode('signin');setPassword('')
        return
      }
      const {data,error:signinError} = await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
      if(signinError)throw signinError
      setSession(data.session)
    } catch(authError) {
      const message=authError instanceof Error?authError.message:'Authentication failed'
      setError(/email not confirmed/i.test(message)?'Confirm your email first, then sign in.':message)
    } finally {setBusy(false)}
  }

  if(loading)return <div className="oc2-loading"><div className="oc2-loader-mark">OC</div><div className="oc2-loader-line"/><span>Connecting your service marketplace</span></div>
  if(session)return <Suspense fallback={<div className="oc2-loading"><div className="oc2-loader-mark">OC</div><div className="oc2-loader-line"/><span>Opening ON CALL</span></div>}><OnCallMarketplace/></Suspense>

  return <div className="oc2-auth">
    <div className="oc2-auth-scene">
      <div className="oc2-orbit"><i/><i/><i/><span>OC</span></div>
      <div className="oc2-brand"><div className="oc2-mark"><span>OC</span></div><div><strong>ON CALL</strong><small>Your button for everything</small></div></div>
      <div className="oc2-auth-copy"><span>ONE APP. EVERYDAY LIFE.</span><h1>Whatever you need.<br/><em>Put it ON CALL.</em></h1><p>Browse 72 services and request verified help as provider coverage activates in your market.</p></div>
    </div>
    <form onSubmit={submit} className="oc2-auth-panel">
      <div className="oc2-segmented"><button type="button" className={mode==='signin'?'active':''} onClick={()=>{setMode('signin');setError('');setNotice('')}}>Sign in</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('');setNotice('')}}>Create account</button></div>
      {mode==='signup'&&<label>Full name<input required minLength={2} value={name} onChange={event=>setName(event.target.value)} autoComplete="name"/></label>}
      <label>Email<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email"/></label>
      <label>Password<input required minLength={8} type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'}/></label>
      {notice&&<div className="oc2-auth-notice" role="status">{notice}</div>}
      {error&&<div className="oc2-error" role="alert">{error}</div>}
      <button className="oc2-primary" disabled={busy}>{busy?'Connecting…':mode==='signin'?'Enter ON CALL':'Create account'}</button>
      <a className="oc2-provider-link" href="/apply">Want to earn with ON CALL? Apply as a provider →</a>
    </form>
  </div>
}
