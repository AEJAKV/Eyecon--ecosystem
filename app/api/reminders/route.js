import { adminClient, mapBooking, fail } from '@/lib/server';
import { claimAndSend } from '@/lib/notifications';
export const dynamic='force-dynamic';
export async function GET(request){
  const secret=process.env.CRON_SECRET;if(!secret||secret.length<32||request.headers.get('authorization')!=='Bearer '+secret)return fail(new Error('Unauthorized.'),401);
  try{const db=adminClient(),now=Date.now();const {data,error}=await db.from('bookings').select('*').eq('status','Booked').gte('start',new Date(now).toISOString()).lte('start',new Date(now+26*3600000).toISOString());if(error)throw new Error('Could not load reminders.');let count=0;for(const row of data){const hours=(new Date(row.start).getTime()-now)/3600000;const kind=hours<=2?'same-day':hours>=22?'day-before':null;if(kind){await claimAndSend(db,mapBooking(row),kind);count++;}}return Response.json({processed:count});}catch(e){return fail(e,500);}
}
