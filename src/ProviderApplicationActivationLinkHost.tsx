import { useEffect } from 'react'

export default function ProviderApplicationActivationLinkHost(){
 useEffect(()=>{
   if(window.location.pathname.replace(/\/$/,'')!=='/apply')return
   const apply=()=>{
     for(const anchor of document.querySelectorAll<HTMLAnchorElement>('a')){
       if(/activate provider command/i.test(anchor.textContent||''))anchor.href='/provider/activate'
     }
   }
   apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});return()=>observer.disconnect()
 },[])
 return null
}
