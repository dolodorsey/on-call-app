import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type Category = { id:string; name:string; description:string|null; sort_order:number|null }
type Service = { id:string; category_id:string; name:string; description:string|null; base_price:number|null; sort_order:number|null }

const buttonText = (element:Element) => String(element.textContent || '').replace(/\s+/g,' ').trim().toLowerCase()

export default function OnCallSubcategoryRestoreHost(){
  const [categories,setCategories]=useState<Category[]>([])
  const [services,setServices]=useState<Service[]>([])
  const [open,setOpen]=useState(false)
  const [active,setActive]=useState<string>('all')
  const [mounted,setMounted]=useState(false)

  useEffect(()=>{
    let alive=true
    Promise.all([
      supabase.from('oc_service_categories').select('id,name,description,sort_order').eq('is_active',true).order('sort_order'),
      supabase.from('oc_service_catalog').select('id,category_id,name,description,base_price,sort_order').eq('is_active',true).order('category_id').order('sort_order'),
    ]).then(([categoryResult,serviceResult])=>{
      if(!alive)return
      if(!categoryResult.error)setCategories((categoryResult.data||[]) as Category[])
      if(!serviceResult.error)setServices((serviceResult.data||[]) as Service[])
    })
    const sync=()=>setMounted(Boolean(document.querySelector('.oc2-app')))
    sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true})
    return()=>{alive=false;observer.disconnect()}
  },[])

  const visibleServices=useMemo(()=>active==='all'?services:services.filter(service=>service.category_id===active),[active,services])

  const openService=(service:Service)=>{
    const categoryName=categories.find(category=>category.id===service.category_id)?.name||''
    setOpen(false)
    const nav=[...document.querySelectorAll<HTMLButtonElement>('.oc2-nav button')].find(button=>buttonText(button).includes('services'))
    nav?.click()
    window.setTimeout(()=>{
      const filters=[...document.querySelectorAll<HTMLButtonElement>('.oc2-filter-rail button')]
      const filter=filters.find(button=>buttonText(button)===categoryName.toLowerCase())
      filter?.click()
      window.setTimeout(()=>{
        const cards=[...document.querySelectorAll<HTMLButtonElement>('.oc2-service-list > button')]
        const card=cards.find(button=>String(button.querySelector('strong')?.textContent||'').trim()===service.name)
        card?.scrollIntoView({behavior:'smooth',block:'center'})
        card?.click()
      },120)
    },120)
  }

  if(!mounted||!services.length)return null

  return <>
    <style>{`
      .oc-subcat-launch{position:fixed;right:14px;bottom:91px;z-index:88;border:1px solid rgba(111,220,255,.32);border-radius:999px;background:rgba(7,16,29,.94);color:#f7fbff;padding:9px 12px;font:800 8px 'DM Sans',sans-serif;letter-spacing:.08em;box-shadow:0 12px 35px rgba(0,0,0,.35);backdrop-filter:blur(18px)}
      .oc-subcat-launch b{color:#6fdcff;margin-left:5px}.oc-subcat-backdrop{position:fixed;inset:0;z-index:220;background:rgba(2,7,14,.82);backdrop-filter:blur(18px);display:flex;align-items:flex-end;justify-content:center}
      .oc-subcat-sheet{width:min(100%,460px);max-height:86dvh;overflow:auto;border-radius:28px 28px 0 0;padding:10px 16px calc(24px + env(safe-area-inset-bottom));background:linear-gradient(155deg,#12243b,#07101d 72%);border-top:1px solid rgba(111,220,255,.2);color:#fff;box-shadow:0 -30px 80px rgba(0,0,0,.5)}
      .oc-subcat-handle{width:42px;height:4px;border-radius:99px;background:rgba(255,255,255,.24);margin:0 auto 18px}.oc-subcat-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}.oc-subcat-head span{font-size:8px;letter-spacing:.16em;color:#6fdcff;font-weight:900}.oc-subcat-head h2{font:800 31px/1 'Sora',sans-serif;letter-spacing:-.045em;margin:6px 0}.oc-subcat-head p{margin:0;color:#8ea1b7;font-size:9px;line-height:1.5}.oc-subcat-close{width:38px;height:38px;border:1px solid rgba(128,182,235,.14);border-radius:13px;background:rgba(255,255,255,.04);color:#fff;font-size:20px}
      .oc-subcat-filters{display:flex;gap:7px;overflow:auto;padding:17px 0 12px;scrollbar-width:none}.oc-subcat-filters button{white-space:nowrap;border:1px solid rgba(128,182,235,.14);border-radius:999px;background:#0c1929;color:#8ea1b7;padding:8px 11px;font-size:8px}.oc-subcat-filters button.active{background:#2585e8;color:#fff;border-color:#2585e8;font-weight:900}
      .oc-subcat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.oc-subcat-card{min-height:104px;border:1px solid rgba(128,182,235,.14);border-radius:17px;background:linear-gradient(155deg,#11243b,#091522);color:#fff;padding:12px;text-align:left;display:flex;flex-direction:column;gap:5px}.oc-subcat-card small{font-size:7px;color:#6fdcff;letter-spacing:.08em}.oc-subcat-card strong{font-size:10px}.oc-subcat-card p{font-size:7px;line-height:1.4;color:#8ea1b7;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.oc-subcat-card em{margin-top:auto;font-style:normal;color:#6fdcff;font:800 13px 'Sora',sans-serif}
      @media(max-width:370px){.oc-subcat-grid{grid-template-columns:1fr}}
    `}</style>
    <button type="button" className="oc-subcat-launch" onClick={()=>setOpen(true)}>SUBCATEGORIES <b>{services.length}</b></button>
    {open&&<div className="oc-subcat-backdrop" onMouseDown={()=>setOpen(false)}><section className="oc-subcat-sheet" onMouseDown={event=>event.stopPropagation()} aria-modal="true" role="dialog"><div className="oc-subcat-handle"/><div className="oc-subcat-head"><div><span>ON CALL SERVICE DIRECTORY</span><h2>Choose a subcategory.</h2><p>{categories.length} categories · {services.length} live service subcategories. Tap one to open its booking flow.</p></div><button className="oc-subcat-close" onClick={()=>setOpen(false)}>×</button></div><div className="oc-subcat-filters"><button className={active==='all'?'active':''} onClick={()=>setActive('all')}>All</button>{categories.map(category=><button key={category.id} className={active===category.id?'active':''} onClick={()=>setActive(category.id)}>{category.name}</button>)}</div><div className="oc-subcat-grid">{visibleServices.map(service=><button className="oc-subcat-card" key={service.id} onClick={()=>openService(service)}><small>{categories.find(category=>category.id===service.category_id)?.name||'ON CALL'}</small><strong>{service.name}</strong><p>{service.description||'Book verified help through ON CALL.'}</p><em>{Number(service.base_price||0)>0?`$${Number(service.base_price).toFixed(0)}+`:'QUOTE'}</em></button>)}</div></section></div>}
  </>
}
