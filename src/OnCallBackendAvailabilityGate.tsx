import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'

const HEALTH_URL='https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/oncall-health'
const HEALTH_TIMEOUT_MS=5_000
const HEALTH_RECHECK_MS=30_000

type BackendState='checking'|'ready'|'unavailable'

export default function OnCallBackendAvailabilityGate({children}:PropsWithChildren){
  const [state,setState]=useState<BackendState>('checking')
  const stopped=useRef(false)

  const verify=useCallback(async()=>{
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),HEALTH_TIMEOUT_MS)
    try{
      const response=await fetch(HEALTH_URL,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal})
      const health=await response.json().catch(()=>null)
      if(stopped.current)return
      const exactProduct=health?.app==='on_call'
      const backendReadable=response.ok&&health?.software_status!=='unhealthy'
      setState(exactProduct&&backendReadable?'ready':'unavailable')
    }catch{
      if(!stopped.current)setState('unavailable')
    }finally{
      window.clearTimeout(timeout)
    }
  },[])

  useEffect(()=>{
    stopped.current=false
    void verify()
    const timer=window.setInterval(()=>void verify(),HEALTH_RECHECK_MS)
    return()=>{
      stopped.current=true
      window.clearInterval(timer)
    }
  },[verify])

  if(state==='ready')return children

  const checking=state==='checking'
  return <main className="oc-runtime-fallback" data-oc-backend-gate={state} role={checking?'status':'alert'} aria-live="polite">
    <div className="oc-runtime-fallback__mark">OC</div>
    <div className="oc-runtime-fallback__eyebrow">{checking?'Verifying service network':'Service network unavailable'}</div>
    <h1>{checking?'Connecting to ON CALL…':'ON CALL services are temporarily paused.'}</h1>
    <p>{checking?'We are confirming the ON CALL operating system before opening booking and provider tools.':'We cannot safely accept bookings, dispatch providers, change service status, or process payments until the ON CALL backend is healthy. No request or charge was attempted.'}</p>
    {!checking&&<button type="button" onClick={()=>{setState('checking');void verify()}}>Check service status</button>}
  </main>
}
