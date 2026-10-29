'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { formatDate, money, serviceName, doctorName, statuses } from '@/lib/config';
import { affiliateRows } from '@/lib/demo';
import { completed } from '@/lib/affiliate';
import { performanceTable, affiliatePerformance, topAffiliates, filterAppointments, staffAppointmentRows, STAFF_APPOINTMENT_FIELDS } from '@/lib/performance';
import { csv } from '@/lib/validation';
import { downloadFile } from '@/lib/calendar';
import { Button, Field, Empty, Icon, Notice } from './ui';
import Calculator from './calculator';
import { AffiliateStats, AffiliateTable, CopyButton, initials } from './affiliate-view';
import { DeskStat } from './desk-view';

// Staff affiliate performance. Everything here includes procedure amounts and is staff-only; the one exception is
// "Preview as affiliate", which renders the affiliate's restricted rows through the same code the affiliate sees.
const href = a => '/admin/affiliates/' + a.slug;
const amount = v => (v == null ? '—' : money(v));

// A column header that sorts the table. aria-sort tells screen readers which column is sorted and how.
function SortHeader({ label, k, sort, setSort }) {
  const active = sort.key === k;
  return <th scope="col" aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
    <button type="button" className="sort-button" onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}>{label}<span aria-hidden="true">{active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span></button>
  </th>;
}

// /admin/affiliates: one row per affiliate (cards on phones), sortable by completed referrals and by commission.
export function AffiliatesTable({ affiliates, bookings, busy, onToggle, onPhoto }) {
  const [sort, setSort] = useState({ key: 'completed', dir: 'desc' });
  if (!affiliates.length) return <Empty text="No affiliates yet." />;
  const rows = performanceTable(affiliates, bookings, sort);
  return <div className="table-wrap performance-table" tabIndex={0} role="region" aria-label="Affiliate performance">
    <table>
      <caption className="sr-only">Affiliate performance. Sorted by {sort.key}, {sort.dir === 'desc' ? 'highest' : 'lowest'} first.</caption>
      <thead><tr>
        <th scope="col">Affiliate</th><th scope="col">Active</th><th scope="col">Bookings</th>
        <SortHeader label="Completed" k="completed" sort={sort} setSort={setSort} />
        <th scope="col">Upcoming</th><th scope="col">Billed</th>
        <SortHeader label="Commission pending" k="pending" sort={sort} setSort={setSort} />
        <SortHeader label="Commission paid" k="paid" sort={sort} setSort={setSort} />
        <th scope="col">Actions</th>
      </tr></thead>
      <tbody>{rows.map(p => { const a = p.affiliate; return <tr key={a.id}>
        <td data-label="Affiliate"><Link className="affiliate-name" href={href(a)}><img src={a.photo} alt="" width="40" height="40" /><span><strong>{a.name}</strong><small>{a.commissionRate}% · /book/{a.slug}</small></span></Link></td>
        <td data-label="Active"><span className={'badge ' + (a.active ? 'attended' : 'cancelled')}>{a.active ? 'Active' : 'Inactive'}</span></td>
        <td data-label="Bookings">{p.total}</td>
        <td data-label="Completed">{p.completed}</td>
        <td data-label="Upcoming">{p.upcoming}</td>
        <td data-label="Billed">{money(p.billed)}</td>
        <td data-label="Commission pending">{money(p.pending)}</td>
        <td data-label="Commission paid">{money(p.paid)}</td>
        <td data-label="Actions"><div className="row-actions">
          <button type="button" className="text-link" disabled={busy} onClick={() => onToggle(a)}>{a.active ? 'Deactivate' : 'Activate'}<span className="sr-only"> {a.name}</span></button>
          <label className="text-link upload-inline">Photo<span className="sr-only"> for {a.name}</span><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f, a); e.target.value = ''; }} /></label>
        </div></td>
      </tr>; })}</tbody>
    </table>
  </div>;
}

