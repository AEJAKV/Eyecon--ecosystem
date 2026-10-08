'use client';
import { useEffect, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { useApp } from './provider';
import { Header, Footer, Button, Icon, Gift, Referral, Loading, Notice, Stars } from './ui';
import { DEMO, services, collections, clinic } from '@/lib/config';

/* Hero photograph. Art direction: a 16:9 crop above 860px and a 9:16 crop on phones.
   Only the matching source is downloaded, so it is prioritised with fetchPriority rather than preload. */
function HeroPhoto({ alt = '', className = '' }) {
  const common = { alt, sizes: '100vw', fetchPriority: 'high' };
  const { props: { srcSet: desktop } } = getImageProps({ ...common, src: '/images/hero-desktop.webp', width: 1672, height: 941 });
  const { props: { srcSet: mobile, ...rest } } = getImageProps({ ...common, src: '/images/hero-mobile.webp', width: 941, height: 1672 });
  return (
    <picture className={`hero-photo ${className}`}>
      <source media="(min-width: 861px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} />
    </picture>
  );
}

// Centre of the glasses in each photograph, as a fraction of its width and height.
const FOCUS = { desktop: [0.73, 0.22], mobile: [0.63, 0.205] };
const PHOTO_SCALE = 1.04; // matches .hero-photo img in site.css

/* The photograph is soft-focused; a lens follows the pointer anywhere on the hero and brings it into focus,
   slightly magnified like an optician’s loupe. On touch it follows a tap or drag. At rest it sits over the glasses. */
function Hero({ children }) {
  const ref = useRef(null), home = useRef({ x: 70, y: 28 }), pinned = useRef(false);
  function place(x, y) {
    ref.current.style.setProperty('--x', x + '%');
    ref.current.style.setProperty('--y', y + '%');
  }
  useEffect(() => {
    const el = ref.current, img = el.querySelector('.hero-photo img'), text = el.querySelector('.hero-text');
    function rest() {
      const box = el.getBoundingClientRect();
      if (!box.width || !img.naturalWidth) return;
      // Where the glasses land on screen, given object-fit: cover and the image’s object-position.
      const [fx, fy] = FOCUS[img.currentSrc.includes('hero-desktop') ? 'desktop' : 'mobile'];
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(parseFloat);
      const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      let x = box.width / 2 + ((box.width - w) * px / 100 + fx * w - box.width / 2) * PHOTO_SCALE;
      let y = box.height / 2 + ((box.height - h) * py / 100 + fy * h - box.height / 2) * PHOTO_SCALE;
      // Rest in the upper half and below the header where there is room, then lift until the circle is clear of the copy.
      const r = parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 150;
      const header = document.querySelector('.site-header .header-inner')?.getBoundingClientRect().height || 0;
      const touches = (cx, cy, rect, gap) => Math.hypot(cx - Math.max(rect.left - box.left, Math.min(cx, rect.right - box.left)), cy - Math.max(rect.top - box.top, Math.min(cy, rect.bottom - box.top))) < r + gap;
      const copy = [...text.children].map(child => child.getBoundingClientRect());
      x = Math.max(r * 0.8, Math.min(x, box.width - r * 0.8));
      y = Math.min(Math.max(y, header + r + 8), box.height / 2);
      while (y > r * 0.8 && copy.some(rect => touches(x, y, rect, 12))) y -= 2;
      // Make way for the hint if a small move down, or else sideways, is enough to clear it.
      const hint = el.querySelector('.lens-hint').getBoundingClientRect(), below = hint.bottom - box.top + r + 8, aside = hint.left - box.left - r - 8;
      const free = (cx, cy) => !copy.some(rect => touches(cx, cy, rect, 12));
      if (touches(x, y, hint, 0)) {
        if (below - y < r * 0.45 && below <= box.height / 2 && free(x, below)) y = below;
        else if (x - aside < r * 0.3 && free(aside, y)) x = aside;
      }
      home.current = { x: x / box.width * 100, y: y / box.height * 100 };
      if (!pinned.current && !el.classList.contains('tracking')) place(home.current.x, home.current.y);
    }
    rest();
    img.addEventListener('load', rest);
    document.fonts?.ready.then(rest);
    const settled = setTimeout(rest, 1600); // once the copy has finished its entrance
    const observer = new ResizeObserver(rest);
    observer.observe(el);
    return () => { img.removeEventListener('load', rest); clearTimeout(settled); observer.disconnect(); };
  }, []);
  function move(e) {
    const el = ref.current, box = el.getBoundingClientRect();
    place((e.clientX - box.left) / box.width * 100, (e.clientY - box.top) / box.height * 100);
    el.classList.add('tracking', 'used');
    if (e.pointerType === 'touch') pinned.current = true;
  }
  function leave(e) {
    ref.current.classList.remove('tracking');
    if (e.pointerType !== 'touch') { pinned.current = false; place(home.current.x, home.current.y); } // a tapped lens stays where it was put
  }
  return (
    <section className="hero" ref={ref} onPointerDown={move} onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave} style={{ '--x': home.current.x + '%', '--y': home.current.y + '%' }}>
      <HeroPhoto className="soft" alt="A woman wearing tortoiseshell optical frames" />
      <div className="hero-lens" aria-hidden="true"><div className="hero-lens-zoom"><HeroPhoto /></div></div>
      <span className="lens-ring" aria-hidden="true" />
      <p className="lens-hint" aria-hidden="true">Move to bring into focus</p>
      {children}
      <span className="scroll-cue" aria-hidden="true" />
    </section>
  );
}

