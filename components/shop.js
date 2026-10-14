'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Header, Footer, Icon } from './ui';
import Photo from './photo';
import { DEMO, frames, shopUrl } from '@/lib/config';
import { withAffiliate } from '@/lib/affiliate';
import { frameBrand, framePrice, reserveHref, readSavedFrames, writeSavedFrames, toggleSaved } from '@/lib/shop';

/* The Shop Frames page: featured frames and the houses Eyecon carries. affiliate is the ?affiliate= value the page
   was opened with; every booking link built here goes through withAffiliate so the referral is kept. */

// localStorage, or null where the browser blocks it (reading the property itself can throw).
function browserStorage() { try { return window.localStorage; } catch { return null; } }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ShopHeading() {
  return (
    <section className="shop-heading" aria-labelledby="shop-title">
      <div className="container">
        <p className="eyebrow">The boutique</p>
        <h1 id="shop-title">Frames</h1>
        <p className="shop-subline">Featured pieces and the houses we carry. Reserve any frame to try at your visit.</p>
      </div>
    </section>
  );
}

function FrameCard({ frame, saved, onSave, affiliate }) {
  const brand = frameBrand(frame), name = (brand?.name || '') + ' ' + frame.model, price = framePrice(frame.price);
  return (
    <li className="frame-card">
      <div className="frame-media">
        <Photo src={'/images/shop/frames/' + frame.slug + '.webp'} alt={name} sizes="(max-width: 640px) 66vw, 24vw">
          <span className="frame-placeholder"><Icon name="glasses" size={30} /><small>Photograph to follow</small></span>
        </Photo>
        {frame.isNew && <span className="frame-new">New</span>}
        <button type="button" className="frame-save" aria-pressed={saved} aria-label={'Save ' + name} onClick={onSave}><Icon name="heart" size={20} /></button>
      </div>
      <h3 className="frame-name">{brand?.name}<span aria-hidden="true"> · </span><span className="sr-only">, </span>{frame.model}</h3>
      <p className="frame-material">{frame.material}</p>
      {price && <p className="frame-price">{price}</p>}
      <Link className="frame-reserve text-link" href={reserveHref(frame, affiliate)}>Reserve to try<span className="sr-only"> the {name}</span></Link>
    </li>
  );
}

/* Featured this week: a scroll-snap row, so swiping and trackpads work without script. The arrows and the left and
   right keys (while the row has focus) move it one card at a time, and the arrows switch off at either end. */
function FeaturedFrames({ affiliate }) {
  const row = useRef(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const [saved, setSaved] = useState([]);
  // Saved frames are read after the first render, so the server and browser render the same hearts.
  useEffect(() => { setSaved(readSavedFrames(browserStorage())); }, []);
  function edges() {
    const el = row.current;
    if (el) setEnds({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }
  useEffect(() => { edges(); window.addEventListener('resize', edges); return () => window.removeEventListener('resize', edges); }, []);
  function move(direction) {
    const el = row.current, [first, second] = el.children;
    const step = second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
    el.scrollBy({ left: direction * step, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  function keys(e) {
    if (e.target !== e.currentTarget || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    move(e.key === 'ArrowRight' ? 1 : -1);
  }
  function save(slug) {
    const next = toggleSaved(saved, slug), storage = browserStorage();
    setSaved(next);
    if (storage) writeSavedFrames(storage, next);
  }
  return (
    <section className="featured-frames" aria-labelledby="featured-title">
      <div className="container">
        <div className="featured-head">
          <h2 id="featured-title" className="featured-title">Featured this week</h2>
          {DEMO && <span className="featured-sample">Sample selection</span>}
          <div className="featured-arrows">
            <button type="button" className="carousel-arrow" aria-label="Previous frames" disabled={ends.start} onClick={() => move(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg></button>
            <button type="button" className="carousel-arrow" aria-label="Next frames" disabled={ends.end} onClick={() => move(1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
          </div>
        </div>
        <ul className="frame-row" ref={row} tabIndex={0} aria-label="Featured frames. Use the left and right arrow keys to move." onKeyDown={keys} onScroll={edges}>
          {frames.map(f => <FrameCard key={f.slug} frame={f} affiliate={affiliate} saved={saved.includes(f.slug)} onSave={() => save(f.slug)} />)}
        </ul>
      </div>
    </section>
  );
}

export default function Shop({ affiliate }) {
  return <>
    <Header bookingHref={withAffiliate('/booking', affiliate)} shopHref={withAffiliate(shopUrl, affiliate)} />
    <main id="main-content" className="shop">
      <ShopHeading />
      <FeaturedFrames affiliate={affiliate} />
    </main>
    <Footer />
  </>;
}