// /admin/affiliates: totals, then each affiliate as a card (or the sortable table). Cards carry an Active switch,
// their figures, how many bookings completed, Open performance, Copy link and Photo.
export function AffiliatesView({ affiliates, bookings, busy, origin, onToggle, onPhoto, onCopied }) {
  const [view, setView] = useState('cards'), [query, setQuery] = useState(''), [sort, setSort] = useState('completed');
  const all = performanceTable(affiliates, bookings, { key: sort }), q = query.trim().toLowerCase();
  const rows = all.filter(p => !q || (p.affiliate.name + ' ' + p.affiliate.slug).toLowerCase().includes(q));
  const total = k => all.reduce((s, p) => s + p[k], 0);
  return <>
    <div className="stats stat-cards">
      <DeskStat icon="users" tone="ink" label="Active affiliates" value={affiliates.filter(a => a.active).length} note={'of ' + affiliates.length} delay={0.04} />
      <DeskStat icon="calendar" tone="gold" label="Referral bookings" value={total('total')} note={total('completed') + ' completed · ' + total('upcoming') + ' upcoming'} delay={0.1} />
      <DeskStat icon="trend" tone="green" label="Billed through referrals" value={total('billed')} format={money} note="After discounts" delay={0.16} />
      <DeskStat icon="wallet" tone="dark" dark label="Commission pending" value={total('pending')} format={money} note={money(total('paid')) + ' paid so far'} delay={0.22} />
    </div>
    <div className="list-tools rise">
      <Field label="Search affiliates" id="affiliate-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or page name" />
      <div className="list-tools-right">
        {view === 'cards' && <Field label="Sort by" id="affiliate-sort"><select id="affiliate-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="completed">Completed</option><option value="pending">Commission pending</option><option value="paid">Commission paid</option><option value="billed">Billed</option></select></Field>}
        <div className="segmented" role="group" aria-label="View">{[['cards', 'Cards'], ['table', 'Table']].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
      </div>
    </div>
    {view === 'table' ? <AffiliatesTable affiliates={rows.map(p => p.affiliate)} bookings={bookings} busy={busy} onToggle={onToggle} onPhoto={onPhoto} /> : rows.length ? <div className="affiliate-cards">{rows.map((p, i) => { const a = p.affiliate, rate = p.total ? Math.round(p.completed / p.total * 100) : 0; return <article key={a.id} className={'panel-card affiliate-card rise' + (a.active ? '' : ' inactive')} style={{ animationDelay: (0.26 + i * 0.05) + 's' }}>
      <div className="affiliate-card-top">
        {a.photo ? <img src={a.photo} alt="" width="56" height="56" /> : <span className="avatar big" aria-hidden="true">{initials(a.name)}</span>}
        <div><Link href={href(a)} className="affiliate-card-name">{a.name}</Link><small>{a.commissionRate}% of net · /book/{a.slug}</small></div>
        <button type="button" role="switch" aria-checked={a.active} className="switch" disabled={busy} onClick={() => onToggle(a)}><span className="switch-track"><span /></span>{a.active ? 'Active' : 'Inactive'}<span className="sr-only"> {a.name}</span></button>
      </div>
      <dl className="mini-stats">
        <div><dt>Bookings</dt><dd>{p.total}</dd></div><div><dt>Completed</dt><dd>{p.completed}</dd></div><div><dt>Upcoming</dt><dd>{p.upcoming}</dd></div>
        <div><dt>Billed</dt><dd>{money(p.billed)}</dd></div><div className="tint"><dt>Pending</dt><dd>{money(p.pending)}</dd></div><div><dt>Paid</dt><dd>{money(p.paid)}</dd></div>
      </dl>
      <div className="journey-row"><div>Bookings completed<strong>{rate}%</strong></div><div className="track"><span className="green" style={{ width: rate + '%' }} /></div></div>
      <div className="affiliate-card-actions">
        <Link className="mini-button" href={href(a)}>Open performance<Icon name="arrow" size={14} /></Link>
        <CopyButton text={origin + '/book/' + a.slug} className="mini-button quiet-button" onDone={onCopied} />
        <label className="mini-button quiet-button icon-only" title="Change photo"><Icon name="user" size={16} /><span className="sr-only">Change photo for {a.name}</span><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(f, a); e.target.value = ''; }} /></label>
      </div>
    </article>; })}</div> : <Empty text="No affiliates match your search." />}
  </>;
}

