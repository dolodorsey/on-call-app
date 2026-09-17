import { useEffect,useState } from 'react'

type PromptEvent=Event&{prompt:()=>Promise<{outcome:'accepted'|'dismissed'}>}
const DISMISS_MS=7*24*60*60*1000
const COLLECTOR='https://wfkohcwxxsrhcxhepfql.supabase.co/functions/v1/marketing-event-capture'
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
const native=()=>Boolean((window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean}}).Capacitor?.isNativePlatform?.())
const read=(k:string)=>{try{return localStorage.getItem(k)}catch{return null}}
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v)}catch{}}
function visitor(){let v=read('oncall:pwa-visitor');if(!v){v=crypto.randomUUID();write('oncall:pwa-visitor',v)}return v}
function track(event_type:string,metadata:Record<string,unknown>={}){fetch(COLLECTOR,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brand_key:'on-call',event_type,visitor_key:visitor(),metadata:{app:'on-call',...metadata}}),keepalive:true}).catch(()=>undefined)}

export default function OnCallInstallPrompt(){
  const[prompt,setPrompt]=useState<PromptEvent|null>(null)
  const[show,setShow]=useState(false)
  const[steps,setSteps]=useState(false)
  const[apple,setApple]=useState(false)
  useEffect(()=>{
    if(native()||standalone())return
    const isApple=ios();setApple(isApple)
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/marketplace-sw.js').catch(()=>undefined)
    const dismissed=Number(read('oncall:pwa-dismissed')||0);const eligible=!dismissed||Date.now()-dismissed>DISMISS_MS
    const before=(e:Event)=>{e.preventDefault();setPrompt(e as PromptEvent);if(eligible)setTimeout(()=>setShow(true),1700)}
    const done=()=>{setShow(false);track('app_install',{platform:isApple?'ios':'web',variant:'oncall_pwa'})}
    addEventListener('beforeinstallprompt',before);addEventListener('appinstalled',done)
    let timer=0;if(eligible&&isApple)timer=window.setTimeout(()=>setShow(true),4200)
    return()=>{removeEventListener('beforeinstallprompt',before);removeEventListener('appinstalled',done);if(timer)clearTimeout(timer)}
  },[])
  if(!show)return null
  const close=()=>{write('oncall:pwa-dismissed',String(Date.now()));setShow(false);track('cta_click',{cta:'pwa_prompt_dismiss'})}
  const install=async()=>{track('app_install_click',{platform:apple?'ios':'web',variant:prompt?'native_prompt':'instructions'});if(prompt){const result=await prompt.prompt();setPrompt(null);if(result.outcome==='accepted')setShow(false);return}setSteps(true)}
  return <div className="oc-install" role="dialog" aria-modal="true" aria-label="Install ON CALL"><section>
    <button className="ocx" onClick={close} aria-label="Close">×</button><div className="ocmark"><span>OC</span></div>
    {!steps?<div className="copy"><p className="eyebrow">YOUR BUTTON FOR EVERYTHING.</p><h2>PUT<br/><em>ON CALL</em><br/>ON YOUR PHONE.</h2><p>Home, personal, family and business services stay one tap away wherever verified provider coverage is active.</p><button className="go" onClick={install}>{prompt?'INSTALL ON CALL':'ADD ON CALL TO HOME SCREEN'} <b>↗</b></button><button className="later" onClick={close}>Continue in browser</button></div>:
    <div className="copy"><p className="eyebrow">{apple?'IPHONE / SAFARI':'INSTALL ON CALL'}</p><h2>THREE TAPS.<br/><em>READY.</em></h2><ol><li><b>01</b><span>{apple?'Tap Share in Safari':'Open your browser menu'}</span></li><li><b>02</b><span>Choose Add to Home Screen / Install App</span></li><li><b>03</b><span>Tap Add</span></li></ol><button className="go" onClick={close}>GOT IT</button></div>}
    <style>{`.oc-install{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:end center;padding:16px;background:linear-gradient(180deg,#06101d22,#06101de9);backdrop-filter:blur(10px)}.oc-install section{position:relative;width:min(650px,100%);overflow:hidden;border:1px solid #43d7ff55;border-radius:28px;padding:30px 22px 22px;background:radial-gradient(circle at 88% 8%,#1677ff3d,transparent 34%),linear-gradient(145deg,#0c2947,#06101d 75%);box-shadow:0 35px 100px #000d;color:#f6fbff}.ocx{position:absolute;right:14px;top:14px;width:38px;height:38px;border-radius:50%;border:1px solid #fff2;background:#fff1;color:#fff;font-size:24px}.ocmark{position:absolute;right:28px;top:76px;width:130px;height:130px;border-radius:50%;border:2px solid #43d7ff88;display:grid;place-items:center;background:linear-gradient(145deg,#1677ff,#071a30);box-shadow:0 24px 62px #0009,0 0 45px #43d7ff22;transform:rotate(5deg)}.ocmark span{font:900 43px/1 Arial;letter-spacing:-.08em}.copy{max-width:455px;padding-right:118px}.eyebrow{margin:0 0 12px;color:#72e5ff;font:900 10px/1 Arial;letter-spacing:.16em}.copy h2{margin:0;font:900 clamp(34px,9vw,54px)/.86 Arial;letter-spacing:-.055em}.copy h2 em{font-style:normal;color:#43d7ff}.copy>p:not(.eyebrow){margin:18px 0;color:#c9d6df;font:500 14px/1.55 Arial}.go{width:100%;min-height:54px;border:0;border-radius:14px;background:linear-gradient(100deg,#43d7ff,#1677ff);color:#04101d;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font:900 12px/1 Arial;letter-spacing:.05em}.go b{font-size:21px}.later{width:100%;border:0;background:transparent;color:#9fb1be;padding:13px 0 0;font:700 11px/1 Arial}.copy ol{list-style:none;margin:20px 0;padding:0;display:grid;gap:9px}.copy li{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid #fff2;border-radius:13px;background:#fff1}.copy li b{color:#43d7ff;font:900 11px/1 Arial}.copy li span{font:700 12px/1.3 Arial}@media(min-width:720px){.oc-install{place-items:center}.oc-install section{padding:40px 35px 30px}.copy{padding-right:155px}}@media(max-width:430px){.ocmark{right:-30px;opacity:.55}.copy{padding-right:40px}.copy h2{font-size:36px}}`}</style>
  </section></div>
}
