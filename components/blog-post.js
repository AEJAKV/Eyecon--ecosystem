import Link from 'next/link';
import { clinic } from '@/lib/config';
import { bylineInitials, categorySlug } from '@/lib/blog';

// How a blog post looks: the public pages (/blog, /blog/[slug]) and the editor's Preview both use these, so authors see
// exactly what readers will. A post here is publicPost's shape (lib/blog.js): text is runs, drawn as React elements,
// never as HTML. No hooks, so server and client pages can both use them.
export const postDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'long' }).format(new Date(iso));

export function Runs({ runs }) {
  return (runs || []).map((r, i) => {
    const lines = r.t.split('\n');
    let node = lines.flatMap((l, j) => j ? [<br key={'b' + j} />, l] : [l]);
    if (r.i) node = <em>{node}</em>;
    if (r.b) node = <strong>{node}</strong>;
    if (r.href) node = r.href.startsWith('/') ? <Link href={r.href}>{node}</Link> : <a href={r.href} target="_blank" rel="noopener noreferrer">{node}</a>;
    return <span key={i}>{node}</span>;
  });
}

function Block({ b, bookingHref }) {
  if (b.type === 'paragraph') return b.text?.length ? <p><Runs runs={b.text} /></p> : null;
  if (b.type === 'heading') return b.text ? (b.level === 3 ? <h3>{b.text}</h3> : <h2>{b.text}</h2>) : null;
  if (b.type === 'list') { const items = b.items.filter(i => i.length).map((i, n) => <li key={n}><Runs runs={i} /></li>); return items.length ? (b.ordered ? <ol>{items}</ol> : <ul>{items}</ul>) : null; }
  if (b.type === 'quote') return b.text?.length ? <blockquote><p><Runs runs={b.text} /></p>{b.cite && <cite>{b.cite}</cite>}</blockquote> : null;
  if (b.type === 'image') return b.url ? <figure><img src={b.url} alt={b.alt} loading="lazy" />{b.caption && <figcaption>{b.caption}</figcaption>}</figure> : null;
  if (b.type === 'button') return <p className="post-cta"><Link className="button" href={bookingHref}>{b.label} →</Link></p>;
  return null;
}

export function Byline({ post }) {
  return <div className="post-byline">
    <span className="post-avatar" aria-hidden="true">{bylineInitials(post.byline)}</span>
    <span><strong>{post.byline}</strong><small>{post.publishedAt ? postDate(post.publishedAt) : 'Not published yet'} · {post.minutes} min read</small></span>
  </div>;
}

export function PostArticle({ post, children }) {
  return <article className="post">
    <header className="post-head">
      {post.category ? <Link className="post-eyebrow" href={'/blog?category=' + categorySlug(post.category)}>{post.category}</Link> : <p className="post-eyebrow">Category</p>}
      <h1>{post.title || 'Untitled post'}</h1>
      {post.excerpt && <p className="post-dek">{post.excerpt}</p>}
      <Byline post={post} />
    </header>
    {post.cover?.url && <figure className="post-cover"><img src={post.cover.url} alt={post.cover.alt} /></figure>}
    <div className="post-body">{post.blocks.map(b => <Block key={b.id} b={b} bookingHref={post.bookingHref} />)}</div>
    {post.tags.length > 0 && <ul className="post-tags" aria-label="Tags">{post.tags.map(t => <li key={t}><Link href={'/blog?tag=' + encodeURIComponent(t.replace(/ /g, '-'))}>#{t}</Link></li>)}</ul>}
    {children}
  </article>;
}

export function PostCard({ post }) {
  return <article className="post-card">
    <Link href={'/blog/' + post.slug} className="post-card-link">
        <span className="post-card-image">{post.cover?.url ? <img src={post.cover.url} alt="" loading="lazy" /> : null}</span>
      <span className="post-card-text">
        {post.category && <span className="post-eyebrow">{post.category}</span>}
        <strong>{post.title}</strong>
        <span className="post-card-dek">{post.excerpt}</span>
        <small>{post.byline} · {postDate(post.publishedAt)} · {post.minutes} min read</small>
      </span>
    </Link>
  </article>;
}