// The staff overview strip: who completed the most referrals this month.
export function TopAffiliates({ affiliates, bookings }) {
  const top = topAffiliates(affiliates, bookings);
  return <section className="top-affiliates" aria-labelledby="top-affiliates-title">
    <div className="section-heading"><h2 id="top-affiliates-title">Top affiliates this month</h2><Link className="text-link" href="/admin/affiliates">All affiliates</Link></div>
    {top.length ? <ol>{top.map((p, i) => <li key={p.affiliate.id}><Link href={href(p.affiliate)}>
      <span className="rank" aria-hidden="true">{i + 1}</span><img src={p.affiliate.photo} alt="" width="44" height="44" />
      <span><strong>{p.affiliate.name}</strong><small>{p.completedThisMonth} completed · {money(p.commissionThisMonth)} commission</small></span>
    </Link></li>)}</ol> : <p className="quiet">No completed referrals yet this month.</p>}
  </section>;
}

// /admin/affiliates/[slug]: the affiliate's figures, their appointments with every staff amount, inline commission
// calculators, filters, CSV, and a read-only preview of exactly what the affiliate sees.
export function AffiliateDetail({ affiliate, data, origin, busy, onComplete }) {
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState({ from: '', to: '', status: 'All' });
  const [open, setOpen] = useState('');
  const own = data.bookings.filter(b => b.affiliateId === affiliate.id).sort((x, y) => new Date(y.start) - new Date(x.start));
  const rows = filterAppointments(own, filter), p = affiliatePerformance(affiliate, data.bookings);
  const set = (k, v) => setFilter(f => ({ ...f, [k]: v }));
  const exportCsv = () => downloadFile(csv(staffAppointmentRows(rows), STAFF_APPOINTMENT_FIELDS), 'eyecon-' + affiliate.slug + '-appointments.csv', 'text/csv');
  const pricing = b => data.procedureCosts?.find(x => x.service === b.service);

  return <div className="affiliate-detail">
    <p><Link className="text-link" href="/admin/affiliates">← All affiliates</Link></p>
    <section className="panel affiliate-hero">
      <img src={affiliate.photo} alt={'Profile photo for ' + affiliate.name} width="72" height="72" />
      <div>
        <h2>{affiliate.name} <span className={'badge ' + (affiliate.active ? 'attended' : 'cancelled')}>{affiliate.active ? 'Active' : 'Inactive'}</span></h2>
        <p className="quiet">{affiliate.email} · {affiliate.commissionRate}% commission on net · {affiliate.commissionNote || 'No written terms recorded.'}</p>
        <p className="link-value">{origin + '/book/' + affiliate.slug}</p>
      </div>
      <div className="toolbar">
        <Button secondary href={'/book/' + affiliate.slug}>Preview page</Button>
        <Button secondary={!preview} aria-pressed={preview} onClick={() => setPreview(v => !v)}>{preview ? 'Back to staff view' : 'Preview as affiliate'}</Button>
      </div>
    </section>

    {preview ? <section className="affiliate-preview" aria-label={'What ' + affiliate.name + ' sees'}>
      <Notice>Preview: exactly what {affiliate.name} sees in their workspace. Read-only.</Notice>
      <AffiliateStats rows={affiliateRows(data.bookings, affiliate.id)} />
      <div className="section-heading"><h2>Referrals</h2></div>
      <AffiliateTable items={affiliateRows(data.bookings, affiliate.id)} title="Referrals (preview)" />
      <div className="section-heading"><h2>Earnings</h2></div>
      <AffiliateTable items={affiliateRows(data.bookings, affiliate.id).filter(completed)} earnings title="Earnings (preview)" />
    </section> : <>
      <div className="stats stats-six">{[['Bookings', p.total], ['Completed', p.completed], ['Upcoming', p.upcoming], ['Billed', money(p.billed)], ['Commission pending', money(p.pending)], ['Commission paid', money(p.paid)]].map(([label, value]) => <article key={label}><p>{label}</p><strong>{value}</strong></article>)}</div>
      <div className="filters">
        <Field label="From" id="appt-from" type="date" value={filter.from} onChange={e => set('from', e.target.value)} />
        <Field label="To" id="appt-to" type="date" value={filter.to} onChange={e => set('to', e.target.value)} />
        <Field label="Status" id="appt-status"><select id="appt-status" value={filter.status} onChange={e => set('status', e.target.value)}>{['All', ...statuses].map(s => <option key={s}>{s}</option>)}</select></Field>
        <button type="button" className="text-link" onClick={() => setFilter({ from: '', to: '', status: 'All' })}>Clear</button>
        <Button secondary onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>
      {rows.length ? <div className="table-wrap appointments-table" tabIndex={0} role="region" aria-label={affiliate.name + ' appointments'}>
        <table>
          <caption className="sr-only">Appointments referred by {affiliate.name}</caption>
          <thead><tr>{['Patient', 'Date', 'Doctor', 'Service', 'Source', 'Status', 'Gross', 'Discount', 'Operation cost', 'Net', 'Commission', 'Payout', ''].map((h, i) => <th scope="col" key={i}>{h || <span className="sr-only">Calculator</span>}</th>)}</tr></thead>
          <tbody>{rows.map(b => { const canCalc = b.status === 'Attended' && b.payout !== 'Paid'; return <Fragment key={b.id}>
            <tr>
              <td data-label="Patient"><strong>{b.name}</strong>{b.reference && <small>{b.reference}</small>}</td>
              <td data-label="Date">{formatDate(b.start)}</td>
              <td data-label="Doctor">{doctorName(b.doctor) || '—'}</td>
              <td data-label="Service">{serviceName(b.service)}</td>
              <td data-label="Source">{b.source}</td>
              <td data-label="Status"><span className={'badge ' + b.status.toLowerCase()}>{b.status}</span></td>
              <td data-label="Gross">{amount(b.grossAmount)}</td>
              <td data-label="Discount">{amount(b.discountAmount)}</td>
              <td data-label="Operation cost">{amount(b.operationCost)}</td>
              <td data-label="Net">{amount(b.netAmount)}</td>
              <td data-label="Commission">{completed(b) ? money(b.commission) : '—'}</td>
              <td data-label="Payout"><span className="badge">{b.payout}</span>{b.paidAt && <small>{formatDate(b.paidAt, { timeStyle: undefined })}</small>}</td>
              <td data-label="Calculator">{canCalc && <button type="button" className="text-link" aria-expanded={open === b.id} aria-controls={'calc-row-' + b.id} onClick={() => setOpen(o => o === b.id ? '' : b.id)}>{open === b.id ? 'Close' : b.grossAmount == null ? 'Calculate' : 'Edit'}<span className="sr-only"> commission for {b.name}</span></button>}{b.payout === 'Paid' && completed(b) && <span className="quiet"><Icon name="check" size={14} /> Locked</span>}</td>
            </tr>
            {canCalc && open === b.id && <tr className="calc-row" id={'calc-row-' + b.id}><td colSpan={13}>
              <Calculator booking={b} affiliate={affiliate} pricing={pricing(b)} busy={busy} onSave={async payload => { if (await onComplete(payload) !== false) setOpen(''); }} />
            </td></tr>}
          </Fragment>; })}</tbody>
        </table>
      </div> : <Empty />}
      <p className="quiet">Billed is gross minus discount on completed referrals. Times in the clinic’s timezone.</p>
    </>}
  </div>;
}
