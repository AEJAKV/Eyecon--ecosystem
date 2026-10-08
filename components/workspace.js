'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './provider';
import { Logo, Button, Field, Notice, Loading, Modal, Icon } from './ui';
import { DEMO, services, statuses, sources, clinic, formatDate, money, serviceName } from '@/lib/config';
import { affiliateRows } from '@/lib/demo';
import { csv, validateBooking, validateSlug, slotTaken } from '@/lib/validation';
import { downloadFile } from '@/lib/calendar';

const affiliateNav = [['', 'Overview'], ['referrals', 'Referrals'], ['link', 'My link & QR'], ['earnings', 'Earnings'], ['profile', 'Profile']];
const staffNav = [['', 'Bookings'], ['affiliates', 'Affiliates'], ['leads', 'Leads'], ['payouts', 'Payouts'], ['messages', 'Messages']];

// A referral can be marked as paid once the visit happened and staff approved a commission.
const payable = b => b.status === 'Attended' && b.commission > 0 && b.payout === 'Pending';
const sum = items => items.reduce((s, b) => s + b.commission, 0);
const slugify = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

async function qrImage(url, options) { const m = await import('qrcode'); return (m.default || m).toDataURL(url, options); }
async function downloadQR(url, slug) {
  const a = document.createElement('a');
  a.href = await qrImage(url, { width: 1000, margin: 3 });
  a.download = 'eyecon-' + slug + '-qr.png';
  a.click();
}

