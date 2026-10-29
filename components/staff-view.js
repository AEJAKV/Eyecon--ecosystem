'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { clinic, money, services } from '@/lib/config';
import { deskDay } from '@/lib/front-desk';
import { staffOverview } from '@/lib/performance';
import { Icon, Button, Field } from './ui';
import { DeskStat, TodaySchedule } from './desk-view';
import { TopAffiliates } from './affiliate-dashboard';

// Staff admin (/admin) overview and page tops. Staff-only: these figures include commission and amounts billed.

// Bookings: four cards, today's schedule beside "Top affiliates this month" and "Needs attention".
export function StaffOverview({ data, busy, onStatus, onDetails }) {
  const o = useMemo(() => staffOverview(data, services), [data]), day = useMemo(() => deskDay(data.bookings, clinic.timezone), [data.bookings]);
  const todo = [
    o.missingId && { icon: 'receipt', tone: 'red', text: o.missingId + ' upcoming file' + (o.missingId === 1 ? '' : 's') + ' missing ID', href: '/admin/leads' },
    o.toPayCount && { icon: 'wallet', tone: 'gold', text: o.toPayCount + ' referral' + (o.toPayCount === 1 ? '' : 's') + ' ready to pay', href: '/admin/payouts' },
    o.needsCalculating && { icon: 'receipt', tone: 'gold', text: o.needsCalculating + ' attended referral' + (o.needsCalculating === 1 ? '' : 's') + ' to calculate', href: '/admin/payouts' },
    o.unpriced && { icon: 'tag', tone: 'gold', text: o.unpriced + ' procedure' + (o.unpriced === 1 ? ' has' : 's have') + ' no price yet', href: '/admin/pricing' }
  ].filter(Boolean);
  return <>
    <div className="stats stat-cards">
      <DeskStat icon="calendar" tone="ink" label="Today’s appointments" value={o.today} note={day.isToday ? day.checkedIn + ' checked in · ' + day.toArrive + ' to arrive' : 'Nothing booked today'} delay={0.04} />
      <DeskStat icon="list" tone="gold" label="Bookings this month" value={o.monthBookings} note={o.monthAffiliate + ' through affiliates · ' + (o.monthBookings - o.monthAffiliate) + ' direct'} delay={0.1} />
      <DeskStat icon="trend" tone="green" label="Billed through referrals" value={o.billedMonth} format={money} note={o.completedMonth + ' completed referral visit' + (o.completedMonth === 1 ? '' : 's') + ' this month'} delay={0.16} />
      <DeskStat icon="wallet" tone="dark" dark href="/admin/payouts" label="Commission to pay" value={o.toPay} format={money} note={o.toPayCount ? o.toPayCount + ' referral' + (o.toPayCount === 1 ? '' : 's') + ' · Open payouts' : 'Nothing to pay right now'} delay={0.22} />
    </div>
    <div className="overview-row">
      <div className="overview-main"><TodaySchedule day={day} busy={busy} onStatus={onStatus} onDetails={onDetails} /></div>
      <div className="overview-side">
        <div className="panel-card top-card rise" style={{ animationDelay: '.32s' }}><TopAffiliates affiliates={data.affiliates} bookings={data.bookings} /></div>
        <section className="attention rise" style={{ animationDelay: '.38s' }} aria-labelledby="attention-title">
          <h2 id="attention-title">Needs attention</h2>
          {todo.length ? <ul>{todo.map(t => <li key={t.text}><Link href={t.href}><span className={'stat-icon ' + t.tone}><Icon name={t.icon} size={18} /></span>{t.text}<Icon name="arrow" size={16} /></Link></li>)}</ul> : <p className="quiet"><Icon name="check" size={16} /> Everything is up to date.</p>}
        </section>
      </div>
    </div>
  </>;
}

// Payouts: ready to pay, still to calculate, paid this month.
export function PayoutSummary({ data }) {
  const o = useMemo(() => staffOverview(data, services), [data]);
  return <div className="stats stat-cards three">
    <DeskStat icon="wallet" tone="dark" dark label="Ready to pay" value={o.toPay} format={money} note={o.toPayCount + ' referral' + (o.toPayCount === 1 ? '' : 's') + ' with commission approved'} delay={0.04} />
    <DeskStat icon="receipt" tone="gold" label="Needs calculating" value={o.needsCalculating} note="Attended, amount billed not entered" delay={0.1} />
    <DeskStat icon="checkCircle" tone="green" label="Paid this month" value={o.paidMonth} format={money} note="Recorded in the ledger" delay={0.16} />
  </div>;
}

// The floating bar on Payouts: how many unpaid commissions are selected, their total, and Record as paid.
export function PayoutBar({ count, total, busy, onRecord }) {
  return <div className={'payout-bar' + (count ? ' active' : '')} role="region" aria-label="Selected payments">
    <span><strong>{count}</strong> selected · total <strong className="payout-total">{money(total)}</strong></span>
    <Button disabled={!count || busy} onClick={onRecord}>Record {money(total)} as paid</Button>
  </div>;
}

