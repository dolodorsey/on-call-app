import React, { useState } from 'react';

const SERVICES = [
  { cat: "Home Repair", items: ["Plumbing","Electrical","HVAC","Carpentry","Painting","Drywall","Appliance Repair","Handyman","Pressure Washing"] },
  { cat: "Cleaning", items: ["House Cleaning","Deep Clean","Move In/Out Clean","Office Cleaning","Window Cleaning","Carpet Cleaning"] },
  { cat: "Moving & Delivery", items: ["Local Moving","Furniture Assembly","Junk Removal","Courier/Delivery"] },
  { cat: "Beauty & Wellness", items: ["Hair Styling","Makeup","Massage","Personal Training","Yoga Instructor","Nail Tech"] },
  { cat: "Tech Support", items: ["Computer Repair","Network Setup","Smart Home Install","TV Mounting","Phone Repair","Data Recovery"] },
  { cat: "Pet Services", items: ["Dog Walking","Pet Sitting","Pet Grooming","Pet Training"] },
  { cat: "Event Services", items: ["DJ/Music","Photography","Bartender","Catering Staff","Event Setup"] },
  { cat: "Landscaping", items: ["Lawn Mowing","Landscaping","Tree Trimming","Irrigation","Snow Removal","Garden Design"] },
];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const WEBHOOK = "https://dorsey.app.n8n.cloud/webhook/provider-application";

