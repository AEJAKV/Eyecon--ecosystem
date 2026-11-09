import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
import { BLOG_POST_ID } from '@/lib/blog';
export const metadata={title:'Admin workspace',robots:{index:false,follow:false}};
// /admin/[section], plus /admin/affiliates/[slug] for one affiliate's performance page and /admin/blog/[post id].
export default async function Page({params}){const {section=[]}=await params;const [name='',item='']=section;if(section.length>2||!['','gift-cards','doctors','affiliates','leads','payouts','pricing','messages','blog','team'].includes(name)||(section.length===2&&!(name==='affiliates'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item))&&!(name==='blog'&&BLOG_POST_ID.test(item))))notFound();return <Workspace role="staff" section={name} item={item}/>;}
