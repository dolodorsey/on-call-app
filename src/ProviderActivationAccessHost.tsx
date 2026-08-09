import { useEffect,useState } from 'react'
import { supabase } from './supabase'

export default function ProviderActivationAccessHost(){
 const[show,setShow]=useState(false)
 useEffect(()=>{let alive=true;supabase.auth.getSession().then(({data})=>{if(alive)setShow(!data.session)});const{data}=supabase.auth.onAuthStateChange((_e,s)=>{if(alive)setShow(!s)});return()=>{alive=false;data.subscription.unsubscribe()}},[])
 if(!show)return null
 return <a className="ocpa-access" href="/provider/activate"><strong>Approved applicant?</strong><span>Create or activate your Provider Command account →</span></a>
}