function QR({ url }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    qrImage(url, { width: 440, margin: 2, color: { dark: '#14181d', light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(s => { if (active) setImage(s); });
    return () => { active = false; };
  }, [url]);
  return image
    ? <img className="qr" src={image} width="150" height="150" alt="QR code linking to this affiliate’s booking page" />
    : <div className="qr" aria-label="Generating QR code" />;
}

function Empty({ text = 'No records match your filters.' }) {
  return <div className="empty-state"><Icon name="calendar" size={32} /><h3>{text}</h3><p>Your next update will appear here.</p></div>;
}

function Stat({ label, value, note }) {
  return <article><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

export default function Workspace({ role, section = '' }) {
  const app = useApp(), { data, user, ready, error: loadError, action, signOut, photo } = app, router = useRouter();
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [modal, setModal] = useState(''), [selected, setSelected] = useState([]), [query, setQuery] = useState(''), [status, setStatus] = useState('All'), [source, setSource] = useState('All'), [date, setDate] = useState(''), [view, setView] = useState('list'), [month, setMonth] = useState(new Date()), [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false), [created, setCreated] = useState(null);
  const [origin, setOrigin] = useState(clinic.site);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => { if (ready && !user && !loadError) router.replace('/login'); }, [ready, user, loadError, router]);
  // Leaving a screen closes the add-affiliate form and clears its notices.
  useEffect(() => { setAdding(false); setCreated(null); setError(''); setMessage(''); }, [section]);

  const staff = role === 'staff';
  const nav = staff ? staffNav : affiliateNav;
  const own = data.affiliates.find(a => a.id === user?.affiliateId);
  const rows = role === 'affiliate' ? affiliateRows(data.bookings, user?.affiliateId) : data.bookings;
  const activeTitle = nav.find(n => n[0] === section)?.[1] || 'Overview';
  const dayKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
  const filtered = rows.filter(b => (!query || b.name.toLowerCase().includes(query.toLowerCase())) && (status === 'All' || b.status === status) && (source === 'All' || b.source === source) && (!date || dayKey(b.start) === date));
  const payoutRows = rows.filter(b => b.affiliateId);
  const eligible = payoutRows.filter(payable);
  const chosen = eligible.filter(b => selected.includes(b.id));
  const total = sum(chosen);

  async function run(fn, success = 'Saved successfully.') { setBusy(true); setError(''); setMessage(''); try { const result = await fn(); setMessage(success); return result; } catch (e) { setError(e.message); return false; } finally { setBusy(false); } }
  async function save(act, payload, success) { const result = await run(() => action(act, payload), success); if (result !== false) setModal(''); return result; }
  function exportRows(exported = filtered) { const fields = staff ? ['name', 'email', 'phone', 'start', 'service', 'source', 'status', 'commission', 'payout'] : ['name', 'start', 'status', 'commission', 'payout']; downloadFile(csv(exported, fields), 'eyecon-' + (section || 'bookings') + '.csv', 'text/csv'); setMessage('Your CSV download is ready.'); }
  async function createAffiliate(p) {
    try { validateSlug(p.slug); } catch (e) { setMessage(''); setError(e.message); return false; }
    const result = await run(() => action('affiliate', p), DEMO ? 'Affiliate created with a referral link and QR code.' : 'Affiliate created. An invitation email has been requested.');
    if (result !== false) setCreated(p);
    return result;
  }
  const copyLink = url => run(() => navigator.clipboard.writeText(url), 'Referral link copied.');
  const saveQR = (url, slug) => run(() => downloadQR(url, slug), 'QR download ready.');

  if (!ready) return <Loading />;
  if (loadError) return <main className="container empty-page"><h1>Workspace unavailable</h1><Notice error>{loadError}</Notice><Button href="/login">Return to sign-in</Button></main>;
  if (!user) return <Loading />;
  if (user.role !== role) return <main className="container empty-page"><h1>This workspace needs a different account</h1><Button href={user.role === 'staff' ? '/admin' : '/affiliate'}>Open your workspace</Button></main>;

  const referralUrl = origin + '/book/' + own?.slug;
  const showAdd = staff && section === 'affiliates' && adding;

  /* One table for every list. Staff see the full booking; affiliates see a lead’s name and status only,
     plus the commission and payment on their earnings page. They never see the appointment type. */
  function table(items, earnings = false) {
    if (!items.length) return <Empty />;
    const payouts = section === 'payouts';
    return (
      <div className={'table-wrap' + (!staff && !earnings ? ' compact' : '')} tabIndex={0} role="region" aria-label={activeTitle + ' table'}>
        <table>
          <caption className="sr-only">{activeTitle}</caption>
          <thead>
            <tr>
              {payouts && <th scope="col" className="cell-check"><input type="checkbox" aria-label="Select every referral that is ready to pay" disabled={!eligible.length || busy} checked={eligible.length > 0 && chosen.length === eligible.length} onChange={e => setSelected(e.target.checked ? eligible.map(b => b.id) : [])} /></th>}
              <th scope="col">{staff ? 'Patient' : 'Name'}</th>
              {staff && <th scope="col">{earnings ? 'Appointment' : 'Date & time'}</th>}
              {staff && <th scope="col">Source</th>}
              <th scope="col">Status</th>
              {earnings && <><th scope="col">Commission</th><th scope="col">Payment</th></>}
              {staff && !earnings && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(b => {
              const canPay = payable(b);
              return (
                <tr key={b.id} className={payouts && selected.includes(b.id) && canPay ? 'is-selected' : undefined}>
                  {payouts && <td className="cell-check"><input aria-label={'Select referral for ' + b.name} type="checkbox" disabled={!canPay} checked={canPay && selected.includes(b.id)} onChange={e => setSelected(s => e.target.checked ? [...s, b.id] : s.filter(id => id !== b.id))} /></td>}
                  <td className="cell-primary">
                    <strong>{b.name}</strong>
                    {staff && b.affiliateId && <small>{data.affiliates.find(a => a.id === b.affiliateId)?.name || 'Affiliate'}</small>}
                  </td>
                  {staff && <td data-label={earnings ? 'Appointment' : 'Date & time'}>{formatDate(b.start)}<small>{serviceName(b.service)}</small></td>}
                  {staff && <td data-label="Source">{b.source}</td>}
                  <td data-label="Status">
                    {staff && !earnings
                      ? <select aria-label={'Status for ' + b.name} value={b.status} disabled={busy} onChange={e => run(() => action('status', { id: b.id, status: e.target.value }), 'Attendance updated.')}><option>{b.status}</option>{statuses.filter(s => s !== b.status).map(s => <option key={s}>{s}</option>)}</select>
                      : <span className={'badge ' + b.status.toLowerCase()}>{b.status}</span>}
                  </td>
                  {earnings && <>
                    <td data-label="Commission">
                      {staff && payouts && b.payout !== 'Paid'
                        ? <form className="commission-form" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); run(() => action('commission', { id: b.id, amount: Number(form.get('amount')) }), 'Commission approved.'); }}>
                            <input type="number" name="amount" aria-label={'Commission for ' + b.name} min="0" max="100000" step="0.01" defaultValue={b.commission} disabled={b.status !== 'Attended' || !b.affiliateId} />
                            <button className="text-link" disabled={busy || b.status !== 'Attended' || !b.affiliateId}>Save</button>
                          </form>
                        : money(b.commission)}
                    </td>
                    <td data-label="Payment">
                      <span className={'badge ' + b.payout.toLowerCase()}>{b.payout}</span>
                      {b.paidAt && <small>{formatDate(b.paidAt, { timeStyle: undefined })}</small>}
                      {payouts && b.payout !== 'Paid' && <small>{canPay ? 'Ready to mark as paid' : b.status !== 'Attended' ? 'Waiting for the visit' : 'Enter a commission first'}</small>}
                    </td>
                  </>}
                  {staff && !earnings && <td data-label="Actions"><button className="text-link" onClick={() => { setDetail(b); setModal('detail'); }}>Details</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-top"><Logo /><p className="workspace-label">{staff ? 'Clinic workspace' : 'Affiliate workspace'}</p></div>
        <nav aria-label="Workspace navigation">
          {nav.map(([path, label]) => <Link key={path} href={'/' + (staff ? 'admin' : 'affiliate') + (path ? '/' + path : '')} aria-current={path === section ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">View website</Link>
          <button onClick={() => run(async () => { await signOut(); router.push('/login'); }, 'Signed out.')}>Sign out</button>
        </div>
      </aside>

      <main className="workspace-main" id="main-content">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{DEMO ? 'Demo workspace' : 'Eyecon workspace'}</p>
            <h1>{showAdd ? 'Add affiliate' : role === 'affiliate' && !section ? 'Good morning, ' + (own?.name.split(' ')[0] || 'there') : activeTitle}</h1>
          </div>
          <div className="toolbar">
            {staff && (!section || section === 'leads') && <><Button secondary onClick={() => setModal('slot')}>Add available time</Button><Button onClick={() => setModal('booking')}>New booking</Button></>}
            {staff && section === 'affiliates' && (adding
              ? <Button secondary onClick={() => { setAdding(false); setCreated(null); }}>All affiliates</Button>
              : <Button onClick={() => { setAdding(true); setCreated(null); setError(''); setMessage(''); }}>Add affiliate</Button>)}
            {(section === 'referrals' || section === 'earnings' || section === 'leads') && <Button secondary onClick={() => exportRows()}>Export CSV</Button>}
          </div>
        </header>
        <Notice error>{error}</Notice>
        <Notice>{message}</Notice>

        {role === 'affiliate' && !section && <>
          <div className="stats">
            <Stat label="Bookings this month" value={rows.filter(b => { let d = new Date(b.start), now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} />
            <Stat label="Completed visits" value={rows.filter(b => b.status === 'Attended').length} />
            <Stat label="Pending commission" value={money(sum(rows.filter(b => b.payout === 'Pending')))} />
            <Stat label="Paid" value={money(sum(rows.filter(b => b.payout === 'Paid')))} />
          </div>
          <p className="quiet">{own?.commissionNote || 'Commission terms will be confirmed by the clinic.'}</p>
          <section className="referral-panel on-ink">
            <div>
              <p className="eyebrow">Share it anywhere</p>
              <h2>Your personal referral link</h2>
              <p className="link-value">{referralUrl}</p>
              <div className="toolbar">
                <Button onClick={() => copyLink(referralUrl)}>Copy link</Button>
                <Button secondary href="/affiliate/link">View QR code</Button>
              </div>
            </div>
            <QR url={referralUrl} />
          </section>
          <div className="section-heading"><h2>Recent referrals</h2><Link className="text-link" href="/affiliate/referrals">View all</Link></div>
          {table(rows.slice(0, 5))}
        </>}

        {((staff && (!section || section === 'leads')) || section === 'referrals') && <>
          <div className="filters">
            <Field label={staff ? 'Search patients' : 'Search by name'} id="search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name" />
            <Field label="Status" id="status"><select id="status" value={status} onChange={e => setStatus(e.target.value)}>{['All', ...statuses].map(s => <option key={s}>{s}</option>)}</select></Field>
            {staff && <Field label="Source" id="source"><select id="source" value={source} onChange={e => setSource(e.target.value)}>{['All', ...sources].map(s => <option key={s}>{s}</option>)}</select></Field>}
            <Field label="Date" id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <button className="text-link" onClick={() => { setQuery(''); setStatus('All'); setSource('All'); setDate(''); }}>Clear</button>
          </div>
          {staff && !section && <div className="view-tabs">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
            <small>Times in {clinic.timezone}</small>
          </div>}
          {view === 'calendar' && staff && !section
            ? <>
                <div className="calendar-heading">
                  <button className="button secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous month</button>
                  <h2>{month.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}</h2>
                  <button className="button secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next month</button>
                </div>
                <div className="month-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <strong key={d}>{d}</strong>)}
                  {Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, i) => <span key={'pad' + i} />)}
                  {Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => {
                    const key = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0') + '-' + String(i + 1).padStart(2, '0');
                    const count = rows.filter(b => dayKey(b.start) === key).length;
                    return <button key={key} className={count > 0 ? 'has-bookings' : undefined} onClick={() => { setDate(key); setView('list'); }} aria-label={key + ', ' + count + ' bookings'}><span>{i + 1}</span>{count > 0 && <small>{count} <i>bookings</i></small>}</button>;
                  })}
                </div>
              </>
            : table(filtered)}
        </>}

        {section === 'link' && own && <section className="panel link-page">
          <div>
            <p className="eyebrow">Your personal introduction</p>
            <h2>One link. A warm welcome.</h2>
            <p>Share your link or QR code so each appointment connects back to your referral.</p>
            <Field label="Your referral link" id="referral-url" readOnly value={referralUrl} />
            <div className="toolbar">
              <Button onClick={() => copyLink(referralUrl)}>Copy link</Button>
              <Button secondary onClick={() => saveQR(referralUrl, own.slug)}>Download QR</Button>
              <Button secondary href={'mailto:?subject=' + encodeURIComponent('Your introduction to Eyecon') + '&body=' + encodeURIComponent('Book your Eyecon appointment through my personal link: ' + referralUrl)}>Email link</Button>
              <Button secondary href={'/book/' + own.slug}>Preview my page</Button>
            </div>
          </div>
          <QR url={referralUrl} />
        </section>}

        {section === 'earnings' && <>
          <div className="stats">
            <Stat label="Pending commission" value={money(sum(rows.filter(b => b.payout !== 'Paid')))} />
            <Stat label="Paid commission" value={money(sum(rows.filter(b => b.payout === 'Paid')))} />
          </div>
          <p className="quiet">Amounts reflect commission approved by clinic staff.</p>
          {table(rows.filter(b => b.commission > 0), true)}
        </>}

        {section === 'profile' && own && <Profile affiliate={own} busy={busy} onSave={p => save('profile', p)} onPhoto={file => run(() => photo(file, own.id), 'Photo updated.')} />}

        {showAdd && <AddAffiliate origin={origin} busy={busy} created={created} onCreate={createAffiliate} onCopy={copyLink} onDownload={saveQR} onAnother={() => { setCreated(null); setError(''); setMessage(''); }} onDone={() => { setAdding(false); setCreated(null); }} />}

        {section === 'affiliates' && !showAdd && <div className="affiliate-grid">
          {data.affiliates.map(a => <article className="panel affiliate-card" key={a.id}>
            <div className="affiliate-card-header">
              <img src={a.photo} alt={'Profile photo for ' + a.name} width="60" height="60" />
              <div><h2>{a.name}</h2><p>{a.email}</p></div>
              <span className={'badge ' + (a.active ? 'active' : 'inactive')}>{a.active ? 'Active' : 'Inactive'}</span>
            </div>
            <p>{a.bio || 'No biography added yet.'}</p>
            <div className="affiliate-link"><span>{origin + '/book/' + a.slug}</span><QR url={origin + '/book/' + a.slug} /></div>
            <p className="quiet">{a.commissionRate}% reference rate. {a.commissionNote || 'Commission approved manually.'}</p>
            <div className="toolbar">
              <Button secondary href={'/book/' + a.slug}>Preview page</Button>
              <Button secondary disabled={busy} onClick={() => run(() => action('toggle-affiliate', { id: a.id }), a.active ? 'Affiliate deactivated.' : 'Affiliate activated.')}>{a.active ? 'Deactivate' : 'Activate'}</Button>
            </div>
            <label className="upload-label">Update profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > 2097152) setError('Use an image smaller than 2 MB.'); else run(() => photo(f, a.id), 'Photo updated.'); } }} /></label>
          </article>)}
        </div>}

        {section === 'payouts' && <>
          <div className="stats">
            <Stat label="Ready to pay" value={money(sum(eligible))} note={eligible.length + (eligible.length === 1 ? ' referral' : ' referrals')} />
            <Stat label="Waiting for a commission" value={payoutRows.filter(b => b.status === 'Attended' && !(b.commission > 0) && b.payout !== 'Paid').length} note="Attended, no amount entered yet" />
            <Stat label="Paid to date" value={money(sum(payoutRows.filter(b => b.payout === 'Paid')))} />
          </div>
          <ol className="steps">
            <li><strong>Approve the commission</strong><span>Enter an amount for each attended referral and save it.</span></li>
            <li><strong>Tick what you have paid</strong><span>Select the referrals you have already paid outside this system.</span></li>
            <li><strong>Mark selected as paid</strong><span>The affiliate’s earnings update straight away.</span></li>
          </ol>
          <Notice>Recording a payout updates the ledger. It does not transfer money.</Notice>
          {table(payoutRows, true)}
          <div className="selection-bar on-ink" role="region" aria-label="Selected payouts">
            <p aria-live="polite">{chosen.length ? <><strong>{chosen.length} selected</strong> · {money(total)}</> : 'Tick the referrals you have paid.'}</p>
            {chosen.length < eligible.length && <button className="text-link" onClick={() => setSelected(eligible.map(b => b.id))}>Select all ready ({eligible.length})</button>}
            {chosen.length > 0 && <button className="text-link" onClick={() => setSelected([])}>Clear</button>}
            <Button disabled={!chosen.length || busy} onClick={() => setModal('payout')}>Mark selected as paid</Button>
          </div>
        </>}

        {section === 'messages' && <>
          <p className="muted">Plain-text templates. Available fields: {'{name}, {date}, {address}, {phone}, {instructions}, {gift}'}.</p>
          <div className="template-grid">{data.templates.map(t => <Template key={t.id} template={t} busy={busy} onSave={p => save('template', p)} />)}</div>
          {!DEMO && <section className="panel">
            <h2>Recent delivery activity</h2>
            {data.jobs?.length ? <ul className="delivery-list">{data.jobs.map((j, i) => <li key={i}><strong>{j.kind}</strong><span>{j.status}</span><small>{JSON.stringify(j.result)}</small></li>)}</ul> : <p>No message delivery activity yet.</p>}
          </section>}
        </>}
      </main>

      <Modal open={!!modal} title={{ booking: 'New manual booking', slot: 'Add available appointment time', payout: 'Mark selected as paid', detail: 'Booking details' }[modal] || ''} onClose={() => setModal('')}>
        <Notice error>{error}</Notice>
        {modal === 'booking' && <ManualForm affiliates={data.affiliates} slots={data.slots.filter(s => new Date(s.start) > new Date() && !slotTaken(s, data.bookings))} busy={busy} onSave={p => { try { return save('booking', validateBooking(p, true), 'Manual booking saved.'); } catch (e) { setError(e.message); } }} />}
        {modal === 'slot' && <form className="stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const d = new Date(f.get('start')); save('slot', { start: d.toISOString(), duration: Number(f.get('duration')) }, 'Appointment time added.'); }}>
          <Field label="Start time (your browser’s local timezone)" id="slot-start" name="start" type="datetime-local" required />
          <Field label="Duration" id="duration"><select id="duration" name="duration">{[15, 30, 45, 60, 90].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></Field>
          <p className="quiet">Add only times the clinic can honour. This calendar is independent of MyVisionExpress.</p>
          <Button disabled={busy}>Add time</Button>
        </form>}
        {modal === 'payout' && <div className="stack">
          <p>Mark {chosen.length} {chosen.length === 1 ? 'referral' : 'referrals'} as paid, totalling <strong>{money(total)}</strong>?</p>
          <p>This records an external payment as paid and updates the affiliate’s earnings.</p>
          <div className="toolbar">
            <Button disabled={busy || !chosen.length} onClick={async () => { const result = await save('payout', { ids: chosen.map(b => b.id) }, 'Payout recorded.'); if (result !== false) setSelected([]); }}>Confirm paid</Button>
            <Button secondary onClick={() => setModal('')}>Cancel</Button>
          </div>
        </div>}
        {modal === 'detail' && detail && <div className="booking-details"><dl>{[['Patient', detail.name], ['Email', detail.email], ['Phone', detail.phone], ['Appointment', serviceName(detail.service)], ['Time', formatDate(detail.start)], ['Source', detail.source], ['Insurance company', detail.insurance || 'Not provided'], ['Policy number', detail.policy || 'Not provided'], ['Favourite brands', detail.brands || 'Not provided'], ['SMS consent', detail.smsConsent ? 'Yes' : 'No']].map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></div>}
      </Modal>
    </div>
  );
}

/* Staff add an affiliate on its own screen. The QR code replaces the placeholder the moment the affiliate is created. */
function AddAffiliate({ origin, busy, created, onCreate, onCopy, onDownload, onAnother, onDone }) {
  const [name, setName] = useState(''), [slug, setSlug] = useState(''), [edited, setEdited] = useState(false);
  const heading = useRef(null);
  useEffect(() => { if (created) heading.current?.focus(); }, [created]);

  if (created) {
    const url = origin + '/book/' + created.slug;
    return (
      <section className="add-affiliate created">
        <div className="panel stack">
          <p className="eyebrow">Affiliate created</p>
          <h2 tabIndex={-1} ref={heading}>{created.name} is ready to refer.</h2>
          <p>Their booking page and QR code are live now. {DEMO ? 'No invitation email is sent in the demo.' : 'An invitation email is on its way so they can set a password and sign in.'}</p>
          <Field label="Referral link" id="created-url" readOnly value={url} />
          <div className="toolbar">
            <Button onClick={() => onCopy(url)}>Copy link</Button>
            <Button secondary onClick={() => onDownload(url, created.slug)}>Download QR</Button>
            <Button secondary href={'/book/' + created.slug}>Preview page</Button>
          </div>
          <p className="quiet">Add a profile photo from their card in the affiliates list.</p>
          <div className="toolbar next">
            <button className="text-link" onClick={() => { setName(''); setSlug(''); setEdited(false); onAnother(); }}>Add another affiliate</button>
            <button className="text-link" onClick={onDone}>Back to all affiliates</button>
          </div>
        </div>
        <aside className="qr-card on-ink">
          <p className="eyebrow">Scan to book</p>
          <QR url={url} />
          <p className="link-value">{url}</p>
        </aside>
      </section>
    );
  }

  return (
    <section className="add-affiliate">
      <form className="panel stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onCreate({ name: f.get('name'), email: f.get('email'), slug: f.get('slug'), bio: f.get('bio'), commissionRate: Number(f.get('rate')), commissionNote: f.get('note') }); }}>
        <div>
          <h2>Who are you adding?</h2>
          <p className="muted">Creating an affiliate gives them a personal booking page, a QR code and a sign-in.</p>
        </div>
        <div className="form-grid">
          <Field label="Full name" id="affiliate-name" name="name" required maxLength={120} value={name} onChange={e => { setName(e.target.value); if (!edited) setSlug(slugify(e.target.value)); }} />
          <Field label="Email address" id="affiliate-email" name="email" type="email" required />
        </div>
        <Field label="Referral page name" id="affiliate-slug" name="slug" placeholder="alex-morgan" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={70} hint="Lowercase letters, numbers and hyphens. This becomes their link and QR code." value={slug} onChange={e => { setSlug(e.target.value); setEdited(true); }} />
        <Field label="Short introduction" id="affiliate-bio"><textarea id="affiliate-bio" name="bio" rows={3} maxLength={500} /></Field>
        <div className="form-grid">
          <Field label="Reference commission rate (%)" id="affiliate-rate" name="rate" type="number" defaultValue="0" min="0" max="100" step="0.01" />
          <Field label="Commission terms" id="affiliate-note" name="note" defaultValue="Terms awaiting approval" maxLength={300} />
        </div>
        <p className="quiet">The rate is informational. Staff enter approved commission amounts after attendance. Upload a profile photo after creating the affiliate.</p>
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create affiliate'}</Button>
      </form>
      <aside className="qr-card on-ink">
        <p className="eyebrow">Referral link</p>
        <div className="qr-placeholder"><Icon name="scan" size={34} /><span>The QR code appears here as soon as you create the affiliate.</span></div>
        <p className="link-value">{origin}/book/{slug || 'page-name'}</p>
      </aside>
    </section>
  );
}

function Profile({ affiliate, busy, onSave, onPhoto }) {
  return (
    <form className="panel stack narrow-panel" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: affiliate.id, name: f.get('name'), bio: f.get('bio') }); }}>
      <div className="profile-image">
        <img src={affiliate.photo} width="100" height="100" alt="Your affiliate profile photo" />
        <label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 2097152) onPhoto(f); }} /><small>JPG, PNG or WebP. Maximum 2 MB.</small></label>
      </div>
      <Field label="Display name" id="profile-name" name="name" defaultValue={affiliate.name} required maxLength={120} />
      <Field label="Short introduction" id="profile-bio"><textarea id="profile-bio" name="bio" defaultValue={affiliate.bio} maxLength={500} rows={5} /></Field>
      <Button disabled={busy}>Save profile</Button>
    </form>
  );
}

