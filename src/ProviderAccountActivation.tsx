import { FormEvent, useEffect, useState } from 'react'
import { supabase } from './supabase'

type Mode='signup'|'signin'
type ActivationResult={activated?:boolean;application_number?:string;application_status?:string;core_dispatch_ready?:boolean;dispatch_ready_services?:number}

export default function ProviderAccountActivation(){
 const[mode,setMode]=useState<Mode>('signup')
 const[name,setName]=useState('')
 const[email,setEmail]=useState('')
 const[password,setPassword]=useState('')
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 const[notice,setNotice]=useState('')
 const[confirmed,setConfirmed]=useState(false)

 const activate=async()=>{
   const{data,error}=await supabase.rpc('oc_provider_activate_approved_application')
   if(error)throw error
   const result=data as ActivationResult
   if(!result?.activated){
     const status=result?.application_status||'not approved'
     throw new Error(`Provider application is ${status}. Activation opens only after operations approval.`)
   }
   setNotice(`Application ${result.application_number||''} linked to your Provider Command account. Verification and payout setup still control dispatch.`)
   window.setTimeout(()=>window.location.assign('/provider'),700)
 }

 useEffect(()=>{
   let active=true
   supabase.auth.getSession().then(async({data})=>{
     if(!active||!data.session)return
     try{await activate()}catch(e){if(active)setError(e instanceof Error?e.message:'Provider activation failed')}
   })
   return()=>{active=false}
 },[])

 const submit=async(event:FormEvent)=>{
   event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('')
   try{
     if(mode==='signup'){
       const{data,error}=await supabase.auth.signUp({
         email:email.trim().toLowerCase(),password,
         options:{
           emailRedirectTo:'https://oncallallday.com/provider/activate',
           data:{full_name:name.trim(),app:'on_call',requested_role:'provider'}
         }
       })
       if(error)throw error
       if(!data.session){
         setConfirmed(true)
         setMode('signin')
         setNotice('Account created. Check your email and confirm it first. Then return here and sign in with the same email to activate the approved provider application.')
         return
       }
       await activate()
     }else{
       const{error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
       if(error)throw error
       await activate()
     }
   }catch(e){setError(e instanceof Error?e.message:'Provider account activation failed')}
   finally{setBusy(false)}
 }

 const resend=async()=>{
   if(!email.trim())return;setBusy(true);setError('')
   try{const{error}=await supabase.auth.resend({type:'signup',email:email.trim().toLowerCase(),options:{emailRedirectTo:'https://oncallallday.com/provider/activate'}});if(error)throw error;setNotice('Confirmation email resent. Use the same email when you return to activate Provider Command.')}
   catch(e){setError(e instanceof Error?e.message:'Confirmation email could not be resent')}
   finally{setBusy(false)}
 }

 return <main className="ocpa-page"><section className="ocpa-art"><a href="/provider" className="ocpa-back">← Provider Command</a><div className="ocpa-mark">OC</div><span>APPROVED PROVIDER ACTIVATION</span><h1>Claim your<br/>Provider Command.</h1><p>Use the same email from your approved ON CALL provider application. Email confirmation is required before the application can attach to this account.</p><div className="ocpa-steps"><div><b>01</b><span>Approved application</span></div><div><b>02</b><span>Confirm email identity</span></div><div><b>03</b><span>Verification + payout setup</span></div><div><b>04</b><span>Go online only when dispatch-ready</span></div></div></section><form className="ocpa-card" onSubmit={submit}><div className="ocpa-switch"><button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('')}}>Create provider account</button><button type="button" className={mode==='signin'?'active':''} onClick={()=>{setMode('signin');setError('')}}>Sign in</button></div><h2>{mode==='signup'?'Activate approved access':'Finish provider activation'}</h2><p>{mode==='signup'?'Create the authenticated account that will be linked to your approved application.':'Sign in after confirming your email. ON CALL will then attach the approved application with the same email.'}</p>{mode==='signup'&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'?'new-password':'current-password'}/></label>{notice&&<div className="ocpa-notice">{notice}</div>}{error&&<div className="ocpa-error">{error}</div>}<button className="ocpa-primary" disabled={busy}>{busy?'Connecting…':mode==='signup'?'Create & verify account':'Sign in & activate'}</button>{confirmed&&<button type="button" className="ocpa-resend" disabled={busy} onClick={resend}>Resend confirmation email</button>}<small>Application approval opens the workspace only. Identity, background, skills, service-area, service-specific credentials, and payout readiness remain enforced before dispatch.</small></form></main>
}
