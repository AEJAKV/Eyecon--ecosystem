'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useApp } from './provider';
import { Header, Footer, Button, Icon, Gift, Referral, Loading, Notice, Stars } from './ui';
import { DEMO, services, brands, clinic } from '@/lib/config';

/* The hero image is soft-focused; a lens follows the pointer and brings it into focus.
   On touch it follows the finger; with no pointer it rests over the frames. */
function LensPhoto() {
  const ref = useRef(null);
  const home = { x: 50, y: 40 };
  function move(e) {
    const el = ref.current, box = el.getBoundingClientRect();
    el.style.setProperty('--x', ((e.clientX - box.left) / box.width) * 100 + '%');
    el.style.setProperty('--y', ((e.clientY - box.top) / box.height) * 100 + '%');
    el.classList.add('tracking');
  }
  function leave() {
    const el = ref.current;
    el.classList.remove('tracking');
    el.style.setProperty('--x', home.x + '%');
    el.style.setProperty('--y', home.y + '%');
  }
  return (
    <div className="hero-photo" ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ '--x': home.x + '%', '--y': home.y + '%' }}>
      <Image className="soft" src="/images/hero.webp" alt="" fill priority sizes="(max-width: 860px) 100vw, 55vw" />
      <div className="lens" aria-hidden="true">
        <Image src="/images/hero.webp" alt="A woman wearing refined optical frames" fill priority sizes="(max-width: 860px) 100vw, 55vw" />
      </div>
      <span className="lens-ring" aria-hidden="true" />
      <p className="lens-hint" aria-hidden="true">Move to bring into focus</p>
    </div>
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
    <Header bookingHref={booking} />
    <main id="main-content">
      <section className="hero">
        <div className="hero-copy">
          {affiliate && <Referral affiliate={affiliate} />}
          <h1>Clear sight, exquisitely framed.</h1>
          <p className="hero-description">A thorough eye exam and a private look at the world’s finest eyewear, in one unhurried visit.</p>
          {affiliate && <Gift />}
          <div className="hero-actions">
            <Button href={booking}>Book your appointment</Button>
            <a className="text-link" href="#appointments">See appointment types</a>
          </div>
          {clinic.rating
            ? <a className="hero-rating" href={clinic.reviews || '#reviews'} target={clinic.reviews ? '_blank' : undefined} rel="noopener noreferrer"><Stars value={clinic.rating} /><span><strong>{clinic.rating.toFixed(1)}</strong> on Google{clinic.reviewCount ? ` from ${clinic.reviewCount} reviews` : ''}</span></a>
            : <p className="quiet">Book online in under a minute.</p>}
        </div>
        <LensPhoto />
      </section>

      <section className="collections" aria-labelledby="collections-title">
        <div className="container">
          <h2 id="collections-title" className="collections-title">The collections</h2>
          <p className="brand-line">{brands.map(b => <span key={b} className="brand">{b}</span>)}</p>
          <p className="collections-note">Tell us which designers you love when you book, and we’ll have them ready for your visit.</p>
        </div>
      </section>

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