/* A brand photograph, or a quiet placeholder with the brand name while the file is missing. */
function BrandImage({ brand }) {
  const [missing, setMissing] = useState(false), ref = useRef(null);
  // An image that failed before the page became interactive never fires onError, so check once on mount.
  useEffect(() => { const img = ref.current; if (img?.complete && !img.naturalWidth) setMissing(true); }, []);
  if (missing) return <span className="brand-placeholder"><strong>{brand.name}</strong>{' '}<small>Photograph to follow</small></span>;
  return <Image ref={ref} src={'/images/brands/' + brand.slug + '.webp'} alt={brand.name + ' eyewear'} fill sizes="(max-width: 860px) 78vw, 24vw" onError={() => setMissing(true)} />;
}

/* Brand carousel. The track is a native scroll-snap list, so swiping and trackpads work without script;
   arrows, the keyboard and clicking a card move it one brand at a time. No autoplay. */
function Collections({ href }) {
  const [active, setActive] = useState(0);
  const track = useRef(null), moving = useRef(0);
  const last = collections.length - 1, brand = collections[active];
  const step = () => track.current.children[1].offsetLeft - track.current.children[0].offsetLeft;
  function go(index) {
    const next = Math.max(0, Math.min(last, index));
    setActive(next);
    // Ignore the scroll positions passed on the way there, so the story does not flicker through every brand.
    clearTimeout(moving.current);
    moving.current = setTimeout(() => { moving.current = 0; }, 1200);
    track.current.scrollTo({ left: next * step(), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function settle() { clearTimeout(moving.current); moving.current = 0; }
  function follow() {
    if (moving.current) return;
    const index = Math.max(0, Math.min(last, Math.round(track.current.scrollLeft / step())));
    if (index !== active) setActive(index);
  }
  function keys(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(active + (e.key === 'ArrowRight' ? 1 : -1));
  }
  return (
    <section className="collections" aria-labelledby="collections-title" onKeyDown={keys}>
      <div className="collections-inner">
        <div className="collections-story">
          <h2 id="collections-title" className="collections-title">Our collections</h2>
          <p className="carousel-count" aria-live="polite" aria-atomic="true"><span className="sr-only">{brand.name}, </span>{active + 1} of {collections.length}</p>
          <div className="brand-stories">
            {collections.map((b, i) => <div key={b.slug} className={`brand-story ${i === active ? 'active' : ''}`} aria-hidden={i !== active}>
              <h3>{b.name}</h3>
              <p>{b.line}</p>
            </div>)}
          </div>
          <Button href={href + '&brand=' + encodeURIComponent(brand.name)}>Book a styling visit</Button>
          <div className="carousel-controls">
            <button type="button" className="carousel-arrow" aria-label="Previous brand" disabled={active === 0} onClick={() => go(active - 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg></button>
            <button type="button" className="carousel-arrow" aria-label="Next brand" disabled={active === last} onClick={() => go(active + 1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
            <span className="carousel-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / collections.length})` }} /></span>
          </div>
        </div>
        <ul className="brand-track" ref={track} tabIndex={0} aria-label="Brands. Use the left and right arrow keys to move." onScroll={follow} onScrollEnd={settle}>
          {collections.map((b, i) => <li key={b.slug}>
            <button type="button" className="brand-card" aria-current={i === active ? 'true' : undefined} onClick={() => go(i)}>
              <span className="brand-media"><BrandImage brand={b} /></span>
            </button>
          </li>)}
          <li className="brand-track-end" aria-hidden="true" />
        </ul>
      </div>
    </section>
  );
}

export default function Landing({ slug }) {
  const { data, ready } = useApp();
  const [affiliate, setAffiliate] = useState(null);
  const [loaded, setLoaded] = useState(!slug);
  const [error, setError] = useState('');
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (DEMO) {
      if (!ready) return;
      const a = data.affiliates.find(a => a.slug === slug && a.active);
      setAffiliate(a || null); setLoaded(true); setError(a ? '' : 'This referral page is no longer available.');
    } else {
      fetch('/api/availability?affiliate=' + encodeURIComponent(slug))
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setAffiliate(d.affiliate); })
        .catch(e => setError(e.message)).finally(() => setLoaded(true));
    }
  }, [slug, data.affiliates, ready]);

  // Mobile booking bar: appears once the hero button scrolls away, hides at the closing call to action.
  useEffect(() => {
    if (!loaded || error) return;
    const hero = document.querySelector('.hero-actions .button'), final = document.querySelector('.final-cta .button');
    if (!hero || !final) return;
    let heroPast = false, finalVisible = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === hero) heroPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        if (entry.target === final) finalVisible = entry.isIntersecting;
      }
      setFloating(heroPast && !finalVisible);
    });
    observer.observe(hero); observer.observe(final);
    return () => observer.disconnect();
  }, [loaded, error]);

  const booking = affiliate ? '/booking?affiliate=' + encodeURIComponent(affiliate.slug) : '/booking';
  const serviceHref = id => booking + (affiliate ? '&' : '?') + 'service=' + id;

  if (!loaded) return <Loading />;
  if (error) return <><Header /><main className="container empty-page" id="main-content"><h1>Your introduction to Eyecon</h1><Notice error>{error}</Notice><Button href="/booking">Book directly</Button></main><Footer /></>;

  return <>
    <Header bookingHref={booking} overlay />
    <main id="main-content">
      <Hero>
        <div className="hero-copy">
          <div className="hero-text">
            {affiliate && <Referral affiliate={affiliate} />}
            <h1>Clear sight, exquisitely framed.</h1>
            <p className="hero-description">A thorough eye exam and a private look at the world’s finest eyewear, in one unhurried visit.</p>
            {affiliate && <Gift />}
            <div className="hero-actions">
              <Button href={booking}>Book your appointment</Button>
              <a className="button outline" href="#appointments">See appointment types</a>
            </div>
            {clinic.rating
              ? <a className="hero-rating" href={clinic.reviews || '#reviews'} target={clinic.reviews ? '_blank' : undefined} rel="noopener noreferrer"><Stars value={clinic.rating} /><span><strong>{clinic.rating.toFixed(1)}</strong> on Google{clinic.reviewCount ? ` from ${clinic.reviewCount} reviews` : ''}</span></a>
              : <p className="hero-rating">Book online in under a minute.</p>}
          </div>
        </div>
      </Hero>

      <Collections href={serviceHref('styling')} />

      <section className="section container" id="appointments" aria-labelledby="appointments-title">
        <div className="section-intro">
          <h2 id="appointments-title">Choose your appointment</h2>
          <p>Every visit is with a licensed optometrist. Pick the care you need to see available times.</p>
        </div>
        <ol className="service-list">
          {services.map(s => <li key={s.id}><Link className="service-row" href={serviceHref(s.id)}>
            <Icon name={s.icon} size={26} />
            <span className="service-text"><strong>{s.name}</strong><small>{s.description}</small></span>
            <span className="service-cta">Book</span>
          </Link></li>)}
          <li><div className="service-row emergency">
            <Icon name="phone" size={26} />
            <span className="service-text"><strong>Urgent eye concerns</strong><small>Call the clinic so the team can guide your next step.</small></span>
            {clinic.phone ? <a className="service-cta" href={'tel:' + clinic.phone}>Call</a> : <span className="service-cta pending-text">Phone to be confirmed</span>}
          </div></li>
        </ol>
      </section>

      <section className="care-section" aria-labelledby="care-title">
        <div className="container care-layout">
          <div>
            <h2 id="care-title">Meet our optometrists</h2>
            <p>Your appointment is a conversation as well as an examination. There is time for your questions, your comfort and your style.</p>
            <Button href={booking} secondary>Arrange your visit</Button>
          </div>
          <div className="doctor-grid">
            {['doctor1', 'doctor2'].map((d, i) => <article className="doctor" key={d}>
              <div className="doctor-photo"><Image src={'/images/' + d + '.webp'} width={300} height={360} alt={'Concept portrait for doctor profile ' + (i + 1)} sizes="(max-width: 860px) 45vw, 22vw" /></div>
              <h3>Doctor name</h3>
              <p>Credentials and a short introduction will be supplied by the clinic.</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="section container trust" id="reviews" aria-label="Reviews and insurance">
        <div className="rating-card">
          <h2>What patients say</h2>
          {clinic.rating
            ? <><p className="rating-figure">{clinic.rating.toFixed(1)}</p><Stars value={clinic.rating} size={22} /><p className="muted">{clinic.reviewCount ? `${clinic.reviewCount} reviews on Google` : 'Rated on Google'}</p></>
            : <><p className="rating-pending">Google rating</p><Stars value={0} size={22} /><p className="muted">The clinic’s verified Google rating and recent reviews will appear here once review access is connected.</p></>}
          {clinic.reviews && <a className="text-link" href={clinic.reviews} target="_blank" rel="noopener noreferrer">Read all reviews on Google</a>}
        </div>
        <div className="insurance">
          <h2 id="insurance">Insurance</h2>
          <p>Add your insurer when you book, or bring your card to the visit. The team will confirm your coverage.</p>
          {clinic.insurers.length
            ? <ul className="insurer-list">{clinic.insurers.map(i => <li key={i}>{i}</li>)}</ul>
            : <p className="pending-text">The list of insurers the clinic works with will be added before launch.</p>}
          <details>
            <summary>What should I bring?</summary>
            <p>Your current glasses or contact lenses, photo ID and insurance card. Any clinic-specific steps arrive with your confirmation.</p>
          </details>
        </div>
      </section>

      <section className="final-cta">
        <div className="container">
          <h2>Reserve your time with us.</h2>
          {affiliate && <p>Your $50 gift card is waiting, courtesy of {affiliate.name}.</p>}
          <Button href={booking}>Book your appointment</Button>
        </div>
      </section>
    </main>
    <Footer />
    <div className={`mobile-book ${floating ? 'visible' : ''}`} aria-hidden={!floating}>
      <Button href={booking} tabIndex={floating ? 0 : -1}>Book appointment</Button>
    </div>
  </>;
}
