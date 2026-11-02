import { clinicTime } from './schedule.js';
import { withAffiliate } from './affiliate.js';

// The blog (migration 016). Affiliates, the front desk and staff admin write posts; staff admin review and publish
// them. These rules are shared by the server (lib/blog-server.js), the demo (lib/demo.js), the editor and the public
// pages, so every mode accepts and shows exactly the same posts.
//
// A post's text is never stored as HTML. Each paragraph, list item and quote is a list of "runs": plain text with
// optional bold, italic and a link ({ t, b, i, href }). The editor turns what the author types into runs, the server
// checks every run, and the pages draw them as React elements, so no markup or script can reach the site.

export const BLOG_CATEGORIES = ['Eye health', 'Frames & style', 'Contact lenses', 'Skin tightening', 'Clinic news'];
export const BLOCK_TYPES = {
  paragraph: ['Paragraph', 'Text with bold, italic and links'],
  heading: ['Heading', 'A section title'],
  image: ['Picture', 'JPG, PNG or WebP'],
  list: ['List', 'Bullets or numbers'],
  quote: ['Quote', 'A pull quote with a credit'],
  button: ['Booking button', 'Book an appointment']
};
export const BLOG_AUTHOR_ROLES = ['staff', 'front-desk', 'affiliate'];
export const LIMITS = { title: 110, excerpt: 200, tags: 6, tag: 24, blocks: 80, blockText: 5000, runs: 200, listItems: 40, alt: 200, caption: 200, cite: 80, label: 40, href: 500, note: 1000 };
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// Pictures are shrunk in the browser before upload (longest side IMAGE_MAX_SIDE), so they stay well under the host's
// 4.5 MB request limit. The server refuses anything over IMAGE_MAX_BYTES.
export const IMAGE_MAX_SIDE = 2000;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const COMMENTS_PER_HOUR = 5;
export const STATUS_LABELS = { draft: 'Draft', review: 'In review', changes: 'Changes requested', approved: 'Published', rejected: 'Not published' };

const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';
const line = (v, max) => str(v, max).replace(/\s+/g, ' ').trim();

// Readers see the first name and the first letter of the last name: "Alex Morgan" → "Alex M.".
export function bylineName(name) {
  const full = String(name || '').trim();
  // A [bracketed placeholder] name (demo and sample accounts) is shown as it is.
  if (/^\[[^\]]*\]$/.test(full)) return full;
  const words = full.split(/\s+/).filter(Boolean);
  if (!words.length) return 'Eyecon Optometry';
  if (words.length === 1) return words[0];
  const initial = Array.from(words[words.length - 1])[0].toUpperCase();
  return words[0] + ' ' + initial + '.';
}
export const bylineInitials = byline => byline === 'Eyecon Optometry' ? 'E' : byline.replace(/[[\]]/g, '').split(' ').map(w => Array.from(w)[0] || '').join('').toUpperCase().slice(0, 2);

export function slugify(text) {
  const s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/g, '');
  return s || 'post';
}
// The first free slug: "my-post", then "my-post-2", "my-post-3", ...
export async function uniqueSlug(title, taken) {
  const base = slugify(title);
  for (let n = 1; n < 200; n++) { const slug = n === 1 ? base : base + '-' + n; if (!(await taken(slug))) return slug; }
  return base + '-' + Date.now().toString(36);
}

