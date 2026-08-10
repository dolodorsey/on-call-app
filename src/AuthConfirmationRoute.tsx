import { useEffect,useState } from 'react'
import { supabase } from './supabase'

type State='checking'|'success'|'error'

export default function AuthConfirmationRoute(){
 const[state,setState]=useState<State>('checking')
 const[message,setMessage]=useState('Confirming your ON CALL account…')

 useEffect(()=>{
   let active=true
   const finish=async()=>{
     try{
       const url=new URL(window.location.href)
       const code=url.searchParams.get('code')
       const tokenHash=url.searchParams.get('token_hash')
       const type=url.searchParams.get('type')

       if(code){
         const{error}=await supabase.auth.exchangeCodeForSession(code)
         if(error)throw error
       }else if(tokenHash&&type){
         const{error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as any})
         if(error)throw error
       }else{
         // Implicit-flow confirmation links are consumed by the browser client when
         // it initializes. Give that session restoration a short bounded window.
         let session=(await supabase.auth.getSession()).data.session
         if(!session){
           session=await new Promise(resolve=>{
             let settled=false
             let subscription:{unsubscribe:()=>void}|null=null
             const finishWait=(value:unknown)=>{if(settled)return;settled=true;subscription?.unsubscribe();resolve(value)}
             const timer=window.setTimeout(()=>finishWait(null),2500)
             const{data}=supabase.auth.onAuthStateChange((_event,next)=>{
               if(settled||!next)return
               window.clearTimeout(timer)
               finishWait(next)
             })
             subscription=data.subscription
           }) as any
         }
         if(!session)throw new Error('Confirmation link is incomplete or has expired.')
       }

       const{data:{session},error:sessionError}=await supabase.auth.getSession()
       if(sessionError)throw sessionError
       if(!session)throw new Error('Email was confirmed, but the browser session could not be established. Sign in with the confirmed email.')
       if(!active)return
       setState('success');setMessage('Email confirmed. Your ON CALL account is ready.')
       window.setTimeout(()=>window.location.replace('/'),700)
     }catch(error){
       if(!active)return
       setState('error')
       setMessage(error instanceof Error?error.message:'This confirmation link could not be completed.')
     }
   }
   void finish()
   return()=>{active=false}
 },[])

 return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:20,background:'radial-gradient(circle at 80% 10%,rgba(41,144,255,.18),transparent 30%),linear-gradient(155deg,#06101d,#0a1c32 48%,#050b14)',color:'#fff',fontFamily:'DM Sans,system-ui,sans-serif'}}><section style={{width:'min(520px,100%)',padding:28,borderRadius:24,background:'rgba(8,22,39,.88)',border:'1px solid rgba(255,255,255,.1)',boxShadow:'0 30px 90px rgba(0,0,0,.28)',textAlign:'center'}}><div style={{width:48,height:48,display:'grid',placeItems:'center',borderRadius:15,margin:'0 auto 15px',background:'#fff',color:'#07101d',fontWeight:950}}>OC</div><span style={{fontSize:9,fontWeight:950,letterSpacing:'.18em',color:'#75b8ff'}}>EMAIL CONFIRMATION</span><h1 style={{fontSize:32,letterSpacing:'-.05em',margin:'9px 0 10px'}}>{state==='success'?'Account confirmed.':state==='error'?'Confirmation needs attention.':'Confirming ON CALL…'}</h1><p style={{margin:'0 auto',maxWidth:420,fontSize:13,lineHeight:1.65,color:'rgba(255,255,255,.65)'}}>{message}</p>{state==='checking'&&<div aria-label="Confirming" style={{width:26,height:26,border:'3px solid rgba(255,255,255,.15)',borderTopColor:'#75b8ff',borderRadius:'50%',margin:'20px auto 0',animation:'spin .8s linear infinite'}}/>}{state==='error'&&<div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginTop:20}}><a href="/" style={{padding:'11px 14px',borderRadius:12,background:'#fff',color:'#07101d',textDecoration:'none',fontSize:11,fontWeight:900}}>Return to ON CALL</a><a href="/support" style={{padding:'11px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,.16)',color:'#fff',textDecoration:'none',fontSize:11,fontWeight:900}}>Support</a></div>}<style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style></section></main>
}
