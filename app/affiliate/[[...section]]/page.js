import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Affiliate workspace',robots:{index:false,follow:false}};
export default async function Page({params}){const {section=[]}=await params;if(section.length>1||!['','referrals','link','earnings','profile'].includes(section[0]||''))notFound();return <Workspace role="affiliate" section={section[0]||''}/>;}