// Links start with https:// or are a page on this site (/booking). Nothing else: no javascript:, data: or //host.
export const safeHref = h => typeof h === 'string' && h.length <= LIMITS.href && /^(https:\/\/[^\s"'<>\\]+|\/(?!\/)[^\s"'<>\\]*)$/i.test(h);

// Runs: [{ t: 'text', b: true, i: true, href: '/booking' }]. Neighbouring runs with the same formatting are joined.
export function cleanRuns(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const r of input.slice(0, LIMITS.runs)) {
    const t = str(r?.t, LIMITS.blockText).replace(/\r\n?/g, '\n');
    if (!t) continue;
    const run = { t };
    if (r.b === true) run.b = true;
    if (r.i === true) run.i = true;
    if (r.href != null && r.href !== '') { if (!safeHref(r.href)) fail('Links must start with https:// or / (a page on this site).'); run.href = r.href; }
    const last = out[out.length - 1];
    if (last && last.b === run.b && last.i === run.i && last.href === run.href) last.t += t; else out.push(run);
  }
  if (runsText(out).length > LIMITS.blockText) fail('A paragraph can be up to ' + LIMITS.blockText + ' characters.');
  return out;
}
export const runsText = runs => (runs || []).map(r => r.t).join('');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Runs as editor HTML. Every piece of text is escaped, so the result only ever holds the tags written here.
export function runsToHtml(runs) {
  return (runs || []).map(r => {
    let h = esc(r.t).replace(/\n/g, '<br>');
    if (r.i) h = '<em>' + h + '</em>';
    if (r.b) h = '<strong>' + h + '</strong>';
    if (r.href && safeHref(r.href)) h = '<a href="' + esc(r.href) + '">' + h + '</a>';
    return h;
  }).join('');
}
// What the author typed (a DOM node from the editor) as runs. Only bold, italic, links and line breaks are kept;
// every other tag is dropped and its text kept. Works on any object shaped like a DOM node, so it can be tested.
export function nodesToRuns(root) {
  const out = [];
  const walk = (node, fmt) => {
    for (const n of Array.from(node.childNodes || [])) {
      if (n.nodeType === 3) { if (n.textContent) out.push({ t: n.textContent, ...fmt }); continue; }
      if (n.nodeType !== 1) continue;
      const tag = String(n.tagName || '').toLowerCase();
      if (tag === 'br') { out.push({ t: '\n', ...fmt }); continue; }
      const next = { ...fmt };
      if (tag === 'b' || tag === 'strong') next.b = true;
      if (tag === 'i' || tag === 'em') next.i = true;
      if (tag === 'a') { const h = n.getAttribute?.('href') || ''; if (safeHref(h)) next.href = h; }
      const block = tag === 'div' || tag === 'p';
      if (block && out.length && !out[out.length - 1].t.endsWith('\n')) out.push({ t: '\n' });
      walk(n, next);
    }
  };
  walk(root, {});
  const runs = cleanRuns(out.map(r => ({ ...r, t: r.t.replace(/ /g, ' ') })));
  if (runs.length) runs[runs.length - 1].t = runs[runs.length - 1].t.replace(/\n+$/, '');
  return runs.filter(r => r.t);
}

export const blockId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
export function newBlock(type) {
  const id = blockId();
  if (type === 'heading') return { id, type, level: 2, text: '' };
  if (type === 'image') return { id, type, key: '', alt: '', caption: '' };
  if (type === 'list') return { id, type, ordered: false, items: [[]] };
  if (type === 'quote') return { id, type, text: [], cite: '' };
  if (type === 'button') return { id, type, label: 'Book an appointment' };
  return { id, type: 'paragraph', text: [] };
}
export function newDraft() {
  return { title: '', excerpt: '', category: '', tags: [], cover: null, blocks: [newBlock('paragraph')], schedule: 'asap', publishAt: null, comments: true };
}

// Stored picture names: "[post id]/[random id].webp" (the same name in the private drafts bucket and, once published,
// in the public bucket). The demo keeps the picture itself in the browser, as a data URL.
export const STORAGE_KEY = /^[a-z0-9-]{1,64}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;
export const storageKeyOk = key => typeof key === 'string' && STORAGE_KEY.test(key);
export const demoKeyOk = key => typeof key === 'string' && ((/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(key) && key.length < 3_000_000) || /^\/images\/[a-z0-9/_-]+\.(webp|jpg|png)$/.test(key));

function cleanBlock(b, keyOk) {
  const id = typeof b?.id === 'string' && /^[a-z0-9]{4,16}$/.test(b.id) ? b.id : blockId();
  switch (b?.type) {
    case 'paragraph': return { id, type: 'paragraph', text: cleanRuns(b.text) };
    case 'heading': return { id, type: 'heading', level: b.level === 3 ? 3 : 2, text: line(b.text, 150) };
    case 'list': {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, LIMITS.listItems).map(cleanRuns);
      return { id, type: 'list', ordered: b.ordered === true, items: items.length ? items : [[]] };
    }
    case 'quote': return { id, type: 'quote', text: cleanRuns(b.text), cite: line(b.cite, LIMITS.cite) };
    case 'image': {
      const key = b.key ? String(b.key) : '';
      if (key && !keyOk(key)) fail('A picture in this post could not be read. Remove it and add it again.');
      return { id, type: 'image', key, alt: line(b.alt, LIMITS.alt), caption: line(b.caption, LIMITS.caption) };
    }
    case 'button': return { id, type: 'button', label: line(b.label, LIMITS.label) || 'Book an appointment' };
    default: fail('This post has a block the editor does not know.');
  }
}

