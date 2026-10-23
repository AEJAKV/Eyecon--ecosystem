'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from './provider';
import { DEMO, residencyStatuses, documentKinds, DOCUMENT_MAX_FILES, DOCUMENT_MAX_BYTES, fileSize, documentsLink } from '@/lib/config';
import { validateDocuments } from '@/lib/validation';
import { Button, Field, Icon, Notice } from './ui';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const extraKinds = documentKinds.filter(k => k.id !== 'government-id');

// "Complete your file": residency status, one government ID and optional tagged documents, sent once with the
// single-use token issued with the booking. canSkip shows "Skip for now" (on the confirmation step); the
// /documents page, reached from the confirmation email, has no skip.
export default function DocumentsForm({ token, canSkip = false }) {
  const { submitDocuments, documentsLinkValid } = useApp();
  const [valid, setValid] = useState(null);
  const [state, setState] = useState('form');
  const [residency, setResidency] = useState('');
  const [id, setId] = useState(null);
  const [extras, setExtras] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const idInput = useRef(null), extraInput = useRef(null), heading = useRef(null);

  useEffect(() => { if (!token) { setValid(false); return; } documentsLinkValid(token).then(setValid).catch(() => setValid(false)); }, [token]);
  useEffect(() => { if (state !== 'form') heading.current?.focus(); }, [state]);

  const total = (id ? 1 : 0) + extras.length;
  function addExtras(list) {
    setError('');
    const room = DOCUMENT_MAX_FILES - total, added = [...list].slice(0, Math.max(0, room)).map(file => ({ key: crypto.randomUUID(), file, kind: '' }));
    if (list.length > room) setError(`You can add up to ${DOCUMENT_MAX_FILES} files in total.`);
    setExtras(x => [...x, ...added]);
    if (extraInput.current) extraInput.current.value = '';
  }
  async function submit(e) {
    e.preventDefault(); setError('');
    const files = [...(id ? [{ file: id, kind: 'government-id' }] : []), ...extras.map(({ file, kind }) => ({ file, kind }))];
    try {
      validateDocuments({ residencyStatus: residency, files: files.map(({ file, kind }) => ({ name: file.name, size: file.size, type: file.type, kind })) });
      setBusy(true);
      await submitDocuments({ token, residencyStatus: residency, files, onProgress: (done, count) => setProgress({ done, count }) });
      setState('done');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); setProgress(null); }
  }

  if (valid === null) return <section className="documents-card" aria-busy="true"><h3>Complete your file</h3><p className="quiet">Checking your link…</p></section>;
  if (!valid && state === 'form') return <section className="documents-card"><h3>Complete your file</h3><Notice>{token ? 'This link has expired or has already been used. Please contact the clinic, or bring your documents to your visit.' : 'Please bring your government ID and any documents to your visit.'}</Notice></section>;
  if (state === 'done') return <section className="documents-card done"><div className="success-mark small"><Icon name="check" size={22} /></div><h3 ref={heading} tabIndex={-1}>Your file is complete</h3><p>Thank you. Only clinic staff can see your documents. To change anything, please contact the clinic.</p>{DEMO && <p className="demo-label">Demo: only the file names and sizes were kept, in this browser. No file was uploaded.</p>}</section>;
  if (state === 'skipped') return <section className="documents-card"><h3 ref={heading} tabIndex={-1}>Finish your file later</h3><p>{DEMO ? 'In live mode, your confirmation email has a link to finish this before your visit.' : 'Your confirmation email has a link to finish this before your visit. The link works once.'}</p>{DEMO && <p className="demo-label">Demo link: <Link href={'/documents#t=' + token}>{documentsLink(token, '')}</Link></p>}<Button secondary onClick={() => setState('form')}>Complete it now</Button></section>;

  return <section className="documents-card" aria-labelledby="documents-title">
    <h3 id="documents-title">Complete your file</h3>
    <p className="muted">Add your residency status and a valid government ID. PDF, JPG or PNG, up to {DOCUMENT_MAX_BYTES / 1048576} MB each and {DOCUMENT_MAX_FILES} files in total.</p>
    {DEMO && <p className="demo-label">Demo: only file names and sizes are kept, in this browser. File contents are never stored or sent.</p>}
    <Notice error>{error}</Notice>
    <form className="stack" onSubmit={submit} noValidate>
      <Field label="Residency status" id="residency-status">
        <select id="residency-status" required value={residency} onChange={e => setResidency(e.target.value)}>
          <option value="">Choose your status</option>
          {residencyStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="field">
        <label htmlFor="government-id">Valid government ID <small>Required, 1 file</small></label>
        {id
          ? <div className="file-row"><Icon name="check" size={18} /><span>{id.name}<small>{fileSize(id.size)}</small></span><button type="button" className="text-link" onClick={() => { setId(null); if (idInput.current) idInput.current.value = ''; }}>Remove</button></div>
          : <input ref={idInput} id="government-id" type="file" accept={ACCEPT} required onChange={e => { setError(''); const f = e.target.files?.[0]; if (f && total >= DOCUMENT_MAX_FILES) setError(`You can add up to ${DOCUMENT_MAX_FILES} files in total.`); else setId(f || null); }} />}
      </div>
      <fieldset className="choice-field documents-extra">
        <legend>Additional documents <small>Optional</small></legend>
        {extras.map((x, i) => <div className="file-row" key={x.key}>
          <span>{x.file.name}<small>{fileSize(x.file.size)}</small></span>
          <label className="sr-only" htmlFor={'kind-' + x.key}>What is {x.file.name}?</label>
          <select id={'kind-' + x.key} required value={x.kind} onChange={e => setExtras(list => list.map((y, j) => j === i ? { ...y, kind: e.target.value } : y))}>
            <option value="">What is this?</option>
            {extraKinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <button type="button" className="text-link" onClick={() => setExtras(list => list.filter((_, j) => j !== i))}>Remove<span className="sr-only"> {x.file.name}</span></button>
        </div>)}
        {total < DOCUMENT_MAX_FILES && <label className="upload-label">Add documents<input ref={extraInput} type="file" accept={ACCEPT} multiple onChange={e => addExtras(e.target.files || [])} /></label>}
        <p className="quiet">Tag each as a diploma, certificate, high school diploma, English language test result or other. {total} of {DOCUMENT_MAX_FILES} files.</p>
      </fieldset>
      <p className="privacy-note">Only authorised clinic staff can see these documents. They are never shared with affiliates. Read our <Link href="/privacy">privacy notice</Link>.</p>
      <div className="form-actions">
        {canSkip && <Button type="button" secondary onClick={() => { setError(''); setState('skipped'); }}>Skip for now</Button>}
        <Button type="submit" disabled={busy}>{busy ? (progress ? `Uploading ${progress.done} of ${progress.count}…` : 'Uploading…') : 'Save my file'}</Button>
      </div>
    </form>
  </section>;
}
