'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate, money, clinic } from '@/lib/config';
import { completed, affiliateStats, affiliateJourney, paidShare, nextUpcoming } from '@/lib/affiliate';
import { Empty, Icon } from './ui';

// Everything here shows only the affiliate's restricted rows (lib/affiliate.js): patient name, appointment date,
// status, their commission (blank until completed) and its payout. Staff "Preview as affiliate" uses the same code.

// Animates a number from 0 to its value once, unless the visitor prefers reduced motion.
export function useCountUp(value, duration = 1000) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let raf, start;
    const step = now => { start ??= now; const t = Math.min(1, (now - start) / duration); setShown(value * (1 - Math.pow(1 - t, 3))); if (t < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
}
const STATUS_ICON = { Booked: 'clock', Attended: 'check', 'No-show': 'xCircle', Cancelled: 'xCircle' };
export function StatusPill({ status }) { return <span className={'badge pill ' + status.toLowerCase()}><Icon name={STATUS_ICON[status] || 'clock'} size={14} />{status}</span>; }
// Two letters for a referral's round badge: the first letters of the first two words of the name.
export const initials = name => String(name || '').split(/\s+/).filter(w => /^[a-z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '•';
const day = d => formatDate(d, { timeStyle: undefined });

// Copies text and says so on the button for two seconds. onDone reports the result to the workspace notice.
export function CopyButton({ text, label = 'Copy link', className = 'button', onDone }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 2200); return () => clearTimeout(t); }, [copied]);
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); onDone?.(null); } catch { onDone?.(new Error('Your browser blocked copying. Select the link and copy it instead.')); } }
  return <button type="button" className={className + (copied ? ' is-copied' : '')} onClick={copy} aria-live="polite"><Icon name={copied ? 'check' : 'copy'} size={18} />{copied ? 'Copied' : label}</button>;
}

function Stat({ icon, tone, label, value, format, note, chip, bar, delay }) {
  const n = useCountUp(value);
  return <article className="stat-card rise" style={{ animationDelay: delay + 's' }}>
    <div className="stat-top"><span className={'stat-icon ' + tone}><Icon name={icon} size={20} /></span>{chip && <span className={'stat-chip ' + tone}>{chip}</span>}</div>
    <p>{label}</p><strong>{format(n)}</strong>
    {bar != null && <div className="meter" aria-hidden="true"><span style={{ width: bar + '%' }} /></div>}
    <small>{note}</small>
  </article>;
}
// The affiliate's overview figures. Upcoming bookings are a count only and never add to the completed figures.
export function AffiliateStats({ rows }) {
  const st = affiliateStats(rows), share = paidShare(st), next = nextUpcoming(rows), whole = n => Math.round(n);
  return <div className="stats stat-cards">
    <Stat icon="checkCircle" tone="green" label="Completed referrals" value={st.completedThisMonth} format={whole} chip="This month" note={st.completedAllTime + ' all time'} delay={0.04} />
    <Stat icon="calendar" tone="gold" label="Upcoming bookings" value={st.upcoming} format={whole} chip={next ? 'Next: ' + new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, month: 'short', day: 'numeric' }).format(new Date(next.start)) : null} note="Counts once completed" delay={0.1} />
    <Stat icon="trend" tone="ink" label="Commission earned" value={st.earned} format={money} note="From completed referrals" delay={0.16} />
    <Stat icon="wallet" tone="gold" label="Paid to you" value={st.paid} format={money} chip={st.earned > 0 ? share + '% paid' : null} bar={share} note={st.awaitingPayment > 0 ? money(st.awaitingPayment) + ' awaiting payment' : 'Nothing awaiting payment'} delay={0.22} />
  </div>;
}

