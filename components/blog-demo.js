'use client';
import { useApp } from './provider';
import { Loading } from './ui';
import { BlogIndex, BlogPostPage, MissingPost } from './blog-public';
import { demoPublicPosts, demoApprovedComments } from '@/lib/demo';

// The demo blog reads this browser's demo data, so posts approved in the demo workspace show up here.
export function DemoBlogIndex({ category, tag }) {
  const { data, ready } = useApp();
  if (!ready) return <Loading />;
  return <BlogIndex posts={demoPublicPosts(data)} category={category} tag={tag} sample />;
}
export function DemoBlogPost({ slug }) {
  const { data, ready } = useApp();
  if (!ready) return <Loading />;
  const post = demoPublicPosts(data).find(p => p.slug === slug);
  // notFound() is for server code only, so the demo shows the same message itself.
  if (!post) return <MissingPost />;
  return <BlogPostPage post={post} comments={demoApprovedComments(data, slug)} sample />;
}
