'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from './provider';
import { DEMO, DOCUMENT_MAX_BYTES, fileSize, documentsLink } from '@/lib/config';
import { validateDocuments } from '@/lib/validation';
import { Button, Field, Icon, Notice } from './ui';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

// "Complete your file": one government ID (required) and the Care Card / Alberta Health Card (optional), sent once
// with the single-use token issued with the booking. canSkip shows "Skip for now" (on the confirmation step); the
// /documents page, reached from the confirmation email, has no skip.
// onState(state) reports 'form', 'done' or 'skipped', so the confirmation can hide its "complete your file" prompt.
export default function DocumentsForm({ token, canSkip = false, onState, skip = false }) {
  const { submitDocuments, documentsLinkValid } = useApp();
  const [valid, setValid] = useState(null);
  const [state, setState] = useState('form');
  const [id, setId] = useState(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const idInput = useRef(null), cardInput = useRef(null), heading = useRef(null);

  useEffect(() => { if (!token) { setValid(false); return; } documentsLinkValid(token).then(setValid).catch(() => setValid(false)); }, [token]);
  useEffect(() => { if (state !== 'form') heading.current?.focus(); onState?.(state); }, [state]);
  // Skipped from the banner at the top of the confirmation.
  useEffect(() => { if (skip) setState('skipped'); }, [skip]);

  async function submit(e) {
    e.preventDefault(); setError('');
    // The file is optional as a whole (it can be skipped), but saving it means adding the ID: that is what it is for.
    if (!id) { setError(canSkip ? 'To save your file, add your government ID. Or choose Skip for now and bring it to your visit.' : 'To save your file, add your government ID. Or bring it to your visit.'); return; }
    const files = [...(id ? [{ file: id, kind: 'government-id' }] : []), ...(card ? [{ file: card, kind: 'health-card' }] : [])];
    try {
      validateDocuments({ files: files.map(({ file, kind }) => ({ name: file.name, size: file.size, type: file.type, kind })) });
      setBusy(true);
      await submitDocuments({ token, residencyStatus: null, files, onProgress: (done, count) => setProgress({ done, count }) });
      setState('done');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); setProgress(null); }
  }

  if (valid === null) return <section className="documents-card" aria-busy="true"><h3>Complete your file</h3><p className="quiet">Checking your link…</p></section>;
  if (!valid && state === 'form') return <section className="documents-card"><h3>Complete your file</h3><Notice>{token ? 'This link has expired or has already been used. Please contact the clinic, or bring your documents to your visit.' : 'Please bring your government ID and any documents to your visit.'}</Notice></section>;
  if (state === 'done') return <section className="documents-card done"><div className="success-mark small"><Icon name="check" size={22} /></div><h3 ref={heading} tabIndex={-1}>Your file is complete</h3><p>Thank you. Only clinic staff can see your documents. To change anything, please contact the clinic.</p>{DEMO && <p className="demo-label">Demo: only the file names and sizes were kept, in this browser. No file was uploaded.</p>}</section>;
  if (state === 'skipped') return <section className="documents-card"><h3 ref={heading} tabIndex={-1}>No problem</h3><p>Please bring your government ID and your Care Card / Alberta Health Card to your visit.</p></section>;

  return <section className="documents-card" id="complete-file" aria-labelledby="documents-title">
    <div className="documents-head"><h3 id="documents-title">Complete your file</h3><small className="documents-fine">Optional · speeds up your check-in</small></div>
    <p className="muted">Add a valid government ID, and your Care Card / Alberta Health Card if you have it. PDF, JPG or PNG, up to {DOCUMENT_MAX_BYTES / 1048576} MB each.</p>
    {DEMO && <p className="demo-label">Demo: only file names and sizes are kept, in this browser. File contents are never stored or sent.</p>}
    <Notice error>{error}</Notice>
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="government-id">Valid government ID <small>Optional, but highly recommended · 1 file</small></label>
        {id
          ? <div className="file-row"><Icon name="check" size={18} /><span>{id.name}<small>{fileSize(id.size)}</small></span><button type="button" className="text-link" onClick={() => { setId(null); if (idInput.current) idInput.current.value = ''; }}>Remove</button></div>
          : <input ref={idInput} id="government-id" type="file" accept={ACCEPT} onChange={e => { setError(''); setId(e.target.files?.[0] || null); }} />}
      </div>
      <div className="field">
        <label htmlFor="health-card">Care Card / Alberta Health Card <small>Optional, 1 file</small></label>
        {card
          ? <div className="file-row"><Icon name="check" size={18} /><span>{card.name}<small>{fileSize(card.size)}</small></span><button type="button" className="text-link" onClick={() => { setCard(null); if (cardInput.current) cardInput.current.value = ''; }}>Remove</button></div>
          : <input ref={cardInput} id="health-card" type="file" accept={ACCEPT} onChange={e => { setError(''); setCard(e.target.files?.[0] || null); }} />}
      </div>
      <p className="privacy-note">Only authorised clinic staff can see these documents. They are never shared with affiliates. Read our <Link href="/privacy">privacy notice</Link>.</p>
      <div className="form-actions">
        {canSkip && <Button type="button" secondary onClick={() => { setError(''); setState('skipped'); }}>Skip for now</Button>}
        <Button type="submit" disabled={busy}>{busy ? (progress ? `Uploading ${progress.done} of ${progress.count}…` : 'Uploading…') : 'Save my file'}</Button>
      </div>
    </form>
  </section>;
}
