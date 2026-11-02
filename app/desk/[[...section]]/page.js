import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
import { BLOG_POST_ID } from '@/lib/blog';
export const metadata={title:'Front desk',robots:{index:false,follow:false}};
// The front desk: Bookings, Gift cards and Leads (see lib/front-desk.js), and the Blog, with /desk/blog/[post id].
export default async function Page({params}){const {section=[]}=await params;const [name='',item='']=section;if(section.length>2||!['','gift-cards','leads','blog'].includes(name)||(section.length===2&&!(name==='blog'&&BLOG_POST_ID.test(item))))notFound();return <Workspace role="front-desk" section={name} item={item}/>;}
