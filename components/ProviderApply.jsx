import React, { useState } from 'react';

const SERVICES = [
  { cat:'Home Care', items:['Deep Home Clean','Standard Home Clean','Move-In / Move-Out Clean','Laundry & Fold','Home Organization','Trash Bin Cleaning'] },
  { cat:'Repairs & Maintenance', items:['Handyman','Plumbing Help','Electrical Help','HVAC Service','Appliance Repair','Furniture Assembly'] },
  { cat:'Outdoor & Property', items:['Lawn Cut & Edge','Landscaping','Pressure Washing','Gutter Cleaning','Junk Removal','Storm & Seasonal Cleanup'] },
  { cat:'Auto & Mobile', items:['Mobile Car Detail','Mobile Oil Change','Battery Replacement','Tire Help','Vehicle Diagnostic','Mobile Car Wash'] },
  { cat:'Moving & Delivery', items:['Moving Labor','Pickup & Delivery','Same-Day Courier','Haul Away','Packing & Unpacking','Delivery + Assembly'] },
  { cat:'Personal Care', items:['Mobile Barber','Makeup Artist','Mobile Hair Styling','Mobile Nail Service','Wardrobe Styling','Personal Assistant'] },
  { cat:'Family & Pet', items:['Babysitter','Elder Companion','Dog Walking','Pet Sitting','House Sitting','Family Runner'] },
  { cat:'Events & Hospitality', items:['Bartender','Event Servers','Private Chef','Event Setup & Breakdown','Event Cleanup Crew','Event Host / Concierge'] },
  { cat:'Business Support', items:['Administrative Assistant','Brand Ambassador','Merchandising Support','Business Runner','Temporary Staff','Mobile Notary'] },
  { cat:'Tech & Installation', items:['Wi-Fi Setup & Troubleshooting','TV Mounting','Smart Home Installation','Computer Help','Phone & Tablet Setup','Gaming & Entertainment Setup'] },
  { cat:'Wellness & Fitness', items:['Mobile Massage','Personal Training','Private Yoga','Assisted Stretch & Recovery','Healthy Meal Prep','Wellness Companion'] },
  { cat:'Premium Concierge', items:['Lifestyle Concierge','Home Manager','Travel Day Assistance','Urgent Custom Request','VIP Event Support','Estate & Property Concierge'] },
];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const APPLICATION_ENDPOINT = 'https://cxdqkjvtpilvouwtbgdy.supabase.co/functions/v1/on-call-provider-application';

const inputStyle={width:'100%',padding:'14px 15px',borderRadius:14,border:'1px solid #e3e8f0',fontSize:14,boxSizing:'border-box',background:'#fff',outline:'none'};
const labelStyle={display:'block',fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:'#8490a5',marginBottom:7};

