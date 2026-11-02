import 'server-only';
import { clinic } from './config.js';
import { audit } from './server.js';
import { validateDraft, newDraft, blogStep, canEditPost, canSeePost, canDeletePost, canWriteBlog, isReviewer, imageKeys, uniqueSlug, publicPost, validateComment, IMAGE_TYPES, IMAGE_MAX_BYTES, COMMENTS_PER_HOUR, bylineName } from './blog.js';

// The live blog (migration 016). /api/blog (signed in) and /api/blog/comments (readers) call these; the public pages
// read published posts through loadPublishedPosts and loadPublishedPost. The rules themselves are in lib/blog.js.
export const DRAFTS_BUCKET = 'blog-drafts';
export const PUBLIC_BUCKET = 'blog-images';
const SIGNED_SECONDS = 3600;
const err = (message, status = 400) => Object.assign(new Error(message), { status });

export function mapPost(r) {
  return { id: r.id, slug: r.slug || null, authorId: r.author_id, authorRole: r.author_role, authorName: r.author_name || '', authorAffiliate: r.author_affiliate || null, status: r.status, draft: r.draft, published: r.published || null, publishedAt: r.published_at || null, reviewNote: r.review_note || '', submittedAt: r.submitted_at || null, reviewedAt: r.reviewed_at || null, createdAt: r.created_at, updatedAt: r.updated_at };
}
const toRow = patch => {
  const map = { status: 'status', published: 'published', publishedAt: 'published_at', reviewNote: 'review_note', submittedAt: 'submitted_at', reviewedAt: 'reviewed_at', reviewedBy: 'reviewed_by', slug: 'slug', draft: 'draft' };
  return Object.fromEntries(Object.entries(patch).filter(([k]) => map[k]).map(([k, v]) => [map[k], v]));
};

// The signed-in person's full name, kept on their posts (readers only ever see bylineName of it).
async function authorName(db, user) {
  if (user.role === 'affiliate') { const { data } = await db.from('affiliates').select('name').eq('id', user.affiliateId).maybeSingle(); return data?.name || ''; }
  const { data } = await db.from('profiles').select('name').eq('id', user.id).maybeSingle();
  return data?.name || '';
}
async function authorEmail(db, post) {
  if (post.authorRole === 'affiliate' && post.authorAffiliate) { const { data } = await db.from('affiliates').select('email').eq('id', post.authorAffiliate).maybeSingle(); return data?.email || ''; }
  const { data } = await db.from('profiles').select('email').eq('id', post.authorId).maybeSingle();
  return data?.email || '';
}
async function findPost(db, user, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) throw err('Post not found.', 404);
  const { data, error } = await db.from('blog_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Could not load this post. Please try again.');
  const post = data && mapPost(data);
  if (!post || !canSeePost(post, user)) throw err('Post not found.', 404);
  return post;
}

