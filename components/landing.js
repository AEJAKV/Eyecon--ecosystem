'use client';
import { useEffect, useRef, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import { useApp } from './provider';
import { Header, Footer, Button, Icon, Gift, Referral, Loading, Notice, Stars } from './ui';
import { DEMO, services, collections, doctors, clinic } from '@/lib/config';

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

// Photographs known to be missing, so a fallback shows at once instead of retrying the request.
const missingPhotos = new Set();

/* A photograph that fills its frame, or the fallback passed as children while the file is missing. */
function Photo({ src, alt, sizes, children }) {
  const [missing, setMissing] = useState(missingPhotos.has(src)), ref = useRef(null);
  const fail = () => { missingPhotos.add(src); setMissing(true); };
  // An image that failed before the page became interactive never fires onError, so check once on mount.
  useEffect(() => { const img = ref.current; if (img?.complete && !img.naturalWidth) fail(); }, []);
  return missing ? children : <Image ref={ref} src={src} alt={alt} fill sizes={sizes} onError={fail} />;
}

function BrandImage({ brand }) {
  return <Photo src={'/images/brands/' + brand.slug + '.webp'} alt={brand.name + ' eyewear'} sizes="(max-width: 860px) 78vw, 24vw"><span className="brand-placeholder"><strong>{brand.name}</strong>{' '}<small>Photograph to follow</small></span></Photo>;
}

/* What one appointment involves: photograph, who it is for, three points and the booking button. */
function ServiceDetail({ service, href, leaving = false }) {
  return (
    <div className={`service-detail ${leaving ? 'leaving' : ''}`} aria-hidden={leaving || undefined}>
      <div className="service-photo">
        <Photo src={'/images/services/' + service.id + '.webp'} alt={leaving ? '' : service.name} sizes="(max-width: 860px) 100vw, 36vw"><span className="service-photo-fallback"><Icon name={service.icon} size={56} /></span></Photo>
      </div>
      <p className="service-meta">{service.meta}</p>
      <h3>{service.name}</h3>
      <ul className="service-points">{service.points.map(point => <li key={point}>{point}</li>)}</ul>
      <Button href={href} tabIndex={leaving ? -1 : undefined}>Book this visit</Button>
    </div>
  );
}

/* Phone layout for the appointments: a row of chips over a swipeable, scroll-snap track of cards, one per service.
   Every card is fully readable; swiping moves the active chip and dot, and tapping a chip scrolls to its card. */
function AppointmentCards({ serviceHref }) {
  const [active, setActive] = useState(0);
  const track = useRef(null), chips = useRef(null), moving = useRef(0), frame = useRef(0);
  const last = services.length - 1;
  const step = () => track.current.children[1].offsetLeft - track.current.children[0].offsetLeft;
  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  function go(index) {
    setActive(index);
    // Ignore the cards passed on the way, so the chips do not flicker through each one.
    clearTimeout(moving.current);
    moving.current = setTimeout(() => { moving.current = 0; }, 1200);
    track.current.scrollTo({ left: index * step(), behavior: smooth() });
  }
  function settle() { clearTimeout(moving.current); moving.current = 0; }
  function follow() {
    if (moving.current || frame.current) return;
    frame.current = requestAnimationFrame(() => { // at most one reading per frame
      frame.current = 0;
      if (!track.current) return;
      setActive(Math.max(0, Math.min(last, Math.round(track.current.scrollLeft / step()))));
    });
  }
  // Keep the active chip in view by scrolling the chip row only, never the page.
  useEffect(() => {
    const row = chips.current, chip = row?.children[active];
    if (chip && row.clientWidth) row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: smooth() });
  }, [active]);
  useEffect(() => () => { clearTimeout(moving.current); cancelAnimationFrame(frame.current); }, []);
  return (
    <div className="appointment-mobile">
      <div className="appointment-chips" ref={chips} role="group" aria-label="Choose an appointment type">
        {services.map((s, i) => <button type="button" key={s.id} aria-pressed={i === active} onClick={() => go(i)}>{s.short}</button>)}
      </div>
      <div className="appointment-track" ref={track} role="region" aria-label="Appointment types" tabIndex={0} onScroll={follow} onScrollEnd={settle}>
        {services.map(s => <article className="appointment-card" key={s.id} role="group" aria-label={s.name}>
          <div className="service-photo">
            <Photo src={'/images/services/' + s.id + '.webp'} alt={s.name} sizes="84vw"><span className="service-photo-fallback"><Icon name={s.icon} size={48} /></span></Photo>
          </div>
          <div className="appointment-card-body">
            <p className="service-meta">{s.meta}</p>
            <h3>{s.name}</h3>
            <ul className="service-points">{s.points.map(point => <li key={point}>{point}</li>)}</ul>
            <Button href={serviceHref(s.id)}>Book this visit</Button>
          </div>
        </article>)}
        <span className="appointment-track-end" aria-hidden="true" />
      </div>
      <div className="appointment-dots" aria-hidden="true">{services.map((s, i) => <span key={s.id} className={i === active ? 'active' : undefined} />)}</div>
    </div>
  );
}

