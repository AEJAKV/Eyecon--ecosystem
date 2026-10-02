import { DEMO } from '@/lib/config';
import { demoSlots } from '@/lib/demo';
import { adminClient, fail, publicAffiliate } from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(request) {
  try {
    if(DEMO)return Response.json({slots:demoSlots()});
    const db=adminClient(),slug=new URL(request.url).searchParams.get('affiliate');let affiliate=null;
    if(slug){const {data,error}=await db.from('affiliates').select('*').eq('slug',slug).eq('active',true).single();if(error)return fail(new Error('This referral page is unavailable.'),404);affiliate=publicAffiliate(data);}
    const {data,error}=await db.rpc('available_slots');if(error)throw new Error('Appointment times are temporarily unavailable.');
    return Response.json({slots:data,affiliate},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,503);}
}
