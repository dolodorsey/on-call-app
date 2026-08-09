import {useEffect,useState} from 'react'
import {supabase} from './supabase'

const SB='https://cxdqkjvtpilvouwtbgdy.supabase.co'
const SK='sb_publishable_x_QDbPwZuhbqB1bd58MLvg_ADSiFODN'
const toBytes=(base64:string)=>{const padding='='.repeat((4-base64.length%4)%4);const raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)))}

export default function PushRegistrationHost(){
 const[supported,setSupported]=useState(false),[permission,setPermission]=useState<NotificationPermission>('default'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const register=async(requestPermission=false)=>{
   if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return
   setBusy(true);setNotice('')
   try{
     let next=Notification.permission
     if(requestPermission&&next==='default')next=await Notification.requestPermission()
     setPermission(next)
     if(next!=='granted'){setReady(false);return}
     const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token){setReady(false);return}
     const configRes=await fetch(`${SB}/functions/v1/marketplace-push-config`,{headers:{apikey:SK},cache:'no-store'});const config=await configRes.json().catch(()=>({}));if(!configRes.ok||!config?.ready||!config?.publicKey)throw new Error('Push configuration is unavailable.')
     const worker=await navigator.serviceWorker.register('/marketplace-sw.js',{scope:'/'});await navigator.serviceWorker.ready
     let subscription=await worker.pushManager.getSubscription()
     if(!subscription)subscription=await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(String(config.publicKey))})
     const json=subscription.toJSON();const endpoint=subscription.endpoint,p256dh=String(json.keys?.p256dh||''),auth=String(json.keys?.auth||'')
     if(!endpoint||!p256dh||!auth)throw new Error('Browser push subscription is incomplete.')
     const{error}=await supabase.rpc('marketplace_register_push_subscription',{p_app:'on_call',p_endpoint:endpoint,p_p256dh:p256dh,p_auth:auth,p_user_agent:navigator.userAgent});if(error)throw error
     setReady(true);setNotice('Background alerts are on.')
   }catch(error){setReady(false);setNotice(error instanceof Error?error.message:'Background alerts could not be enabled.')}
   finally{setBusy(false)}
 }
 useEffect(()=>{const ok='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;setSupported(ok);if(ok){setPermission(Notification.permission);if(Notification.permission==='granted')register(false).catch(()=>{})}},[])
 if(!supported||permission==='denied')return null
 if(ready&&!notice)return null
 return <div style={{position:'fixed',right:12,bottom:48,zIndex:2450,width:'min(340px,calc(100vw - 24px))',display:'flex',justifyContent:'flex-end',pointerEvents:'none'}}>
   <div style={{pointerEvents:'auto',padding:'9px 11px',borderRadius:14,background:'rgba(7,16,29,.94)',border:'1px solid rgba(111,220,255,.22)',boxShadow:'0 14px 42px rgba(0,0,0,.28)',color:'#fff',fontSize:9,lineHeight:1.4}}>
    {permission==='default'?<button type="button" onClick={()=>register(true)} disabled={busy} style={{border:0,borderRadius:10,padding:'9px 11px',background:'#6fdcff',color:'#05111f',fontWeight:900,cursor:'pointer'}}>{busy?'ENABLING…':'ENABLE BACKGROUND ALERTS'}</button>:<span>{notice||'Background alerts connected.'}</span>}
   </div>
 </div>
}