export default function ProviderApply() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ first_name:"",last_name:"",email:"",phone:"",city:"",state:"",zip_code:"",services_requested:[],years_experience:"",experience_description:"",has_vehicle:false,vehicle_type:"",background_check_consent:false });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const u = (k,v) => setForm(p => ({...p,[k]:v}));
  const toggleSvc = s => setForm(p => ({...p, services_requested: p.services_requested.includes(s) ? p.services_requested.filter(x=>x!==s) : [...p.services_requested, s]}));
  const canNext = () => {
    if (step===0) return form.first_name && form.last_name && form.email && form.phone && form.city && form.state;
    if (step===1) return form.services_requested.length > 0;
    if (step===2) return form.years_experience && form.background_check_consent;
    return true;
  };
  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(WEBHOOK, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, brand:"on_call", state_code:form.state}) });
      const data = await res.json();
      if (data.success) { setResult(data); setStep(4); } else setError(data.error||"Failed");
    } catch(e) { setError("Network error"); }
    setSubmitting(false);
  };

  const C = { bg:'#f8f9fc', primary:'#1a6bff', card:'#fff', border:'#e5e7eb', text:'#1e293b', muted:'#94a3b8' };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"system-ui, sans-serif"}}>
      <div style={{background:"linear-gradient(135deg, #1a6bff 0%, #0a4fd4 100%)",padding:"36px 24px",textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:"0.4em",color:"rgba(255,255,255,0.7)",marginBottom:8}}>ON CALL</div>
        <div style={{fontSize:28,fontWeight:700,color:"#fff"}}>Become a Provider</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",marginTop:4}}>Join our network of home & lifestyle professionals</div>
      </div>
      {step < 4 && (
        <div style={{maxWidth:600,margin:"0 auto",padding:"12px 24px"}}>
          <div style={{display:"flex",gap:4}}>
            {["Info","Services","Experience","Review"].map((l,i) => (
              <div key={i} style={{flex:1}}>
                <div style={{height:4,borderRadius:4,background:i<=step?C.primary:"#e0e0e0"}} />
                <div style={{fontSize:10,textAlign:"center",marginTop:4,color:i===step?C.text:C.muted}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{maxWidth:600,margin:"0 auto",padding:"24px"}}>
        {step===0 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Personal Information</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>First Name *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.first_name} onChange={e=>u("first_name",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Last Name *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.last_name} onChange={e=>u("last_name",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Email *</label><input type="email" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.email} onChange={e=>u("email",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Phone *</label><input type="tel" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.phone} onChange={e=>u("phone",e.target.value)} /></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginTop:12}}>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>City *</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.city} onChange={e=>u("city",e.target.value)} /></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>State *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.state} onChange={e=>u("state",e.target.value)}><option value="">--</option>{STATES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Zip</label><input style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.zip_code} onChange={e=>u("zip_code",e.target.value)} /></div>
          </div>
        </div>)}
        {step===1 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Select Your Services</h2>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>{form.services_requested.length} selected</p>
          {SERVICES.map(cat => (
            <div key={cat.cat} style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:8}}>{cat.cat}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cat.items.map(s => (
                  <button key={s} onClick={()=>toggleSvc(s)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,border:form.services_requested.includes(s)?`1px solid ${C.primary}`:`1px solid ${C.border}`,background:form.services_requested.includes(s)?C.primary:"#fff",color:form.services_requested.includes(s)?"#fff":"#555",cursor:"pointer"}}>{form.services_requested.includes(s)?"✓ ":""}{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>)}
        {step===2 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Experience & Background</h2>
          <div><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Years of Experience *</label><select style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,boxSizing:"border-box"}} value={form.years_experience} onChange={e=>u("years_experience",e.target.value)}><option value="">Select</option><option value="0">Less than 1</option><option value="1">1-2 years</option><option value="3">3-5 years</option><option value="5">5-10 years</option><option value="10">10+ years</option></select></div>
          <div style={{marginTop:12}}><label style={{display:"block",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,marginBottom:6}}>Experience</label><textarea style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:14,height:80,resize:"none",boxSizing:"border-box"}} value={form.experience_description} onChange={e=>u("experience_description",e.target.value)} /></div>
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={form.has_vehicle} onChange={e=>u("has_vehicle",e.target.checked)} /><span style={{fontSize:14}}>I have a vehicle</span></div>
          <div style={{marginTop:20,padding:16,background:"#fff",borderRadius:12,border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}><input type="checkbox" checked={form.background_check_consent} onChange={e=>u("background_check_consent",e.target.checked)} style={{marginTop:3}} /><div><div style={{fontSize:14,fontWeight:600}}>Background Check Consent *</div><div style={{fontSize:12,color:C.muted,marginTop:4}}>I authorize The Kollective Hospitality Group to conduct a background check.</div></div></div>
          </div>
        </div>)}
        {step===3 && (<div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:16}}>Review & Submit</h2>
          <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${C.border}`}}><div style={{fontWeight:600}}>{form.first_name} {form.last_name}</div><div style={{fontSize:13,color:C.muted}}>{form.email} · {form.phone} · {form.city}, {form.state}</div></div>
          <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${C.border}`}}><div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:C.muted,marginBottom:6}}>Services ({form.services_requested.length})</div><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{form.services_requested.map(s=><span key={s} style={{padding:"3px 10px",background:"#f1f3f8",borderRadius:12,fontSize:11}}>{s}</span>)}</div></div>
          {error && <div style={{marginTop:12,padding:12,background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:8,fontSize:13,color:"#ef4444"}}>{error}</div>}
        </div>)}
        {step===4 && result && (<div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:64,marginBottom:16}}>📞</div>
          <h2 style={{fontSize:28,fontWeight:700,marginBottom:8}}>Application Submitted!</h2>
          <div style={{display:"inline-block",padding:"8px 20px",background:C.primary,color:"#fff",borderRadius:8,fontFamily:"monospace",fontSize:18,marginBottom:16}}>{result.application_number}</div>
          <p style={{color:C.muted,maxWidth:400,margin:"0 auto",fontSize:14}}>We will review within 2-3 business days. Check your email for next steps.</p>
        </div>)}
        {step < 4 && (
          <div style={{display:"flex",justifyContent:"space-between",marginTop:32,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
            {step>0 ? <button onClick={()=>setStep(s=>s-1)} style={{padding:"10px 24px",fontSize:14,color:C.muted,background:"none",border:"none",cursor:"pointer"}}>← Back</button> : <div/>}
            {step<3 ? <button onClick={()=>canNext()&&setStep(s=>s+1)} disabled={!canNext()} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:canNext()?C.primary:"#e0e0e0",color:canNext()?"#fff":"#999",border:"none",cursor:canNext()?"pointer":"not-allowed"}}>Continue →</button>
            : <button onClick={submit} disabled={submitting} style={{padding:"10px 28px",borderRadius:8,fontSize:14,fontWeight:600,background:"#10b981",color:"#fff",border:"none",cursor:"pointer"}}>{submitting?"Submitting...":"Submit Application"}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
