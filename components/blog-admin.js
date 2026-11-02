'use client';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './provider';
import { Button, Notice, Icon, Empty, Loading } from './ui';
import { PostArticle } from './blog-post';
import { DEMO, clinic, formatDate } from '@/lib/config';
import { workspacePath } from '@/lib/front-desk';
import * as B from '@/lib/blog';

// The workspace blog (/affiliate/blog, /desk/blog, /admin/blog): each author's posts and the block editor; for staff
// admin also the review queue and readers' comments. The rules (who may edit, submit or publish) are in lib/blog.js
// and are checked again by the server.
const ROLE_NAMES = { affiliate: 'Affiliate', 'front-desk': 'Front desk', staff: 'Staff admin' };
const TONES = { published: 'attended', scheduled: 'attended', review: 'pending', changes: 'no-show', rejected: 'no-show', draft: 'neutral' };
const shortDate = iso => iso ? formatDate(iso, { dateStyle: 'medium', timeStyle: undefined }) : '';
// A picture's address: a signed link for a draft picture (live), or the stored picture itself (demo).
const srcFor = (images, key) => !key ? '' : images[key] || (key.startsWith('data:image/') || key.startsWith('/images/') ? key : '');

export default function BlogWorkspace({ role, item = '' }) {
  const app = useApp(), router = useRouter(), base = workspacePath(role) + '/blog';
  const [state, setState] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; app.blogLoad().then(s => { if (on) setState(s); }).catch(e => { if (on) setError(e.message); }); return () => { on = false; }; }, []);
  const putPost = post => setState(s => ({ ...s, posts: s.posts.some(p => p.id === post.id) ? s.posts.map(p => p.id === post.id ? post : p) : [post, ...s.posts] }));
  async function run(fn, done) { setBusy(true); setError(''); setMessage(''); try { const r = await fn(); if (done) setMessage(done); return r; } catch (e) { setError(e.message); return false; } finally { setBusy(false); } }
  if (error && !state) return <Notice error>{error}</Notice>;
  if (!state) return <Loading />;
  const startPost = () => run(async () => { const { post } = await app.blogAction('create'); putPost(post); router.push(base + '/' + post.id); });
  if (item) {
    const post = state.posts.find(p => p.id === item);
    if (!post) return <><Notice error>{error}</Notice><Empty text="This post isn’t available." /><p><Link className="text-link" href={base}>← All posts</Link></p></>;
    return <PostEditor key={post.id} post={post} me={state.me} images={state.images} base={base} onPost={putPost}
      onImage={(key, url) => setState(s => ({ ...s, images: { ...s.images, [key]: url } }))}
      onDeleted={id => { setState(s => ({ ...s, posts: s.posts.filter(p => p.id !== id) })); router.push(base); }} />;
  }
  return <>
    <Notice error>{error}</Notice><Notice>{message}</Notice>
    <PostList state={state} base={base} busy={busy} onNew={startPost}
      onModerate={(c, approve) => run(async () => { await app.blogAction(approve ? 'comment-approve' : 'comment-delete', { id: c.id }); setState(s => ({ ...s, comments: approve ? s.comments.map(x => x.id === c.id ? { ...x, status: 'approved' } : x) : s.comments.filter(x => x.id !== c.id) })); }, approve ? 'Comment approved. It now shows on the post.' : 'Comment deleted.')} />
  </>;
}

