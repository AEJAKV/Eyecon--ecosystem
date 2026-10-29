import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Front desk',robots:{index:false,follow:false}};
// The front desk: Bookings, Gift cards and Leads only (see lib/front-desk.js).
export default async function Page({params}){const {section=[]}=await params;if(section.length>1||!['','gift-cards','leads'].includes(section[0]||''))notFound();return <Workspace role="front-desk" section={section[0]||''}/>;}