export default function ProviderApply(){
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({first_name:'',last_name:'',email:'',phone:'',city:'',state:'',zip_code:'',services_requested:[],years_experience:'',experience_description:'',has_vehicle:false,vehicle_type:'',background_check_consent:false});
  const [submitting,setSubmitting]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState('');
  const u=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const toggleSvc=(service)=>setForm(prev=>({...prev,services_requested:prev.services_requested.includes(service)?prev.services_requested.filter(x=>x!==service):[...prev.services_requested,service]}));
  const canNext=()=>step===0?Boolean(form.first_name&&form.last_name&&form.email&&form.phone&&form.city&&form.state):step===1?form.services_requested.length>0:step===2?Boolean(form.years_experience&&form.background_check_consent):true;
  const submit=async()=>{
    if(submitting)return;
    setSubmitting(true);setError('');
    try{
      const res=await fetch(APPLICATION_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,state_code:form.state})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw new Error(data.error||'Application service unavailable');
      setResult(data);setStep(4);
    }catch(e){setError(e instanceof Error?e.message:'Application could not be submitted.');}
    finally{setSubmitting(false);}
  };

  return <main style={{minHeight:'100dvh',background:'#f6f8fc',color:'#111827',fontFamily:"Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}}>
    <header style={{padding:'30px 22px 38px',background:'radial-gradient(circle at 85% 0%,#4f8cff 0,transparent 35%),linear-gradient(145deg,#07111f,#0e2341 60%,#12376b)',color:'#fff'}}>
      <div style={{maxWidth:660,margin:'0 auto'}}>
        <a href="/" style={{color:'#bcd0ef',textDecoration:'none',fontSize:12,fontWeight:700}}>← ON CALL</a>
        <div style={{marginTop:28,fontSize:11,fontWeight:900,letterSpacing:'.28em',color:'#82b2ff'}}>PROVIDER NETWORK</div>
        <h1 style={{fontSize:'clamp(34px,8vw,54px)',lineHeight:1,letterSpacing:'-.045em',margin:'10px 0 12px'}}>Turn your skill into booked work.</h1>
        <p style={{margin:0,maxWidth:540,color:'#c7d5e9',lineHeight:1.6,fontSize:15}}>Apply once. Get verified. Choose when you are available. Accept only services you are approved to perform.</p>
      </div>
    </header>

    {step<4&&<div style={{maxWidth:660,margin:'-17px auto 0',padding:'0 18px'}}><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,background:'#fff',padding:7,borderRadius:18,boxShadow:'0 12px 30px rgba(17,24,39,.08)'}}>{['Info','Services','Experience','Review'].map((label,i)=><div key={label} style={{padding:'9px 6px',borderRadius:12,textAlign:'center',fontSize:11,fontWeight:800,background:i===step?'#eaf2ff':'transparent',color:i<=step?'#1765e8':'#9aa4b5'}}>{i<step?'✓ ':''}{label}</div>)}</div></div>}

    <section style={{maxWidth:660,margin:'0 auto',padding:'30px 20px 60px'}}>
      {step===0&&<div>
        <div style={{fontSize:12,fontWeight:900,color:'#1765e8',letterSpacing:'.12em'}}>01 — WHO YOU ARE</div><h2 style={{fontSize:28,letterSpacing:'-.03em',margin:'8px 0 22px'}}>Basic information</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          <div><label style={labelStyle}>First name *</label><input style={inputStyle} value={form.first_name} onChange={e=>u('first_name',e.target.value)}/></div>
          <div><label style={labelStyle}>Last name *</label><input style={inputStyle} value={form.last_name} onChange={e=>u('last_name',e.target.value)}/></div>
          <div><label style={labelStyle}>Email *</label><input type="email" style={inputStyle} value={form.email} onChange={e=>u('email',e.target.value)}/></div>
          <div><label style={labelStyle}>Phone *</label><input type="tel" style={inputStyle} value={form.phone} onChange={e=>u('phone',e.target.value)}/></div>
          <div><label style={labelStyle}>City *</label><input style={inputStyle} value={form.city} onChange={e=>u('city',e.target.value)}/></div>
          <div><label style={labelStyle}>State *</label><select style={inputStyle} value={form.state} onChange={e=>u('state',e.target.value)}><option value="">Select state</option>{STATES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label style={labelStyle}>ZIP code</label><input style={inputStyle} value={form.zip_code} onChange={e=>u('zip_code',e.target.value)}/></div>
        </div>
      </div>}

      {step===1&&<div>
        <div style={{fontSize:12,fontWeight:900,color:'#1765e8',letterSpacing:'.12em'}}>02 — WHAT YOU DO</div><h2 style={{fontSize:28,letterSpacing:'-.03em',margin:'8px 0 6px'}}>Choose your services</h2><p style={{color:'#758197',margin:'0 0 24px'}}>{form.services_requested.length} selected · choose every service you can professionally perform.</p>
        {SERVICES.map(group=><div key={group.cat} style={{marginBottom:23}}><div style={{fontSize:12,fontWeight:900,marginBottom:10}}>{group.cat}</div><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{group.items.map(service=>{const active=form.services_requested.includes(service);return <button type="button" key={service} onClick={()=>toggleSvc(service)} style={{padding:'10px 13px',borderRadius:999,border:active?'1px solid #1765e8':'1px solid #e2e7ef',background:active?'#1765e8':'#fff',color:active?'#fff':'#334155',fontSize:12,fontWeight:700,cursor:'pointer'}}>{active?'✓ ':''}{service}</button>})}</div></div>)}
      </div>}

      {step===2&&<div>
        <div style={{fontSize:12,fontWeight:900,color:'#1765e8',letterSpacing:'.12em'}}>03 — READINESS</div><h2 style={{fontSize:28,letterSpacing:'-.03em',margin:'8px 0 22px'}}>Experience & verification</h2>
        <div><label style={labelStyle}>Years of experience *</label><select style={inputStyle} value={form.years_experience} onChange={e=>u('years_experience',e.target.value)}><option value="">Select</option><option value="0">Less than 1 year</option><option value="1">1–2 years</option><option value="3">3–5 years</option><option value="5">5–10 years</option><option value="10">10+ years</option></select></div>
        <div style={{marginTop:15}}><label style={labelStyle}>Tell us about your work</label><textarea style={{...inputStyle,minHeight:110,resize:'vertical'}} value={form.experience_description} onChange={e=>u('experience_description',e.target.value)} placeholder="Experience, certifications, specialties, equipment, notable clients, or anything our review team should know."/></div>
        <label style={{display:'flex',gap:11,alignItems:'center',marginTop:18,padding:'15px 17px',background:'#fff',border:'1px solid #e3e8f0',borderRadius:15}}><input type="checkbox" checked={form.has_vehicle} onChange={e=>u('has_vehicle',e.target.checked)}/><span style={{fontSize:14,fontWeight:700}}>I have reliable transportation</span></label>
        <label style={{display:'flex',gap:11,alignItems:'flex-start',marginTop:10,padding:'17px',background:'#edf5ff',border:'1px solid #cfe2ff',borderRadius:15}}><input type="checkbox" checked={form.background_check_consent} onChange={e=>u('background_check_consent',e.target.checked)} style={{marginTop:3}}/><span><strong style={{fontSize:14}}>Verification consent *</strong><span style={{display:'block',fontSize:12,color:'#65748d',lineHeight:1.55,marginTop:4}}>I authorize ON CALL and its authorized screening providers to verify the information required for provider approval.</span></span></label>
      </div>}

      {step===3&&<div>
        <div style={{fontSize:12,fontWeight:900,color:'#1765e8',letterSpacing:'.12em'}}>04 — REVIEW</div><h2 style={{fontSize:28,letterSpacing:'-.03em',margin:'8px 0 22px'}}>Ready to submit</h2>
        <div style={{background:'#fff',border:'1px solid #e3e8f0',borderRadius:18,padding:20}}><div style={{fontSize:19,fontWeight:900}}>{form.first_name} {form.last_name}</div><div style={{color:'#758197',fontSize:13,marginTop:5}}>{form.email} · {form.phone}<br/>{form.city}, {form.state} {form.zip_code}</div></div>
        <div style={{background:'#fff',border:'1px solid #e3e8f0',borderRadius:18,padding:20,marginTop:12}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.1em',color:'#758197'}}>SERVICES · {form.services_requested.length}</div><div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>{form.services_requested.map(s=><span key={s} style={{padding:'7px 10px',background:'#f1f5fa',borderRadius:999,fontSize:11,fontWeight:700}}>{s}</span>)}</div></div>
        {error&&<div style={{marginTop:14,padding:14,background:'#fff0f0',border:'1px solid #ffc7c7',borderRadius:14,fontSize:13,color:'#c52b2b'}}>{error}</div>}
      </div>}

      {step===4&&result&&<div style={{textAlign:'center',padding:'45px 10px'}}><div style={{width:74,height:74,borderRadius:24,display:'grid',placeItems:'center',margin:'0 auto 18px',background:'#eaf2ff',fontSize:36}}>✓</div><h2 style={{fontSize:34,letterSpacing:'-.04em',margin:'0 0 8px'}}>Application received.</h2><p style={{color:'#758197',lineHeight:1.6,maxWidth:440,margin:'0 auto'}}>Save your application number. Provider access is activated only after verification and approval.</p><div style={{display:'inline-block',marginTop:22,padding:'11px 18px',background:'#111827',color:'#fff',borderRadius:12,fontFamily:'monospace',fontSize:17}}>{result.application_number}</div><div><a href="/" style={{display:'inline-block',marginTop:24,color:'#1765e8',fontWeight:800,textDecoration:'none'}}>Return to ON CALL →</a></div></div>}

      {step<4&&<div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:34,paddingTop:20,borderTop:'1px solid #e3e8f0'}}>{step>0?<button type="button" onClick={()=>setStep(s=>s-1)} style={{padding:'13px 20px',border:0,background:'transparent',fontWeight:800,color:'#65748d',cursor:'pointer'}}>← Back</button>:<span/>}{step<3?<button type="button" disabled={!canNext()} onClick={()=>canNext()&&setStep(s=>s+1)} style={{padding:'13px 22px',border:0,borderRadius:14,background:canNext()?'#1765e8':'#dbe1ea',color:'#fff',fontWeight:900,cursor:canNext()?'pointer':'not-allowed'}}>Continue →</button>:<button type="button" disabled={submitting} onClick={submit} style={{padding:'13px 22px',border:0,borderRadius:14,background:'#111827',color:'#fff',fontWeight:900,cursor:'pointer'}}>{submitting?'Submitting…':'Submit application'}</button>}</div>}
    </section>
  </main>;
}
