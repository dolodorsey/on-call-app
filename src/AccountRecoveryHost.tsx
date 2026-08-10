import { FormEvent, useEffect, useState } from 'react'
import { supabase } from './supabase'

type Mode='request'|'update'

export default function AccountRecoveryHost(){
 const[visible,setVisible]=useState(false)
 const[open,setOpen]=useState(false)
 const[mode,setMode]=useState<Mode>('request')
 const[email,setEmail]=useState('')
 const[password,setPassword]=useState('')
 const[confirm,setConfirm]=useState('')
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 const[notice,setNotice]=useState('')

 useEffect(()=>{
   let active=true
   const initialPath=window.location.pathname.replace(/\/$/,'')||'/'
   if(initialPath==='/auth/reset'){
     setMode('request');setOpen(true);setVisible(false);setError('');setNotice('Enter the email on your ON CALL account to receive a secure password-reset link.')
   }
   const check=()=>{
     if(!active)return
     const path=window.location.pathname.replace(/\/$/,'')||'/'
     if(path==='/auth/reset'){setVisible(false);return}
     const loginSurface=Boolean(document.querySelector('.oc2-auth-panel,.ocp-auth-card,.ocpa-card'))
     setVisible(loginSurface&&['/','/provider','/provider/activate'].includes(path))
   }
   check();const observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true})
   const{data}=supabase.auth.onAuthStateChange((event)=>{
     if(event==='PASSWORD_RECOVERY'){setMode('update');setOpen(true);setVisible(false);setError('');setNotice('Choose a new password for this ON CALL account.')}
   })
   return()=>{active=false;observer.disconnect();data.subscription.unsubscribe()}
 },[])

 const request=async(event:FormEvent)=>{
   event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('')
   try{
     const normalized=email.trim().toLowerCase();if(!normalized)throw new Error('Enter the email on your ON CALL account.')
     const{error}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo:'https://oncallallday.com/?recovery=1'})
     if(error)throw error
     setNotice('Password reset email sent. Open the link in that email on this device to choose a new password.')
   }catch(e){setError(e instanceof Error?e.message:'Password reset email could not be sent')}
   finally{setBusy(false)}
 }

 const update=async(event:FormEvent)=>{
   event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('')
   try{
     if(password.length<8)throw new Error('Use at least 8 characters for the new password.')
     if(password!==confirm)throw new Error('The new passwords do not match.')
     const{error}=await supabase.auth.updateUser({password})
     if(error)throw error
     setNotice('Password updated. Your ON CALL account is ready.')
     window.setTimeout(()=>{setOpen(false);setMode('request');setPassword('');setConfirm('');window.location.assign(window.location.pathname==='/provider/activate'?'/provider/activate':window.location.pathname==='/provider'?'/provider':'/')},800)
   }catch(e){setError(e instanceof Error?e.message:'Password could not be updated')}
   finally{setBusy(false)}
 }

 const close=()=>{
   setOpen(false)
   if((window.location.pathname.replace(/\/$/,'')||'/')==='/auth/reset')window.location.assign('/')
 }

 return <>{visible&&!open&&<button className="ocar-launch" onClick={()=>{setMode('request');setOpen(true);setError('');setNotice('')}}>Forgot password?</button>}{open&&<div className="ocar-backdrop"><section className="ocar-card" role="dialog" aria-modal="true"><button className="ocar-close" onClick={close}>×</button><div className="ocar-mark">OC</div><span>{mode==='request'?'ACCOUNT RECOVERY':'SET NEW PASSWORD'}</span><h2>{mode==='request'?'Recover ON CALL.':'Choose a new password.'}</h2><p>{mode==='request'?'We’ll send a secure recovery link to the email on your account.':'This recovery session came from your password-reset email.'}</p>{mode==='request'?<form onSubmit={request}><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{error&&<div className="ocar-error">{error}</div>}{notice&&<div className="ocar-notice">{notice}</div>}<button className="ocar-primary" disabled={busy}>{busy?'Sending…':'Send reset link'}</button></form>:<form onSubmit={update}><label>New password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label><label>Confirm password<input required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>{error&&<div className="ocar-error">{error}</div>}{notice&&<div className="ocar-notice">{notice}</div>}<button className="ocar-primary" disabled={busy}>{busy?'Updating…':'Update password'}</button></form>}<small>Recovery never changes provider approval, verification, bookings, or payout state.</small></section></div>}</>
}