// Pricing: one tile per procedure, showing what is left after the operation cost as they type.
export function PriceTile({ service, price, busy, onSave, validate }) {
  const [retail, setRetail] = useState(String(price?.retailPrice ?? 0)), [cost, setCost] = useState(String(price?.operationCost ?? 0));
  let problem = ''; try { validate({ retailPrice: retail, operationCost: cost }); } catch (e) { problem = e.message; }
  const r = Number(retail) || 0, c = Number(cost) || 0, changed = r !== Number(price?.retailPrice ?? 0) || c !== Number(price?.operationCost ?? 0);
  const state = changed ? ['Unsaved', 'pending'] : r > 0 ? ['Saved', 'attended'] : ['Not set', 'no-show'];
  return <form className="panel-card price-tile" onSubmit={e => { e.preventDefault(); if (!problem) onSave({ service: service.id, retailPrice: retail, operationCost: cost }); }}>
    <div className="price-head"><h2>{service.name}</h2><span className={'badge pill ' + state[1]}>{state[0]}</span></div>
    <div className="price-inputs">
      <Field label="Retail price ($)" id={'retail-' + service.id} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={retail} onChange={e => setRetail(e.target.value)} />
      <Field label="Operation cost ($)" id={'cost-' + service.id} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={cost} onChange={e => setCost(e.target.value)} />
    </div>
    <div className="price-meter" aria-hidden="true"><span className="cost" style={{ width: (r > 0 ? Math.min(100, c / r * 100) : 0) + '%' }} /><span className="left" style={{ width: (r > 0 ? Math.max(0, (r - c) / r * 100) : 0) + '%' }} /></div>
    <p className="price-left"><span>Left after cost</span><strong className={r > 0 ? '' : 'unset'}>{r > 0 ? money(Math.max(0, r - c)) : 'Not set'}</strong></p>
    {problem && <p className="error-text" role="alert">{problem}</p>}
    <Button disabled={busy || !!problem}>Save</Button>
    {price?.updatedAt && <small className="quiet">Updated {new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium' }).format(new Date(price.updatedAt))}</small>}
  </form>;
}

// Messages: the templates as tabs, an editor with fields to add, and the email filled in with sample details.
const TEMPLATE_INFO = { confirmation: ['Confirmation', 'Right after booking'], 'day-before': ['Day before', 'Reminder'], 'same-day': ['Same day', 'Reminder'], 'no-show': ['No-show', 'When marked no-show'] };
export const TEMPLATE_FIELDS = ['name', 'doctor', 'date', 'address', 'phone', 'instructions', 'gift', 'documents_link', 'reference', 'lookup_link'];
const SAMPLE = { name: 'Sample patient', doctor: 'Dr. [First] [Last]', date: '[Appointment date and time]', address: '[Clinic address]', phone: '[Clinic phone]', instructions: '[Arrival instructions]', gift: '[Gift card line]', documents_link: '[Complete your file link]', reference: '[Booking reference]', lookup_link: '[Find my booking link]' };
// A template with each {field} replaced by its sample value; unknown fields stay as typed.
export const previewTemplate = text => String(text || '').replace(/\{([a-z_]+)\}/g, (m, k) => SAMPLE[k] ?? m);
export function MessagesAdmin({ templates, busy, onSave }) {
  const [tab, setTab] = useState(templates[0]?.id || ''), t = templates.find(x => x.id === tab) || templates[0];
  if (!t) return null;
  return <>
    <div className="template-tabs rise" role="group" aria-label="Templates">{templates.map(x => { const [label, when] = TEMPLATE_INFO[x.id] || [x.id.replaceAll('-', ' '), 'Email']; return <button key={x.id} type="button" aria-pressed={x.id === t.id} onClick={() => setTab(x.id)}><span className="stat-icon gold"><Icon name="mail" size={18} /></span><span><strong>{label}</strong><small>{when}</small></span></button>; })}</div>
    <TemplateEditor key={t.id} template={t} busy={busy} onSave={onSave} />
  </>;
}
function TemplateEditor({ template, busy, onSave }) {
  const [subject, setSubject] = useState(template.subject), [body, setBody] = useState(template.body);
  const add = k => setBody(b => b + (b && !/\s$/.test(b) ? ' ' : '') + '{' + k + '}');
  return <div className="template-layout">
    <form className="panel-card template-editor rise" style={{ animationDelay: '.06s' }} onSubmit={e => { e.preventDefault(); onSave({ id: template.id, subject, body }); }}>
      <Field label="Email subject" id={template.id + '-subject'} value={subject} onChange={e => setSubject(e.target.value)} required maxLength={150} />
      <Field label="Message" id={template.id + '-body'}><textarea id={template.id + '-body'} value={body} onChange={e => setBody(e.target.value)} rows={9} maxLength={3000} required /></Field>
      <div className="field-chips"><span className="quiet">Add a field (it is filled in for each patient)</span><div>{TEMPLATE_FIELDS.map(k => <button key={k} type="button" onClick={() => add(k)}>{'{' + k + '}'}</button>)}</div></div>
      <div className="editor-foot"><Button disabled={busy}>Save template</Button><small className="quiet">{body.length} / 3000 characters</small></div>
    </form>
    <section className="email-preview rise" style={{ animationDelay: '.12s' }} aria-label="Email preview">
      <p className="eyebrow">Preview · sample details</p>
      <div className="email-card"><div className="email-head"><small>To: patient@example.com</small><strong>{subject || 'No subject'}</strong></div><div className="email-body"><span className="share-brand">EYECON</span><p>{previewTemplate(body)}</p></div></div>
    </section>
  </div>;
}
