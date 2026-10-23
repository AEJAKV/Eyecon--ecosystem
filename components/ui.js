'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { clinic,DEMO,GIFT_CARD_DAYS,formatDate,shopUrl } from '@/lib/config';
import { giftCode,HIDDEN_SERIAL } from '@/lib/gift';
import { searchEntries,searchSite } from '@/lib/search';
export function Icon({name='eye',size=24}){const paths={eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,eyeOff:<><path d="m3 3 18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.1"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,circle:<><circle cx="12" cy="12" r="8"/><path d="m5 18 13-13"/></>,drop:<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>,people:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/></>,scan:<><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M6 12h12"/><circle cx="12" cy="12" r="3"/></>,glasses:<><circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 14h4M2 14l2-7m18 7-2-7"/></>,phone:<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 2-3 3-5 2A22 22 0 0 1 3 8c-1-2 0-5 2-5Z"/>,gift:<><path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12"/><path d="M12 9C4 9 5 1 9 4l3 5c8 0 7-8 3-5l-3 5Z"/></>,check:<path d="m5 12 4 4L20 5"/>,menu:<path d="M3 6h18M3 12h18M3 18h18"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></>,skin:<><path d="M11 3C7 3 4.5 6 4.5 10.5c0 4.8 2.9 8.8 6.5 10.5 3.6-1.7 6.5-5.7 6.5-10.5"/><path d="M8.5 15c1.4 1 3.6 1 5 0"/><path d="M18.5 2.5v4m-2-2h4"/></>,bag:<><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/></>,pin:<><path d="M12 21.5s-7-6.3-7-11.7a7 7 0 0 1 14 0c0 5.4-7 11.7-7 11.7Z"/><circle cx="12" cy="9.8" r="2.4"/></>,heart:<path d="M12 20.5S3.5 15.4 3.5 9.3A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 8.5 2.1c0 6.1-8.5 11.2-8.5 11.2Z"/>};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.eye}</svg>;}
// The wordmark with Eyecon's mark: a thin gold outlined rectangle, 3:2, to the right of EYECON. It is drawn inline so it
// stays sharp at any size, sits on the baseline at the height of the capitals, and is decorative (the link is labelled).
export function Logo(){return <Link href="/" className="logo" aria-label="Eyecon Optometry home"><span>EYECON<svg className="logo-mark" viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect x="1" y="1" width="28" height="18" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span><small>Optometry</small></Link>;}
export function Button({children,href,secondary=false,className='',...props}){const classes=`button ${secondary?'secondary':''} ${className}`;return href?<Link className={classes} href={href} {...props}>{children}</Link>:<button className={classes} {...props}>{children}</button>;}
// Phones (640px and narrower) get a cleaner bar, like a fashion house: a menu button on the left, the logo with its mark
// centred, and search and a shopping bag (to Shop Frames) on the right. Tablets and desktops show Search, Shop Frames, the
// phone and Book in a row on the right; Search opens the same panel everywhere. Book, Shop Frames, the phone number and the
// location move into the menu drawer, which sits outside the header so the white overlay header never tints it. Wider screens keep the row of actions on the right. shopHref carries an
// affiliate's referral into both.
function MobileMenu({open,onClose,bookingHref,bookingLabel,shopHref}){
  const ref=useRef(null);
  useEffect(()=>{const d=ref.current;if(!d)return;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close();},[open]);
  // If the screen grows past phone width (a rotated tablet), the drawer closes because the header shows the actions again.
  useEffect(()=>{if(!open)return;const mq=window.matchMedia('(min-width: 641px)');const on=()=>{if(mq.matches)onClose();};mq.addEventListener('change',on);return()=>mq.removeEventListener('change',on);},[open,onClose]);
  const mapHref=clinic.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(clinic.address.replace(' · ',', ')):null;
  return <dialog ref={ref} id="site-menu" className="menu-drawer" aria-label="Menu" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="menu-panel">
      <div className="menu-head"><button type="button" className="menu-close" onClick={onClose} aria-label="Close menu"><Icon name="close" size={24}/></button><span onClick={onClose}><Logo/></span><span className="menu-spacer" aria-hidden="true"/></div>
      <nav className="menu-nav" aria-label="Main">
        <Link href={bookingHref} onClick={onClose}><span>{bookingLabel}</span><Icon name="calendar" size={22}/></Link>
        <Link href={shopHref} onClick={onClose}><span>Shop Frames</span><Icon name="bag" size={22}/></Link>
      </nav>
      <div className="menu-contact">
        <p className="eyebrow">Visit and contact</p>
        {clinic.phone
          ?<a className="menu-contact-row" href={clinic.phoneHref} aria-label={'Call Eyecon at '+clinic.phone}><Icon name="phone" size={20}/><span><small>Call us</small>{clinic.phone}</span></a>
          :<span className="menu-contact-row pending"><Icon name="phone" size={20}/><span><small>Call us</small>Phone to be confirmed</span></span>}
        {mapHref
          ?<a className="menu-contact-row" href={mapHref} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={20}/><span><small>Visit us · Get directions</small>{clinic.address}<span className="sr-only"> (opens Google Maps in a new tab)</span></span></a>
          :<span className="menu-contact-row pending"><Icon name="pin" size={20}/><span><small>Visit us</small>Address to be confirmed</span></span>}
      </div>
    </div>
  </dialog>;}