/* What the intro shows about one optometrist. Used by the in-card panel on desktop and the bottom sheet on phones. */
function DoctorIntro({ doctor, href, onClose }) {
  const name = `${doctor.title} ${doctor.first} ${doctor.last}`;
  return <>
    <button type="button" className="doctor-close" aria-label={'Close ' + name} onClick={onClose}><Icon name="close" size={20} /></button>
    <p className="doctor-panel-name">{name}</p>
    <p className="doctor-panel-intro">{doctor.intro}</p>
    <dl className="doctor-facts">
      <div><dt>Focus</dt><dd>{doctor.focus}</dd></div>
      <div><dt>Languages</dt><dd>{doctor.languages}</dd></div>
      <div><dt>Wears</dt><dd>{doctor.wears}</dd></div>
    </dl>
    <Button href={href}><Icon name="calendar" size={18} />Book with {doctor.first}</Button>
  </>;
}

/* The optometrists as portrait cards. “Meet [First]” opens that doctor’s intro: on desktop a panel slides up over the
   lower part of the card, leaving the face visible; on phones (below 860px) the cards become a swipeable track and the
   intro is a bottom sheet over a dimmed page. Only one intro is open at a time. It closes with its X, Escape, a click
   or tap elsewhere, or a swipe down on the sheet; focus moves in on opening and back to the Meet button on closing. */
const SWIPE_TO_CLOSE = 90;

