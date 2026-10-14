'use client';
import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { skinTechnologies } from '@/lib/config';

const arrow = d => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

/* The technologies for Non-Invasive Skin Tightening as a row of cards. Like the Collections carousel, the row is a
   native scroll-snap track, so swiping and trackpads work without script; the arrows and the left and right keys
   (while the row has focus) move it one card at a time.
   - With onChange (booking step 1), each card is a toggle: choosing one is optional and choosing it again clears it.
   - With hrefFor (the home page panel), each card links to booking with that technology already chosen. */
export default function SkinTechnologies({ value = '', onChange, hrefFor }) {
  const track = useRef(null);
  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const step = () => { const c = track.current.children; return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : track.current.clientWidth; };
  const move = by => track.current.scrollBy({ left: by * step(), behavior: smooth() });
  function keys(e) {
    if (e.target !== track.current || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1);
  }
  const body = t => <>
    <span className="tech-media"><Image src={t.image} alt="" fill sizes="(max-width: 860px) 70vw, 240px" /></span>
    <span className="tech-body"><strong>{t.name}</strong><small>{t.summary}</small><span className="tech-session">{t.session}</span></span>
  </>;
  return <div className="skin-tech">
    <div className="skin-tech-head">
      <p className="skin-tech-title">{onChange ? 'Choose a technology' : 'Technologies'} <small>Optional</small></p>
      <div className="skin-tech-arrows">
        <button type="button" className="carousel-arrow small" aria-label="Previous technology" onClick={() => move(-1)}>{arrow('M19 12H5m6-6-6 6 6 6')}</button>
        <button type="button" className="carousel-arrow small" aria-label="Next technology" onClick={() => move(1)}>{arrow('M5 12h14m-6-6 6 6-6 6')}</button>
      </div>
    </div>
    <ul className="skin-tech-track" ref={track} tabIndex={0} onKeyDown={keys} aria-label="Skin tightening technologies. Use the left and right arrow keys to move.">
      {skinTechnologies.map(t => <li key={t.slug}>
        {onChange
          ? <button type="button" className="tech-card" aria-pressed={value === t.slug} onClick={() => onChange(value === t.slug ? '' : t.slug)}>{body(t)}</button>
          : <Link className="tech-card" href={hrefFor(t.slug)}>{body(t)}<span className="sr-only"> (book with this technology)</span></Link>}
      </li>)}
      {/* Lets the last card snap to the start of the row, as in the Collections carousel. */}
      <li className="skin-tech-end" aria-hidden="true" />
    </ul>
  </div>;
}
