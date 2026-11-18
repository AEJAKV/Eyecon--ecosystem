import { notFound } from 'next/navigation';
import { DEMO, clinic } from '@/lib/config';
import { adminClient } from '@/lib/server';
import { loadPublishedPost } from '@/lib/blog-server';
import { demoPublicPosts, seedDemo } from '@/lib/demo';
import { BlogPostPage } from '@/components/blog-public';
import { PostSchema } from '@/components/schema';
import { canonicalFor,pageSocial } from '@/lib/seo';
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
  return {...base,title:{absolute:post.title+' · Eyecon Optometry'},description:post.excerpt,alternates:canonicalFor('/blog/'+post.slug),...pageSocial({title:post.title,description:post.excerpt,type:'article',image:post.cover?.url&&!post.cover.url.startsWith('data:')?{url:post.cover.url,alt:post.cover.alt}:null,og:{publishedTime:post.publishedAt}})};
}
export default async function Page({params}){
  const {slug}=await params;
  if(DEMO)return <><PostSchema post={demoPublicPosts(seedDemo()).find(p=>p.slug===slug)}/><DemoBlogPost slug={slug}/></>;
  const found=await load(slug);if(!found)notFound();
  return <><PostSchema post={found.post}/><BlogPostPage post={found.post} comments={found.comments}/></>;
}