function PostList({ state, base, busy, onNew, onModerate }) {
  const { posts, me, images, comments } = state, staff = B.isReviewer(me), now = new Date();
  const queue = posts.filter(p => p.status === 'review'), pending = comments.filter(c => c.status === 'pending');
  const [tab, setTab] = useState(staff ? (queue.length ? 'review' : 'all') : 'mine');
  const shown = tab === 'review' ? queue : tab === 'mine' ? posts.filter(p => B.ownsPost(p, me)) : posts;
  const tabs = staff ? [['review', 'To review', queue.length], ['all', 'All posts', posts.length], ['mine', 'My posts', posts.filter(p => B.ownsPost(p, me)).length], ['comments', 'Comments', pending.length]] : [];
  return <>
    <div className="blog-list-head rise">
      {staff ? <div className="blog-tabs" role="group" aria-label="Show">{tabs.map(([k, l, n]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}{n > 0 && <span className="nav-count">{n}</span>}</button>)}</div> : <p className="quiet">Write a post, then submit it. The clinic reviews every post before it goes on the blog.</p>}
      <Button disabled={busy} onClick={onNew}><Icon name="pen" size={18} />New post</Button>
    </div>
    {tab === 'comments' ? <CommentList comments={comments} posts={posts} busy={busy} onModerate={onModerate} /> : shown.length ? <ol className="blog-rows rise">{shown.map(p => {
      const st = B.postState(p, now), cover = srcFor(images, p.draft.cover?.key);
      return <li key={p.id} className="blog-row">
        <Link href={base + '/' + p.id} className="blog-row-main">
          <span className="blog-thumb">{cover ? <img src={cover} alt="" /> : <Icon name="image" size={22} />}</span>
          <span className="blog-row-text"><strong>{p.draft.title || 'Untitled post'}</strong>
            <small>{staff && <>{p.authorName || 'Eyecon Optometry'} · {ROLE_NAMES[p.authorRole]} · </>}{p.status === 'review' ? 'Submitted ' + shortDate(p.submittedAt) : 'Updated ' + shortDate(p.updatedAt)}</small></span>
          <span className="blog-row-badges">{st.live && p.status !== 'approved' && <span className="badge pill attended">Live</span>}<span className={'badge pill ' + TONES[st.key]}>{st.label}</span></span>
        </Link>
        {st.live && p.slug && <Link className="text-link" href={'/blog/' + p.slug}>View on blog<span className="sr-only"> {p.draft.title}</span></Link>}
      </li>;
    })}</ol> : <Empty text={tab === 'review' ? 'Nothing is waiting for review.' : 'No posts yet. Start one with New post.'} />}
  </>;
}

function CommentList({ comments, posts, busy, onModerate }) {
  const [confirm, setConfirm] = useState('');
  const list = [...comments].sort((a, b) => (a.status === 'pending') === (b.status === 'pending') ? new Date(b.createdAt) - new Date(a.createdAt) : a.status === 'pending' ? -1 : 1);
  if (!list.length) return <Empty text="No comments yet." />;
  return <ol className="blog-comments-admin rise">{list.map(c => { const post = posts.find(p => p.id === c.postId); return <li key={c.id} className={'panel-card ' + c.status}>
    <div className="comment-meta"><strong>{c.name}</strong><small>on {post?.slug ? <Link href={'/blog/' + post.slug}>{post.published?.title || post.draft.title}</Link> : (post?.draft.title || 'a post')} · {shortDate(c.createdAt)}</small><span className={'badge pill ' + (c.status === 'pending' ? 'pending' : 'attended')}>{c.status === 'pending' ? 'Waiting' : 'Shown'}</span></div>
    <p className="comment-body">{c.body}</p>
    <div className="row-actions">
      {c.status === 'pending' && <button type="button" className="mini-button" disabled={busy} onClick={() => onModerate(c, true)}><Icon name="check" size={16} />Approve</button>}
      {confirm === c.id ? <><button type="button" className="mini-button danger-button" disabled={busy} onClick={() => { setConfirm(''); onModerate(c, false); }}>Delete comment</button><button type="button" className="text-link" onClick={() => setConfirm('')}>Keep it</button></> : <button type="button" className="text-link" onClick={() => setConfirm(c.id)}>Delete<span className="sr-only"> comment by {c.name}</span></button>}
    </div>
  </li>; })}</ol>;
}

