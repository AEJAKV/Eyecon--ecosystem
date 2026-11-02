'use client';
import { useState } from 'react';
import { useApp } from './provider';
import Captcha from './captcha';
import { Button, Field, Notice } from './ui';
import { postDate } from './blog-post';
import { DEMO } from '@/lib/config';
import { validateComment, COMMENT_NOTE } from '@/lib/blog';

// Readers' comments on a post: the approved ones, and a form (a first name and the comment). A new comment waits for
// the clinic's approval. Turnstile and a hidden field stop bots; the demo keeps comments in this browser.
export default function BlogComments({ slug, comments }) {
  const { blogComment } = useApp();
  const [name, setName] = useState(''), [body, setBody] = useState(''), [website, setWebsite] = useState(''), [captcha, setCaptcha] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError('');
    try { validateComment({ name, body, website }); } catch (err) { setError(err.message); return; }
    if (!DEMO && !captcha) { setError('Please complete the verification.'); return; }
    setBusy(true);
    try { await blogComment({ slug, name, body, website, captcha }); setSent(true); setName(''); setBody(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="post-comments" aria-labelledby="comments-title">
    <h2 id="comments-title">Comments{comments.length ? ' (' + comments.length + ')' : ''}</h2>
    <p>{COMMENT_NOTE}</p>
    {comments.length > 0 && <ol>{comments.map(c => <li key={c.id}><strong>{c.name}</strong><small>{postDate(c.createdAt)}</small><p>{c.body}</p></li>)}</ol>}
    {sent ? <Notice>Thank you. Your comment will appear once the clinic approves it.</Notice> : <form className="comment-form" onSubmit={submit} noValidate>
      <Field label="Your first name" id="comment-name" value={name} maxLength={40} autoComplete="given-name" onChange={e => setName(e.target.value)} required />
      <Field label="Comment" id="comment-body"><textarea id="comment-body" value={body} maxLength={1000} onChange={e => setBody(e.target.value)} required /></Field>
      <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
      {!DEMO && <Captcha action="comment" onToken={setCaptcha} />}
      <Notice error>{error}</Notice>
      <div><Button disabled={busy}>{busy ? 'Sending…' : 'Post comment'}</Button></div>
    </form>}
  </section>;
}
