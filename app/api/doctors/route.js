import { DEMO, clinic, placeholderDoctors } from '@/lib/config';
import { adminClient, identity, requireStaff, sameOrigin, fail, audit, loadDoctorDirectory, generateSlots } from '@/lib/server';
import { websiteList, publicDoctor, validateDoctorProfile, validateWeeklyHours, validateTimeOff, validateExtraHours, bookingsInTimeOff, doctorRow, mapTimeOffRow } from '@/lib/schedule';
export const dynamic='force-dynamic';
// Optometrists (migration 010).
//  GET: the optometrists the website shows, with public profile fields only (no schedules). Cached briefly by the CDN.
//  POST (staff only): change profiles, photos, hours, time off and extra days. Every schedule change regenerates that
//  optometrist's bookable times straight away. Optometrists are hidden, never deleted, so past bookings keep a name.
export async function GET(){
  try{
    const list=DEMO?placeholderDoctors:await loadDoctorDirectory(adminClient());
    return Response.json({doctors:websiteList(list).map(publicDoctor)},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}});
  }catch(e){return fail(e,503);}
}
const IMAGE_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function imageOk(type,bytes){
  if(type==='image/png')return bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
  if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/webp')return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  return false;
}
async function existing(db,slug){
  const {data}=await db.from('doctors').select('slug').eq('slug',String(slug||'')).maybeSingle();
  if(!data)throw new Error('Optometrist not found.');
  return data.slug;
}
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo workspace.'),409);
    const u=await identity(request);requireStaff(u);const db=u.db;
    // Portrait upload: JPG, PNG or WebP up to 2 MB, checked by file signature, into the public doctor-photos bucket.
    if(request.headers.get('content-type')?.includes('multipart/form-data')){
      const form=await request.formData(),file=form.get('file'),slug=await existing(db,form.get('doctor'));
      if(!file||typeof file.arrayBuffer!=='function'||file.size>2097152||!IMAGE_TYPES[file.type])throw new Error('Upload a JPG, PNG or WebP image smaller than 2 MB.');
      const bytes=Buffer.from(await file.arrayBuffer());if(!imageOk(file.type,bytes))throw new Error('The file does not match its image type.');
      const key=slug+'/'+crypto.randomUUID()+'.'+IMAGE_TYPES[file.type];
      const {error}=await db.storage.from('doctor-photos').upload(key,bytes,{contentType:file.type});if(error)throw new Error('Could not upload this image.');
      const {data:url}=db.storage.from('doctor-photos').getPublicUrl(key);
      const {error:ue}=await db.from('doctors').update({photo:url.publicUrl,photo_alt:'',updated_at:new Date().toISOString()}).eq('slug',slug);if(ue)throw new Error('Could not save this image.');
      await audit(db,u.id,'doctor-photo',slug);return Response.json({ok:true});
    }
    const {action,payload:p={}}=await request.json();
    if(action==='doctor'){
      // Add (p.isNew) or edit a profile. The page name (slug) is set when the optometrist is added and never changes.
      const d=validateDoctorProfile(p);
      if(p.isNew){
        const {data:taken}=await db.from('doctors').select('slug').eq('slug',d.slug).maybeSingle();if(taken)throw new Error('An optometrist with this page name already exists.');
        const {data:last}=await db.from('doctors').select('display_order').order('display_order',{ascending:false}).limit(1);
        const {error}=await db.from('doctors').insert({...doctorRow(d),display_order:(last?.[0]?.display_order||0)+1});if(error)throw new Error('Could not add this optometrist.');
      }else{
        const slug=await existing(db,d.slug);
        const {error}=await db.from('doctors').update(doctorRow(d)).eq('slug',slug);if(error)throw new Error('Could not save this optometrist.');
        // Shown or hidden and the appointment length both change which times are open.
        await generateSlots(db,slug);
      }
      await audit(db,u.id,p.isNew?'doctor-add':'doctor',d.slug);return Response.json({ok:true,slug:d.slug});
    }
    if(action==='doctor-order'){
      const slugs=Array.isArray(p.slugs)?p.slugs.map(String).slice(0,50):[];
      for(const [i,slug] of slugs.entries())await db.from('doctors').update({display_order:i+1}).eq('slug',slug);
      await audit(db,u.id,action,'batch');return Response.json({ok:true});
    }
    if(action==='doctor-hours'){
      const slug=await existing(db,p.doctor),hours=validateWeeklyHours(p.hours);const minutes=Number(p.slotMinutes);
      const {data,error}=await db.rpc('save_doctor_hours',{p_doctor:slug,p_slot_minutes:minutes,p_hours:hours,p_timezone:clinic.timezone});
      if(error)throw new Error(error.message.includes('slot_minutes')?'Choose an appointment length of 15, 30, 45, 60 or 90 minutes.':'Could not save these hours.');
      await audit(db,u.id,action,slug);return Response.json({ok:true,added:data||0});
    }
    if(action==='time-off-add'){
      const slug=await existing(db,p.doctor),off=validateTimeOff(p,clinic.timezone);
      const {data:row,error}=await db.from('doctor_time_off').insert({doctor:slug,starts_at:off.startsAt,ends_at:off.endsAt,reason:off.reason}).select('*').single();if(error)throw new Error('Could not save this time off.');
      await generateSlots(db,slug);
      // Appointments already booked inside the time off are kept; staff get the list of patients to rebook.
      const {data:booked}=await db.from('bookings').select('name,start,duration,doctor,status').eq('doctor',slug).eq('status','Booked').lt('start',off.endsAt).gte('start',new Date(new Date(off.startsAt).getTime()-90*60000).toISOString());
      await audit(db,u.id,action,row.id);return Response.json({ok:true,timeOff:mapTimeOffRow(row),rebook:bookingsInTimeOff(booked,slug,off)});
    }
    if(action==='time-off-remove'){
      const {data:row,error}=await db.from('doctor_time_off').delete().eq('id',Number(p.id)).select('doctor').maybeSingle();if(error||!row)throw new Error('Time off not found.');
      await generateSlots(db,row.doctor);await audit(db,u.id,action,p.id);return Response.json({ok:true});
    }
    if(action==='extra-add'){
      const slug=await existing(db,p.doctor),x=validateExtraHours(p);
      const {error}=await db.from('doctor_extra_hours').insert({doctor:slug,day:x.day,start_time:x.start,end_time:x.end});if(error)throw new Error('Could not save these extra hours.');
      await generateSlots(db,slug);await audit(db,u.id,action,slug);return Response.json({ok:true});
    }
    if(action==='extra-remove'){
      const {data:row,error}=await db.from('doctor_extra_hours').delete().eq('id',Number(p.id)).select('doctor').maybeSingle();if(error||!row)throw new Error('Extra hours not found.');
      await generateSlots(db,row.doctor);await audit(db,u.id,action,p.id);return Response.json({ok:true});
    }
    throw new Error('Unknown action.');
  }catch(e){return fail(e);}
}