// The dark "One link. A warm welcome." card on the overview, with copy, email and QR shortcuts.
export function ReferralHero({ url, qr, onCopied }) {
  return <section className="ref-hero rise" style={{ animationDelay: '.26s' }} aria-labelledby="ref-hero-title">
    <div className="ref-hero-copy">
      <p className="eyebrow">Your personal introduction</p>
      <h2 id="ref-hero-title">One link. <em>A warm welcome.</em></h2>
      <div className="ref-link-box"><Icon name="link" size={18} /><span className="ref-link-text">{url}</span><CopyButton text={url} label="Copy" className="ref-copy" onDone={onCopied} /></div>
      <div className="ref-actions">
        <a className="ghost-button" href={'mailto:?subject=' + encodeURIComponent('Your introduction to Eyecon') + '&body=' + encodeURIComponent('Book your Eyecon appointment through my personal link: ' + url)}><Icon name="mail" size={16} />Email link</a>
        <Link className="ghost-button" href="/affiliate/link"><Icon name="qr" size={16} />QR code</Link>
      </div>
    </div>
    <Link className="ref-hero-qr" href="/affiliate/link" aria-label="Open your QR code">{qr}</Link>
  </section>;
}

// Booked → Attended → Paid, as bars that grow when the page opens.
export function ReferralJourney({ rows, note }) {
  const j = affiliateJourney(rows), [grown, setGrown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setGrown(true)); return () => cancelAnimationFrame(t); }, []);
  const bar = (label, n, tone) => <div className="journey-row" key={label}><div><span className={'dot ' + tone} />{label}<strong>{n}</strong></div><div className="track"><span className={tone} style={{ width: (grown ? n / j.max * 100 : 0) + '%' }} /></div></div>;
  return <section className="panel-card journey rise" style={{ animationDelay: '.32s' }} aria-labelledby="journey-title">
    <div className="card-head"><h2 id="journey-title">Referral journey</h2><span className="quiet">All time</span></div>
    {bar('Booked', j.booked, 'gold')}{bar('Attended', j.attended, 'green')}{bar('Paid', j.paid, 'ink')}
    <p className="card-note"><Icon name="info" size={18} />{note}</p>
  </section>;
}

// One referral as a row: round badge, name and date, status, and the commission once completed.
function ReferralRow({ b }) {
  return <li className="ref-row">
    <span className="avatar" aria-hidden="true">{initials(b.name)}</span>
    <span className="ref-row-main"><strong>{b.name}</strong><small><Icon name="calendar" size={14} />{formatDate(b.start)}</small></span>
    <StatusPill status={b.status} />
    <span className="ref-row-money">{completed(b) ? <><strong>{money(b.commission)}</strong><small>{b.payout === 'Paid' ? 'Paid' + (b.paidAt ? ' ' + day(b.paidAt) : '') : 'Payment pending'}</small></> : <><strong aria-label="Not yet completed">—</strong><small>Counts once completed</small></>}</span>
  </li>;
}
// The overview's recent referrals, with All / Upcoming / Completed tabs.
export function RecentReferrals({ rows, limit = 5 }) {
  const [tab, setTab] = useState('all');
  const tabs = [['all', 'All', rows], ['upcoming', 'Upcoming', rows.filter(r => r.status === 'Booked')], ['done', 'Completed', rows.filter(completed)]];
  const shown = tabs.find(t => t[0] === tab)[2].slice(0, limit);
  return <section className="panel-card list-card rise" style={{ animationDelay: '.38s' }} aria-labelledby="recent-title">
    <div className="card-head"><h2 id="recent-title">Recent referrals</h2>
      <div className="card-tools">
        <div className="segmented" role="group" aria-label="Show referrals">{tabs.map(([id, label, list]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label} <span>{list.length}</span></button>)}</div>
        <Link className="text-link with-icon" href="/affiliate/referrals">View all<Icon name="arrow" size={16} /></Link>
      </div>
    </div>
    {shown.length ? <ul className="ref-list">{shown.map(b => <ReferralRow key={b.id} b={b} />)}</ul> : <Empty text={tab === 'all' ? 'No referrals yet. Share your link to get started.' : 'No referrals here yet.'} />}
  </section>;
}