// Site search, on every screen size: a panel that drops from the top with the field focused. It searches the houses, frames, services and a
// few pages (lib/search.js); before anything is typed it suggests the most visited places.
function SiteSearch({open,onClose,bookingHref,shopHref}){
  const ref=useRef(null),input=useRef(null),router=useRouter();
  const [query,setQuery]=useState('');
  const affiliate=(()=>{try{return new URL(shopHref,'https://eyecon.local').searchParams.get('affiliate');}catch{return null;}})();
  const options={bookingHref,shopHref,affiliate};
  useEffect(()=>{const d=ref.current;if(!d)return;if(open&&!d.open){setQuery('');d.showModal();requestAnimationFrame(()=>input.current?.focus());}if(!open&&d.open)d.close();},[open]);
  const results=searchSite(query,options);
  const entries=searchEntries(options),suggestions=['Book an appointment','Shop all frames','Cartier','Find my booking'].map(t=>entries.find(e=>e.title===t)).filter(Boolean);
  const list=query.trim()?results:suggestions;
  return <dialog ref={ref} id="site-search" className="search-panel" aria-label="Search" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="search-inner">
      <form className="search-bar" role="search" onSubmit={e=>{e.preventDefault();if(results[0]){onClose();router.push(results[0].href);}}}>
        <Icon name="search" size={20}/>
        <label htmlFor="site-search-input" className="sr-only">Search frames, houses and services</label>
        <input ref={input} id="site-search-input" type="search" enterKeyHint="search" autoComplete="off" placeholder="Search frames, houses, services" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onClose();}}}/>
        <button type="button" className="menu-close" onClick={onClose} aria-label="Close search"><Icon name="close" size={22}/></button>
      </form>
      <p className="eyebrow search-label" aria-live="polite">{query.trim()?(results.length?results.length+(results.length===1?' result':' results'):'No results'):'Popular'}</p>
      {query.trim()&&!results.length&&<p className="search-empty">Nothing matches “{query.trim()}”. Try a house such as Cartier, or a service such as eye exam.</p>}
      <ul className="search-results">{list.map(r=><li key={r.group+r.title+r.href}><Link href={r.href} onClick={onClose}><span><small>{r.group}</small><strong>{r.title}</strong>{r.sub&&<em>{r.sub}</em>}</span></Link></li>)}</ul>
    </div>
  </dialog>;}
export function Header({bookingHref='/booking',bookingLabel='Book appointment',bookingShort='Book',shopHref=shopUrl,overlay=false}){
  const [scrolled,setScrolled]=useState(false);
  const [menu,setMenu]=useState(false);
  const [find,setFind]=useState(false);
  useEffect(()=>{const on=()=>setScrolled(window.scrollY>(overlay?40:24));on();window.addEventListener('scroll',on,{passive:true});return()=>window.removeEventListener('scroll',on);},[overlay]);
  return <><header className={`site-header ${overlay?'overlay':''} ${scrolled?'scrolled':''}`}><div className="header-inner">
    <button type="button" className="menu-toggle" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menu} aria-controls="site-menu" onClick={()=>setMenu(true)}><Icon name="menu" size={24}/></button>
    <Logo/><div className="header-actions">
    <button type="button" className="call-link search-link" aria-label="Search" aria-haspopup="dialog" aria-expanded={find} aria-controls="site-search" onClick={()=>setFind(true)}><Icon name="search" size={18}/><span>Search</span></button>
    <Link className="call-link shop-link" href={shopHref} aria-label="Shop Frames"><Icon name="bag" size={18}/><span className="shop-long">Shop Frames</span><span className="shop-short" aria-hidden="true">Frames</span></Link>
    {clinic.phone
      ?<a className="call-link" href={clinic.phoneHref} aria-label={'Call Eyecon at '+clinic.phone}><Icon name="phone" size={18}/><span>{clinic.phone}</span></a>
      :<span className="call-link pending" title="The clinic phone number will be added before launch"><Icon name="phone" size={18}/><span>Clinic phone</span></span>}
    <Button href={bookingHref} aria-label={bookingLabel}><span className="label-long">{bookingLabel}</span><span className="label-short" aria-hidden="true">{bookingShort}</span></Button></div>
    <div className="header-icons">
      <button type="button" className="icon-link" aria-label="Search" aria-haspopup="dialog" aria-expanded={find} aria-controls="site-search" onClick={()=>setFind(true)}><Icon name="search" size={22}/></button>
      <Link className="icon-link" href={shopHref} aria-label="Shop Frames"><Icon name="bag" size={22}/></Link>
    </div></div></header>
    <MobileMenu open={menu} onClose={()=>setMenu(false)} bookingHref={bookingHref} bookingLabel={bookingLabel} shopHref={shopHref}/>
    <SiteSearch open={find} onClose={()=>setFind(false)} bookingHref={bookingHref} shopHref={shopHref}/></>;}