// A draft as the author last saved it. Saving is lenient (empty blocks and missing descriptions are fine while
// writing); submitChecks decides whether it can go to review. keyOk checks stored picture names (live: storageKeyOk).
export function validateDraft(input, { keyOk = storageKeyOk } = {}) {
  const d = input && typeof input === 'object' ? input : {};
  const category = BLOG_CATEGORIES.includes(d.category) ? d.category : '';
  const tags = [];
  for (const t of Array.isArray(d.tags) ? d.tags : []) {
    const tag = line(String(t || ''), LIMITS.tag).toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > LIMITS.tags) fail('Use up to ' + LIMITS.tags + ' tags.');
  const blocks = Array.isArray(d.blocks) ? d.blocks : [];
  if (blocks.length > LIMITS.blocks) fail('A post can have up to ' + LIMITS.blocks + ' blocks.');
  let cover = null;
  if (d.cover?.key) { if (!keyOk(String(d.cover.key))) fail('The cover picture could not be read. Choose it again.'); cover = { key: String(d.cover.key), alt: line(d.cover.alt, LIMITS.alt) }; }
  let publishAt = null;
  if (d.schedule === 'later' && d.publishAt) {
    const t = new Date(d.publishAt);
    if (Number.isNaN(t.getTime())) fail('Choose a valid publishing date.');
    publishAt = t.toISOString();
  }
  return {
    title: line(d.title, LIMITS.title), excerpt: line(d.excerpt, LIMITS.excerpt), category, tags: tags.slice(0, LIMITS.tags), cover,
    blocks: blocks.map(b => cleanBlock(b, keyOk)), schedule: d.schedule === 'later' ? 'later' : 'asap', publishAt, comments: d.comments !== false
  };
}

export const imageKeys = draft => [draft?.cover?.key, ...(draft?.blocks || []).filter(b => b.type === 'image').map(b => b.key)].filter(Boolean);
const hasWriting = draft => (draft.blocks || []).some(b => (b.type === 'paragraph' || b.type === 'quote') ? runsText(b.text).trim().length > 0 : b.type === 'list' ? b.items.some(i => runsText(i).trim()) : false);

// The "Ready to submit?" checklist. Every item must be ticked before the author can submit, and again before staff
// can publish.
export function submitChecks(draft, now = new Date()) {
  const images = (draft.blocks || []).filter(b => b.type === 'image');
  const later = draft.schedule === 'later';
  return [
    { label: 'Title written', ok: (draft.title || '').trim().length >= 4 },
    { label: 'Short summary written', ok: (draft.excerpt || '').trim().length >= 10 },
    { label: 'Category chosen', ok: BLOG_CATEGORIES.includes(draft.category) },
    { label: 'Cover picture with a description', ok: !!draft.cover?.key && (draft.cover.alt || '').trim().length >= 3 },
    { label: 'Every picture uploaded and described', ok: images.every(b => b.key && (b.alt || '').trim().length >= 3) },
    { label: 'Some writing in the post', ok: hasWriting(draft) },
    { label: later ? 'Publish date is in the future' : 'Publishes when approved', ok: !later || (!!draft.publishAt && new Date(draft.publishAt) > now) }
  ];
}
export const readyToSubmit = (draft, now) => submitChecks(draft, now).every(c => c.ok);