// Draft pictures are private: each one gets a link that works for an hour.
async function signedImages(db, keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await db.storage.from(DRAFTS_BUCKET).createSignedUrls(unique, SIGNED_SECONDS);
  if (error) { console.error('Blog pictures not signed:', error.message); return {}; }
  return Object.fromEntries((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
}
const publicUrl = (db, key) => db.storage.from(PUBLIC_BUCKET).getPublicUrl(key).data.publicUrl;

// The workspace's blog: the person's own posts (staff admin: every post), with links for their draft pictures, and for
// staff admin the readers' comments. Authors never receive anyone else's posts or any comment.
export async function loadBlogWorkspace(db, user) {
  if (!canWriteBlog(user)) throw err('Blog access is not available for this account.', 403);
  let q = db.from('blog_posts').select('*').order('updated_at', { ascending: false }).limit(500);
  if (!isReviewer(user)) q = q.eq('author_id', user.id);
  const { data, error } = await q;
  if (error) { if (error.code === '42P01') throw err('The blog is not set up yet. Run migration 016 in Supabase.', 503); throw new Error('Could not load the blog. Please try again.'); }
  const posts = data.map(mapPost);
  const images = await signedImages(db, posts.flatMap(p => imageKeys(p.draft)));
  let comments = [];
  if (isReviewer(user)) {
    const c = await db.from('blog_comments').select('id,post_id,name,body,status,created_at').order('created_at', { ascending: false }).limit(300);
    if (c.error) console.error('Blog comments not loaded:', c.error.code);
    comments = (c.data || []).map(x => ({ id: x.id, postId: x.post_id, name: x.name, body: x.body, status: x.status, createdAt: x.created_at }));
  }
  return { posts, images, comments };
}

export async function createPost(db, user) {
  if (!canWriteBlog(user)) throw err('Blog access is not available for this account.', 403);
  const row = { author_id: user.id, author_role: user.role, author_name: (await authorName(db, user)).slice(0, 120), author_affiliate: user.role === 'affiliate' ? user.affiliateId : null, status: 'draft', draft: newDraft() };
  const { data, error } = await db.from('blog_posts').insert(row).select('*').single();
  if (error) throw new Error('Could not start a new post. Please try again.');
  await audit(db, user.id, 'blog-create', data.id);
  return mapPost(data);
}

export async function savePost(db, user, id, input) {
  const post = await findPost(db, user, id);
  if (!canEditPost(post, user)) throw err('This post can’t be edited right now.', 409);
  const draft = validateDraft(input);
  // Every picture must be one uploaded to this post.
  if (imageKeys(draft).some(k => !k.startsWith(post.id + '/'))) throw err('A picture in this post could not be read. Remove it and add it again.');
  const { data, error } = await db.from('blog_posts').update({ draft, updated_at: new Date().toISOString() }).eq('id', post.id).eq('status', post.status).select('*').maybeSingle();
  if (error) throw new Error('Could not save the post. Please try again.');
  if (!data) throw err('This post was just changed by someone else. Reload it and try again.', 409);
  return mapPost(data);
}

// A picture for a post: JPG, PNG or WebP, checked by its first bytes, into the private drafts bucket.
export function imageBytesOk(type, bytes) {
  if (type === 'image/png') return bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}
export async function uploadImage(db, user, id, file) {
  const post = await findPost(db, user, String(id || ''));
  if (!canEditPost(post, user)) throw err('This post can’t be edited right now.', 409);
  if (!file || typeof file.arrayBuffer !== 'function' || !IMAGE_TYPES[file.type] || file.size > IMAGE_MAX_BYTES) throw err('Use a JPG, PNG or WebP picture up to 4 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!imageBytesOk(file.type, bytes)) throw err('The file does not match its picture type.');
  const key = post.id + '/' + crypto.randomUUID() + '.' + IMAGE_TYPES[file.type];
  const { error } = await db.storage.from(DRAFTS_BUCKET).upload(key, bytes, { contentType: file.type });
  if (error) throw new Error('Could not upload this picture. Please try again.');
  const urls = await signedImages(db, [key]);
  return { key, url: urls[key] || '' };
}

// Published pictures are copied from the private drafts bucket to the public bucket under the same name.
async function publishImages(db, keys) {
  for (const key of [...new Set(keys)]) {
    const { data, error } = await db.storage.from(DRAFTS_BUCKET).download(key);
    if (error || !data) throw new Error('A picture in this post could not be published. Ask the author to add it again.');
    const ext = key.split('.').pop(), type = Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)?.[0];
    const { error: up } = await db.storage.from(PUBLIC_BUCKET).upload(key, Buffer.from(await data.arrayBuffer()), { contentType: type, upsert: true });
    if (up) throw new Error('A picture in this post could not be published. Please try again.');
  }
}

// submit / revise (the author) and approve / changes / reject / unpublish (staff admin). blogStep (lib/blog.js)
// decides; the update only succeeds if nobody changed the post's status in between.
export async function stepPost(db, user, id, step, { note, confirm } = {}, now = new Date()) {
  const post = await findPost(db, user, id);
  const patch = blogStep(post, step, user, { note, confirm, now });
  if (step === 'approve') {
    await publishImages(db, imageKeys(post.draft));
    if (!post.slug) patch.slug = await uniqueSlug(post.draft.title, async s => { const { data } = await db.from('blog_posts').select('id').eq('slug', s).maybeSingle(); return !!data; });
  }
  const { data, error } = await db.from('blog_posts').update({ ...toRow(patch), updated_at: now.toISOString() }).eq('id', post.id).eq('status', post.status).select('*').maybeSingle();
  if (error) throw new Error('Could not save this change. Please try again.');
  if (!data) throw err('This post was just changed by someone else. Reload it and try again.', 409);
  await audit(db, user.id, 'blog-' + step, post.id);
  const saved = mapPost(data);
  await notifyStep(db, saved, step);
  return saved;
}

export async function deletePost(db, user, id) {
  const post = await findPost(db, user, id);
  if (!canDeletePost(post, user)) throw err('Only a post that was never published can be deleted.', 409);
  const { error } = await db.from('blog_posts').delete().eq('id', post.id);
  if (error) throw new Error('Could not delete this post. Please try again.');
  for (const bucket of [DRAFTS_BUCKET, PUBLIC_BUCKET]) {
    const { data } = await db.storage.from(bucket).list(post.id, { limit: 1000 });
    const files = (data || []).map(f => post.id + '/' + f.name);
    if (files.length) { const { error: rm } = await db.storage.from(bucket).remove(files); if (rm) console.error('Blog pictures not removed:', rm.message); }
  }
  await audit(db, user.id, 'blog-delete', post.id);
  return { id: post.id };
}

// Staff admin approve a reader's comment (it then shows on the post) or delete it.
export async function moderateComment(db, user, id, approve, now = new Date()) {
  if (!isReviewer(user)) throw err('Only staff admin can moderate comments.', 403);
  const q = db.from('blog_comments');
  const { data, error } = approve
    ? await q.update({ status: 'approved', reviewed_at: now.toISOString(), reviewed_by: user.id }).eq('id', String(id || '')).select('id').maybeSingle()
    : await q.delete().eq('id', String(id || '')).select('id').maybeSingle();
  if (error) throw new Error('Could not save this change. Please try again.');
  if (!data) throw err('Comment not found.', 404);
  await audit(db, user.id, approve ? 'blog-comment-approve' : 'blog-comment-delete', data.id);
  return { id: data.id };
}

// Readers ---------------------------------------------------------------------------------------------------------
async function affiliateSlugs(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await db.from('affiliates').select('id,slug').in('id', list).eq('active', true);
  return Object.fromEntries((data || []).map(a => [a.id, a.slug]));
}
// Published posts that have reached their date, newest first, as readers see them.
export async function loadPublishedPosts(db, now = new Date()) {
  const { data, error } = await db.from('blog_posts').select('*').not('published', 'is', null).lte('published_at', now.toISOString()).order('published_at', { ascending: false }).limit(200);
  if (error) { if (error.code !== '42P01') console.error('Blog posts not loaded:', error.code); return []; }
  const posts = data.map(mapPost), slugs = await affiliateSlugs(db, posts.map(p => p.authorAffiliate));
  return posts.map(p => publicPost(p, { imageUrl: k => publicUrl(db, k), affiliateSlug: slugs[p.authorAffiliate], now })).filter(Boolean);
}
// One published post and its approved comments (a first name, the comment and its date only), or null.
export async function loadPublishedPost(db, slug, now = new Date()) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const { data, error } = await db.from('blog_posts').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) return null;
  const post = mapPost(data), slugs = await affiliateSlugs(db, [post.authorAffiliate]);
  const view = publicPost(post, { imageUrl: k => publicUrl(db, k), affiliateSlug: slugs[post.authorAffiliate], now });
  if (!view) return null;
  const { data: c } = await db.from('blog_comments').select('id,name,body,created_at').eq('post_id', post.id).eq('status', 'approved').order('created_at').limit(500);
  return { post: view, comments: (c || []).map(x => ({ id: x.id, name: x.name, body: x.body, createdAt: x.created_at })) };
}
// A reader's comment: on a live post that allows comments, at most COMMENTS_PER_HOUR an hour from one address. It
// waits for staff approval before anyone sees it.
export async function addComment(db, input, hash, now = new Date()) {
  const comment = validateComment(input);
  const slug = typeof input?.slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) ? input.slug : '';
  const { data: row } = slug ? await db.from('blog_posts').select('*').eq('slug', slug).maybeSingle() : { data: null };
  const live = row && publicPost(mapPost(row), { imageUrl: k => k, now });
  if (!live || !live.comments) throw err('Comments are closed on this post.', 404);
  const { count } = await db.from('blog_comments').select('id', { count: 'exact', head: true }).eq('request_hash', hash).gte('created_at', new Date(now.getTime() - 3600000).toISOString());
  if ((count || 0) >= COMMENTS_PER_HOUR) throw err('Too many comments. Please try again later.', 429);
  const { error } = await db.from('blog_comments').insert({ post_id: row.id, name: comment.name, body: comment.body, status: 'pending', request_hash: hash });
  if (error) throw new Error('Your comment could not be sent. Please try again.');
  return { ok: true };
}