// Status chips with counts for the Referrals page.
export function StatusChips({ rows, statuses, value, onChange }) {
  return <div className="chips" role="group" aria-label="Filter by status">{['All', ...statuses].map(s => <button key={s} type="button" className={'chip ' + s.toLowerCase()} aria-pressed={value === s} onClick={() => onChange(s)}><span className="dot" />{s}<span className="chip-count">{s === 'All' ? rows.length : rows.filter(r => r.status === s).length}</span></button>)}</div>;
}

// An affiliate's referrals: patient, appointment date, status and their commission (blank until completed). The
// earnings view lists completed referrals with payout status instead of the status column. Nothing else is shown.
export function AffiliateTable({ items, earnings, title }) {
  return items.length ? <div className="table-wrap ref-table card-table" tabIndex={0} role="region" aria-label={title + ' table'}><table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">Patient</th><th scope="col">Appointment</th>{!earnings && <th scope="col">Status</th>}<th scope="col">Your commission</th>{earnings && <th scope="col">Payout</th>}</tr></thead><tbody>{items.map(b => <tr key={b.id}><td data-label="Patient" data-main=""><span className="cell-person"><span className="avatar" aria-hidden="true">{initials(b.name)}</span><strong>{b.name}</strong></span></td><td data-label="Appointment"><span className="cell-date"><Icon name="calendar" size={16} />{formatDate(b.start)}</span></td>{!earnings && <td data-label="Status"><StatusPill status={b.status} /></td>}<td className="cell-money" data-label="Your commission">{completed(b) ? money(b.commission) : <span className="quiet" aria-label="Not yet completed">—</span>}</td>{earnings && <td data-label="Payout"><span className={'badge ' + (b.payout === 'Paid' ? 'paid' : 'pending')}>{b.payout}</span>{b.paidAt && <small>{day(b.paidAt)}</small>}</td>}</tr>)}</tbody></table></div> : <Empty text={earnings ? 'No completed referrals yet.' : undefined} />;
}

// Earnings: the paid-versus-awaiting ring and "How you are paid".
export function EarningsSummary({ rows }) {
  const st = affiliateStats(rows), share = paidShare(st), earned = useCountUp(st.earned, 1200), pct = useCountUp(share, 1200);
  return <div className="earnings-top">
    <section className="earnings-hero rise" aria-label="Commission earned">
      <div className="ring" style={{ '--deg': pct * 3.6 + 'deg' }} role="img" aria-label={share + '% of your commission has been paid'}><div><strong>{Math.round(pct)}%</strong><span>Paid</span></div></div>
      <div className="earnings-figures">
        <p className="eyebrow">Commission earned</p>
        <strong className="earnings-total">{money(earned)}</strong>
        <div className="legend"><span><i className="dot gold" />Paid {money(st.paid)}</span><span><i className="dot faint" />Awaiting {money(st.awaitingPayment)}</span></div>
      </div>
    </section>
    <section className="panel-card steps rise" style={{ animationDelay: '.08s' }} aria-labelledby="paid-steps">
      <h2 id="paid-steps">How you are paid</h2>
      <ol>
        <li><span className="step-icon green"><Icon name="check" size={16} /></span><span><strong>Visit completed</strong><small>Your referral attends their appointment.</small></span></li>
        <li><span className="step-icon gold"><Icon name="receipt" size={16} /></span><span><strong>Clinic calculates</strong><small>Your commission appears here.</small></span></li>
        <li><span className="step-icon ink"><Icon name="wallet" size={16} /></span><span><strong>Payment recorded</strong><small>Marked paid, with the date.</small></span></li>
      </ol>
    </section>
  </div>;
}
// Earnings: each completed referral, opening to show its progress (visit → calculated → paid).
export function EarningsList({ rows }) {
  const [open, setOpen] = useState(rows.find(r => r.payout !== 'Paid')?.id || null);
  if (!rows.length) return <Empty text="No completed referrals yet." />;
  return <section className="panel-card list-card rise" style={{ animationDelay: '.14s' }} aria-labelledby="earned-list">
    <div className="card-head"><h2 id="earned-list">Completed referrals</h2><span className="quiet">Select one to see its progress</span></div>
    <ul className="ref-list">{rows.map(b => { const isOpen = open === b.id, paid = b.payout === 'Paid'; return <li key={b.id} className={'earn-item' + (isOpen ? ' open' : '')}>
      <button type="button" className="ref-row earn-toggle" aria-expanded={isOpen} aria-controls={'earn-' + b.id} onClick={() => setOpen(isOpen ? null : b.id)}>
        <span className="avatar" aria-hidden="true">{initials(b.name)}</span>
        <span className="ref-row-main"><strong>{b.name}</strong><small>{formatDate(b.start)}</small></span>
        <strong className="earn-amount">{money(b.commission)}</strong>
        <span className={'badge ' + (paid ? 'paid' : 'pending')}>{paid ? 'Paid' + (b.paidAt ? ' ' + day(b.paidAt) : '') : 'Pending'}</span>
        <Icon name="chevron" size={18} />
      </button>
      {isOpen && <ol className="timeline" id={'earn-' + b.id}>
        <li className="done"><span /><strong>Visit completed</strong><small>{day(b.start)}</small></li>
        <li className="done"><span /><strong>Commission calculated</strong><small>{money(b.commission)}</small></li>
        <li className={paid ? 'done' : ''}><span /><strong>{paid ? 'Paid' : 'Awaiting payment'}</strong><small>{paid ? (b.paidAt ? day(b.paidAt) : 'Recorded') : 'The clinic records it'}</small></li>
      </ol>}
    </li>; })}</ul>
  </section>;
}