export function wordCount(draft) {
  const parts = [draft.title, draft.excerpt];
  for (const b of draft.blocks || []) {
    if (b.type === 'paragraph' || b.type === 'quote') parts.push(runsText(b.text));
    if (b.type === 'list') parts.push(...b.items.map(runsText));
    if (b.type === 'heading') parts.push(b.text);
    if (b.type === 'image') parts.push(b.caption);
  }
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}
export const readMinutes = draft => Math.max(1, Math.round(wordCount(draft) / 200));

// The clinic-time value for <input type="datetime-local">, and back.
export function toLocalInput(iso, timeZone) {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromLocalInput(value, timeZone) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(value || ''));
  return m ? clinicTime(m[1], m[2], timeZone) : null;
}

// Who may do what. A post's author edits it while it is a draft or sent back; staff admin may tidy it while it is in
// review. Only staff admin decide. An unpublished post can be deleted by its author, and any post by staff admin.
export const isReviewer = user => user?.role === 'staff';
export const canWriteBlog = user => BLOG_AUTHOR_ROLES.includes(user?.role);
export const ownsPost = (post, user) => !!user?.id && post?.authorId === user.id;
export function canEditPost(post, user) {
  if (!post || !user) return false;
  if (ownsPost(post, user) && (post.status === 'draft' || post.status === 'changes')) return true;
  return isReviewer(user) && post.status === 'review';
}
export const canSeePost = (post, user) => ownsPost(post, user) || isReviewer(user);

// Where a post stands, for badges: Draft, In review, Changes requested, Not published, Scheduled or Published, plus
// whether a published copy is live (or waiting for its date) while the author edits the working copy.
export function postState(post, now = new Date()) {
  const hasCopy = !!post?.published, live = hasCopy && new Date(post.publishedAt) <= now, scheduled = hasCopy && !live;
  if (post.status === 'approved') return { key: scheduled ? 'scheduled' : 'published', label: scheduled ? 'Scheduled' : 'Published', live, scheduled };
  return { key: post.status, label: STATUS_LABELS[post.status] || 'Draft', live, scheduled };
}

