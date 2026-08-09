import { useEffect,useState } from 'react'
import { getMarketplacePaymentsHealth, hostedCheckoutFallbackConfigured, stripeClientPublishableKeyConfigured, type MarketplacePaymentsHealth } from './supabase'

export default function PaymentReadinessHost(){
 const[health,setHealth]=useState<MarketplacePaymentsHealth|null>(null)
 useEffect(()=>{let disposed=false;const load=async()=>{try{const next=await getMarketplacePaymentsHealth(true);if(!disposed)setHealth(next)}catch{if(!disposed)setHealth({ready:false,stripe_server_credential:false,webhook_signature_secret:false,payments:'unavailable',webhooks:'unavailable',message:'ON CALL payment runtime check is unavailable.'})}};load();const t=window.setInterval(load,60_000);return()=>{disposed=true;window.clearInterval(t)}},[])
 const clientReady=stripeClientPublishableKeyConfigured||hostedCheckoutFallbackConfigured
 const fullyReady=Boolean(health?.ready&&clientReady)
 if(!health||fullyReady)return null
 const clientMissing=!clientReady
 return <aside role="status" aria-live="polite" style={{position:'fixed',left:'50%',transform:'translateX(-50%)',top:10,zIndex:2200,width:'min(760px,calc(100vw - 24px))',padding:'10px 14px',borderRadius:14,background:'rgba(58,26,9,.97)',color:'#fff4df',border:'1px solid rgba(255,183,71,.34)',boxShadow:'0 16px 48px rgba(0,0,0,.28)',backdropFilter:'blur(14px)',display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}>
  <div><strong style={{display:'block',fontSize:11,letterSpacing:'.06em'}}>PAYMENT RUNTIME MAINTENANCE</strong><span style={{display:'block',fontSize:10,lineHeight:1.45,marginTop:2,color:'rgba(255,244,223,.72)'}}>{clientMissing?'Secure customer checkout is not configured. Authorization is blocked before Stripe is called.':'Browsing, booking, matching and tracking remain available. Charges, captures and provider payout onboarding are blocked before Stripe is called.'}</span></div>
  <span style={{whiteSpace:'nowrap',fontSize:9,fontWeight:900,color:'#ffd08a'}}>NO CHARGE ATTEMPTED</span>
 </aside>
}
