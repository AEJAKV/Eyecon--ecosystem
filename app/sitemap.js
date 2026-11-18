import { DEMO, clinic, collections } from '@/lib/config';
import { adminClient } from '@/lib/server';
import { loadPublishedPosts } from '@/lib/blog-server';
import { sitemapFor } from '@/lib/seo';
// sitemap.xml: the public pages, every brand page and each published blog post. Refreshed every hour. The demo site
// is not indexed (robots.js), so it lists the fixed pages only. /booking and /my-booking are noindex and not listed.
// The fixed pages are dated with the time of the build: nothing records when each page's wording last changed.
export const revalidate=3600;
const BUILT=new Date();
export default async function sitemap(){
  let posts=[];
  if(!DEMO){try{posts=await loadPublishedPosts(adminClient());}catch(e){console.error('Sitemap: blog not loaded:',e?.message);}}
  return sitemapFor(clinic.site,{collections,posts,lastModified:BUILT});
}
