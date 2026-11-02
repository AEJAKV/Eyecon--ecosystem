import { DEMO } from '@/lib/config';
import { adminClient } from '@/lib/server';
import { loadPublishedPosts } from '@/lib/blog-server';
import { BlogIndex } from '@/components/blog-public';
import { DemoBlogIndex } from '@/components/blog-demo';
// The blog: published posts, newest first, filtered by ?category= or ?tag=. Rendered on each request so a scheduled
// post appears once its time comes. The demo reads this browser's demo data.
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'Blog · Eyecon Optometry'},description:'Eye health, frames and news from Eyecon Optometry in Edmonton.'};
const one=v=>typeof v==='string'?v:'';
export default async function Page({searchParams}){
  const {category,tag}=await searchParams;
  if(DEMO)return <DemoBlogIndex category={one(category)} tag={one(tag)}/>;
  let posts=[];try{posts=await loadPublishedPosts(adminClient());}catch(e){console.error('Blog not loaded:',e?.message);}
  return <BlogIndex posts={posts} category={one(category)} tag={one(tag)}/>;
}
