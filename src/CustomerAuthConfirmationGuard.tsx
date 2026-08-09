import { FormEvent, useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function CustomerAuthConfirmationGuard(){
 const[email,setEmail]=useState('')
 const[open,setOpen]=useState(false)
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 const[notice,setNotice]=useState('')

 useEffect(()=>{
  const handle=async(event:Event)=>{
    const form=(event.target as HTMLElement|null)?.closest?.('.oc2-auth-panel') as HTMLFormElement|null
    if(!form)return
    const active=[...form.querySelectorAll<HTMLButtonElement>('.oc2-segmented button')].find(button=>button.classList.contains('active'))
    if(!active||!/create account/i.test(active.textContent||''))return
    event.preventDefault();event.stopPropagation();(event as any).stopImmediatePropagation?.()
    if(busy)return
    const inputs=[...form.querySelectorAll<HTMLInputElement>('input')]
    const emailInput=inputs.find(input=>input.type==='email')
    const passwordInput=inputs.find(input=>input.type==='password')
    const nameInput=inputs.find(input=>input.type!=='email'&&input.type!=='password')
    const nextEmail=(emailInput?.value||'').trim().toLowerCase()
    const password=passwordInput?.value||''
    const fullName=(nameInput?.value||'').trim()
    if(!nextEmail||password.length<8||!fullName){setError('Enter your name, valid email, and an 8+ character password.');setOpen(true);return}
    setBusy(true);setError('');setNotice('')
    try{
      const{data,error}=await supabase.auth.signUp({email:nextEmail,password,options:{emailRedirectTo:'https://oncallallday.com/',data:{full_name:fullName,app:'on_call'}}})
      if(error)throw error
      setEmail(nextEmail)
      if(data.session){window.location.reload();return}
      setNotice('Your ON CALL account was created. Confirm the email we sent you before signing in. This is required by the live authentication settings.')
      setOpen(true)
    }catch(e){setError(e instanceof Error?e.message:'Account creation failed');setOpen(true)}finally{setBusy(false)}
  }
  document.addEventListener('submit',handle,true)
  return()=>document.removeEventListener('submit',handle,true)
 },[busy])

 const resend=async()=>{if(!email||busy)return;setBusy(true);setError('');try{const{error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:'https://oncallallday.com/'}});if(error)throw error;setNotice('Confirmation email resent. Confirm it, then return here and sign in.')}catch(e){setError(e instanceof Error?e.message:'Confirmation email could not be resent')}finally{setBusy(false)}}
 const switchToSignin=()=>{const form=document.querySelector('.oc2-auth-panel');const button=[...form?.querySelectorAll<HTMLButtonElement>('.oc2-segmented button')||[]].find(item=>/sign in/i.test(item.textContent||''));button?.click();setOpen(false)}
 if(!open)return null
 return <div className="ocac-backdrop"><section className="ocac-card" role="dialog" aria-modal="true"><div className="ocac-mark">OC</div><span>EMAIL CONFIRMATION REQUIRED</span><h2>Confirm your account.</h2><p>{notice||'ON CALL requires email confirmation before the first sign-in.'}</p>{email&&<strong>{email}</strong>}{error&&<div className="ocac-error">{error}</div>}<button className="ocac-primary" onClick={switchToSignin}>I confirmed — sign in</button>{email&&<button className="ocac-secondary" disabled={busy} onClick={resend}>{busy?'Sending…':'Resend confirmation email'}</button>}<small>Do not create a second account. After confirmation, use the same email and password.</small></section></div>
}
