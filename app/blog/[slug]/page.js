import { notFound } from 'next/navigation';
import { DEMO, clinic } from '@/lib/config';
import { adminClient } from '@/lib/server';
import { loadPublishedPost } from '@/lib/blog-server';
import { demoPublicPosts, seedDemo } from '@/lib/demo';
import { BlogPostPage } from '@/components/blog-public';
import { DemoBlogPost } from '@/components/blog-demo';
// One published post with its approved comments. A draft, a post waiting for its date or an unpublished post is
// not found. The link preview uses the post's title, summary and cover picture.
export const dynamic='force-dynamic';
async function load(slug){try{return await loadPublishedPost(adminClient(),slug);}catch(e){console.error('Blog post not loaded:',e?.message);return null;}}
export async function generateMetadata({params}){
  const {slug}=await params;
  const post=DEMO?demoPublicPosts(seedDemo()).find(p=>p.slug===slug):(await load(slug))?.post;
  if(!post)return {title:'Blog'};
  const base=/^https?:\/\//.test(clinic.site)?{metadataBase:new URL(clinic.site)}:{};
  return {...base,title:{absolute:post.title+' · Eyecon Optometry'},description:post.excerpt,openGraph:{type:'article',title:post.title,description:post.excerpt,publishedTime:post.publishedAt,...(post.cover?.url&&!post.cover.url.startsWith('data:')?{images:[{url:post.cover.url,alt:post.cover.alt}]}:{})}};
}
export default async function Page({params}){
  const {slug}=await params;
  if(DEMO)return <DemoBlogPost slug={slug}/>;
  const found=await load(slug);if(!found)notFound();
  return <BlogPostPage post={found.post} comments={found.comments}/>;
}
