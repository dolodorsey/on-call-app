export default function LegalLinksHost(){
  const path=window.location.pathname.replace(/\/$/,'')||'/'
  if(path==='/ops'||path==='/privacy'||path==='/terms')return null
  return <nav aria-label="ON CALL legal and support" style={{position:'fixed',left:'50%',bottom:8,transform:'translateX(-50%)',zIndex:1020,display:'flex',gap:10,alignItems:'center',padding:'6px 9px',borderRadius:999,background:'rgba(4,12,22,.76)',backdropFilter:'blur(14px)',border:'1px solid rgba(255,255,255,.08)',fontSize:9,fontWeight:800,letterSpacing:'.05em',whiteSpace:'nowrap'}}><a href="/privacy" style={{color:'rgba(255,255,255,.65)',textDecoration:'none'}}>PRIVACY</a><span style={{color:'rgba(255,255,255,.18)'}}>•</span><a href="/terms" style={{color:'rgba(255,255,255,.65)',textDecoration:'none'}}>TERMS</a><span style={{color:'rgba(255,255,255,.18)'}}>•</span><a href="mailto:thedoctordorsey@gmail.com" style={{color:'rgba(255,255,255,.65)',textDecoration:'none'}}>SUPPORT</a></nav>
}
