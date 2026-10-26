'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getImageProps } from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Header, Footer, Icon, Button } from './ui';
import Photo, { ArtPhoto } from './photo';
import { DEMO, clinic, collections, frames, shopUrl } from '@/lib/config';
import { withAffiliate } from '@/lib/affiliate';
import { frameBrand, framePrice, reserveHref, stylingHref, directionsUrl, brandGroups, readSavedFrames, writeSavedFrames, toggleSaved } from '@/lib/shop';

/* The Shop Frames page: featured frames and the houses Eyecon carries. affiliate is the ?affiliate= value the page
   was opened with; every booking link built here goes through withAffiliate so the referral is kept. */

// localStorage, or null where the browser blocks it (reading the property itself can throw).
function browserStorage() { try { return window.localStorage; } catch { return null; } }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Keyboard focus inside a swipe row: the browser scrolls only far enough to show the focused link, and the snap can
// then pull the row back so it is hidden again. Bring the whole card that holds it to its snap position instead.
function revealCard(e) {
  const row = e.currentTarget, card = [...row.children].find(c => c.contains(e.target));
  if (!card) return;
  const r = card.getBoundingClientRect(), box = row.getBoundingClientRect();
  if (r.left >= box.left && r.right <= box.right) return;
  card.scrollIntoView({ block: 'nearest', inline: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/* The page heading over a full-width photograph: a 16:9 crop above 640px and a 4:5 crop on phones. Only the matching
   source is downloaded, so it loads eagerly with fetchPriority rather than preload. If the photograph is missing the
   plain heading shows instead, and onMissing lets the page drop the overlay header. */
function ShopHeading({ photo, onMissing }) {
  const ref = useRef(null);
  // An image that failed before the page became interactive never fires onError, so check once on mount.
  useEffect(() => { const img = ref.current; if (img?.complete && !img.naturalWidth) onMissing(); }, []);
  const words = (
    <div className="container">
      <p className="eyebrow">The boutique</p>
      <h1 id="shop-title">Frames</h1>
      <p className="shop-subline">Featured pieces and the houses we carry. Reserve any frame to try at your visit.</p>
    </div>
  );
  if (!photo) return <section className="shop-heading" aria-labelledby="shop-title">{words}</section>;
  const common = { alt: 'Five models wearing luxury eyewear', sizes: '100vw', loading: 'eager', fetchPriority: 'high' };
  const { props: { srcSet: wide } } = getImageProps({ ...common, src: '/images/shop/hero-desktop.webp', width: 1664, height: 936 });
  const { props: { srcSet: narrow, ...rest } } = getImageProps({ ...common, src: '/images/shop/hero-mobile.webp', width: 1080, height: 1350 });
  return (
    <section className="shop-heading shop-hero" aria-labelledby="shop-title">
      <picture className="shop-hero-photo">
        <source media="(max-width: 640px)" srcSet={narrow} />
        <source srcSet={wide} />
        <img ref={ref} {...rest} onError={onMissing} />
      </picture>
      {words}
    </section>
  );
}

// The hearted frames and a toggle that saves them. They are read after the first render, so the server and the
// browser render the same hearts.
function useSavedFrames() {
  const [saved, setSaved] = useState([]);
  useEffect(() => { setSaved(readSavedFrames(browserStorage())); }, []);
  function toggle(slug) {
    const next = toggleSaved(saved, slug), storage = browserStorage();
    setSaved(next);
    if (storage) writeSavedFrames(storage, next);
  }
  return [saved, toggle];
}

function FrameCard({ frame, saved, onSave, affiliate, sizes = '(max-width: 640px) 66vw, 24vw' }) {
  const brand = frameBrand(frame), name = (brand?.name || '') + ' ' + frame.model, price = framePrice(frame.price);
  return (
    <li className="frame-card">
      <div className="frame-media">
        <Photo src={'/images/shop/frames/' + frame.slug + '.webp'} alt={name} sizes={sizes}>
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
  const [saved, save] = useSavedFrames();
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
        <ul className="frame-row" ref={row} tabIndex={0} aria-label="Featured frames. Use the left and right arrow keys to move." onKeyDown={keys} onScroll={edges} onFocus={revealCard}>
          {frames.map(f => <FrameCard key={f.slug} frame={f} affiliate={affiliate} saved={saved.includes(f.slug)} onSave={() => save(f.slug)} />)}
        </ul>
      </div>
    </section>
  );
}

/* The houses, below the featured row, in the order of collections (grouped by brandGroups in lib/shop.js). Every
   photograph falls back to the brand's carousel photograph in public/images/brands, then to a named placeholder. */
function BrandPhoto({ brand, sizes }) {
  return <Photo src={'/images/brands/' + brand.slug + '.webp'} alt={brand.name + ' eyewear'} sizes={sizes}><span className="brand-placeholder"><strong>{brand.name}</strong>{' '}<small>Photograph to follow</small></span></Photo>;
}

// A full-width band: 16:9 with the words low over the photograph on larger screens; 4:5 with the words below on phones.
// Phones show the brand's 4:5 photograph, the same one the carousel and tiles use.
// On /shop it is an article with a Shop the collection button; on the brand's own page it heads the page (an h1, no button).
function Banner({ brand, affiliate, page = false }) {
  const art = '/images/shop/banners/' + brand.slug, Wrap = page ? 'header' : 'article', Heading = page ? 'h1' : 'h3';
  return (
    <Wrap className="shop-banner" aria-labelledby={'house-' + brand.slug}>
      <div className="shop-banner-media">
        <ArtPhoto desktop={art + '-desktop.webp'} mobile={'/images/brands/' + brand.slug + '.webp'} alt={brand.name + ' eyewear'}><BrandPhoto brand={brand} sizes="100vw" /></ArtPhoto>
      </div>
      <div className="shop-banner-text">
        <Heading id={'house-' + brand.slug} className="house-name">{brand.name}</Heading>
        <p className="house-tagline">{brand.tagline}</p>
        {!page && <span className="button outline coming-soon">Coming Soon<span className="sr-only"> for {brand.name}</span></span>}
      </div>
    </Wrap>
  );
}

function Tile({ brand, affiliate }) {
  return (
    <li className="house-tile">
      <div className="house-media">
        <BrandPhoto brand={brand} sizes="(max-width: 640px) 78vw, 33vw" />
      </div>
      <h3 className="house-name">{brand.name}</h3>
      <p className="house-tagline">{brand.tagline}</p>
      <span className="house-link coming-soon">Coming Soon<span className="sr-only"> for {brand.name}</span></span>
    </li>
  );
}

// The two tiles that close the page and fill any short row of tiles.
function ClosingTile({ id, affiliate }) {
  if (id === 'styling') return (
    <li className="house-tile closing-tile">
      <div className="closing-panel dark">
        <h3>Book a styling visit</h3>
        <p>Try pieces from every house with a personal styling consultation.</p>
        <Button href={stylingHref(affiliate)}>Book now</Button>
      </div>
    </li>
  );
  const directions = directionsUrl(clinic.address);
  return (
    <li className="house-tile closing-tile">
      <div className="closing-panel">
        <h3>Visit the boutique</h3>
        {clinic.address ? <p>{clinic.address}</p> : <p className="pending-text">Address to be confirmed</p>}
        {directions && <a className="button secondary" href={directions} target="_blank" rel="noopener noreferrer">Get directions<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
    </li>
  );
}

// Three equal columns; on phones a swipe row with a "1 / 3" counter that follows the scroll.
function TileRow({ items, affiliate }) {
  const row = useRef(null), [index, setIndex] = useState(0);
  function follow() {
    const el = row.current, [first, second] = el.children;
    const step = second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setIndex(atEnd ? items.length - 1 : Math.min(items.length - 1, Math.round(el.scrollLeft / step)));
  }
  return (
    <div className="house-row">
      <ul className="house-tiles" ref={row} onScroll={follow} onFocus={revealCard}>
        {items.map(item => item.closing
          ? <ClosingTile key={item.closing} id={item.closing} affiliate={affiliate} />
          : <Tile key={item.slug} brand={item} affiliate={affiliate} />)}
      </ul>
      <p className="house-count" aria-hidden="true">{index + 1} / {items.length}</p>
    </div>
  );
}

function Houses({ affiliate }) {
  return (
    <section className="houses" aria-labelledby="houses-title">
      <h2 id="houses-title" className="sr-only">The houses we carry</h2>
      {brandGroups().map((group, i) => group.type === 'banner'
        ? <Banner key={group.items[0].slug} brand={group.items[0]} affiliate={affiliate} />
        : <TileRow key={'row-' + i} items={group.items} affiliate={affiliate} />)}
    </section>
  );
}

export default function Shop({ affiliate }) {
  const [photo, setPhoto] = useState(true);
  return <>
    <Header bookingHref={withAffiliate('/booking', affiliate)} shopHref={withAffiliate(shopUrl, affiliate)} overlay={photo} />
    <main id="main-content" className="shop">
      <ShopHeading photo={photo} onMissing={() => setPhoto(false)} />
      <FeaturedFrames affiliate={affiliate} />
      <Houses affiliate={affiliate} />
    </main>
    <Footer />
  </>;
}

/* A brand's own page at /shop/[slug]. It is built ahead of time, so the affiliate is read in the browser: the
   prerendered page has no referral on its links, and the browser swaps in the same page with the referral added. */
export function BrandPage({ slug }) {
  const brand = collections.find(c => c.slug === slug);
  return <Suspense fallback={<BrandPageBody brand={brand} affiliate={null} />}><BrandPageWithAffiliate brand={brand} /></Suspense>;
}

function BrandPageWithAffiliate({ brand }) {
  return <BrandPageBody brand={brand} affiliate={useSearchParams().get('affiliate')} />;
}

function BrandPageBody({ brand, affiliate }) {
  const [saved, save] = useSavedFrames(), pieces = frames.filter(f => f.brand === brand.slug);
  return <>
    <Header bookingHref={withAffiliate('/booking', affiliate)} shopHref={withAffiliate(shopUrl, affiliate)} />
    <main id="main-content" className="shop brand-page">
      <p className="container brand-back"><Link className="text-link" href={withAffiliate('/shop', affiliate)}><span aria-hidden="true">← </span>All frames</Link></p>
      <Banner brand={brand} page />
      <div className="container brand-intro"><p className="brand-blurb">{brand.blurb}</p></div>
      <section className="container brand-frames" aria-labelledby="brand-frames-title">
        <div className="featured-head">
          <h2 id="brand-frames-title" className="featured-title">{brand.name} frames</h2>
          {DEMO && pieces.length > 0 && <span className="featured-sample">Sample selection</span>}
        </div>
        {pieces.length
          ? <ul className="frame-grid">{pieces.map(f => <FrameCard key={f.slug} frame={f} affiliate={affiliate} sizes="(max-width: 1024px) 50vw, 25vw" saved={saved.includes(f.slug)} onSave={() => save(f.slug)} />)}</ul>
          : <p className="brand-empty">New pieces arriving soon. Book a styling visit to see the full collection in person.</p>}
      </section>
      <section className="final-cta brand-cta" aria-labelledby="brand-cta-title">
        <div className="container">
          <h2 id="brand-cta-title">Want to try {brand.name} in person?</h2>
          <Button href={stylingHref(affiliate, brand.name)}>Book a styling visit</Button>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