function Doctors({ serviceHref }) {
  const [open, setOpen] = useState(null), [dot, setDot] = useState(0);
  const panels = useRef({}), pills = useRef({}), sheet = useRef(null), track = useRef(null), frame = useRef(0), drag = useRef(null);
  // The sheet keeps showing the last doctor while it slides away.
  const shown = useRef(doctors[0]);
  if (open) shown.current = doctors.find(d => d.slug === open) || shown.current;
  const href = d => serviceHref('eye-exam') + '&doctor=' + encodeURIComponent(d.slug);

  function close() {
    const slug = open;
    if (!slug) return;
    setOpen(null);
    // Hand focus back to the Meet button, unless the click that closed the intro has already put it somewhere useful.
    requestAnimationFrame(() => { const at = document.activeElement; if (!at || at === document.body || panels.current[slug]?.contains(at) || sheet.current?.contains(at)) pills.current[slug]?.focus({ preventScroll: true }); });
  }
  useEffect(() => {
    if (!open) return;
    const phone = window.matchMedia('(max-width: 860px)').matches, root = document.documentElement;
    (phone ? sheet.current : panels.current[open])?.focus({ preventScroll: true });
    if (phone) root.classList.add('sheet-open'); // locks page scrolling and hides the floating Book bar
    const key = e => { if (e.key === 'Escape') close(); };
    const outside = e => { if (!panels.current[open]?.contains(e.target) && !sheet.current?.contains(e.target) && !e.target.closest?.('.doctor-pill')) close(); };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); root.classList.remove('sheet-open'); };
  }, [open]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Phones: the dot under the track follows the card nearest the start, read at most once per frame.
  function follow() {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = track.current;
      if (!el || el.children.length < 2) return;
      setDot(Math.max(0, Math.min(doctors.length - 1, Math.round(el.scrollLeft / (el.children[1].offsetLeft - el.children[0].offsetLeft)))));
    });
  }
  // Phones: dragging the sheet down from its top closes it.
  function dragStart(e) { drag.current = sheet.current.scrollTop <= 0 ? { from: e.touches[0].clientY, by: 0 } : null; }
  function dragMove(e) {
    if (!drag.current) return;
    drag.current.by = Math.max(0, e.touches[0].clientY - drag.current.from);
    sheet.current.style.transition = 'none';
    sheet.current.style.transform = drag.current.by ? `translateY(${drag.current.by}px)` : '';
  }
  function dragEnd() {
    if (!drag.current) return;
    const far = drag.current.by > SWIPE_TO_CLOSE;
    drag.current = null;
    if (far) close();
    requestAnimationFrame(() => { if (sheet.current) { sheet.current.style.transition = ''; sheet.current.style.transform = ''; } });
  }

  const person = shown.current, personName = `${person.title} ${person.first} ${person.last}`;
  return (
    <section className="doctors" aria-labelledby="doctors-title">
      <div className="doctors-intro">
        <h2 id="doctors-title">The people behind your exam</h2>
        <p>Every visit is unhurried, personal and led by a licensed optometrist.</p>
      </div>
      {/* Two per row for two or four doctors, three per row for three, five or six. On phones, one swipeable row. */}
      <div className="doctor-grid" ref={track} data-count={doctors.length} style={{ '--per-row': doctors.length === 1 ? 1 : doctors.length === 2 || doctors.length === 4 ? 2 : 3 }} onScroll={follow}>
        {doctors.map(d => {
          const active = open === d.slug, name = `${d.title} ${d.first} ${d.last}`;
          return (
            <article className={`doctor-card ${active ? 'open' : ''}`} key={d.slug}>
              <Image src={d.photo} alt={d.alt || name} fill sizes="(max-width: 860px) 86vw, 600px" />
              <div className="doctor-card-text" aria-hidden={active || undefined}>
                <h3><em>{d.title} {d.first}</em> <span>{d.last}</span></h3>
                <p>{d.line}</p>
                <button type="button" className="doctor-pill" ref={el => { pills.current[d.slug] = el; }} aria-expanded={active} tabIndex={active ? -1 : undefined} onClick={() => setOpen(d.slug)}>Meet {d.first}</button>
              </div>
              <div className="doctor-panel" role="dialog" aria-modal="false" aria-label={name} tabIndex={-1} inert={!active} ref={el => { panels.current[d.slug] = el; }}>
                <DoctorIntro doctor={d} href={href(d)} onClose={close} />
              </div>
            </article>
          );
        })}
      </div>
      {doctors.length > 1 && <div className="doctor-dots" aria-hidden="true">{doctors.map((d, i) => <span key={d.slug} className={i === dot ? 'active' : undefined} />)}</div>}

      <div className={`doctor-sheet-backdrop ${open ? 'open' : ''}`} aria-hidden="true" />
      <div className={`doctor-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={personName} tabIndex={-1} inert={!open} ref={sheet} onTouchStart={dragStart} onTouchMove={dragMove} onTouchEnd={dragEnd} onTouchCancel={dragEnd}>
        <span className="doctor-sheet-handle" aria-hidden="true" />
        <DoctorIntro doctor={person} href={href(person)} onClose={close} />
      </div>
    </section>
  );
}

// Is point p inside the triangle a, b, c?
function insideTriangle(p, a, b, c) {
  const side = (u, v, w) => (u.x - w.x) * (v.y - w.y) - (v.x - w.x) * (u.y - w.y);
  const d1 = side(p, a, b), d2 = side(p, b, c), d3 = side(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/* Appointments set like an optometrist’s eye chart: each line a size smaller, and only the line you are reading is sharp.
   Hover, keyboard focus or a click picks a line; its detail crossfades into the panel beside the chart.

   Hovering uses the “safe triangle” (menu-aim) pattern so that travelling from a line to the panel does not select
   every line crossed on the way: a line entered while the mouse is heading for the panel waits, and is only selected
   if the mouse stops on it or turns away. A click pins a line; other lines then only preview on hover. */
const AIM_WAIT = 250, HOVER_INTENT = 120, AIM_TOLERANCE = 20, STOPPED_AFTER = 90;

function Appointments({ serviceHref }) {
  const [active, setActive] = useState(0), [leaving, setLeaving] = useState(null), [pinned, setPinned] = useState(null), [preview, setPreview] = useState(null);
  // Timers read the latest values from refs rather than from the render they were created in.
  const current = useRef(0), pin = useRef(null), over = useRef(null), trail = useRef([]), pending = useRef(0), pointer = useRef(''), panel = useRef(null);

  function select(index) {
    if (index === current.current) return;
    setLeaving(current.current);
    current.current = index;
    setActive(index);
  }
  function cancel() { clearTimeout(pending.current); pending.current = 0; }
  // The outgoing detail stays just long enough to fade out.
  useEffect(() => { if (leaving === null) return; const timer = setTimeout(() => setLeaving(null), 380); return () => clearTimeout(timer); }, [leaving, active]);
  useEffect(() => cancel, []);

  // True while the mouse is travelling from where it was a moment ago towards the panel’s left edge.
  function aiming(point) {
    const from = trail.current[0], box = panel.current?.getBoundingClientRect();
    if (!from || !box || (from.x === point.x && from.y === point.y)) return false;
    return insideTriangle(point, from, { x: box.left, y: box.top - AIM_TOLERANCE }, { x: box.left, y: box.bottom + AIM_TOLERANCE });
  }
  function track(e) {
    if (e.pointerType !== 'mouse') return;
    trail.current = [...trail.current.slice(-3), { x: e.clientX, y: e.clientY, at: performance.now() }];
  }
  function enter(index, e) {
    if (e.pointerType !== 'mouse') return;
    over.current = index;
    cancel();
    if (pin.current !== null) { setPreview(index === pin.current ? null : index); return; }
    if (index === current.current) return;
    const settle = () => {
      if (over.current !== index || pin.current !== null) return; // moved on, or a line was pinned meanwhile
      const last = trail.current[trail.current.length - 1];
      const stopped = !last || performance.now() - last.at > STOPPED_AFTER;
      if (stopped || !aiming(last)) select(index);
      else pending.current = setTimeout(settle, AIM_WAIT); // still heading for the panel: keep waiting
    };
    pending.current = setTimeout(settle, aiming({ x: e.clientX, y: e.clientY }) ? AIM_WAIT : HOVER_INTENT);
  }
  function leave(index, e) {
    if (e.pointerType !== 'mouse') return;
    if (over.current === index) { over.current = null; cancel(); }
    setPreview(p => (p === index ? null : p));
  }
  function focus(index, e) {
    // Keyboard focus selects at once. A pin on another line is dropped so the dot never disagrees with the panel.
    if (!e.target.matches(':focus-visible')) return;
    cancel();
    if (pin.current !== null && pin.current !== index) { pin.current = null; setPinned(null); setPreview(null); }
    select(index);
  }
  function click(index) {
    cancel();
    const touch = pointer.current === 'touch';
    pointer.current = '';
    select(index);
    if (touch) return; // a tap just opens the line, as before
    // A mouse click or Enter / Space pins the line; clicking the pinned line again releases it.
    const next = pin.current === index ? null : index;
    pin.current = next; setPinned(next); setPreview(null);
  }

  return (
    <section className="appointments" id="appointments" aria-labelledby="appointments-title">
      <div className="container">
        <div className="section-intro">
          <h2 id="appointments-title">Choose your appointment</h2>
          <p className="only-desktop">Every visit is with a licensed optometrist. Find the line that fits you.</p>
          <p className="only-mobile">Swipe to explore. Every visit is with a licensed optometrist.</p>
        </div>
        <div className="chart-layout">
          <ol className="chart" onPointerMove={track}>
            {services.map((s, i) => <li key={s.id}>
              <button type="button" className={`chart-row ${i === active ? 'active' : ''} ${i === pinned ? 'pinned' : ''} ${i === preview ? 'preview' : ''}`} style={{ '--i': i }} aria-expanded={i === active} aria-controls="service-panel"
                onPointerEnter={e => enter(i, e)} onPointerLeave={e => leave(i, e)} onPointerDown={e => { pointer.current = e.pointerType; }} onFocus={e => focus(i, e)} onClick={() => click(i)}>
                <span>{i === pinned && <i className="chart-pin" aria-hidden="true" />}{s.name}{i === pinned && <span className="sr-only"> (kept selected)</span>}</span>
                <i className="chart-arrow" aria-hidden="true" />
              </button>
            </li>)}
          </ol>
          <div className="service-panel" id="service-panel" aria-live="polite" ref={panel} onPointerEnter={cancel}>
            <ServiceDetail key={services[active].id} service={services[active]} href={serviceHref(services[active].id)} />
            {leaving !== null && leaving !== active && <ServiceDetail key={'leaving-' + services[leaving].id} service={services[leaving]} href={serviceHref(services[leaving].id)} leaving />}
          </div>
        </div>
      </div>
      <AppointmentCards serviceHref={serviceHref} />
      <div className="urgent-strip">
        <div className="container">
          <p>Urgent eye concern? Talk to the team now.</p>
          {clinic.phone
            ? <a className="button" href={'tel:' + clinic.phone}><Icon name="phone" size={18} />Call {clinic.phone}</a>
            : <span className="urgent-pending"><Icon name="phone" size={18} />Phone to be confirmed</span>}
        </div>
      </div>
    </section>
  );
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

  // Mobile booking bar: appears once the hero button scrolls away, hides at the closing call to action,
  // and steps aside while the appointment cards are on screen so it never covers their own Book buttons.
  useEffect(() => {
    if (!loaded || error) return;
    const hero = document.querySelector('.hero-actions .button'), final = document.querySelector('.final-cta .button'), cards = document.querySelector('.appointment-track');
    if (!hero || !final) return;
    let heroPast = false, finalVisible = false, cardsVisible = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === hero) heroPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        if (entry.target === final) finalVisible = entry.isIntersecting;
        if (entry.target === cards) cardsVisible = entry.isIntersecting;
      }
      setFloating(heroPast && !finalVisible && !cardsVisible);
    });
    observer.observe(hero); observer.observe(final); if (cards) observer.observe(cards);
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

      <Appointments serviceHref={serviceHref} />

      <Doctors serviceHref={serviceHref} />

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