export function PreviewBar(){return DEMO?<div className="preview-bar">Design preview · Use fictional patient details.<Link href="/login">Explore workspaces</Link></div>:null;}
export function Referral({affiliate}){return affiliate?<div className="referral"><img src={affiliate.photo||'/images/affiliate.webp'} width="56" height="56" alt=""/><div><small>Introduced by</small><strong>{affiliate.name}</strong></div></div>:null;}
// The $50 gift pill. Before booking it shows the affiliate's card number with the serial hidden; once the booking has
// issued a card (pass it as card) it shows the full number and the date it is valid until.
export function Gift({compact=false,affiliate,card}){return <div className={`gift ${compact?'compact':''}`}><span className="gift-value" aria-hidden="true">$50</span><div><strong>Gift card on your first visit</strong><small><span>No. EYC-{giftCode(affiliate)}-<span className="gift-serial">{card?.serial||HIDDEN_SERIAL}</span></span> · <span>{card?'Valid until '+formatDate(card.expiresAt,{dateStyle:'medium',timeStyle:undefined}):`Valid ${GIFT_CARD_DAYS} days from booking`}</span> · <Link className="gift-terms" href="/gift-card-terms" target="_blank">Terms<span className="sr-only"> of the gift card (opens in a new tab)</span></Link></small></div></div>;}
export function Stars({value=5,size=16}){return <span className="stars" aria-hidden="true">{[0,1,2,3,4].map(i=>{const fill=Math.max(0,Math.min(1,value-i));return <svg key={i} width={size} height={size} viewBox="0 0 24 24"><defs><linearGradient id={'s'+i+'-'+Math.round(value*10)}><stop offset={fill} stopColor="currentColor"/><stop offset={fill} stopColor="currentColor" stopOpacity=".22"/></linearGradient></defs><path fill={`url(#s${i}-${Math.round(value*10)})`} d="M12 2.8l2.75 5.9 6.45.75-4.78 4.42 1.28 6.38L12 17.06l-5.7 3.19 1.28-6.38L2.8 9.45l6.45-.75z"/></svg>;})}</span>;}
export function Footer(){return <footer className="footer"><div className="footer-inner"><div className="footer-brand"><Logo/><p className="footer-about">Eyecon is the leading provider of optometry services and vision care products in Edmonton. Come visit us today!</p></div><div className="footer-col"><h2>Visit</h2>{clinic.address?<p>{clinic.address}</p>:<p className="pending-text">Address to be confirmed</p>}{clinic.hours?<p>{clinic.hours}</p>:<p className="pending-text">Hours to be confirmed</p>}</div><div className="footer-col"><h2>Contact</h2>{clinic.phone?<a href={clinic.phoneHref}>{clinic.phone}</a>:<p className="pending-text">Phone to be confirmed</p>}{clinic.email&&<a href={'mailto:'+clinic.email}>{clinic.email}</a>}</div><div className="footer-col"><h2>Eyecon</h2><Link href="/my-booking">Find my booking</Link><Link href="/privacy">Privacy</Link><Link href="/login">Affiliate and staff sign-in</Link></div></div><p className="footer-legal">© {new Date().getFullYear()} Eyecon Optometry</p></footer>;}
export function Field({label,id,error,hint,children,...props}){return <div className="field"><label htmlFor={id}>{label}</label>{children||<input id={id} aria-invalid={!!error} aria-describedby={hint?id+'-hint':undefined} {...props}/>} {hint&&<small id={id+'-hint'}>{hint}</small>}{error&&<small className="error-text">{error}</small>}</div>;}
export function Notice({children,error=false}){return children?<div role={error?'alert':'status'} className={`notice ${error?'error':''}`}>{children}</div>:null;}
export function Modal({open,title,onClose,children}){const ref=useRef(null);useEffect(()=>{const d=ref.current;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close();},[open]);return <dialog ref={ref} className="modal" onCancel={onClose} onClose={onClose} aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button onClick={onClose} className="icon-button" aria-label="Close dialog"><Icon name="close"/></button></div>{open&&children}</dialog>;}
export function Loading(){return <div className="loading" role="status"><span className="spinner"/>Loading your Eyecon experience…</div>;}
export function Portrait({src,alt,...props}){return <Image src={src} alt={alt} {...props}/>;}
// The empty state for a table or list.
export function Empty({text='No records match your filters.'}){return <div className="empty-state"><Icon name="calendar" size={32}/><h3>{text}</h3><p>Your next update will appear here.</p></div>;}