// Emails (Resend, optional): staff admin hear about each submitted post, authors about each decision. Nothing is
// sent until RESEND_API_KEY and RESEND_FROM are set, and a failed email never undoes the step.
export function blogEmail(post, step, site = clinic.site) {
  const title = post.draft?.title || 'Untitled post', by = bylineName(post.authorName);
  if (step === 'submit') return { to: 'review', subject: 'Blog post to review: ' + title, text: `${by} submitted “${title}” for review.\n\nOpen the review queue: ${site}/admin/blog` };
  const back = { affiliate: '/affiliate/blog', 'front-desk': '/desk/blog', staff: '/admin/blog' }[post.authorRole] || '/login';
  const note = post.reviewNote ? `\n\nNote from the clinic: ${post.reviewNote}` : '';
  if (step === 'approve') return { to: 'author', subject: 'Your blog post is approved', text: `“${title}” is approved${new Date(post.publishedAt) > new Date() ? ' and will go live on ' + new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.publishedAt)) : ' and live on the blog'}.\n\n${site}/blog/${post.slug}` };
  if (step === 'changes') return { to: 'author', subject: 'Changes requested on your blog post', text: `The clinic asked for changes to “${title}”.${note}\n\nEdit it here: ${site}${back}` };
  if (step === 'reject') return { to: 'author', subject: 'Your blog post was not published', text: `The clinic decided not to publish “${title}”.${note}` };
  return null;
}
async function notifyStep(db, post, step) {
  const mail = blogEmail(post, step);
  if (!mail || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  try {
    const to = mail.to === 'review' ? (process.env.BLOG_REVIEW_EMAIL || clinic.email) : await authorEmail(db, post);
    if (!to) return;
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'blog-' + step + '-' + post.id + '-' + post.updatedAt }, body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject: mail.subject, text: mail.text }), signal: AbortSignal.timeout(10000) });
    if (!res.ok) console.error('Blog email not sent:', res.status);
  } catch (e) { console.error('Blog email not sent:', e?.message); }
}
