import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
// /admin/[section], plus /admin/affiliates/[slug] for one affiliate's performance page.
export default async function Page({params}){const {section=[]}=await params;const [name='',item='']=section;if(section.length>2||!['','affiliates','leads','payouts','pricing','messages'].includes(name)||(section.length===2&&(name!=='affiliates'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item))))notFound();return <Workspace role="staff" section={name} item={item}/>;}
