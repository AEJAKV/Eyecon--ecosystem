import { DEMO, clinic, collections } from '@/lib/config';
import { adminClient } from '@/lib/server';
import { loadPublishedPosts } from '@/lib/blog-server';
// sitemap.xml: the public pages, every brand page and each published blog post. Refreshed every hour. The demo site
// is not indexed (robots.js), so it lists the fixed pages only.
export const revalidate=3600;
export default async function sitemap(){
  const at=path=>new URL(path,clinic.site).toString();
  const pages=['/','/booking','/shop','/blog','/my-booking','/privacy','/gift-card-terms',...collections.map(c=>'/shop/'+c.slug)].map(p=>({url:at(p)}));
  if(DEMO)return pages;
  let posts=[];try{posts=await loadPublishedPosts(adminClient());}catch(e){console.error('Sitemap: blog not loaded:',e?.message);}
  return [...pages,...posts.map(p=>({url:at('/blog/'+p.slug),lastModified:p.publishedAt}))];
}
