import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function CustomerRecoveryHost() {
  const [visible,setVisible] = useState(false)
  const [open,setOpen] = useState(false)
  const [recovery,setRecovery] = useState(false)
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [confirm,setConfirm] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/,'') || '/'
    if (path === '/provider' || path === '/apply') return
    supabase.auth.getSession().then(({data}) => setVisible(!data.session))
    const params = new URLSearchParams(window.location.search)
    if (params.get('recovery') === '1') setRecovery(true)
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setVisible(false) }
      if (event === 'SIGNED_IN') setVisible(false)
      if (event === 'SIGNED_OUT') setVisible(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'https://oncallallday.com/?recovery=1' })
      if (resetError) throw resetError
      setNotice('Password reset email sent. Open the secure link to choose a new password.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Password reset could not be started.') }
    finally { setBusy(false) }
  }

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return
    setError(''); setNotice('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setNotice('Password updated. Sign in again with your new password.')
      setPassword(''); setConfirm('')
      await supabase.auth.signOut()
      const url = new URL(window.location.href); url.searchParams.delete('recovery'); history.replaceState({},'',url.pathname+url.search+url.hash)
      setRecovery(false); setOpen(true); setVisible(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Password could not be updated.') }
    finally { setBusy(false) }
  }

  const modal = recovery || open
  if (!visible && !modal) return null
  return <>
    {visible && !modal && <button type="button" onClick={() => setOpen(true)} style={{position:'fixed',right:16,bottom:16,zIndex:2600,border:'1px solid rgba(111,220,255,.22)',borderRadius:999,padding:'10px 14px',background:'rgba(7,16,29,.94)',color:'#f7fbff',fontSize:11,fontWeight:800,boxShadow:'0 12px 35px rgba(0,0,0,.3)'}}>Forgot password?</button>}
    {modal && <div onMouseDown={() => !recovery && setOpen(false)} style={{position:'fixed',inset:0,zIndex:2800,background:'rgba(0,0,0,.72)',backdropFilter:'blur(14px)',display:'grid',placeItems:'center',padding:18}}><form onSubmit={recovery ? updatePassword : sendReset} onMouseDown={e => e.stopPropagation()} style={{width:'min(440px,100%)',borderRadius:24,padding:22,background:'#0c1929',border:'1px solid rgba(111,220,255,.2)',color:'#fff',boxShadow:'0 30px 90px rgba(0,0,0,.5)'}}><div style={{display:'flex',justifyContent:'space-between',gap:16}}><div><small style={{color:'#6fdcff',fontWeight:900,letterSpacing:'.12em'}}>ACCOUNT RECOVERY</small><h2 style={{margin:'8px 0 4px',fontSize:28}}>{recovery?'Choose a new password':'Reset your ON CALL password'}</h2><p style={{margin:0,color:'#8ea1b7',fontSize:12,lineHeight:1.5}}>{recovery?'This recovery session is tied to the account that opened the emailed link.':'Use the email attached to your customer account.'}</p></div>{!recovery&&<button type="button" onClick={() => setOpen(false)} style={{width:38,height:38,borderRadius:12,border:'1px solid rgba(255,255,255,.12)',background:'transparent',color:'#fff',fontSize:20}}>×</button>}</div>
      {recovery ? <><label style={{display:'grid',gap:6,marginTop:18,fontSize:10,color:'#6fdcff',fontWeight:800}}>NEW PASSWORD<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{height:48,borderRadius:13,border:'1px solid rgba(255,255,255,.12)',background:'#08111d',color:'#fff',padding:'0 12px'}}/></label><label style={{display:'grid',gap:6,marginTop:12,fontSize:10,color:'#6fdcff',fontWeight:800}}>CONFIRM PASSWORD<input required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={{height:48,borderRadius:13,border:'1px solid rgba(255,255,255,.12)',background:'#08111d',color:'#fff',padding:'0 12px'}}/></label></> : <label style={{display:'grid',gap:6,marginTop:18,fontSize:10,color:'#6fdcff',fontWeight:800}}>EMAIL<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{height:48,borderRadius:13,border:'1px solid rgba(255,255,255,.12)',background:'#08111d',color:'#fff',padding:'0 12px'}}/></label>}
      {error&&<div style={{marginTop:10,padding:10,borderRadius:12,background:'rgba(255,120,109,.12)',color:'#ff9e96',fontSize:11}}>{error}</div>}{notice&&<div style={{marginTop:10,padding:10,borderRadius:12,background:'rgba(59,210,143,.12)',color:'#80e8b7',fontSize:11}}>{notice}</div>}<button disabled={busy} style={{width:'100%',height:48,marginTop:14,border:0,borderRadius:13,background:'#6fdcff',color:'#05111f',fontWeight:900}}>{busy?'Working…':recovery?'Set new password':'Send secure reset link'}</button></form></div>}
  </>
}