function Template({ template, busy, onSave }) {
  return (
    <form className="panel stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: template.id, subject: f.get('subject'), body: f.get('body') }); }}>
      <h2>{template.id.replaceAll('-', ' ')}</h2>
      <Field label="Email subject" id={template.id + '-subject'} name="subject" defaultValue={template.subject} required maxLength={150} />
      <Field label="Message" id={template.id + '-body'}><textarea id={template.id + '-body'} name="body" defaultValue={template.body} rows={6} maxLength={3000} required /></Field>
      <Button disabled={busy}>Save template</Button>
    </form>
  );
}

function ManualForm({ affiliates, slots, busy, onSave }) {
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), service: f.get('service'), start: f.get('start'), source: f.get('source'), affiliateId: f.get('affiliateId') || null, firstVisit: f.get('firstVisit') === 'yes', smsConsent: f.get('sms') === 'on' }); }}>
      <div className="form-grid">
        <Field label="Patient name" id="manual-name" name="name" required />
        <Field label="Email" id="manual-email" name="email" type="email" required />
        <Field label="Mobile number" id="manual-phone" name="phone" type="tel" required />
        <Field label="Source" id="manual-source"><select name="source" id="manual-source">{['Phone', 'Walk-in', 'Direct'].map(s => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Credit an affiliate" id="manual-affiliate"><select id="manual-affiliate" name="affiliateId"><option value="">No affiliate</option>{affiliates.filter(a => a.active).map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></Field>
      <Field label="Appointment type" id="manual-service"><select id="manual-service" name="service">{services.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Available time" id="manual-start"><select id="manual-start" name="start" required><option value="">Choose a time</option>{slots.map(s => <option value={s.start} key={s.start}>{formatDate(s.start)}</option>)}</select></Field>
      <Field label="First visit?" id="manual-first"><select id="manual-first" name="firstVisit"><option value="yes">Yes</option><option value="no">No</option></select></Field>
      <label className="checkbox-label"><input type="checkbox" name="sms" /><span>The patient agreed to SMS reminders.</span></label>
      <Button disabled={busy || !slots.length}>Save manual booking</Button>
    </form>
  );
}
