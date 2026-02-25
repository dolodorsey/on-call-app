import React, { useState, useEffect, useCallback } from 'react';

/* ─── ON CALL Light Palette ─── */
const C = {
  bg: '#f8f9fc', card: '#ffffff', card2: '#f1f3f8', primary: '#1a6bff', primaryDark: '#0a4fd4',
  green: '#10b981', greenDark: '#059669', orange: '#f59e0b', purple: '#8b5cf6',
  white: '#ffffff', black: '#0f172a', gray: '#64748b', grayLight: '#94a3b8', grayLighter: '#e2e8f0',
  border: '#e5e7eb', text: '#1e293b', muted: '#94a3b8', yellow: '#facc15',
  red: '#ef4444', teal: '#14b8a6', accent: '#1a6bff',
};

/* ─── shared inline helpers ─── */
const flex = (dir='row',align='center',justify='center',gap=0) => ({display:'flex',flexDirection:dir,alignItems:align,justifyContent:justify,gap});
const btn = (bg,color='#fff',extra) => ({background:bg,color,border:'none',borderRadius:14,padding:'14px 28px',fontSize:16,fontWeight:700,cursor:'pointer',transition:'all .2s',...extra});
const cardStyle = {background:C.card,borderRadius:16,padding:20,border:`1px solid ${C.border}`,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'};
const inputStyle = {width:'100%',padding:'14px 16px',background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,outline:'none',boxSizing:'border-box'};
const errText = {fontSize:12,color:C.red,marginTop:4};

/* ─── types ─── */
const SERVICES = [
  {name:'Deep Clean',emoji:'🧹',price:85,eta:'45 min'},
  {name:'Handyman',emoji:'🔧',price:65,eta:'30 min'},
  {name:'Plumbing',emoji:'🚿',price:95,eta:'35 min'},
  {name:'Electrician',emoji:'⚡',price:90,eta:'40 min'},
  {name:'Lawn Care',emoji:'🌿',price:55,eta:'25 min'},
  {name:'Private Chef',emoji:'👨‍🍳',price:150,eta:'60 min'},
];

const PLANS = [
  {name:'Basic',price:'$0',period:'forever',features:['Pay-as-you-go pricing','Standard response time','Basic GPS tracking','Email support'],popular:false},
  {name:'ON CALL+',price:'$9.99',period:'/month',features:['15% off all services','Priority matching','Live GPS tracking','24/7 support line','1 free cleaning/month'],popular:true},
  {name:'ON CALL Pro',price:'$19.99',period:'/month',features:['25% off all services','VIP priority matching','Live GPS + ETA alerts','24/7 concierge line','2 free cleanings/month','Family coverage (up to 4)','Dedicated account manager'],popular:false},
];

const REVIEWS = [
  {text:'ON CALL sent a cleaning team 40 minutes before our guests arrived. The house was spotless. This app is a lifesaver.',name:'Danielle R.',plan:'ON CALL+ Member',stars:5},
  {text:'I use ON CALL for everything now. Plumber last week, private chef this weekend. One app for all of it.',name:'Marcus T.',plan:'Pro Member',stars:5},
  {text:'The handyman was professional, on time, and fixed everything in one visit. Finally a platform I can trust.',name:'Angela W.',plan:'ON CALL+',stars:5},
];

const MISSIONS_HISTORY = [
  {customer:'Karen L.',service:'Deep Clean',earned:85,time:'2:15 PM',rating:5},
  {customer:'James M.',service:'Plumbing',earned:95,time:'11:30 AM',rating:5},
  {customer:'Priya K.',service:'Lawn Care',earned:55,time:'9:45 AM',rating:4},
  {customer:'David W.',service:'Handyman',earned:65,time:'Yesterday',rating:5},
];

const CITIZEN_HISTORY = [
  {service:'Deep Clean',provider:'Maria G.',date:'Today, 2:15 PM',cost:85,status:'Completed'},
  {service:'Plumbing',provider:'Carlos R.',date:'Jan 15, 9:30 AM',cost:95,status:'Completed'},
  {service:'Handyman',provider:'Alex T.',date:'Dec 28, 7:45 PM',cost:65,status:'Completed'},
];

/* ─── validation helpers ─── */
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passwordStrength = (p) => {
  if(p.length<8) return {label:'Too short',color:C.red,pct:20};
  let score=0;
  if(/[a-z]/.test(p)) score++;
  if(/[A-Z]/.test(p)) score++;
  if(/[0-9]/.test(p)) score++;
  if(/[^a-zA-Z0-9]/.test(p)) score++;
  if(score<=1) return {label:'Weak',color:C.orange,pct:40};
  if(score===2) return {label:'Fair',color:C.yellow,pct:60};
  if(score===3) return {label:'Good',color:C.primary,pct:80};
  return {label:'Strong',color:C.green,pct:100};
};

/* ════════════════════════════════════════ */
/*               MAIN APP                  */
/* ════════════════════════════════════════ */
const App = () => {
  const [screen, setScreen] = useState('landing');
  const [fade, setFade] = useState(true);
  const [userName, setUserName] = useState('');

  const navigate = useCallback((s) => {
    setFade(false);
    setTimeout(()=>{setScreen(s);setFade(true);window.scrollTo(0,0);},200);
  },[]);

  const wrapper = {
    maxWidth:430,margin:'0 auto',minHeight:'100dvh',background:C.bg,
    fontFamily:"'DM Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color:C.text,position:'relative',overflow:'hidden',
    opacity:fade?1:0,transition:'opacity .2s',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap');
        @keyframes anim-rise{0%{opacity:0;transform:translateY(24px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes anim-pop{0%{opacity:0;transform:scale(.85)}100%{opacity:1;transform:scale(1)}}
        @keyframes anim-slide-up{0%{opacity:0;transform:translateY(40px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes anim-fade{0%{opacity:0}100%{opacity:1}}
        @keyframes anim-tab{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .anim-rise{animation:anim-rise .5s ease-out both}
        .anim-pop{animation:anim-pop .4s cubic-bezier(.34,1.56,.64,1) both}
        .anim-slide-up{animation:anim-slide-up .6s ease-out both}
        .anim-fade{animation:anim-fade .4s ease-out both}
        .anim-tab{animation:anim-tab .35s ease-out both}
        body{margin:0;background:#f0f2f7}
        *{box-sizing:border-box}
      `}</style>
      <div style={wrapper}>
        {screen==='landing' && <Landing onGetHelp={()=>navigate('auth-citizen')} onProviderPortal={()=>navigate('auth-hero')}/>}
        {screen==='auth-citizen' && <AuthScreen role="citizen" onBack={()=>navigate('landing')} onLogin={(n)=>{setUserName(n);navigate('citizen');}}/>}
        {screen==='auth-hero' && <AuthScreen role="hero" onBack={()=>navigate('landing')} onLogin={(n)=>{setUserName(n);navigate('hero');}}/>}
        {screen==='citizen' && <CitizenApp userName={userName} onBack={()=>navigate('landing')}/>}
        {screen==='hero' && <ProviderDashboard userName={userName} onBack={()=>navigate('landing')}/>}
      </div>
    </>
  );
};

/* ════════════════════════════════════════ */
/*             AUTH SCREEN                 */
/* ════════════════════════════════════════ */
const AuthScreen = ({role,onBack,onLogin}) => {
  const [mode,setMode]=useState('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [touched,setTouched]=useState({});

  const isCitizen=role==='citizen';
  const accent=isCitizen?C.primary:C.green;
  const title=isCitizen?'Your Account':'Provider Portal';
  const subtitle=isCitizen?'Get trusted help, anytime':'Join the ON CALL network';
  const icon=isCitizen?'🏠':'🛠️';

  const emailErr = touched.email && !isValidEmail(email) ? 'Please enter a valid email address' : '';
  const pwErr = touched.password && password.length>0 && password.length<8 ? 'Password must be at least 8 characters' : '';
  const nameErr = touched.name && mode==='signup' && name.trim().length<2 ? 'Name must be at least 2 characters' : '';
  const pwInfo = password.length>0 ? passwordStrength(password) : null;
  const isValid = isValidEmail(email) && password.length>=8 && (mode==='signin' || name.trim().length>=2);

  const handleSubmit = () => {
    if(!isValid) return;
    const displayName = mode==='signup' ? name.trim() : email.split('@')[0];
    onLogin(displayName);
  };

  return (
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600}}>← Back</button>
        <div style={{fontWeight:800,fontSize:16,color:C.text,letterSpacing:0.5}}>ON CALL</div>
        <div style={{width:50}}/>
      </div>

      <div style={{flex:1,...flex('column','center','center'),padding:'40px 24px'}}>
        <div style={{width:80,height:80,borderRadius:20,background:`${accent}12`,...flex('row','center','center'),fontSize:40,marginBottom:20}}>{icon}</div>
        <h1 style={{fontSize:24,fontWeight:800,color:C.text,margin:'0 0 4px'}}>{title}</h1>
        <p style={{fontSize:14,color:C.muted,margin:'0 0 32px'}}>{subtitle}</p>

        <div style={{...flex('row','center','center',0),width:'100%',marginBottom:28,background:C.card2,borderRadius:12,padding:4,border:`1px solid ${C.border}`}}>
          <button onClick={()=>{setMode('signin');setTouched({});}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,background:mode==='signin'?accent:'transparent',color:mode==='signin'?C.white:C.muted,transition:'all .2s'}}>Sign In</button>
          <button onClick={()=>{setMode('signup');setTouched({});}} style={{flex:1,padding:'10px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:14,fontWeight:700,background:mode==='signup'?accent:'transparent',color:mode==='signup'?C.white:C.muted,transition:'all .2s'}}>Create Account</button>
        </div>

        <div style={{width:'100%',maxWidth:360}}>
          {mode==='signup'&&(
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Full Name</label>
              <input value={name} onChange={e=>setName(e.target.value)} onBlur={()=>setTouched(t=>({...t,name:true}))} placeholder="Enter your full name" style={{...inputStyle,borderColor:nameErr?C.red:C.border}}/>
              {nameErr && <div style={errText}>{nameErr}</div>}
            </div>
          )}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onBlur={()=>setTouched(t=>({...t,email:true}))} placeholder="you@example.com" style={{...inputStyle,borderColor:emailErr?C.red:C.border}}/>
            {emailErr && <div style={errText}>{emailErr}</div>}
          </div>
          <div style={{marginBottom:8}}>
            <label style={{fontSize:12,color:C.gray,fontWeight:600,marginBottom:6,display:'block'}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onBlur={()=>setTouched(t=>({...t,password:true}))} placeholder="••••••••" style={{...inputStyle,borderColor:pwErr?C.red:C.border}}/>
            {pwErr && <div style={errText}>{pwErr}</div>}
          </div>
          {pwInfo && (
            <div style={{marginBottom:20}}>
              <div style={{height:4,background:C.grayLighter,borderRadius:2,overflow:'hidden',marginBottom:4}}>
                <div style={{height:'100%',width:`${pwInfo.pct}%`,background:pwInfo.color,borderRadius:2,transition:'all .3s'}}/>
              </div>
              <div style={{fontSize:11,color:pwInfo.color,fontWeight:600}}>{pwInfo.label}</div>
            </div>
          )}
          {!pwInfo && <div style={{height:16,marginBottom:8}}/>}

          <button onClick={handleSubmit} disabled={!isValid} style={{...btn(accent),width:'100%',fontSize:16,marginBottom:16,opacity:isValid?1:0.4,cursor:isValid?'pointer':'not-allowed'}}>
            {mode==='signin'?'Sign In':'Create Account'}
          </button>

          {mode==='signin'&&(
            <button style={{background:'none',border:'none',color:accent,fontSize:13,cursor:'pointer',width:'100%',textAlign:'center',fontWeight:600}}>Forgot Password?</button>
          )}
        </div>

        <div style={{...flex('row','center','center',12),width:'100%',maxWidth:360,margin:'24px 0'}}>
          <div style={{flex:1,height:1,background:C.border}}/>
          <span style={{fontSize:12,color:C.muted}}>or continue with</span>
          <div style={{flex:1,height:1,background:C.border}}/>
        </div>
        <div style={{...flex('row','center','center',12),width:'100%',maxWidth:360}}>
          {['Google','Apple'].map(provider=>(
            <button key={provider} onClick={()=>onLogin(provider+' User')} style={{flex:1,padding:'12px 0',background:C.card,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
              {provider==='Google'?'🔵':'🍎'} {provider}
            </button>
          ))}
        </div>
        <p style={{fontSize:11,color:C.grayLight,marginTop:32,textAlign:'center',maxWidth:300}}>
          By continuing, you agree to ON CALL's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*            LANDING PAGE                 */
/* ════════════════════════════════════════ */
const Landing = ({onGetHelp,onProviderPortal}) => {
  const [scrollY,setScrollY]=useState(0);
  useEffect(()=>{const h=()=>setScrollY(window.scrollY);window.addEventListener('scroll',h);return()=>window.removeEventListener('scroll',h);},[]);

  return (
    <div>
      {/* NAV */}
      <nav style={{position:'sticky',top:0,zIndex:50,background:scrollY>50?'rgba(248,249,252,0.95)':C.bg,backdropFilter:scrollY>50?'blur(12px)':'none',borderBottom:`1px solid ${scrollY>50?C.border:'transparent'}`,padding:'12px 20px',transition:'all .3s',...flex('row','center','space-between')}}>
        <div style={flex('row','center','flex-start',8)}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg, ${C.primary}, ${C.teal})`,...flex('row','center','center'),fontWeight:900,fontSize:10,color:C.white,letterSpacing:0.5}}>OC</div>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:C.text,letterSpacing:0.5}}>ON CALL</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:0.5}}>Your Button for Everything</div>
          </div>
        </div>
        <div style={flex('row','center','flex-end',8)}>
          <button onClick={onGetHelp} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.gray,borderRadius:10,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:600}}>Sign In</button>
          <button onClick={onProviderPortal} style={{background:C.card,border:`1px solid ${C.border}`,color:C.green,borderRadius:10,padding:'8px 14px',fontSize:12,cursor:'pointer',fontWeight:600}}>Provider Portal</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="anim-rise" style={{padding:'60px 24px 40px',textAlign:'center',background:`radial-gradient(ellipse at 50% 0%,rgba(26,107,255,0.06) 0%,transparent 60%)`}}>
        <div className="anim-fade" style={{display:'inline-block',fontSize:10,color:C.primary,fontWeight:700,letterSpacing:3,textTransform:'uppercase',marginBottom:12,animationDelay:'.1s',background:`${C.primary}08`,padding:'6px 16px',borderRadius:20}}>All-Services Super App</div>
        <h1 className="anim-rise" style={{fontSize:44,fontWeight:900,color:C.text,margin:'12px 0 8px',letterSpacing:-0.5,lineHeight:1.1,animationDelay:'.15s'}}>ON CALL</h1>
        <p className="anim-fade" style={{fontSize:17,color:C.gray,margin:'0 0 4px',fontWeight:500,animationDelay:'.25s'}}>Life Made Simple</p>
        <p className="anim-fade" style={{fontSize:14,color:C.muted,margin:'0 0 32px',animationDelay:'.35s'}}>When you don't know who to call — call ON CALL.</p>
        <div className="anim-slide-up" style={{...flex('column','center','center',12),animationDelay:'.4s'}}>
          <button onClick={onGetHelp} style={{...btn(`linear-gradient(135deg, ${C.primary}, ${C.teal})`),width:'100%',maxWidth:280,fontSize:18,padding:'16px 32px',boxShadow:`0 8px 30px ${C.primary}25`,borderRadius:16}}>🏠 Book a Service</button>
          <button onClick={onProviderPortal} style={{...btn('transparent',C.text,{border:`2px solid ${C.border}`,width:'100%',maxWidth:280,borderRadius:16})}}>🛠️ Become a Provider</button>
        </div>
        <div style={{...flex('row','center','center',20),marginTop:32,flexWrap:'wrap'}}>
          {[['✓','Vetted Providers'],['⚡','Avg 30min Arrival'],['⭐','4.9/5 Rating']].map(([ic,label])=>(
            <div key={label} style={{...flex('row','center','center',6),fontSize:12,color:C.gray}}>
              <span style={{color:C.green}}>{ic}</span>{label}
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',color:C.text,margin:'0 0 8px'}}>How ON CALL Works</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Help in three simple steps</p>
        {[
          {step:'1',title:'Tell Us What You Need',desc:'Browse services or describe your request. We handle the rest — from cleaning to chefs to electricians.',icon:'📱',color:C.primary},
          {step:'2',title:'Provider Matched',desc:'We match you with the closest qualified, vetted provider. Track their arrival in real-time with GPS.',icon:'🎯',color:C.teal},
          {step:'3',title:'Done & Rated',desc:'Professional service with transparent pricing. Pay securely through the app when the job is complete.',icon:'✅',color:C.green},
        ].map((s,i)=>(
          <div key={s.step} className="anim-rise" style={{...cardStyle,...flex('row','flex-start','flex-start',16),marginBottom:16,animationDelay:`${i*0.12}s`}}>
            <div style={{width:48,height:48,borderRadius:14,background:`${s.color}10`,...flex('row','center','center'),fontSize:24,flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontSize:12,color:s.color,fontWeight:700,marginBottom:4}}>STEP {s.step}</div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>{s.title}</div>
              <div style={{fontSize:13,color:C.gray,lineHeight:1.5}}>{s.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* SERVICES */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',color:C.text,margin:'0 0 8px'}}>Popular Services</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Everything you need in one place</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {SERVICES.map((s,i)=>(
            <div key={s.name} className="anim-pop" style={{...cardStyle,textAlign:'center',padding:20,animationDelay:`${i*0.08}s`}}>
              <div style={{fontSize:32,marginBottom:8}}>{s.emoji}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{s.name}</div>
              <div style={{fontSize:18,fontWeight:800,color:C.primary}}>${s.price}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>~{s.eta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SAFETY / TRUST */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',color:C.text,margin:'0 0 8px'}}>Trust & Safety Built In</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Every provider is thoroughly vetted and verified</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            {icon:'🛡️',title:'Background Checked',desc:'Comprehensive verification for all providers'},
            {icon:'⭐',title:'Highly Rated',desc:'Only top-rated professionals'},
            {icon:'📍',title:'GPS Tracked',desc:'Real-time location sharing'},
            {icon:'📞',title:'24/7 Support',desc:'Always available when you need us'},
          ].map(c=>(
            <div key={c.title} style={{...cardStyle,textAlign:'center',padding:20}}>
              <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>{c.title}</div>
              <div style={{fontSize:11,color:C.gray,lineHeight:1.4}}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',color:C.text,margin:'0 0 8px'}}>Choose Your Plan</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Save more with a membership</p>
        {PLANS.map(p=>(
          <div key={p.name} style={{...cardStyle,marginBottom:16,border:`1px solid ${p.popular?C.primary:C.border}`,position:'relative',overflow:'hidden'}}>
            {p.popular&&<div style={{position:'absolute',top:12,right:-30,background:`linear-gradient(135deg, ${C.primary}, ${C.teal})`,color:C.white,fontSize:10,fontWeight:800,padding:'4px 36px',transform:'rotate(45deg)',letterSpacing:1}}>POPULAR</div>}
            <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>{p.name}</div>
            <div style={{...flex('row','baseline','flex-start',4),marginBottom:12}}>
              <span style={{fontSize:32,fontWeight:900,color:p.popular?C.primary:C.text}}>{p.price}</span>
              <span style={{fontSize:13,color:C.muted}}>{p.period}</span>
            </div>
            {p.features.map(f=>(
              <div key={f} style={{...flex('row','center','flex-start',8),marginBottom:8}}>
                <span style={{color:C.green,fontSize:14}}>✓</span>
                <span style={{fontSize:13,color:C.gray}}>{f}</span>
              </div>
            ))}
            <button onClick={onGetHelp} style={{...btn(p.popular?`linear-gradient(135deg, ${C.primary}, ${C.teal})`:C.card2,p.popular?C.white:C.text,{width:'100%',marginTop:12,border:p.popular?'none':`1px solid ${C.border}`})}}>
              {p.price==='$0'?'Get Started Free':'Subscribe Now'}
            </button>
          </div>
        ))}
      </section>

      {/* TESTIMONIALS */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`}}>
        <h2 style={{fontSize:24,fontWeight:800,textAlign:'center',color:C.text,margin:'0 0 8px'}}>What People Say</h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:14,margin:'0 0 32px'}}>Real stories from real customers</p>
        {REVIEWS.map((r,i)=>(
          <div key={i} style={{...cardStyle,marginBottom:16}}>
            <div style={{marginBottom:8}}>{Array(r.stars).fill('⭐').join('')}</div>
            <p style={{fontSize:14,color:C.gray,lineHeight:1.6,margin:'0 0 12px',fontStyle:'italic'}}>"{r.text}"</p>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{r.name}</div>
            <div style={{fontSize:11,color:C.muted}}>{r.plan}</div>
          </div>
        ))}
      </section>

      {/* BECOME A PROVIDER */}
      <section style={{padding:'48px 24px',borderTop:`1px solid ${C.border}`,textAlign:'center',background:`radial-gradient(ellipse at 50% 100%,rgba(16,185,129,0.06) 0%,transparent 60%)`}}>
        <div style={{fontSize:48,marginBottom:16}}>🛠️</div>
        <h2 style={{fontSize:24,fontWeight:800,color:C.text,margin:'0 0 8px'}}>Become an ON CALL Provider</h2>
        <p style={{fontSize:14,color:C.gray,margin:'0 0 24px',maxWidth:320,marginLeft:'auto',marginRight:'auto',lineHeight:1.6}}>Earn on your schedule helping people with the skills you already have. Flexible hours, instant payouts, and the ability to grow your own business.</p>
        <button onClick={onProviderPortal} style={{...btn(C.green),fontSize:16,padding:'14px 40px',borderRadius:16}}>Apply Now</button>
      </section>

      {/* TRUST METRICS */}
      <section style={{padding:'40px 24px',borderTop:`1px solid ${C.border}`}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {[['50+','Service Categories'],['4.9','App Rating'],['30 min','Avg Arrival'],['98%','Jobs Completed']].map(([val,label])=>(
            <div key={label} style={{textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:900,color:C.text}}>{val}</div>
              <div style={{fontSize:11,color:C.muted}}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{padding:'32px 24px',borderTop:`1px solid ${C.border}`,textAlign:'center'}}>
        <div style={{fontWeight:800,fontSize:18,color:C.text,marginBottom:4}}>ON CALL</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Anything. Anytime. Anyone.</div>
        <div style={{fontSize:11,color:C.grayLight}}>© 2026 ON CALL. All rights reserved.</div>
      </footer>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*             CITIZEN APP                 */
/* ════════════════════════════════════════ */
const CitizenApp = ({userName,onBack}) => {
  const [tab,setTab]=useState('home');
  const [selectedService,setSelectedService]=useState(null);
  const [reqStep,setReqStep]=useState(null);
  const [eta,setEta]=useState(1800);
  const [notifOpen,setNotifOpen]=useState(false);

  useEffect(()=>{
    if(reqStep!=='tracking') return;
    const t=setInterval(()=>setEta(p=>Math.max(0,p-1)),1000);
    return()=>clearInterval(t);
  },[reqStep]);

  const startRequest=(svc)=>{
    setSelectedService(svc);
    setReqStep('confirm');
  };

  const dispatchProvider=()=>{
    setReqStep('finding');
    setTimeout(()=>setReqStep('found'),3000);
  };

  const startTracking=()=>{
    setEta(1800);
    setReqStep('tracking');
  };

  const cancelRequest=()=>{
    setReqStep(null);
    setSelectedService(null);
  };

  const formatEta=(s)=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  /* ── Service Request Flow overlays ── */
  if(reqStep==='confirm' && selectedService) return (
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <button onClick={cancelRequest} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer',fontWeight:600}}>← Cancel</button>
        <div style={{fontSize:14,fontWeight:700,color:C.text}}>Confirm Service</div>
        <div style={{width:50}}/>
      </div>
      <div style={{flex:1,...flex('column','center','center'),padding:'40px 24px'}}>
        <div style={{fontSize:64,marginBottom:20}}>{selectedService.emoji}</div>
        <h2 style={{fontSize:28,fontWeight:900,color:C.text,margin:'0 0 8px'}}>{selectedService.name}</h2>
        <div style={{...cardStyle,width:'100%',marginTop:24,marginBottom:24}}>
          <div style={{...flex('row','center','space-between'),marginBottom:12}}>
            <span style={{fontSize:14,color:C.gray}}>Service Price</span>
            <span style={{fontSize:20,fontWeight:900,color:C.primary}}>${selectedService.price}</span>
          </div>
          <div style={{...flex('row','center','space-between'),marginBottom:12}}>
            <span style={{fontSize:14,color:C.gray}}>Estimated Arrival</span>
            <span style={{fontSize:16,fontWeight:700,color:C.text}}>~{selectedService.eta}</span>
          </div>
          <div style={{...flex('row','center','space-between')}}>
            <span style={{fontSize:14,color:C.gray}}>Service Fee</span>
            <span style={{fontSize:14,fontWeight:600,color:C.muted}}>$0.00</span>
          </div>
        </div>
        <div style={{width:'100%',padding:'16px 20px',background:`${C.primary}08`,borderRadius:14,marginBottom:24,...flex('row','center','flex-start',10)}}>
          <span style={{fontSize:18}}>📍</span>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>Your current location</div>
            <div style={{fontSize:11,color:C.muted}}>GPS detected automatically</div>
          </div>
        </div>
        <button onClick={dispatchProvider} style={{...btn(`linear-gradient(135deg, ${C.primary}, ${C.teal})`),width:'100%',fontSize:18,padding:'18px 32px',boxShadow:`0 8px 30px ${C.primary}25`,borderRadius:16}}>📲 Find Provider</button>
      </div>
    </div>
  );

  if(reqStep==='finding') return (
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','center','center'),padding:40}}>
      <div style={{position:'relative',width:160,height:160,marginBottom:40}}>
        <div style={{position:'absolute',inset:0,borderRadius:'50%',border:`2px solid ${C.primary}30`,animation:'pulse-ring 2s ease-out infinite'}}/>
        <div style={{position:'absolute',inset:20,borderRadius:'50%',border:`2px solid ${C.primary}50`,animation:'pulse-ring 2s ease-out infinite .5s'}}/>
        <div style={{position:'absolute',inset:40,borderRadius:'50%',border:`2px solid ${C.primary}80`,animation:'pulse-ring 2s ease-out infinite 1s'}}/>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg, ${C.primary}, ${C.teal})`,boxShadow:`0 0 30px ${C.primary}40`,...flex('row','center','center')}}>
          <span style={{fontSize:20}}>🔍</span>
        </div>
      </div>
      <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:8}}>Finding Your Provider...</div>
      <div style={{fontSize:14,color:C.gray,textAlign:'center'}}>Matching you with the closest verified provider</div>
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}`}</style>
    </div>
  );

  if(reqStep==='found') return (
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','center','center'),padding:24}}>
      <div style={{fontSize:48,marginBottom:16,animation:'bounce-in .5s ease'}}>🎉</div>
      <h2 style={{fontSize:24,fontWeight:900,color:C.text,margin:'0 0 8px'}}>Provider Matched!</h2>
      <p style={{fontSize:14,color:C.gray,margin:'0 0 24px'}}>They're on the way</p>
      <div style={{...cardStyle,width:'100%',maxWidth:360}}>
        <div style={{...flex('row','center','flex-start',16),marginBottom:20}}>
          <div style={{width:64,height:64,borderRadius:16,background:`${C.green}12`,...flex('row','center','center'),fontSize:32}}>🛠️</div>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.text}}>Maria G.</div>
            <div style={{fontSize:13,color:C.yellow}}>⭐ 4.9 · 312 jobs</div>
          </div>
        </div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,color:C.gray}}>ETA</span>
          <span style={{fontSize:16,fontWeight:700,color:C.text}}>~30 min</span>
        </div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,color:C.gray}}>Specialty</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Home Services · Cleaning</span>
        </div>
        <div style={{...flex('row','center','space-between'),padding:'12px 0',borderTop:`1px solid ${C.border}`}}>
          <span style={{fontSize:13,color:C.gray}}>Service</span>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>{selectedService?.name}</span>
        </div>
      </div>
      <button onClick={startTracking} style={{...btn(C.green),width:'100%',maxWidth:360,fontSize:16,marginTop:24,borderRadius:16}}>Track My Provider →</button>
      <style>{`@keyframes bounce-in{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}`}</style>
    </div>
  );

  if(reqStep==='tracking') return (
    <div style={{minHeight:'100dvh',background:C.bg,...flex('column','stretch','flex-start')}}>
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <button onClick={cancelRequest} style={{background:'transparent',border:'none',color:C.gray,fontSize:14,cursor:'pointer'}}>✕ Close</button>
        <div style={{fontSize:14,fontWeight:700,color:C.green}}>Provider En Route</div>
        <div style={{width:40}}/>
      </div>
      <div style={{flex:1,minHeight:300,background:C.card,margin:'0 20px',borderRadius:20,position:'relative',overflow:'hidden',...flex('column','center','center'),border:`1px solid ${C.border}`}}>
        <div style={{width:200,height:200,borderRadius:'50%',border:`2px dashed ${C.grayLighter}`,position:'absolute',...flex('column','center','center')}}>
          <div style={{width:120,height:120,borderRadius:'50%',border:`2px dashed ${C.grayLighter}`,position:'absolute',...flex('column','center','center')}}>
            <div style={{width:16,height:16,borderRadius:'50%',background:C.primary,boxShadow:`0 0 20px ${C.primary}60`}}/>
          </div>
        </div>
        <div style={{position:'absolute',top:20,right:20,width:12,height:12,borderRadius:'50%',background:C.green,boxShadow:`0 0 12px ${C.green}`}}/>
        <div style={{position:'absolute',bottom:16,left:16,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'8px 12px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>📍 Live GPS Tracking</div>
      </div>
      <div style={{padding:20}}>
        <div style={{...cardStyle,...flex('row','center','space-between'),marginBottom:16}}>
          <div style={flex('row','center','flex-start',12)}>
            <div style={{width:48,height:48,borderRadius:14,background:`${C.green}12`,...flex('row','center','center'),fontSize:24}}>🛠️</div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>Maria G.</div>
              <div style={{fontSize:12,color:C.muted}}>⭐ 4.9 · Home Services</div>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:24,fontWeight:900,color:C.primary,fontVariantNumeric:'tabular-nums'}}>{formatEta(eta)}</div>
            <div style={{fontSize:10,color:C.muted}}>ETA</div>
          </div>
        </div>
        <div style={flex('row','center','center',12)}>
          <button style={{...btn(C.card,C.text,{flex:1,border:`1px solid ${C.border}`,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'})}}>📞 Call</button>
          <button style={{...btn(C.card,C.text,{flex:1,border:`1px solid ${C.border}`,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'})}}>💬 Message</button>
          <button onClick={cancelRequest} style={{...btn(C.card,C.red,{flex:1,border:`1px solid ${C.red}30`})}}>Cancel</button>
        </div>
      </div>
    </div>
  );

  /* ── Full Service Taxonomy (from ON CALL deck) ── */
  const SERVICE_TAXONOMY = [
    { id:'home-services', name:'Home Services', icon:'🏠', color:'#1a6bff', count:7, services:[
      {name:'Deep Cleaning',description:'Full home deep cleaning service',price:'$85',eta:'45-60 min'},
      {name:'Handyman',description:'General repairs and installations',price:'$65',eta:'30-45 min'},
      {name:'Plumbing',description:'Leak repair, drain clearing, fixtures',price:'$95',eta:'30-50 min'},
      {name:'Electrical',description:'Wiring, outlets, fixture install',price:'$90',eta:'35-50 min'},
      {name:'HVAC',description:'AC/heating repair and maintenance',price:'$110',eta:'45-60 min'},
      {name:'Smart Home Setup',description:'Smart devices, WiFi, automation',price:'$75',eta:'60-90 min'},
      {name:'Appliance Install',description:'Washer, dryer, dishwasher install',price:'$85',eta:'45-75 min'},
    ]},
    { id:'personal-care', name:'Personal Care & Wellness', icon:'💆', color:'#a855f7', count:6, services:[
      {name:'Hair Styling',description:'Professional hair styling at home',price:'$65',eta:'45-60 min'},
      {name:'Nails',description:'Manicure and pedicure at home',price:'$55',eta:'45-60 min'},
      {name:'Massage Therapy',description:'Licensed massage therapist',price:'$95',eta:'60-90 min'},
      {name:'IV Therapy',description:'Hydration and vitamin infusion',price:'$150',eta:'45-60 min'},
      {name:'Personal Trainer',description:'In-home fitness training',price:'$75',eta:'60 min'},
      {name:'Makeup Artist',description:'Professional makeup for events',price:'$85',eta:'45-60 min'},
    ]},
    { id:'family-childcare', name:'Family & Childcare', icon:'👶', color:'#f59e0b', count:5, services:[
      {name:'Babysitter',description:'Vetted, experienced childcare',price:'$25/hr',eta:'30-60 min'},
      {name:'Elder Care',description:'Compassionate elder assistance',price:'$30/hr',eta:'45-60 min'},
      {name:'Pet Walking',description:'Professional dog walking',price:'$20',eta:'20-30 min'},
      {name:'Pet Grooming',description:'Full grooming at your door',price:'$65',eta:'60-90 min'},
      {name:'Tutoring',description:'Academic tutoring all subjects',price:'$45/hr',eta:'Scheduled'},
    ]},
    { id:'errands-delivery', name:'Errands & Deliveries', icon:'📦', color:'#ef4444', count:4, services:[
      {name:'Grocery Run',description:'Grocery shopping and delivery',price:'$25',eta:'30-45 min'},
      {name:'Pharmacy Pickup',description:'Prescription and OTC pickup',price:'$15',eta:'20-30 min'},
      {name:'Dry Cleaning',description:'Pickup and delivery service',price:'$20',eta:'Same day'},
      {name:'Personal Shopping',description:'Last-minute personal shopping',price:'$35',eta:'45-60 min'},
    ]},
    { id:'lifestyle-events', name:'Lifestyle & Events', icon:'🎉', color:'#14b8a6', count:6, services:[
      {name:'Private Chef',description:'Professional chef at your home',price:'$150',eta:'Scheduled'},
      {name:'Bartender',description:'Professional bartending service',price:'$45/hr',eta:'Scheduled'},
      {name:'Waitstaff',description:'Professional servers for events',price:'$35/hr',eta:'Scheduled'},
      {name:'DJ',description:'Professional DJ for your event',price:'$200',eta:'Scheduled'},
      {name:'Photographer',description:'Professional event photography',price:'$175',eta:'Scheduled'},
      {name:'Event Planner',description:'Full event coordination',price:'Quote',eta:'Scheduled'},
    ]},
    { id:'outdoor-yard', name:'Outdoor & Yard', icon:'🌿', color:'#22c55e', count:5, services:[
      {name:'Lawn Mowing',description:'Full lawn mowing and edging',price:'$45',eta:'30-45 min'},
      {name:'Landscaping',description:'Design and maintenance',price:'$85',eta:'60-120 min'},
      {name:'Pool Cleaning',description:'Full pool service and chemical balance',price:'$75',eta:'45-60 min'},
      {name:'Power Washing',description:'Driveway, deck, siding wash',price:'$95',eta:'60-90 min'},
      {name:'Tree Trimming',description:'Professional tree service',price:'$120',eta:'60-120 min'},
    ]},
    { id:'seasonal-holiday', name:'Seasonal & Holiday', icon:'🎄', color:'#eab308', count:4, services:[
      {name:'Holiday Lights',description:'Setup and takedown service',price:'$150',eta:'Scheduled'},
      {name:'Holiday Decor',description:'Full holiday decorating',price:'$125',eta:'Scheduled'},
      {name:'Seasonal Organizer',description:'Closet/garage seasonal prep',price:'$65',eta:'60-90 min'},
      {name:'Firewood Delivery',description:'Seasoned firewood delivered',price:'$55',eta:'30-45 min'},
    ]},
    { id:'security-specialty', name:'Security & Specialty', icon:'🛡️', color:'#6366f1', count:5, services:[
      {name:'Event Security',description:'Professional security personnel',price:'$50/hr',eta:'Scheduled'},
      {name:'Valet',description:'Professional valet service',price:'$40/hr',eta:'Scheduled'},
      {name:'Locksmith',description:'Emergency locksmith service',price:'$75',eta:'20-30 min'},
      {name:'Pest Control',description:'Professional pest treatment',price:'$95',eta:'45-60 min'},
      {name:'Personal Stylist',description:'Wardrobe consultation',price:'$85',eta:'Scheduled'},
    ]},
    { id:'business-office', name:'Business & Office', icon:'🏢', color:'#0ea5e9', count:4, services:[
      {name:'IT Setup',description:'Office tech setup and support',price:'$85',eta:'45-60 min'},
      {name:'Office Cleaning',description:'Professional office cleaning',price:'$95',eta:'60-90 min'},
      {name:'Office Movers',description:'Furniture and equipment moving',price:'$120',eta:'Scheduled'},
      {name:'Corporate Concierge',description:'Full-service office packages',price:'Quote',eta:'Scheduled'},
    ]},
  ];

  const ServicesScreen = ({onDispatch}) => {
    const [activeCat,setActiveCat] = useState(null);
    const [selectedSvc,setSelectedSvc] = useState(null);
    const cat = activeCat ? SERVICE_TAXONOMY.find(c=>c.id===activeCat) : null;

    if (cat) {
      return (
        <div className="anim-tab" style={{padding:20}}>
          <button onClick={()=>{setActiveCat(null);setSelectedSvc(null);}} style={{background:'none',border:'none',color:C.gray,cursor:'pointer',...flex('row','center','flex-start',6),marginBottom:16,fontSize:14}}>
            <span style={{fontSize:18}}>‹</span> All Services
          </button>
          <div style={{...flex('row','center','flex-start',10),marginBottom:20}}>
            <div style={{width:44,height:44,borderRadius:14,background:`${cat.color}10`,...flex('row','center','center'),fontSize:24}}>{cat.icon}</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:C.text}}>{cat.name}</div>
              <div style={{fontSize:12,color:C.muted}}>{cat.services.length} services</div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {cat.services.map((s,i)=>{
              const sel = selectedSvc===s.name;
              return (
                <button key={s.name} className="anim-rise" onClick={()=>setSelectedSvc(sel?null:s.name)}
                  style={{...cardStyle,textAlign:'left',cursor:'pointer',border:sel?`2px solid ${cat.color}`:`1px solid ${C.border}`,animationDelay:`${i*0.05}s`,transition:'all .2s'}}>
                  <div style={flex('row','center','space-between')}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.name}</div>
                      <div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.description}</div>
                    </div>
                    <div style={{textAlign:'right',marginLeft:12,flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:s.price==='Quote'?C.orange:C.primary}}>{s.price}</div>
                      <div style={{fontSize:11,color:C.muted}}>⏱ {s.eta}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedSvc && (
            <button onClick={()=>onDispatch(cat.services.find(s2=>s2.name===selectedSvc)||{name:selectedSvc,price:'$0',eta:'30 min'})} className="anim-pop"
              style={{...btn(`linear-gradient(135deg, ${C.primary}, ${C.teal})`,C.white,{width:'100%',marginTop:20,padding:'16px 28px',fontSize:15,letterSpacing:0.5,borderRadius:16,boxShadow:`0 8px 30px ${C.primary}25`})}}>
              📲 BOOK NOW
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="anim-tab" style={{padding:20}}>
        <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>All Services</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:20}}>50+ services across 9 categories</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {SERVICE_TAXONOMY.map((cat,i)=>(
            <button key={cat.id} className="anim-pop" onClick={()=>setActiveCat(cat.id)}
              style={{...cardStyle,textAlign:'left',cursor:'pointer',borderLeft:`3px solid ${cat.color}`,animationDelay:`${i*0.06}s`}}>
              <div style={{fontSize:28,marginBottom:8}}>{cat.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>{cat.name}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{cat.count} services</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ── Main Citizen Tabs ── */
  return (
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80}}>
      {/* Header */}
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <div style={flex('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg, ${C.primary}, ${C.teal})`,...flex('row','center','center'),fontWeight:900,fontSize:9,color:C.white,letterSpacing:0.3}}>OC</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>Hi, {userName || 'there'} 👋</div>
            <div style={{fontSize:11,color:C.muted}}>Basic Member</div>
          </div>
        </div>
        <button onClick={()=>setNotifOpen(!notifOpen)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,width:40,height:40,cursor:'pointer',...flex('row','center','center'),position:'relative',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
          <span style={{fontSize:18}}>🔔</span>
          <div style={{position:'absolute',top:6,right:6,width:8,height:8,borderRadius:'50%',background:C.primary}}/>
        </button>
      </div>

      {notifOpen && (
        <div style={{margin:'0 20px 16px',padding:16,background:C.card,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Notifications</div>
          {['🎉 Welcome to ON CALL! Your account is ready.','⭐ Upgrade to ON CALL+ for priority matching.'].map((n,i)=>(
            <div key={i} style={{padding:'10px 0',borderBottom:i===0?`1px solid ${C.border}`:'none',fontSize:13,color:C.gray}}>{n}</div>
          ))}
        </div>
      )}

      {tab==='home'&&(
        <div className="anim-tab">
          {/* Map area */}
          <div style={{margin:'0 20px',height:200,background:C.card,borderRadius:20,position:'relative',overflow:'hidden',...flex('column','center','center'),border:`1px solid ${C.border}`}}>
            <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 50%,${C.card2} 0%,${C.bg} 100%)`}}/>
            <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.5}}/>
            <div style={{position:'relative',width:16,height:16,borderRadius:'50%',background:C.primary,boxShadow:`0 0 20px ${C.primary}60`}}/>
            <div style={{position:'absolute',bottom:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>📍 Your location</div>
          </div>

          {/* Main CTA Button */}
          <div style={{...flex('column','center','center'),padding:'20px 20px 12px'}}>
            <button onClick={()=>startRequest(SERVICES[0])} style={{width:140,height:140,borderRadius:'50%',background:`linear-gradient(135deg, ${C.primary}, ${C.teal})`,border:'none',color:C.white,fontSize:15,fontWeight:900,cursor:'pointer',boxShadow:`0 8px 40px ${C.primary}35`,letterSpacing:0.5,animation:'oc-pulse 2s ease-in-out infinite'}}>
              🏠<br/>ON CALL<br/><span style={{fontSize:11,fontWeight:600}}>Book Now</span>
            </button>
          </div>
          <style>{`@keyframes oc-pulse{0%,100%{box-shadow:0 8px 30px rgba(26,107,255,0.25)}50%{box-shadow:0 8px 50px rgba(26,107,255,0.45)}}`}</style>

          {/* Service cards grid */}
          <div style={{padding:'8px 20px'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12}}>Popular Services</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {SERVICES.map((s,i)=>(
                <button key={s.name} className="anim-pop" onClick={()=>startRequest(s)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'14px 8px',cursor:'pointer',textAlign:'center',animationDelay:`${i*0.07}s`,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:28,marginBottom:4}}>{s.emoji}</div>
                  <div style={{fontSize:11,color:C.text,fontWeight:600}}>{s.name}</div>
                  <div style={{fontSize:12,color:C.primary,fontWeight:800}}>${s.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent history preview */}
          <div style={{padding:'20px 20px 0'}}>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:12}}>Recent Bookings</div>
            {CITIZEN_HISTORY.map((h,i)=>(
              <div key={i} style={{...flex('row','center','space-between'),padding:'12px 0',borderBottom:i<CITIZEN_HISTORY.length-1?`1px solid ${C.border}`:'none'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.text}}>{h.service}</div>
                  <div style={{fontSize:11,color:C.muted}}>{h.provider} · {h.date}</div>
                </div>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>${h.cost}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='services'&&(
        <ServicesScreen onDispatch={(svc)=>startRequest({name:svc.name,emoji:'📲',price:typeof svc.price==='string'?parseInt(svc.price.replace(/[^0-9]/g,''))||0:svc.price,eta:svc.eta||'30 min'})} />
      )}

      {tab==='history'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Booking History</h2>
          {CITIZEN_HISTORY.map((h,i)=>(
            <div key={i} style={{...cardStyle,...flex('row','center','space-between'),marginBottom:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>{h.service}</div>
                <div style={{fontSize:12,color:C.muted}}>{h.provider} · {h.date}</div>
                <div style={{fontSize:11,color:C.green,marginTop:4}}>✓ {h.status}</div>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:C.text}}>${h.cost}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='wallet'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Wallet</h2>
          <div style={{...cardStyle,textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>ON CALL Balance</div>
            <div style={{fontSize:36,fontWeight:900,color:C.primary}}>$0.00</div>
          </div>
          <div style={{...cardStyle,marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Payment Methods</div>
            <div style={{...flex('row','center','space-between'),padding:'12px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:14,color:C.gray}}>💳 •••• 4242</span>
              <span style={{fontSize:12,color:C.green}}>Default</span>
            </div>
            <button style={{...btn('transparent',C.primary,{border:'none',padding:'12px 0',fontSize:13,fontWeight:600})}}>+ Add Payment Method</button>
          </div>
          <div style={cardStyle}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Recent Charges</div>
            {CITIZEN_HISTORY.map((h,i)=>(
              <div key={i} style={{...flex('row','center','space-between'),padding:'10px 0',borderBottom:i<CITIZEN_HISTORY.length-1?`1px solid ${C.border}`:'none'}}>
                <span style={{fontSize:13,color:C.gray}}>{h.service} · {h.date}</span>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>${h.cost}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='profile'&&(
        <div className="anim-tab" style={{padding:20,...flex('column','center','center'),minHeight:'60vh'}}>
          <div style={{width:80,height:80,borderRadius:20,background:C.card2,...flex('row','center','center'),fontSize:36,marginBottom:16,border:`1px solid ${C.border}`}}>👤</div>
          <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{userName || 'User'}</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Basic Member</div>
          {['My Profile','ON CALL Plans','Payment Methods','Safety Settings','Help & Support'].map(item=>(
            <div key={item} style={{...cardStyle,width:'100%',marginBottom:8,...flex('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}>
              <span style={{fontSize:14,color:C.text}}>{item}</span>
              <span style={{color:C.muted}}>→</span>
            </div>
          ))}
          <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:16})}}>Sign Out</button>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...flex('row','center','space-around'),zIndex:40}}>
        {[['home','🏠','Home'],['services','📋','Services'],['history','📂','History'],['wallet','💳','Wallet'],['profile','👤','Profile']].map(([id,ic,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...flex('column','center','center',2),padding:'6px 12px'}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,color:tab===id?C.primary:C.muted,fontWeight:tab===id?700:500}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════ */
/*           PROVIDER DASHBOARD            */
/* ════════════════════════════════════════ */
const ProviderDashboard = ({userName,onBack}) => {
  const [tab,setTab]=useState('dashboard');
  const [onDuty,setOnDuty]=useState(false);
  const [showAlert,setShowAlert]=useState(false);
  const [alertTimer,setAlertTimer]=useState(15);

  useEffect(()=>{
    if(!onDuty)return;
    const t=setTimeout(()=>setShowAlert(true),3000);
    return()=>clearTimeout(t);
  },[onDuty]);

  useEffect(()=>{
    if(!showAlert)return;
    setAlertTimer(15);
    const t=setInterval(()=>setAlertTimer(p=>{if(p<=1){setShowAlert(false);return 0;}return p-1;}),1000);
    return()=>clearInterval(t);
  },[showAlert]);

  const todayEarnings=245;
  const weekEarnings=1120;

  return (
    <div style={{minHeight:'100dvh',background:C.bg,paddingBottom:80}}>
      {/* Header */}
      <div style={{padding:'16px 20px',...flex('row','center','space-between')}}>
        <div style={flex('row','center','flex-start',10)}>
          <div style={{width:32,height:32,borderRadius:8,background:C.green,...flex('row','center','center'),fontWeight:900,fontSize:9,color:C.white}}>OC</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>{userName || 'Provider'} 🛠️</div>
            <div style={{fontSize:11,color:onDuty?C.green:C.muted}}>{onDuty?'● Available':'○ Offline'}</div>
          </div>
        </div>
        <button onClick={()=>{setOnDuty(!onDuty);if(onDuty)setShowAlert(false);}} style={{...flex('row','center','center',8),background:onDuty?`${C.green}08`:C.card2,border:`1px solid ${onDuty?C.green:C.border}`,borderRadius:20,padding:'8px 16px',cursor:'pointer'}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:onDuty?C.green:C.grayLight}}/>
          <span style={{fontSize:12,fontWeight:700,color:onDuty?C.green:C.gray}}>{onDuty?'AVAILABLE':'OFFLINE'}</span>
        </button>
      </div>

      {/* Job Alert */}
      {showAlert&&(
        <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',...flex('column','center','center'),padding:20}}>
          <div style={{...cardStyle,width:'100%',maxWidth:380,border:`2px solid ${C.primary}`,position:'relative',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{position:'absolute',top:12,right:12}}>
              <div style={{width:44,height:44,borderRadius:'50%',border:`3px solid ${alertTimer<=5?C.red:C.green}`,...flex('row','center','center')}}>
                <span style={{fontSize:18,fontWeight:900,color:alertTimer<=5?C.red:C.green}}>{alertTimer}</span>
              </div>
            </div>
            <div style={{fontSize:12,color:C.primary,fontWeight:700,letterSpacing:2,marginBottom:8}}>📲 NEW JOB REQUEST</div>
            <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Deep Cleaning</div>
            <div style={{fontSize:13,color:C.gray,marginBottom:16}}>Karen L. · 3BR Home</div>
            <div style={{...flex('row','center','flex-start',8),marginBottom:8}}>
              <span style={{color:C.primary}}>📍</span>
              <span style={{fontSize:13,color:C.gray}}>456 Maple Ave · 1.8 mi away</span>
            </div>
            <div style={{...flex('row','center','flex-start',8),marginBottom:16}}>
              <span style={{color:C.green}}>💰</span>
              <span style={{fontSize:20,fontWeight:900,color:C.green}}>$85.00</span>
            </div>
            <div style={flex('row','center','center',12)}>
              <button onClick={()=>setShowAlert(false)} style={{...btn(C.card2,C.gray,{flex:1,border:`1px solid ${C.border}`})}}>Decline</button>
              <button onClick={()=>{setShowAlert(false);setTab('jobs');}} style={{...btn(`linear-gradient(135deg, ${C.primary}, ${C.teal})`,C.white,{flex:2})}}>Accept Job</button>
            </div>
          </div>
        </div>
      )}

      {tab==='dashboard'&&(
        <div className="anim-tab" style={{padding:20}}>
          <div style={{...cardStyle,marginBottom:16}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,textAlign:'center'}}>
              <div>
                <div style={{fontSize:11,color:C.muted}}>Today</div>
                <div style={{fontSize:24,fontWeight:900,color:C.green}}>${todayEarnings}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:C.muted}}>This Week</div>
                <div style={{fontSize:24,fontWeight:900,color:C.text}}>${weekEarnings}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:C.muted}}>Rating</div>
                <div style={{fontSize:24,fontWeight:900,color:C.yellow}}>⭐ 4.9</div>
              </div>
            </div>
          </div>

          <div style={{...cardStyle,...flex('row','center','space-between'),marginBottom:16,border:`1px solid ${onDuty?`${C.green}40`:C.border}`}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>Availability</div>
              <div style={{fontSize:12,color:onDuty?C.green:C.muted}}>{onDuty?'Receiving job requests':'Go online to receive jobs'}</div>
            </div>
            <button onClick={()=>{setOnDuty(!onDuty);if(onDuty)setShowAlert(false);}} style={{width:56,height:32,borderRadius:16,background:onDuty?C.green:C.grayLighter,border:'none',cursor:'pointer',position:'relative',transition:'all .3s'}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:C.white,position:'absolute',top:3,left:onDuty?27:3,transition:'left .3s',boxShadow:'0 2px 4px rgba(0,0,0,0.15)'}}/>
            </button>
          </div>

          <div style={{height:200,background:C.card,borderRadius:20,marginBottom:16,position:'relative',overflow:'hidden',...flex('column','center','center'),border:`1px solid ${C.border}`}}>
            <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.grayLighter} 1px,transparent 1px),linear-gradient(90deg,${C.grayLighter} 1px,transparent 1px)`,backgroundSize:'40px 40px',opacity:0.5}}/>
            <div style={{position:'relative',width:14,height:14,borderRadius:'50%',background:onDuty?C.green:C.grayLight,boxShadow:onDuty?`0 0 20px ${C.green}80`:'none'}}/>
            <div style={{position:'absolute',bottom:12,left:12,background:'rgba(255,255,255,0.9)',borderRadius:10,padding:'6px 10px',fontSize:11,color:C.gray,border:`1px solid ${C.border}`}}>{onDuty?'🟢 Live':'⚫ Offline'}</div>
          </div>

          <div style={cardStyle}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Incoming Jobs</div>
            {!onDuty ? (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:28,marginBottom:8}}>💤</div>
                <div style={{fontSize:13,color:C.muted}}>Go online to receive jobs</div>
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:28,marginBottom:8}}>📡</div>
                <div style={{fontSize:13,color:C.green}}>Listening for requests...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='jobs'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Recent Jobs</h2>
          {MISSIONS_HISTORY.map((m,i)=>(
            <div key={i} style={{...cardStyle,...flex('row','center','space-between'),marginBottom:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>{m.service}</div>
                <div style={{fontSize:12,color:C.muted}}>{m.customer} · {m.time}</div>
                <div style={{fontSize:11,color:C.yellow}}>{'⭐'.repeat(m.rating)}</div>
              </div>
              <div style={{fontSize:20,fontWeight:800,color:C.green}}>+${m.earned}</div>
            </div>
          ))}
        </div>
      )}

      {tab==='earnings'&&(
        <div className="anim-tab" style={{padding:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:16}}>Earnings</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
            <div style={{...cardStyle,textAlign:'center'}}>
              <div style={{fontSize:11,color:C.muted}}>Today</div>
              <div style={{fontSize:32,fontWeight:900,color:C.green}}>${todayEarnings}</div>
            </div>
            <div style={{...cardStyle,textAlign:'center'}}>
              <div style={{fontSize:11,color:C.muted}}>This Week</div>
              <div style={{fontSize:32,fontWeight:900,color:C.text}}>${weekEarnings}</div>
            </div>
          </div>
          <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:12}}>Payout Breakdown</h3>
          <div style={cardStyle}>
            {[['Base earnings','$960.00'],['Tips','$125.00'],['Bonuses','$55.00'],['Platform fee','-$96.00']].map(([label,val])=>(
              <div key={label} style={{...flex('row','center','space-between'),padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:14,color:C.gray}}>{label}</span>
                <span style={{fontSize:14,fontWeight:700,color:val.startsWith('-')?C.red:C.text}}>{val}</span>
              </div>
            ))}
            <div style={{...flex('row','center','space-between'),padding:'12px 0 0'}}>
              <span style={{fontSize:16,fontWeight:800,color:C.text}}>Net Payout</span>
              <span style={{fontSize:20,fontWeight:900,color:C.green}}>$1,044.00</span>
            </div>
          </div>
        </div>
      )}

      {tab==='profile'&&(
        <div className="anim-tab" style={{padding:20,...flex('column','center','center'),minHeight:'60vh'}}>
          <div style={{width:80,height:80,borderRadius:20,background:`${C.green}12`,...flex('row','center','center'),fontSize:36,marginBottom:16}}>🛠️</div>
          <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>{userName || 'Provider'}</div>
          <div style={{fontSize:13,color:C.green,marginBottom:24}}>⭐ 4.9 Rating · 312 Jobs</div>
          {['My Profile','Skills & Certifications','Documents','Payout Settings','Help & Support'].map(item=>(
            <div key={item} style={{...cardStyle,width:'100%',marginBottom:8,...flex('row','center','space-between'),padding:'16px 20px',cursor:'pointer'}}>
              <span style={{fontSize:14,color:C.text}}>{item}</span>
              <span style={{color:C.muted}}>→</span>
            </div>
          ))}
          <button onClick={onBack} style={{...btn('transparent',C.red,{border:'none',marginTop:16})}}>Sign Out</button>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,padding:'8px 0 env(safe-area-inset-bottom,8px)',...flex('row','center','space-around'),zIndex:40}}>
        {[['dashboard','📊','Dashboard'],['jobs','📋','Jobs'],['earnings','💰','Earnings'],['profile','👤','Profile']].map(([id,ic,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'none',border:'none',cursor:'pointer',...flex('column','center','center',2),padding:'6px 12px'}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,color:tab===id?C.green:C.muted,fontWeight:tab===id?700:500}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