// ---------- The editor ----------
// Pictures are shrunk in the browser (longest side 2000px, WebP or JPEG) before upload. The demo keeps them smaller,
// because it stores them in this browser.
async function shrink(file) {
  if (!B.IMAGE_TYPES[file.type]) throw new Error('Use a JPG, PNG or WebP picture.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a picture smaller than 25 MB.');
  let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error('This picture could not be read. Try a JPG or PNG.'); }
  const max = DEMO ? 1200 : B.IMAGE_MAX_SIDE, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bmp.width * scale)); canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = (type, q) => new Promise(r => canvas.toBlob(r, type, q)), quality = DEMO ? 0.72 : 0.85;
  let out = await blob('image/webp', quality);
  if (!out || out.type !== 'image/webp') out = await blob('image/jpeg', quality);
  if (!out || out.size > B.IMAGE_MAX_BYTES) throw new Error('This picture is too large. Choose a smaller one.');
  return new File([out], 'picture.' + (out.type === 'image/webp' ? 'webp' : 'jpg'), { type: out.type });
}

const plainPaste = e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); };
// A paragraph or quote: the browser edits the text; each change is read back as runs (lib/blog.js nodesToRuns).
function RichText({ runs, onChange, className, label }) {
  const ref = useRef(null);
  useLayoutEffect(() => { ref.current.innerHTML = B.runsToHtml(runs); }, []);
  return <div ref={ref} className={'rt ' + className} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} data-ph={label}
    onInput={e => onChange(B.nodesToRuns(e.currentTarget))} onPaste={plainPaste} />;
}
function ListText({ items, ordered, onChange }) {
  const ref = useRef(null), Tag = ordered ? 'ol' : 'ul';
  useLayoutEffect(() => { ref.current.innerHTML = items.map(i => '<li>' + B.runsToHtml(i) + '</li>').join('') || '<li></li>'; }, []);
  return <Tag ref={ref} className="rt ed-list" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="List, one point per line" onPaste={plainPaste}
    onInput={e => { const el = e.currentTarget, lis = [...el.children].filter(c => c.tagName === 'LI'); if (!lis.length) { el.innerHTML = '<li></li>'; onChange([[]]); return; } onChange(lis.map(B.nodesToRuns)); }} />;
}

function Drop({ id, busy, onFile, label = 'Add a picture' }) {
  const [over, setOver] = useState(false);
  return <label className={'blog-drop' + (over ? ' over' : '')} htmlFor={id} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
    <Icon name="image" size={26} /><strong>{busy ? 'Uploading…' : label}</strong>
    <small>Drop it here or choose a file · JPG, PNG or WebP</small><small>No patient faces or details</small>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
  </label>;
}

