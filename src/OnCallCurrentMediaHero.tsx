import React from 'react'

const CURRENT_ON_CALL_MOTION = 'https://dzlmtvodpyhetvektfuo.supabase.co/storage/v1/object/public/brand-graphics/kollective/animations/ON_CALL_ANI_.mp4'

export default function OnCallCurrentMediaHero() {
  return (
    <section className="oc-current-media" aria-label="ON CALL service network">
      <video className="oc-current-media__video" src={CURRENT_ON_CALL_MOTION} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
      <div className="oc-current-media__shade" />
      <div className="oc-current-media__copy">
        <span>ON CALL · CURRENT SERVICE NETWORK</span>
        <strong>Trusted help, without the runaround.</strong>
        <p>Book real local service, track the job, and pay only through the verified ON CALL flow.</p>
      </div>
      <div className="oc-current-media__signal"><i/><span>LIVE</span></div>
    </section>
  )
}
