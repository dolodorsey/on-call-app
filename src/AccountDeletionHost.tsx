import { useEffect,useState } from 'react'
import { supabase } from './supabase'

export default function AccountDeletionHost(){
  const[session,setSession]=useState<any>(null)
  const[open,setOpen]=useState(false)
  const[confirmText,setConfirmText]=useState('')
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')

  useEffect(()=>{
    let active=true
    supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)})
    const{data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next)})
    return()=>{active=false;data.subscription.unsubscribe()}
  },[])

  if(!session||window.location.pathname.startsWith('/ops')||window.location.pathname==='/apply')return null

  const remove=async()=>{
    if(confirmText!=='DELETE'||busy)return
    setBusy(true);setError('')
    try{
      const{data,error:invokeError}=await supabase.functions.invoke('on-call-delete-account',{body:{confirm:true}})
      if(invokeError)throw invokeError
      if(!data?.ok)throw new Error(data?.error||'Account deletion could not be completed.')
      try{await supabase.auth.signOut({scope:'local'})}catch{}
      localStorage.clear()
      sessionStorage.clear()
      window.location.replace('/?account=deleted')
    }catch(e){setError(e instanceof Error?e.message:'Account deletion could not be completed.');setBusy(false)}
  }

  return <>
    <button type="button" onClick={()=>{setOpen(true);setConfirmText('');setError('')}} style={{position:'fixed',right:14,bottom:145,zIndex:1080,border:'1px solid rgba(255,255,255,.14)',borderRadius:999,padding:'8px 11px',background:'rgba(6,16,29,.88)',backdropFilter:'blur(14px)',color:'rgba(255,255,255,.72)',fontSize:9,fontWeight:850,letterSpacing:'.08em',cursor:'pointer'}}>ACCOUNT & PRIVACY</button>
    {open&&<div role="dialog" aria-modal="true" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)setOpen(false)}} style={{position:'fixed',inset:0,zIndex:5000,display:'grid',placeItems:'center',padding:18,background:'rgba(2,7,15,.78)',backdropFilter:'blur(10px)'}}>
      <section style={{width:'min(480px,100%)',borderRadius:24,padding:22,background:'#0b1727',color:'#fff',border:'1px solid rgba(255,255,255,.11)',boxShadow:'0 30px 90px rgba(0,0,0,.48)'}}>
        <div style={{fontSize:9,fontWeight:950,letterSpacing:'.16em',color:'#ff9d9d'}}>ACCOUNT DELETION</div>
        <h2 style={{margin:'8px 0 8px',fontSize:26,letterSpacing:'-.04em'}}>Delete your ON CALL account?</h2>
        <p style={{margin:0,color:'rgba(255,255,255,.68)',fontSize:12,lineHeight:1.55}}>This permanently removes your sign-in identity, saved addresses, payment-method references, push subscriptions and personal profile data. Financial and safety records are retained only in anonymized form where required.</p>
        <label style={{display:'block',marginTop:16,fontSize:10,fontWeight:850,color:'rgba(255,255,255,.72)'}}>Type DELETE to confirm<input autoComplete="off" value={confirmText} onChange={e=>setConfirmText(e.target.value.toUpperCase())} placeholder="DELETE" style={{width:'100%',marginTop:7,padding:'12px 13px',borderRadius:12,border:'1px solid rgba(255,255,255,.13)',background:'#07111e',color:'#fff',outline:0}}/></label>
        {error&&<div style={{marginTop:11,padding:'10px 11px',borderRadius:11,background:'rgba(194,54,54,.16)',color:'#ffb4b4',fontSize:11}}>{error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:16}}><button disabled={busy} onClick={()=>setOpen(false)} style={{border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:12,background:'transparent',color:'#fff',fontWeight:850}}>Keep account</button><button disabled={busy||confirmText!=='DELETE'} onClick={remove} style={{border:0,borderRadius:12,padding:12,background:confirmText==='DELETE'?'#dc3d4b':'rgba(255,255,255,.08)',color:'#fff',fontWeight:900,cursor:confirmText==='DELETE'?'pointer':'not-allowed'}}>{busy?'Deleting…':'Delete permanently'}</button></div>
      </section>
    </div>}
  </>
}
