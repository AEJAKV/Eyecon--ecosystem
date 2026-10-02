import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
export default async function Page({params}){const {section=[]}=await params;if(section.length>1||!['','affiliates','leads','payouts','messages'].includes(section[0]||''))notFound();return <Workspace role="staff" section={section[0]||''}/>;}
