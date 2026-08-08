import { useEffect,useMemo,useState } from 'react'
import { supabase } from './supabase'

type Booking={id:string;customer_id:string;provider_id?:string|null;service_name:string;status:string;address?:string|null;lat?:number|null;lng?:number|null}
type Position={lat:number;lng:number;updated_at?:string|null}
type Alert={id?:number;title?:string;body?:string;action_url?:string}

const labels:Record<string,string>={assigned:'Provider assigned',en_route:'Provider en route',on_site:'Provider arrived',working:'Service in progress'}
const miles=(a:number,b:number,c:number,d:number)=>{const r=3958.8,toRad=(v:number)=>v*Math.PI/180;const x=toRad(c-a),y=toRad(d-b);const h=Math.sin(x/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(y/2)**2;return 2*r*Math.asin(Math.sqrt(h))}

export default function CustomerOperationsHost(){
  const[booking,setBooking]=useState<Booking|null>(null)
  const[position,setPosition]=useState<Position|null>(null)
  const[alert,setAlert]=useState<Alert|null>(null)
  const[permission,setPermission]=useState<NotificationPermission>(()=>typeof Notification==='undefined'?'denied':Notification.permission)
  const[busy,setBusy]=useState(false)

  useEffect(()=>{
    let disposed=false
    let bookingChannel:ReturnType<typeof supabase.channel>|null=null
    let locationChannel:ReturnType<typeof supabase.channel>|null=null
    let notificationChannel:ReturnType<typeof supabase.channel>|null=null

    const showAlert=(row:Alert)=>{
      setAlert(row);window.setTimeout(()=>setAlert(current=>current?.id===row.id?null:current),4200)
      if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
        const n=new Notification(row.title||'ON CALL update',{body:row.body||'Your booking has an update.',tag:row.id?`occ-${row.id}`:`occ-${Date.now()}`,icon:'/favicon.svg'})
        n.onclick=()=>{window.focus();if(row.action_url)window.location.assign(row.action_url)}
      }
    }

    const loadPosition=async(providerId?:string|null)=>{
      if(!providerId){if(!disposed)setPosition(null);return}
      const{data}=await supabase.from('oc_provider_locations').select('lat,lng,updated_at').eq('provider_id',providerId).eq('is_on_duty',true).order('updated_at',{ascending:false}).limit(1).maybeSingle()
      if(!disposed)setPosition(data?{lat:Number(data.lat),lng:Number(data.lng),updated_at:data.updated_at}:null)
    }

    const connect=async()=>{
      const{data:{session}}=await supabase.auth.getSession();if(!session?.user||disposed)return
      const{data:profile}=await supabase.from('oc_users').select('id,role').eq('auth_id',session.user.id).maybeSingle();if(!profile||profile.role==='provider'||disposed)return
      const refreshActive=async()=>{
        const{data:rows}=await supabase.from('oc_bookings').select('id,customer_id,provider_id,service_name,status,address,lat,lng').eq('customer_id',profile.id).in('status',['assigned','en_route','on_site','working']).order('created_at',{ascending:false}).limit(1)
        const current=(rows?.[0]||null) as Booking|null
        if(disposed)return
        setBooking(current);await loadPosition(current?.provider_id)
      }
      await refreshActive()
      supabase.realtime.setAuth(session.access_token)
      bookingChannel=supabase.channel(`oc-customer-booking:${profile.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_bookings',filter:`customer_id=eq.${profile.id}`},()=>{refreshActive().catch(()=>{})}).subscribe()
      notificationChannel=supabase.channel(`oc-customer-notify:${profile.id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'oc_notifications',filter:`user_id=eq.${profile.id}`},payload=>showAlert(payload.new as Alert)).subscribe()
      locationChannel=supabase.channel(`oc-customer-live-gps:${profile.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'oc_provider_locations'},payload=>{const row=payload.new as any;if(row?.lat!=null&&row?.lng!=null)setPosition({lat:Number(row.lat),lng:Number(row.lng),updated_at:row.updated_at})}).subscribe()
    }
    connect().catch(error=>console.warn('ON CALL customer live tracking fallback unavailable',error))
    return()=>{disposed=true;[bookingChannel,locationChannel,notificationChannel].forEach(ch=>{if(ch)supabase.removeChannel(ch)})}
  },[])

  const distance=useMemo(()=>booking&&position&&booking.lat!=null&&booking.lng!=null?miles(position.lat,position.lng,Number(booking.lat),Number(booking.lng)):null,[booking,position])
  const age=position?.updated_at?Math.max(0,Math.floor((Date.now()-new Date(position.updated_at).getTime())/1000)):null
  const mapUrl=useMemo(()=>{
    if(!position)return null
    const d=.025
    return `https://www.openstreetmap.org/export/embed.html?bbox=${position.lng-d}%2C${position.lat-d}%2C${position.lng+d}%2C${position.lat+d}&layer=mapnik&marker=${position.lat}%2C${position.lng}`
  },[position])
  const report=async()=>{
    if(!booking||busy)return
    const type=window.prompt('Issue type: provider_no_show, safety, damage, access_problem, payment, service_quality, or other','other')?.trim();if(!type)return
    const description=window.prompt('Briefly describe what happened:')?.trim();if(!description)return
    setBusy(true)
    const{data,error}=await supabase.rpc('oc_report_booking_issue',{p_booking_id:booking.id,p_issue_type:type,p_description:description,p_severity:type==='safety'?'high':'low'})
    setBusy(false)
    if(error)showAlert({title:'Could not submit report',body:error.message})
    else{const row=Array.isArray(data)?data[0]:data;showAlert({title:'Support case opened',body:row?.incident_number?`Case ${row.incident_number} is open.`:'Your issue was recorded.'})}
  }
  const enable=async()=>{if(typeof Notification==='undefined')return;setPermission(await Notification.requestPermission())}

  if(!booking&&!alert&&permission!=='default')return null
  return <>
    {permission==='default'&&<button type="button" onClick={enable} style={{position:'fixed',right:16,bottom:92,zIndex:1180,border:0,borderRadius:999,padding:'10px 13px',background:'#0b1727',color:'#fff',fontSize:10,fontWeight:900,boxShadow:'0 12px 36px rgba(0,0,0,.25)'}}>ENABLE BOOKING ALERTS</button>}
    {booking&&<section style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:84,zIndex:1150,width:'min(620px,calc(100vw - 28px))',borderRadius:20,overflow:'hidden',background:'rgba(6,16,29,.96)',color:'#fff',boxShadow:'0 18px 60px rgba(0,0,0,.34)',border:'1px solid rgba(255,255,255,.10)',backdropFilter:'blur(16px)'}}>
      {mapUrl&&<div style={{height:150,position:'relative',background:'#0b1727'}}><iframe title="Live ON CALL provider location" src={mapUrl} style={{width:'100%',height:'100%',border:0,filter:'saturate(.75) contrast(1.04)'}}/><div style={{position:'absolute',left:12,top:10,padding:'6px 8px',borderRadius:999,background:'rgba(6,16,29,.88)',fontSize:9,fontWeight:900,letterSpacing:'.08em'}}>LIVE PROVIDER GPS</div></div>}
      <div style={{padding:'13px 15px'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><div><small style={{fontSize:9,fontWeight:900,letterSpacing:'.12em',color:'#73d9ff'}}>LIVE SERVICE</small><strong style={{display:'block',fontSize:13,marginTop:3}}>{labels[booking.status]||booking.status} · {booking.service_name}</strong><span style={{display:'block',fontSize:11,marginTop:3,color:'rgba(255,255,255,.65)'}}>{distance!=null?`${distance.toFixed(1)} mi from service location · approx. ${Math.max(2,Math.ceil(distance*3))} min`:position?'Provider GPS connected':'Waiting for live provider GPS'}{age!=null?` · updated ${age<5?'now':`${age}s ago`}`:''}</span></div><button type="button" onClick={report} disabled={busy} style={{border:'1px solid rgba(255,255,255,.15)',background:'transparent',color:'#fff',borderRadius:10,padding:'9px 10px',fontSize:10,fontWeight:800,cursor:'pointer'}}>{busy?'SENDING…':'REPORT ISSUE'}</button></div></div>
    </section>}
    {alert&&<div role="status" aria-live="polite" style={{position:'fixed',right:16,top:78,zIndex:1300,width:'min(360px,calc(100vw - 32px))',padding:'13px 15px',borderRadius:15,background:'#0b1727',color:'#fff',boxShadow:'0 18px 56px rgba(0,0,0,.3)'}}><strong style={{display:'block',fontSize:13}}>{alert.title||'ON CALL update'}</strong><span style={{display:'block',fontSize:11,marginTop:4,color:'rgba(255,255,255,.68)',lineHeight:1.45}}>{alert.body}</span></div>}
  </>
}