function PostEditor({ post, me, images, base, onPost, onImage, onDeleted }) {
  const app = useApp();
  const editable = B.canEditPost(post, me), staff = B.isReviewer(me), mine = B.ownsPost(post, me), now = new Date();
  const [draft, setDraft] = useState(post.draft), [dirty, setDirty] = useState(false), [mode, setMode] = useState(editable ? 'edit' : 'preview');
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [adder, setAdder] = useState(null), [linking, setLinking] = useState(false), [linkUrl, setLinkUrl] = useState(''), [confirm, setConfirm] = useState(false), [note, setNote] = useState(''), [sure, setSure] = useState(''), [tag, setTag] = useState('');
  const range = useRef(null);
  useEffect(() => { if (!editable) setMode('preview'); }, [editable]);
  useEffect(() => { if (!dirty) return; const warn = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const st = B.postState(post, now), checks = B.submitChecks(draft, now), ready = checks.every(c => c.ok), byline = B.bylineName(post.authorName);
  const src = key => srcFor(images, key);
  const change = fn => { setDraft(d => fn(d)); setDirty(true); };
  const set = (k, v) => change(d => ({ ...d, [k]: v }));
  const setBlock = (id, patch) => change(d => ({ ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, ...patch } : b) }));
  const move = (i, by) => change(d => { const blocks = [...d.blocks]; [blocks[i], blocks[i + by]] = [blocks[i + by], blocks[i]]; return { ...d, blocks }; });
  async function run(fn, done) { setBusy(true); setError(''); setMessage(''); try { const r = await fn(); if (done) setMessage(done); return r; } catch (e) { setError(e.message); return false; } finally { setBusy(false); } }
  async function save() { const { post: saved } = await app.blogAction('save', { id: post.id, draft }); onPost(saved); setDraft(saved.draft); setDirty(false); return saved; }
  async function step(name, extra = {}, done) {
    return run(async () => { if (dirty && editable) await save(); const { post: p } = await app.blogAction('step', { id: post.id, step: name, ...extra }); onPost(p); setDraft(p.draft); setDirty(false); setNote(''); setConfirm(false); if (!B.canEditPost(p, me)) setMode('preview'); }, done);
  }
  async function upload(file, place) {
    setError(''); setUploading(place);
    try { const small = await shrink(file); const { key, url } = await app.blogUpload(post.id, small); onImage(key, url); return key; }
    catch (e) { setError(e.message); return ''; } finally { setUploading(''); }
  }
  const safeRuns = fn => runs => { try { fn(runs); } catch (e) { setError(e.message); } };
  function format(cmd) {
    const sel = window.getSelection(), host = sel.rangeCount && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('.rt');
    if (!host) { setError('Click into a paragraph, list or quote first.'); return; }
    setError('');
    if (cmd === 'link') { if (sel.isCollapsed) { setError('Select the words to turn into a link.'); return; } range.current = sel.getRangeAt(0).cloneRange(); setLinkUrl(''); setLinking(true); return; }
    document.execCommand(cmd, false, null);
  }
  function addLink() {
    const url = linkUrl.trim();
    if (!B.safeHref(url)) { setError('Links start with https:// or / (a page on this site, like /booking).'); return; }
    const r = range.current, node = r?.commonAncestorContainer, host = node && (node.nodeType === 1 ? node : node.parentElement).closest('.rt');
    setLinking(false); if (!host) return;
    host.focus(); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('createLink', false, url);
  }
  const preview = { slug: post.slug, title: draft.title, excerpt: draft.excerpt, category: draft.category, tags: draft.tags, cover: draft.cover?.key ? { url: src(draft.cover.key), alt: draft.cover.alt } : null, blocks: draft.blocks.map(b => b.type === 'image' ? { ...b, url: src(b.key) } : b), byline, publishedAt: post.publishedAt, minutes: B.readMinutes(draft), bookingHref: '/booking' };
  const liveOrScheduled = !!post.published;

  return <div className="blog-editor">
    <div className="blog-editor-top">
      <Link className="text-link" href={base}>← All posts</Link>
      <div className="blog-editor-actions">
        <span className={'badge pill ' + TONES[st.key]}>{st.label}{st.live && post.status !== 'approved' ? ' · live version unchanged' : ''}{st.scheduled ? ' · ' + formatDate(post.publishedAt) : ''}</span>
        {editable && <div className="seg" role="group" aria-label="Mode"><button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Write</button><button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>Preview</button></div>}
        {editable && <Button secondary disabled={busy || !dirty} onClick={() => run(save, 'Saved.')}>{dirty ? 'Save draft' : 'Saved'}</Button>}
      </div>
    </div>
    <Notice error>{error}</Notice><Notice>{message}</Notice>
    <Banner post={post} me={me} st={st} byline={byline} />

    <div className="blog-grid">
      <main className="blog-canvas" aria-label="Post">
        {mode === 'edit' ? <>
          <div className="blog-fmt" role="toolbar" aria-label="Text formatting" onMouseDown={e => { if (e.target.closest('.tb')) e.preventDefault(); }}>
            {linking ? <div className="linkrow"><input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } if (e.key === 'Escape') setLinking(false); }} placeholder="https://… or /booking" aria-label="Link address" autoFocus /><button type="button" className="mini-button" onClick={addLink}>Add link</button><button type="button" className="text-link" onClick={() => setLinking(false)}>Cancel</button></div> : <>
              <button type="button" className="tb" onClick={() => format('bold')} aria-label="Bold" title="Bold"><strong>B</strong></button>
              <button type="button" className="tb" onClick={() => format('italic')} aria-label="Italic" title="Italic"><em className="serif-i">I</em></button>
              <button type="button" className="tb" onClick={() => format('link')} aria-label="Link" title="Link"><Icon name="link" size={17} /></button>
              <button type="button" className="tb" onClick={() => format('removeFormat')} aria-label="Clear formatting" title="Clear formatting"><Icon name="close" size={16} /></button>
              <span className="hint">{B.wordCount(draft)} words · {B.readMinutes(draft)} min read</span>
            </>}
          </div>
          <div className="blog-sheet">
            <label className="blog-label" htmlFor="post-title">Title</label>
            <textarea id="post-title" className="title-input" rows={1} maxLength={B.LIMITS.title} value={draft.title} placeholder="Post title" onChange={e => set('title', e.target.value)} />
            <label className="blog-label" htmlFor="post-excerpt">Short summary <small>(shown on the blog list and in link previews)</small></label>
            <textarea id="post-excerpt" className="dek-input" rows={2} maxLength={B.LIMITS.excerpt} value={draft.excerpt} placeholder="One or two sentences" onChange={e => set('excerpt', e.target.value)} />
            <p className="meta-line">By {byline} · {draft.category || 'No category yet'} · {B.readMinutes(draft)} min read</p>
            <Adder at={0} open={adder === 0} setOpen={setAdder} onAdd={(type, at) => change(d => ({ ...d, blocks: [...d.blocks.slice(0, at), B.newBlock(type), ...d.blocks.slice(at)] }))} full={draft.blocks.length >= B.LIMITS.blocks} />
            {draft.blocks.map((b, i) => <div key={b.id}>
              <section className="blog-block" aria-label={B.BLOCK_TYPES[b.type][0]}>
                <div className="block-tools">
                  <span className="type">{B.BLOCK_TYPES[b.type][0]}</span>
                  {b.type === 'heading' && [2, 3].map(l => <button key={l} type="button" className="ib" aria-pressed={b.level === l} onClick={() => setBlock(b.id, { level: l })}>H{l}</button>)}
                  {b.type === 'list' && <><button type="button" className="ib" aria-pressed={!b.ordered} onClick={() => setBlock(b.id, { ordered: false })} aria-label="Bullets">•</button><button type="button" className="ib" aria-pressed={b.ordered} onClick={() => setBlock(b.id, { ordered: true })} aria-label="Numbers">1.</button></>}
                  {b.type === 'image' && b.key && <button type="button" className="ib" onClick={() => setBlock(b.id, { key: '' })}>Replace</button>}
                  <button type="button" className="ib" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className="ib" disabled={i === draft.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className="ib del" onClick={() => change(d => ({ ...d, blocks: d.blocks.filter(x => x.id !== b.id) }))} aria-label={'Delete ' + B.BLOCK_TYPES[b.type][0].toLowerCase()}>✕</button>
                </div>
                {b.type === 'paragraph' && <RichText runs={b.text} className="ed-p" label="Write a paragraph…" onChange={safeRuns(text => setBlock(b.id, { text }))} />}
                {b.type === 'heading' && <input className={'ed-h' + b.level} value={b.text} maxLength={150} placeholder="Heading" aria-label="Heading" onChange={e => setBlock(b.id, { text: e.target.value })} />}
                {b.type === 'list' && <ListText key={b.ordered ? 'ol' : 'ul'} items={b.items} ordered={b.ordered} onChange={safeRuns(items => setBlock(b.id, { items }))} />}
                {b.type === 'quote' && <><RichText runs={b.text} className="ed-quote" label="Quote" onChange={safeRuns(text => setBlock(b.id, { text }))} /><input className="cite-input" value={b.cite} maxLength={B.LIMITS.cite} placeholder="Who said it" aria-label="Quote credit" onChange={e => setBlock(b.id, { cite: e.target.value })} /></>}
                {b.type === 'button' && <div className="book-ed"><span className="button">{b.label || 'Book an appointment'} →</span><span><input className="inp" value={b.label} maxLength={B.LIMITS.label} aria-label="Button text" onChange={e => setBlock(b.id, { label: e.target.value })} /><small className="ref-note">{post.authorRole === 'affiliate' ? `Opens booking with ${byline}’s referral` : 'Opens the booking page'}</small></span></div>}
                {b.type === 'image' && (b.key ? <div className="img-ed"><img src={src(b.key)} alt={b.alt} />
                  <div className="img-fields">
                    <span><input className={'inp' + ((b.alt || '').trim().length >= 3 ? '' : ' bad')} value={b.alt} maxLength={B.LIMITS.alt} placeholder="Describe the picture (required)" aria-label="Picture description" onChange={e => setBlock(b.id, { alt: e.target.value })} /><small>Read aloud to people using screen readers</small></span>
                    <span><input className="inp" value={b.caption} maxLength={B.LIMITS.caption} placeholder="Caption (optional)" aria-label="Caption" onChange={e => setBlock(b.id, { caption: e.target.value })} /></span>
                  </div></div>
                  : <Drop id={'img-' + b.id} busy={uploading === b.id} onFile={async f => { const key = await upload(f, b.id); if (key) setBlock(b.id, { key }); }} />)}
              </section>
              <Adder at={i + 1} open={adder === i + 1} setOpen={setAdder} onAdd={(type, at) => change(d => ({ ...d, blocks: [...d.blocks.slice(0, at), B.newBlock(type), ...d.blocks.slice(at)] }))} full={draft.blocks.length >= B.LIMITS.blocks} />
            </div>)}
          </div>
        </> : <PostArticle post={preview} />}
      </main>

      <aside className="blog-side">
        {editable && mine && <section className="panel-card dark-card">
          <h2>Ready to submit?</h2>
          <Checklist checks={checks} />
          <label className="confirm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} /><span>This post has no patient names, photos or details, and makes no promises about results.</span></label>
          <Button disabled={busy || !ready || !confirm} onClick={() => step('submit', { confirm: true }, 'Submitted. The clinic will review it.')}>Submit for review</Button>
          <small>The clinic reviews every post before it goes on the blog.</small>
        </section>}
        {staff && post.status === 'review' && <section className="panel-card dark-card review-card">
          <h2>Your decision</h2>
          <Checklist checks={checks} />
          <label htmlFor="review-note">Note to {byline}</label>
          <textarea id="review-note" value={note} maxLength={B.LIMITS.note} onChange={e => setNote(e.target.value)} placeholder="Required when you send it back" rows={4} />
          <Button disabled={busy || !ready} onClick={() => step('approve', {}, 'Approved. The author has been told.')}>{!liveOrScheduled && draft.schedule === 'later' && draft.publishAt && new Date(draft.publishAt) > now ? 'Approve · goes live ' + formatDate(draft.publishAt) : 'Approve and publish'}</Button>
          <Button secondary disabled={busy} onClick={() => step('changes', { note }, 'Sent back to the author with your note.')}>Send back for changes</Button>
          <Button secondary className="danger-button" disabled={busy} onClick={() => step('reject', { note }, 'Marked as not published.')}>Don’t publish</Button>
        </section>}
        {mine && (post.status === 'approved' || post.status === 'rejected') && <section className="panel-card">
          <h2>{post.status === 'approved' ? 'Published post' : 'Not published'}</h2>
          <Button secondary disabled={busy} onClick={() => step('revise', {}, 'You can edit the post now.').then(() => setMode('edit'))}><Icon name="pen" size={18} />Edit this post</Button>
          <small>{post.status === 'approved' ? 'Your changes go to the clinic first. The live post stays as it is until they approve them.' : 'Make changes and submit it again.'}</small>
        </section>}
        {staff && post.published && <section className="panel-card">
          <h2>On the blog</h2>
          {post.slug && st.live && <Link className="text-link" href={'/blog/' + post.slug}>View the live post</Link>}
          {sure === 'unpublish' ? <><Button className="danger-button" disabled={busy} onClick={() => { setSure(''); step('unpublish', {}, 'Taken off the blog.'); }}>Yes, unpublish</Button><button type="button" className="text-link" onClick={() => setSure('')}>Keep it live</button></> : <Button secondary disabled={busy} onClick={() => setSure('unpublish')}>Unpublish</Button>}
          <small>Takes it off the blog and returns it to the author as a draft.</small>
        </section>}

        <section className="panel-card">
          <h2>Author</h2>
          <div className="blog-author"><span className="post-avatar" aria-hidden="true">{B.bylineInitials(byline)}</span><span><strong>{byline}</strong><small>{post.authorName || 'Eyecon Optometry'} · {ROLE_NAMES[post.authorRole]}</small></span></div>
          <small>Readers see the first name and the first letter of the last name.</small>
        </section>

        <section className="panel-card">
          <h2>Cover picture</h2>
          {draft.cover?.key ? <>
            <img className="cover-thumb" src={src(draft.cover.key)} alt="" />
            <input className={'inp' + ((draft.cover.alt || '').trim().length >= 3 ? '' : ' bad')} value={draft.cover.alt} disabled={!editable} maxLength={B.LIMITS.alt} placeholder="Describe the picture (required)" aria-label="Cover picture description" onChange={e => set('cover', { ...draft.cover, alt: e.target.value })} />
            {editable && <button type="button" className="text-link" onClick={() => set('cover', null)}>Replace picture</button>}
          </> : editable ? <Drop id="cover-file" label="Add a cover picture" busy={uploading === 'cover'} onFile={async f => { const key = await upload(f, 'cover'); if (key) set('cover', { key, alt: '' }); }} /> : <p className="quiet">No cover picture.</p>}
          <small>Shown on the blog list and when the post is shared.</small>
        </section>

        <section className="panel-card">
          <h2>Topic</h2>
          <label htmlFor="post-category">Category</label>
          <select id="post-category" value={draft.category} disabled={!editable} onChange={e => set('category', e.target.value)}><option value="">Choose a category</option>{B.BLOG_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <label htmlFor="post-tag">Tags</label>
          <div className="tags">{draft.tags.map(t => <span key={t} className="tag">{t}{editable && <button type="button" onClick={() => set('tags', draft.tags.filter(x => x !== t))} aria-label={'Remove ' + t}>×</button>}</span>)}
            {editable && draft.tags.length < B.LIMITS.tags && <input id="post-tag" value={tag} maxLength={B.LIMITS.tag} placeholder="Add a tag, press Enter" onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const v = tag.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').trim(); if (v && !draft.tags.includes(v)) set('tags', [...draft.tags, v]); setTag(''); } }} />}</div>
          <small>Up to {B.LIMITS.tags}. Readers can filter the blog by tag.</small>
        </section>

        <section className="panel-card">
          <h2>Publishing</h2>
          {liveOrScheduled ? <p className="quiet">{st.live ? 'Live since ' + shortDate(post.publishedAt) + '. Approved changes keep this date.' : 'Scheduled for ' + formatDate(post.publishedAt) + '.'}</p> : <>
            <label className="radio"><input type="radio" name="schedule" checked={draft.schedule === 'asap'} disabled={!editable} onChange={() => set('schedule', 'asap')} />As soon as it’s approved</label>
            <label className="radio"><input type="radio" name="schedule" checked={draft.schedule === 'later'} disabled={!editable} onChange={() => set('schedule', 'later')} />On a date I choose</label>
            {draft.schedule === 'later' && <><input className="inp" type="datetime-local" aria-label="Publishing date and time" disabled={!editable} value={B.toLocalInput(draft.publishAt, clinic.timezone)} onChange={e => set('publishAt', B.fromLocalInput(e.target.value, clinic.timezone))} /><small>{clinic.timezoneLabel}. If approval comes later, it goes live on approval.</small></>}
          </>}
          <label className="blog-switch"><span>Allow comments<small>Each comment waits for the clinic’s approval.</small></span><input type="checkbox" checked={draft.comments} disabled={!editable} onChange={e => set('comments', e.target.checked)} /></label>
        </section>

        <section className="panel-card">
          <h2>Activity</h2>
          <ul className="blog-log">
            {post.publishedAt && <li>{st.live ? 'Live since' : 'Goes live'} {formatDate(post.publishedAt)}</li>}
            {post.reviewedAt && <li>Reviewed {formatDate(post.reviewedAt)}</li>}
            {post.submittedAt && <li>Submitted {formatDate(post.submittedAt)}</li>}
            <li>Started {formatDate(post.createdAt)}</li>
          </ul>
          {B.canDeletePost(post, me) && (sure === 'delete' ? <><Button className="danger-button" disabled={busy} onClick={() => run(async () => { await app.blogAction('delete', { id: post.id }); setDirty(false); onDeleted(post.id); })}>Yes, delete this post</Button><button type="button" className="text-link" onClick={() => setSure('')}>Keep it</button></> : <button type="button" className="text-link danger-text" onClick={() => setSure('delete')}>Delete post</button>)}
        </section>
      </aside>
    </div>
  </div>;
}

function Banner({ post, me, st, byline }) {
  const author = B.ownsPost(post, me);
  if (post.status === 'changes') return <div className="blog-banner warn"><p><strong>{author ? 'The clinic asked for changes.' : 'Sent back to the author.'}</strong> {author && 'Edit the post and submit it again.'}</p>{post.reviewNote && <p className="note">“{post.reviewNote}”</p>}</div>;
  if (post.status === 'review') return <div className="blog-banner gold"><p>{author && !B.isReviewer(me) ? <><strong>In review.</strong> You can’t edit the post while the clinic reviews it. You’ll be told when they publish it or send it back.</> : <><strong>Submitted by {byline} ({ROLE_NAMES[post.authorRole]}).</strong> You can fix small things before publishing. For larger changes, send it back with a note.</>}</p></div>;
  if (post.status === 'rejected') return <div className="blog-banner warn"><p><strong>Not published.</strong></p>{post.reviewNote && <p className="note">“{post.reviewNote}”</p>}</div>;
  if (post.status === 'approved') return <div className="blog-banner good"><p><strong>{st.scheduled ? 'Approved and scheduled.' : 'Published on the blog.'}</strong> {author && 'To change it, choose Edit this post. The clinic approves changes before they go live.'}</p></div>;
  if (post.status === 'draft' && post.published) return <div className="blog-banner gold"><p><strong>Editing a published post.</strong> The live version stays up until the clinic approves these changes.</p></div>;
  return null;
}

function Checklist({ checks }) {
  return <ul className="checklist">{checks.map(c => <li key={c.label} className={c.ok ? 'done' : ''}><span className="mk" aria-hidden="true">{c.ok ? '✓' : ''}</span><span>{c.label}<span className="sr-only">{c.ok ? ' (done)' : ' (to do)'}</span></span></li>)}</ul>;
}

function Adder({ at, open, setOpen, onAdd, full }) {
  if (full) return <div className="blog-adder" />;
  return <div className={'blog-adder' + (open ? ' open' : '')}>
    <button type="button" className="add-btn" aria-expanded={open} aria-label="Add a block here" onClick={() => setOpen(open ? null : at)}>+</button>
    {open && <div className="add-menu" role="menu" onKeyDown={e => { if (e.key === 'Escape') setOpen(null); }}>{Object.entries(B.BLOCK_TYPES).map(([k, [name, sub]]) => <button key={k} type="button" role="menuitem" autoFocus={k === 'paragraph'} onClick={() => { onAdd(k, at); setOpen(null); }}><span>{name}</span><small>{sub}</small></button>)}</div>}
  </div>;
}
