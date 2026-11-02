import Link from 'next/link';
import { Header, Footer } from './ui';
import { PostArticle, PostCard } from './blog-post';
import BlogComments from './blog-comments';
import { BLOG_CATEGORIES, categorySlug, categoryFromSlug, filterPosts } from '@/lib/blog';

// The public blog. posts come from loadPublishedPosts (live) or demoPublicPosts (demo); both are publicPost's shape,
// so readers only ever get the published copy and the short byline. sample marks demo placeholder content.
export function BlogIndex({ posts, category = '', tag = '', sample = false }) {
  const cat = categoryFromSlug(category), shown = filterPosts(posts, { category: cat ? category : '', tag });
  const used = BLOG_CATEGORIES.filter(c => posts.some(p => p.category === c));
  return <>
    <Header />
    <main id="main-content" className="blog-page">
      <section className="blog-hero">
        <p className="eyebrow">THE EYECON JOURNAL</p>
        <h1>Notes on <em>seeing well</em></h1>
        <p>Eye health, frames and news from the clinic, written by the Eyecon team and the people who know us best.</p>
        {sample && <span className="blog-sample-note">Sample posts</span>}
      </section>
      {used.length > 1 && <nav className="blog-filters" aria-label="Categories">
        <Link href="/blog" aria-current={!cat && !tag ? 'page' : undefined}>All</Link>
        {used.map(c => <Link key={c} href={'/blog?category=' + categorySlug(c)} aria-current={cat === c ? 'page' : undefined}>{c}</Link>)}
      </nav>}
      {tag && <p className="blog-filters">Tagged “{tag.replace(/-/g, ' ')}” · <Link href="/blog">Show all posts</Link></p>}
      {shown.length ? <div className="blog-grid-list">{shown.map(p => <PostCard key={p.slug} post={p} />)}</div> : <p className="blog-empty">{posts.length ? 'No posts match. ' : 'The first posts are on their way. '}<Link href="/blog">See all posts</Link></p>}
    </main>
    <Footer />
  </>;
}

export function BlogPostPage({ post, comments, sample = false }) {
  return <>
    <Header bookingHref={post.bookingHref} />
    <main id="main-content" className="blog-page">
      <p className="blog-back"><Link href="/blog">← All posts</Link>{sample && <span className="blog-sample-note">Sample post</span>}</p>
      <PostArticle post={post}>
        {post.comments && <BlogComments slug={post.slug} comments={comments} />}
      </PostArticle>
    </main>
    <Footer />
  </>;
}

export function MissingPost() {
  return <>
    <Header />
    <main id="main-content" className="blog-page"><section className="blog-hero"><p className="eyebrow">THE EYECON JOURNAL</p><h1>This post isn’t available</h1><p>It may not be published yet, or it was taken down. <Link href="/blog">See all posts</Link></p></section></main>
    <Footer />
  </>;
}
