import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
import { BLOG_POST_ID } from '@/lib/blog';
export const metadata={title:'Affiliate workspace',robots:{index:false,follow:false}};
// /affiliate/[section], plus /affiliate/blog/[post id] for one of their posts.
export default async function Page({params}){const {section=[]}=await params;const [name='',item='']=section;if(section.length>2||!['','referrals','link','earnings','blog','profile'].includes(name)||(section.length===2&&!(name==='blog'&&BLOG_POST_ID.test(item))))notFound();return <Workspace role="affiliate" section={name} item={item}/>;}