// My link & QR: a printable share card (light or dark) beside the link, its actions and how the link works.
export function ShareKit({ url, name, slug, qr, onCopied, onDownload }) {
  const [dark, setDark] = useState(false);
  return <div className="share-kit">
    <section className="share-stage rise" aria-label="Your share card">
      <div className="segmented" role="group" aria-label="Card style"><button type="button" aria-pressed={!dark} onClick={() => setDark(false)}>Light card</button><button type="button" aria-pressed={dark} onClick={() => setDark(true)}>Dark card</button></div>
      <div className={'share-card' + (dark ? ' dark' : '')}><span className="share-brand">EYECON</span><div className="share-qr">{qr}</div><span>Scan to book with my<br />personal introduction</span><em>{name}</em></div>
    </section>
    <div className="share-side">
      <section className="panel-card rise" style={{ animationDelay: '.08s' }} aria-label="Your referral link">
        <label className="field-label" htmlFor="referral-url">Your referral link</label>
        <div className="link-row"><input id="referral-url" readOnly value={url} onFocus={e => e.target.select()} /><CopyButton text={url} onDone={onCopied} /></div>
        <div className="share-actions">
          <button type="button" className="share-action" onClick={onDownload}><span className="stat-icon gold"><Icon name="download" size={20} /></span>Download QR</button>
          <a className="share-action" href={'mailto:?subject=' + encodeURIComponent('Your introduction to Eyecon') + '&body=' + encodeURIComponent('Book your Eyecon appointment through my personal link: ' + url)}><span className="stat-icon gold"><Icon name="mail" size={20} /></span>Email link</a>
          <Link className="share-action" href={'/book/' + slug}><span className="stat-icon gold"><Icon name="eye" size={20} /></span>Preview my page</Link>
        </div>
      </section>
      <section className="panel-card steps rise" style={{ animationDelay: '.14s' }} aria-labelledby="link-steps">
        <h2 id="link-steps">How your link works</h2>
        <ol className="numbered">
          <li><span className="step-icon ink">1</span><span><strong>Share it</strong><small>Send the link, or let someone scan your QR code.</small></span></li>
          <li><span className="step-icon ink">2</span><span><strong>They book and get a gift card</strong><small>Their booking is credited to you, and they receive a gift card.</small></span></li>
          <li><span className="step-icon ink">3</span><span><strong>You earn after their visit</strong><small>Commission is calculated by the clinic once the visit is completed.</small></span></li>
        </ol>
      </section>
    </div>
  </div>;
}