// The changes each step makes to a post: { status, ... } for the server or demo to save. Throws when the step is not
// allowed. now is used for scheduling; slug(title) gives a free page name (async on the server).
export function blogStep(post, step, user, { note = '', confirm = false, now = new Date() } = {}) {
  const err = (m, status = 400) => { throw Object.assign(new Error(m), { status }); };
  const cleanNote = line(note, LIMITS.note);
  if (!canSeePost(post, user)) err('Post not found.', 404);
  if (step === 'submit') {
    if (!ownsPost(post, user)) err('Only the author can submit this post.', 403);
    if (post.status !== 'draft' && post.status !== 'changes') err('This post has already been submitted.', 409);
    if (!readyToSubmit(post.draft, now)) err('Finish the checklist before submitting.');
    if (confirm !== true) err('Confirm that the post has no patient information and makes no promises about results.');
    return { status: 'review', submittedAt: now.toISOString(), reviewNote: '' };
  }
  if (step === 'revise') {
    if (!ownsPost(post, user)) err('Only the author can edit this post.', 403);
    if (post.status !== 'approved' && post.status !== 'rejected') err('This post can already be edited.', 409);
    return { status: 'draft', reviewNote: post.status === 'rejected' ? post.reviewNote : '' };
  }
  if (!isReviewer(user)) err('Only staff admin can review posts.', 403);
  if (step === 'approve') {
    if (post.status !== 'review') err('This post is not waiting for review.', 409);
    if (!readyToSubmit(post.draft, now)) err('The checklist is not complete. Send it back, or finish it before publishing.');
    // A post that is already live keeps its original date when changes are approved. A new post goes live now, or on
    // the author's chosen date if that is still ahead.
    const alreadyLive = post.published && new Date(post.publishedAt) <= now;
    const at = alreadyLive ? post.publishedAt : post.draft.schedule === 'later' && post.draft.publishAt && new Date(post.draft.publishAt) > now ? post.draft.publishAt : now.toISOString();
    return { status: 'approved', published: post.draft, publishedAt: at, reviewNote: '', reviewedAt: now.toISOString(), reviewedBy: user.id };
  }
  if (step === 'changes') {
    if (post.status !== 'review') err('This post is not waiting for review.', 409);
    if (cleanNote.length < 3) err('Add a note so the author knows what to change.');
    return { status: 'changes', reviewNote: cleanNote, reviewedAt: now.toISOString(), reviewedBy: user.id };
  }
  if (step === 'reject') {
    if (post.status !== 'review') err('This post is not waiting for review.', 409);
    return { status: 'rejected', reviewNote: cleanNote, reviewedAt: now.toISOString(), reviewedBy: user.id };
  }
  if (step === 'unpublish') {
    if (!post.published) err('This post is not published.', 409);
    return { status: post.status === 'approved' ? 'draft' : post.status, published: null, publishedAt: null, reviewedAt: now.toISOString(), reviewedBy: user.id };
  }
  err('Unknown step.');
}
export const canDeletePost = (post, user) => isReviewer(user) || (ownsPost(post, user) && !post.published && post.status !== 'review');

// What readers receive for a published post: its published copy, the short byline and the booking link. Never the
// author's full name, account or role, the working copy or the review note. imageUrl(key) gives each picture's address.
export function publicPost(post, { imageUrl, affiliateSlug = null, now = new Date() } = {}) {
  if (!post?.published || new Date(post.publishedAt) > now) return null;
  const p = post.published, url = k => (k ? imageUrl(k) : '');
  return {
    slug: post.slug, title: p.title, excerpt: p.excerpt, category: p.category, tags: p.tags || [],
    cover: p.cover?.key ? { url: url(p.cover.key), alt: p.cover.alt } : null,
    blocks: (p.blocks || []).map(b => b.type === 'image' ? (b.key ? { id: b.id, type: 'image', url: url(b.key), alt: b.alt, caption: b.caption } : null) : b).filter(Boolean),
    byline: bylineName(post.authorName), publishedAt: post.publishedAt, minutes: readMinutes(p), comments: p.comments !== false,
    bookingHref: withAffiliate('/booking', affiliateSlug || undefined)
  };
}
// The blog list: newest first, filtered by category and tag (by their slugs from the address).
export function filterPosts(posts, { category, tag } = {}) {
  return posts.filter(p => (!category || slugify(p.category) === category) && (!tag || p.tags.includes(String(tag).replace(/-/g, ' ')) || p.tags.map(slugify).includes(tag)))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}
export const categorySlug = c => slugify(c);
export const categoryFromSlug = s => BLOG_CATEGORIES.find(c => slugify(c) === s) || null;

// Readers' comments: a first name and the comment. No links (they are almost always spam). website is a hidden field
// people never see; a value there means a bot filled the form in.
export function validateComment(input) {
  const name = line(input?.name, 60), body = str(input?.body, 1200).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (input?.website) fail('Your comment could not be sent.');
  if (name.length < 1 || name.length > 40 || !/\p{L}/u.test(name)) fail('Enter your first name (up to 40 characters).');
  if (body.length < 2 || body.length > 1000) fail('Write a comment of up to 1,000 characters.');
  if (/https?:|www\.|<[a-z/]/i.test(body)) fail('Comments can’t include links or code.');
  return { name, body };
}
export const COMMENT_NOTE = 'Comments appear once the clinic approves them. Please don’t share health details or personal information.';
