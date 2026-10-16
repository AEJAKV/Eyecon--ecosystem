# Full folder structure

```text
eyecon-module-1/
├── .env.example
├── .gitignore
├── AGENTS.md
├── app/
│   ├── admin/
│   │   └── [[...section]]/
│   │       └── page.js
│   ├── affiliate/
│   │   └── [[...section]]/
│   │       └── page.js
│   ├── api/
│   │   ├── availability/
│   │   │   └── route.js
│   │   ├── bookings/
│   │   │   └── route.js
│   │   ├── reminders/
│   │   │   └── route.js
│   │   └── workspace/
│   │       └── route.js
│   ├── book/
│   │   └── [slug]/
│   │       └── page.js
│   ├── booking/
│   │   └── page.js
│   ├── error.js
│   ├── globals.css
│   ├── icon.svg
│   ├── layout.js
│   ├── login/
│   │   └── page.js
│   ├── not-found.js
│   ├── page.js
│   ├── privacy/
│   │   └── page.js
│   └── robots.js
├── CLAUDE.md
├── components/
│   ├── booking-flow.js
│   ├── landing.js
│   ├── login-form.js
│   ├── provider.js
│   ├── ui.js
│   └── workspace.js
├── jsconfig.json
├── lib/
│   ├── calendar.js
│   ├── config.js
│   ├── demo.js
│   ├── notifications.js
│   ├── server.js
│   ├── supabase.js
│   └── validation.js
├── next.config.mjs
├── package-lock.json
├── package.json
├── public/
│   └── images/
│       ├── affiliate.webp
│       ├── doctor1.webp
│       ├── doctor2.webp
│       └── hero.webp
├── README.md
├── scripts/
│   └── generate-code-guide.mjs
├── supabase/
│   └── schema.sql
├── tests/
│   └── core.test.js
└── SOURCE_CODE.md
```

The ZIP contains these files in their actual folders. `node_modules`, `.next` and `.env.local` are created on your machine and are deliberately excluded. `SOURCE_CODE.md` is this generated guide.

# Complete source files

Every text source file is reproduced below, including the lockfile. Create each file at its exact relative path. The image restoration command follows the source; the full README and setup instructions are last.

## .env.example

```text
# Demo is the default. Use only fictional patient data in demo mode.
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CLINIC_PHONE=
NEXT_PUBLIC_CLINIC_EMAIL=
NEXT_PUBLIC_CLINIC_ADDRESS=
NEXT_PUBLIC_CLINIC_HOURS=
NEXT_PUBLIC_CLINIC_TIMEZONE=America/Toronto
# Optional verified Google Business profile URL. No fabricated rating is shown.
NEXT_PUBLIC_REVIEWS_URL=
# Live services: set demo mode false AFTER completing README setup.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# 32-byte key encoded as 64 hexadecimal characters. Never prefix NEXT_PUBLIC_.
INSURANCE_ENCRYPTION_KEY=
# Required for public live booking. Use the matching Turnstile site and secret keys.
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
# Optional real confirmation email and SMS services.
RESEND_API_KEY=
RESEND_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
# Random secret, at least 32 characters. For scheduled reminders.
CRON_SECRET=
```

## .gitignore

```text
node_modules/
.next/
.env*
!.env.example
.DS_Store
*.log
.vercel/
coverage/
```

## AGENTS.md

```markdown
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
```

## app/admin/[[...section]]/page.js

```javascript
import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Staff workspace',robots:{index:false,follow:false}};
export default async function Page({params}){const {section=[]}=await params;if(section.length>1||!['','affiliates','leads','payouts','messages'].includes(section[0]||''))notFound();return <Workspace role="staff" section={section[0]||''}/>;}
```

## app/affiliate/[[...section]]/page.js

```javascript
import { notFound } from 'next/navigation';
import Workspace from '@/components/workspace';
export const metadata={title:'Affiliate workspace',robots:{index:false,follow:false}};
export default async function Page({params}){const {section=[]}=await params;if(section.length>1||!['','referrals','link','earnings','profile'].includes(section[0]||''))notFound();return <Workspace role="affiliate" section={section[0]||''}/>;}
```

## app/api/availability/route.js

```javascript
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
```

## app/api/bookings/route.js

```javascript
import { createHash } from 'node:crypto';
import { DEMO } from '@/lib/config';
import { validateBooking } from '@/lib/validation';
import { adminClient, encryptPolicy, mapBooking, sameOrigin, fail } from '@/lib/server';
import { claimAndSend } from '@/lib/notifications';
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo booking flow.'),409);
    const raw=await request.json();if(raw.website)return fail(new Error('Unable to process this booking.'));
    if(!process.env.TURNSTILE_SECRET_KEY)throw new Error('Online booking verification is not configured. Please contact the clinic.');
    const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:String(raw.captcha||'')}),signal:AbortSignal.timeout(10000)}).then(r=>r.json());
    if(!verify.success || verify.hostname!==new URL(request.url).hostname || verify.action!=='booking')throw new Error('Please complete the booking verification and try again.');
    const b=validateBooking(raw),db=adminClient();
    const requestHash=createHash('sha256').update((request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')+process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex');
    const {data,error}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:requestHash});
    if(error)throw new Error(error.message.includes('rate limit')?'Too many booking attempts. Please contact the clinic.':error.message.includes('affiliate')?'This referral is no longer available.':'That appointment time is no longer available. Please choose another.');
    const saved=mapBooking(data[0]),notifications=await claimAndSend(db,saved,'confirmation');
    return Response.json({booking:{id:saved.id,start:saved.start,duration:saved.duration,service:saved.service,affiliateId:saved.affiliateId,name:saved.name},notifications},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
```

## app/api/reminders/route.js

```javascript
import { adminClient, mapBooking, fail } from '@/lib/server';
import { claimAndSend } from '@/lib/notifications';
export const dynamic='force-dynamic';
export async function GET(request){
  const secret=process.env.CRON_SECRET;if(!secret||secret.length<32||request.headers.get('authorization')!=='Bearer '+secret)return fail(new Error('Unauthorized.'),401);
  try{const db=adminClient(),now=Date.now();const {data,error}=await db.from('bookings').select('*').eq('status','Booked').gte('start',new Date(now).toISOString()).lte('start',new Date(now+26*3600000).toISOString());if(error)throw new Error('Could not load reminders.');let count=0;for(const row of data){const hours=(new Date(row.start).getTime()-now)/3600000;const kind=hours<=2?'same-day':hours>=22?'day-before':null;if(kind){await claimAndSend(db,mapBooking(row),kind);count++;}}return Response.json({processed:count});}catch(e){return fail(e,500);}
}
```

## app/api/workspace/route.js

```javascript
import { identity, requireStaff, sameOrigin, fail, mapBooking, mapAffiliate, encryptPolicy, audit } from '@/lib/server';
import { clean, validateStatus, validateSlug, validateBooking, safePhoto } from '@/lib/validation';
import { claimAndSend } from '@/lib/notifications';
import { clinic } from '@/lib/config';
export const dynamic='force-dynamic';
export async function GET(request){
  try{const u=await identity(request);const db=u.db;
    if(u.role==='affiliate'){
      const [a,b]=await Promise.all([db.from('affiliates').select('*').eq('id',u.affiliateId).single(),db.from('bookings').select('id,name,status,start,commission,payout,paid_at').eq('affiliate_id',u.affiliateId).order('start',{ascending:false})]);
      if(a.error||b.error)throw new Error('Unable to load your referrals.');
      return Response.json({user:{role:u.role,affiliateId:u.affiliateId},affiliates:[mapAffiliate(a.data)],bookings:b.data.map(r=>({...r,commission:Number(r.commission),paidAt:r.paid_at})),templates:[],slots:[]},{headers:{'Cache-Control':'no-store'}});
    }
    requireStaff(u);
    const [a,b,t,s,j]=await Promise.all([db.from('affiliates').select('*').order('created_at'),db.from('bookings').select('*').order('start',{ascending:false}).limit(2000),db.from('message_templates').select('*').order('id'),db.rpc('available_slots'),db.from('notification_jobs').select('booking_id,kind,status,result,created_at').order('created_at',{ascending:false}).limit(100)]);
    if(a.error||b.error||t.error||s.error||j.error)throw new Error('Unable to load the workspace.');
    return Response.json({user:{role:'staff'},affiliates:a.data.map(mapAffiliate),bookings:b.data.map(mapBooking),templates:t.data,slots:s.data,jobs:j.data},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,401);}
}
export async function POST(request){
  try{sameOrigin(request);const u=await identity(request),db=u.db;
    if(request.headers.get('content-type')?.includes('multipart/form-data')){
      const form=await request.formData(),file=form.get('file'),id=u.role==='affiliate'?u.affiliateId:String(form.get('affiliateId'));
      if(!file || typeof file.arrayBuffer!=='function' || file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Upload a JPG, PNG or WebP image smaller than 2 MB.');
      const bytes=Buffer.from(await file.arrayBuffer());const valid=(file.type==='image/png'&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')||(file.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216)||(file.type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP');if(!valid)throw new Error('The file does not match its image type.');
      const {data:a}=await db.from('affiliates').select('id').eq('id',id).single();if(!a)throw new Error('Affiliate not found.');
      const key=id+'/'+crypto.randomUUID()+'.'+(file.type==='image/jpeg'?'jpg':file.type.split('/')[1]);const {error}=await db.storage.from('affiliate-photos').upload(key,bytes,{contentType:file.type});if(error)throw new Error('Could not upload this image.');
      const {data:url}=db.storage.from('affiliate-photos').getPublicUrl(key);const {error:update}=await db.from('affiliates').update({photo:url.publicUrl}).eq('id',id);if(update)throw new Error('Could not save this image.');await audit(db,u.id,'photo',id);return Response.json({ok:true});
    }
    const {action,payload:p}=await request.json();let error=null;
    if(action==='profile'){
      const id=u.role==='affiliate'?u.affiliateId:p.id;const name=clean(p.name,120);if(name.length<2)throw new Error('Please enter a name.');({error}=await db.from('affiliates').update({name,bio:clean(p.bio,500)}).eq('id',id));
    }else{
      requireStaff(u);
      if(action==='status'){
        const status=validateStatus(p.status);({error}=await db.from('bookings').update({status}).eq('id',p.id));
        if(!error&&status==='No-show'){const {data:b}=await db.from('bookings').select('*').eq('id',p.id).single();if(b)await claimAndSend(db,mapBooking(b),'no-show');}
      }else if(action==='commission'){
        const amount=Number(p.amount);if(!Number.isFinite(amount)||amount<0||amount>100000)throw new Error('Enter a valid commission amount.');
        const result=await db.from('bookings').update({commission:amount}).eq('id',p.id).eq('status','Attended').neq('payout','Paid').not('affiliate_id','is',null).select('id');error=result.error;if(!error&&!result.data.length)throw new Error('Only unpaid attended referrals can receive commission.');
      }else if(action==='payout'){
        if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>100)throw new Error('Select up to 100 referrals.');({error}=await db.rpc('approve_payout',{p_ids:p.ids,p_actor:u.id}));
      }else if(action==='affiliate'){
        const name=clean(p.name,120),email=clean(p.email,254);if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a name and valid email.');const slug=validateSlug(p.slug);const rate=Number(p.commissionRate||0);if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Commission rate must be between 0 and 100.');
        const {data:exists}=await db.from('affiliates').select('id').eq('slug',slug).maybeSingle();if(exists)throw new Error('That referral page name already exists.');
        const {data:invite,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:clinic.site+'/login?set-password=1'});if(inviteError)throw new Error('Could not invite this email. Check whether it already has an account.');
        const {data:a,error:ae}=await db.from('affiliates').insert({name,email,slug,bio:clean(p.bio,500),photo:safePhoto(p.photo),commission_rate:rate,commission_note:clean(p.commissionNote,300)}).select('id').single();
        if(ae)throw new Error('The invitation was sent, but the affiliate record could not be created. Staff must review this account in Supabase.');
        const {error:pe}=await db.from('profiles').insert({id:invite.user.id,role:'affiliate',affiliate_id:a.id});if(pe){await db.from('affiliates').update({active:false}).eq('id',a.id);throw new Error('The invitation was sent, but workspace access could not be created. Staff must review this inactive account in Supabase.');}
      }else if(action==='toggle-affiliate'){
        const {data:a}=await db.from('affiliates').select('active').eq('id',p.id).single();if(!a)throw new Error('Affiliate not found.');({error}=await db.from('affiliates').update({active:!a.active}).eq('id',p.id));
      }else if(action==='template'){
        const subject=clean(p.subject,150),body=clean(p.body,3000);if(!subject||!body)throw new Error('Enter a subject and message.');({error}=await db.from('message_templates').update({subject,body}).eq('id',p.id));
      }else if(action==='slot'){
        const start=new Date(p.start),duration=Number(p.duration);if(!Number.isFinite(start.getTime())||start<=new Date()||![15,30,45,60,90].includes(duration))throw new Error('Choose a future time and a valid duration.');({error}=await db.from('appointment_slots').insert({start:start.toISOString(),duration}));
      }else if(action==='booking'){
        const b=validateBooking(p,true);const {data,error:e}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:null});error=e;if(!e)await claimAndSend(db,mapBooking(data[0]),'confirmation');
      }else throw new Error('Unknown action.');
    }
    if(error)throw new Error('Could not save the change. Check the selected records and try again.');await audit(db,u.id,action,p.id||'batch');return Response.json({ok:true});
  }catch(e){return fail(e);}
}
```

## app/book/[slug]/page.js

```javascript
import Landing from '@/components/landing';
export const metadata={title:'Your personal introduction',robots:{index:false,follow:false}};
export default async function Page({params}){const {slug}=await params;return <Landing slug={slug}/>;}
```

## app/booking/page.js

```javascript
import { Suspense } from 'react';
import BookingFlow from '@/components/booking-flow';
import { Loading } from '@/components/ui';
export const metadata={title:'Book your appointment',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<Loading/>}><BookingFlow/></Suspense>;}
```

## app/error.js

```javascript
'use client';
export default function ErrorPage({reset}){return <main className="container empty-page" id="main-content"><h1>We couldn’t open this page</h1><p>Please try again. Your saved records remain available.</p><button className="button" onClick={reset}>Try again</button><a className="text-link" href="/">Return to Eyecon</a></main>;}
```

## app/globals.css

```css
:root{--paper:#fdfcf9;--white:#fff;--ink:#202221;--muted:#62645e;--line:#deded7;--soft:#f3f2ee;--gold:#aa8d4f;--gold-text:#775f2c;--tint:#eee5ce;--danger:#8a2727;--serif:Georgia,'Times New Roman',serif;--sans:Arial,Helvetica,sans-serif;--radius:4px}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:6rem}body{margin:0;background:var(--paper);color:var(--ink);font:1rem/1.6 var(--sans);-webkit-font-smoothing:antialiased}button,input,textarea,select{font:inherit}button,a,input,select,textarea{-webkit-tap-highlight-color:transparent}a{color:inherit;text-underline-offset:4px}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}img{max-width:100%;height:auto}h1,h2,h3,p{margin-top:0}h1,h2{font-family:var(--serif);font-weight:400;line-height:1.1;letter-spacing:-.035em}h1{font-size:clamp(2.6rem,5vw,5.25rem)}h2{font-size:clamp(2rem,3.1vw,3.2rem)}h3{font-size:1.05rem;line-height:1.4}p{margin-bottom:1.1rem}em{font-weight:400;font-style:italic}small{font-size:.875rem}fieldset{min-width:0}svg{flex-shrink:0}input[type=checkbox],input[type=radio]{width:1.15rem;height:1.15rem;accent-color:var(--ink);flex-shrink:0}input:not([type=checkbox]):not([type=radio]),textarea,select{width:100%;min-height:48px;border:1px solid #bfc1b9;border-radius:var(--radius);padding:.75rem .85rem;background:var(--white);color:var(--ink)}textarea{resize:vertical}input:focus,select:focus,textarea:focus{outline:2px solid var(--gold-text);outline-offset:2px}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--gold-text);outline-offset:4px}input:read-only{background:var(--soft)}::selection{background:var(--tint)}.container{width:min(1250px,calc(100% - 3rem));margin-inline:auto}.button{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.8rem 1.6rem;background:var(--ink);color:var(--white);border:1px solid var(--ink);border-radius:var(--radius);font-weight:500;text-decoration:none;line-height:1.35;transition:background .18s,transform .18s;white-space:normal;text-align:center}.button:hover{background:#383c37}.button.secondary{background:transparent;color:var(--ink);border-color:#bcbeb5}.button.secondary:hover{background:var(--soft)}.text-link{border:0;background:transparent;padding:0;min-height:32px;text-decoration:underline;text-underline-offset:5px;color:var(--ink);font-weight:500}.eyebrow{font-size:.8rem;letter-spacing:.16em;font-weight:600;line-height:1.6;margin-bottom:1.1rem}.quiet,.muted{color:var(--muted)}.quiet{font-size:.875rem}.stack{display:flex;flex-direction:column;gap:1.25rem}.stack p{margin-bottom:0}.skip-link{position:absolute;top:-80px;left:20px;z-index:50;background:var(--ink);color:white;padding:12px 20px}.skip-link:focus{top:10px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.preview-bar{display:flex;justify-content:center;align-items:center;gap:1rem;padding:.55rem 1rem;background:var(--ink);color:white;font-size:.8rem;line-height:1.5;flex-wrap:wrap}.preview-bar a{color:#efe5cb}.site-header{border-bottom:1px solid var(--line);background:var(--paper);position:relative;z-index:10}.header-inner{max-width:1450px;margin:auto;padding:1.2rem 2.5rem;display:flex;justify-content:space-between;align-items:center;gap:1rem}.logo{display:inline-flex;flex-direction:column;text-decoration:none;line-height:1;align-items:center;width:max-content}.logo span{font-family:var(--serif);font-size:1.85rem;letter-spacing:.21em}.logo small{font-size:.55rem;letter-spacing:.33em;margin-top:.55rem}.header-actions{display:flex;gap:2rem;align-items:center}.call-link{display:flex;align-items:center;gap:.65rem;text-decoration:none;font-size:.9rem}.header-note{color:var(--muted);font-size:.875rem}.hero{max-width:1600px;margin:auto;display:grid;grid-template-columns:1fr 1fr;min-height:620px}.hero-copy{padding:4rem clamp(1.5rem,4.5vw,5.5rem) 3.5rem}.hero h1{font-size:clamp(2.7rem,4.8vw,5rem);margin:1.6rem 0 1.5rem}.hero-description{max-width:30rem;font-size:1.05rem;line-height:1.7;color:var(--muted)}.hero-photo{position:relative;min-height:500px;background:#d9d8d3;overflow:hidden}.hero-photo img{object-fit:cover;object-position:58% center}.hero-photo span{position:absolute;bottom:1.6rem;left:2rem;color:#fff;font-size:.7rem;font-weight:600;letter-spacing:.2em;text-shadow:0 1px 5px #000}.hero-actions{display:flex;align-items:center;gap:1.6rem;flex-wrap:wrap;margin:1.3rem 0 1.2rem}.referral{display:flex;gap:.85rem;align-items:center;margin-bottom:1.5rem}.referral img{width:46px;height:46px;object-fit:cover;border-radius:50%;border:1px solid var(--line)}.referral small,.referral strong{display:block}.referral small{color:var(--muted);font-size:.8rem}.referral strong{font-size:1rem;font-weight:500}.gift{display:flex;align-items:center;gap:1rem;padding:1rem 1.15rem;background:var(--tint);border-radius:3px;max-width:36rem}.gift strong{font-size:1rem;font-weight:600}.gift small{display:block;font-size:.75rem;line-height:1.5;margin-top:3px;color:#61553d}.gift.compact{padding:.8rem}.designer-strip{padding:1.4rem 2rem;border-block:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:4rem}.designer-strip p{font-size:.8rem;color:var(--muted);margin:0}.designer-strip>div{display:flex;gap:clamp(2rem,6vw,6rem);align-items:center}.designer-strip span{font-size:1.1rem;letter-spacing:.18em}.designer-strip .brand-cartier{font-family:var(--serif);font-style:italic;font-size:2rem;letter-spacing:0}.designer-strip .brand-tom-ford{font-weight:700;letter-spacing:-.04em;text-transform:uppercase}.section{padding-block:5.5rem}.section-intro{margin-bottom:2.5rem}.section-intro p:last-child{color:var(--muted);max-width:38rem}.service-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:3rem}.service-row{display:flex;align-items:center;gap:1.2rem;padding:1.6rem .1rem;border-bottom:1px solid var(--line);text-decoration:none;min-height:105px}.service-row>div{flex:1}.service-row h3{margin:0 0 .35rem;font-weight:500}.service-row p{font-size:.875rem;line-height:1.6;color:var(--muted);margin:0}.service-row>span:last-child{font-size:.875rem}.service-row:hover{background:var(--soft)}.service-row.emergency{grid-column:1/-1}.care-section{background:var(--soft);padding:5rem 0}.care-layout{display:grid;grid-template-columns:.85fr 1.15fr;gap:5rem;align-items:center}.care-layout>div:first-child p:not(.eyebrow){color:var(--muted);max-width:29rem}.doctor-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}.doctor img{width:100%;aspect-ratio:1;object-fit:cover;filter:grayscale(1);background:#deddd7}.doctor h3{margin-top:1rem;margin-bottom:.4rem;font-weight:500}.doctor p{font-size:.875rem;line-height:1.6;color:var(--muted)}.reassurance{display:grid;grid-template-columns:1fr 1fr;gap:6rem}.reassurance h2{font-size:2.3rem}.reassurance p{color:var(--muted)}details{border-block:1px solid var(--line);padding:1rem 0}summary{cursor:pointer;font-weight:500;line-height:1.6}details p{margin:1rem 0 0}details[open] summary{margin-bottom:.75rem}.final-cta{text-align:center;background:var(--ink);color:var(--paper);padding:4.5rem 0}.final-cta h2{font-size:clamp(2.1rem,3.4vw,3.5rem)}.final-cta .button{background:var(--paper);color:var(--ink);border-color:var(--paper)}.final-cta p:last-child{margin-top:1rem;margin-bottom:0;color:#d4d5ca;font-size:.9rem}.footer{max-width:1450px;margin:auto;display:grid;grid-template-columns:.7fr 1.5fr 1fr;gap:3rem;padding:3rem 2.5rem}.footer p{font-size:.875rem;color:var(--muted);margin-bottom:.45rem}.footer>div{display:flex;flex-direction:column;align-items:flex-start;gap:.4rem}.footer a:not(.logo){font-size:.875rem}.footer small{color:var(--muted);margin-top:.5rem;font-size:.8rem}.mobile-book{display:none}.empty-page{min-height:60vh;padding-block:6rem}.empty-page h1{font-size:3rem}.empty-page .button{margin-top:1rem}.loading{min-height:60vh;display:flex;align-items:center;justify-content:center;gap:1rem}.spinner{width:22px;height:22px;border:2px solid var(--line);border-top-color:var(--ink);border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.notice{padding:1rem 1.2rem;background:var(--soft);border-left:3px solid var(--gold);margin-bottom:1.25rem;line-height:1.6;font-size:.9rem}.notice.error{background:#f8ece9;border-color:var(--danger);color:var(--danger)}.field{display:flex;flex-direction:column;gap:.45rem}.field label,.field legend{font-size:.875rem;font-weight:500}.field small{font-size:.8rem;color:var(--muted)}.field .error-text{color:var(--danger)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}.form-actions{display:flex;justify-content:space-between;gap:1rem;margin-top:2rem}.form-actions>.button:only-child{margin-left:auto;min-width:160px}.booking-shell{max-width:1250px;margin:4rem auto 5rem;display:grid;grid-template-columns:.85fr 1.15fr;gap:6rem;padding:0 1.5rem}.booking-aside h1{font-size:clamp(2.7rem,4vw,4.2rem)}.booking-aside>p:not(.eyebrow){max-width:26rem;color:var(--muted)}.booking-aside .referral{margin-top:2.5rem}.booking-help{margin-top:3rem;padding-top:2rem;border-top:1px solid var(--line)}.booking-help h3{margin-top:.7rem;font-weight:500}.booking-help p{font-size:.875rem;color:var(--muted)}.booking-panel{min-width:0;padding-top:.25rem}.booking-panel h2{font-size:2.1rem;margin:1.5rem 0 1.5rem;outline:none}.booking-ref{font-size:.85rem;padding-bottom:1rem;border-bottom:1px solid var(--line)}.stepper{list-style:none;display:flex;justify-content:space-between;padding:0;margin:0 0 2rem;gap:.3rem}.stepper li{display:flex;align-items:center;flex-direction:column;gap:.4rem;color:var(--muted);flex:1;position:relative}.stepper li:before{content:'';position:absolute;top:15px;height:1px;background:var(--line);width:100%;left:50%;z-index:-1}.stepper li:last-child:before{display:none}.stepper li>span{width:31px;height:31px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--soft);border:1px solid var(--line);font-size:.85rem}.stepper .current>span{background:var(--ink);color:white;border-color:var(--ink)}.stepper small{font-size:.75rem}.service-choices{display:flex;flex-direction:column;gap:.75rem}.service-choice{display:flex;align-items:center;gap:1rem;cursor:pointer;background:var(--white);padding:1rem;border:1px solid #c6c8bf;border-radius:4px;min-height:79px}.service-choice strong{display:block;font-size:.95rem;font-weight:500}.service-choice small{display:block;font-size:.8rem;line-height:1.5;color:var(--muted);margin-top:3px}.service-choice.selected{border-color:var(--gold-text);background:#f8f4e9}.service-choice input{margin:0}.urgent-note{margin-top:1.5rem;font-size:.875rem;color:var(--muted)}.urgent-note a{color:var(--ink)}.week-tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin:1.5rem 0}.week-tabs button,.day-grid button,.time-grid button,.view-tabs button{border:1px solid #bcbeb5;background:var(--white);color:var(--ink);border-radius:4px;min-height:46px;padding:.65rem 1rem}.week-tabs .active,.day-grid .active,.time-grid .active{background:var(--ink);color:white;border-color:var(--ink)}.day-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:.55rem;margin-bottom:1.5rem}.day-grid button{padding:.75rem .2rem;display:flex;flex-direction:column;gap:.2rem;align-items:center;font-size:.875rem}.day-grid small{font-size:.75rem}.time-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}.selection-summary{background:var(--soft);display:flex;align-items:center;gap:1rem;padding:1rem;line-height:1.5;font-size:.875rem;margin-top:1rem}.selection-summary small{display:block;margin-top:.25rem}.selection-summary .text-link{margin-left:auto}.choice-field{border:0;padding:0;margin:0;display:flex;gap:1rem}.choice-field legend{font-size:.875rem;margin-bottom:.7rem}.choice-field label{display:flex;align-items:center;gap:.7rem;flex:1;border:1px solid #bfc1b9;padding:.65rem 1rem;border-radius:4px;cursor:pointer}.optional-fields summary{display:flex;align-items:center;justify-content:space-between}.optional-fields summary:after{content:'+';margin-left:auto;padding-left:1rem}.optional-fields small{color:var(--muted);font-weight:400;margin-left:.75rem}.optional-fields[open] summary:after{content:'−'}.optional-fields .stack{margin-top:1rem}.checkbox-label{display:flex;gap:.8rem;align-items:flex-start;font-size:.875rem}.checkbox-label input{margin:4px 0}.checkbox-label small{display:block;font-size:.8rem;line-height:1.6;color:var(--muted);margin-top:.3rem}.privacy-note{font-size:.8rem;color:var(--muted)}.honeypot{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.success-mark{width:65px;height:65px;background:var(--tint);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem}.confirmation-card{padding:1.6rem;background:var(--soft);margin:1.5rem 0 2rem}.confirmation-card p{margin-bottom:.5rem}.confirmation-card small{color:var(--muted)}.calendar-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.5rem}.calendar-actions .button{flex:1;padding:.7rem .65rem;font-size:.875rem}.confirmation .gift{margin-bottom:2rem}.check-list{padding:0;list-style:none;margin-bottom:2rem}.check-list li{display:flex;gap:.75rem;align-items:flex-start;margin:.6rem 0;font-size:.9rem}.check-list svg{margin-top:4px}.login-page{display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 40px)}.login-editorial{background:var(--ink);color:var(--paper);padding:4rem clamp(2rem,7vw,7rem);display:flex;flex-direction:column;justify-content:center}.login-editorial .logo{margin-bottom:4rem}.login-editorial h1{font-size:clamp(2.5rem,4vw,4.5rem);margin-bottom:2rem}.login-editorial p{color:#d2d5cb;max-width:30rem}.login-panel{max-width:530px;width:100%;align-self:center;justify-self:center;padding:4rem 2rem}.login-panel h2{font-size:2.6rem}.login-panel>p:not(.eyebrow){color:var(--muted)}.login-panel>.stack{margin-top:2rem}.login-panel small{color:var(--muted)}.workspace{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{padding:2rem 1.5rem;border-right:1px solid var(--line);background:var(--soft);display:flex;flex-direction:column;gap:2rem;position:sticky;top:0;height:100vh}.workspace-label{font-size:.65rem;letter-spacing:.15em;color:var(--muted);margin-bottom:0}.sidebar nav{display:flex;flex-direction:column;gap:.4rem}.sidebar nav a{text-decoration:none;padding:.8rem 1rem;border-radius:4px;font-size:.95rem}.sidebar nav a:hover{background:#e8e8e1}.sidebar nav a[aria-current=page]{background:var(--tint);font-weight:500}.sidebar-bottom{margin-top:auto;display:flex;flex-direction:column;gap:.6rem;font-size:.875rem}.sidebar-bottom button{background:none;border:0;text-align:left;padding:.25rem 0;text-decoration:underline;min-height:40px}.workspace-main{padding:3rem clamp(1.25rem,3.5vw,4rem);min-width:0}.workspace-header{display:flex;justify-content:space-between;align-items:center;gap:1.5rem;margin-bottom:2.5rem}.workspace-header .eyebrow{margin-bottom:.7rem}.workspace-header h1{font-size:2.8rem;margin:0}.toolbar{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap}.toolbar .button{font-size:.875rem}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1rem}.stats article{padding:1.5rem 1.25rem;border:1px solid var(--line);background:var(--white);border-radius:4px;min-width:0}.stats p{font-size:.875rem;color:var(--muted);margin-bottom:.75rem}.stats strong{font-family:var(--serif);font-size:2.4rem;font-weight:400;line-height:1.2;overflow-wrap:anywhere}.referral-panel{padding:2rem;background:var(--tint);border-radius:4px;display:flex;justify-content:space-between;gap:2rem;align-items:center;margin:2rem 0 3rem}.referral-panel h2{font-size:1.8rem}.referral-panel .button{margin:.4rem .5rem .4rem 0}.link-value{font-size:1.15rem;overflow-wrap:anywhere}.qr{width:150px;height:150px;flex-shrink:0;background:white}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1.5rem}.section-heading h2{font-size:1.8rem;margin:0}.table-wrap:focus-visible{outline:3px solid var(--gold-text);outline-offset:4px}.table-wrap{overflow-x:auto;border:1px solid var(--line);background:var(--white);border-radius:4px;margin-top:1.5rem;max-width:100%}table{border-collapse:collapse;width:100%;text-align:left;font-size:.9rem}th{padding:1rem 1.2rem;color:var(--muted);font-weight:500;background:var(--soft);white-space:nowrap}td{padding:1.25rem 1.2rem;border-top:1px solid var(--line);vertical-align:middle;min-width:120px}td strong{font-weight:500}td small{display:block;color:var(--muted);font-size:.8rem;margin-top:.25rem}td select{font-size:.85rem;padding:.5rem .7rem;min-height:42px;min-width:120px}.badge{display:inline-block;white-space:nowrap;padding:.25rem .6rem;background:#eeeFEB;border-radius:3px;font-size:.8rem;color:#41443d}.badge.attended{background:#e7eee0;color:#36522a}.badge.no-show,.badge.cancelled{background:#f4e9e5;color:#873d2b}.filters{display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1.5rem}.filters .field:first-child{flex:2;min-width:190px}.filters .field{flex:1;min-width:140px}.filters>.text-link{padding-bottom:.8rem}.view-tabs{display:flex;gap:.5rem;align-items:center}.view-tabs button[aria-pressed=true]{background:var(--ink);color:white}.view-tabs small{margin-left:auto;color:var(--muted)}.panel{padding:2rem;border:1px solid var(--line);background:var(--white);border-radius:4px}.panel h2{font-size:1.8rem}.narrow-panel{max-width:680px}.profile-image{display:flex;gap:1.2rem;align-items:center}.profile-image img,.affiliate-card-header img{border-radius:50%;object-fit:cover}.profile-image label{display:flex;flex-direction:column;gap:.4rem;font-size:.875rem}.profile-image input{padding:.5rem!important;font-size:.8rem;min-height:36px!important}.link-page{max-width:850px}.link-page .qr{margin-block:1.5rem;width:220px;height:220px}.link-page .field{margin-bottom:1.5rem}.affiliate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem}.affiliate-card-header{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}.affiliate-card-header h2{margin:0;font-size:1.45rem}.affiliate-card-header p{font-size:.8rem;margin:0;color:var(--muted);overflow-wrap:anywhere}.affiliate-card-header .badge{margin-left:auto}.affiliate-card>p{font-size:.875rem;margin:1.2rem 0}.affiliate-link{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding-block:1rem;border-block:1px solid var(--line)}.affiliate-link span{overflow-wrap:anywhere;font-size:.8rem}.affiliate-link .qr{width:90px;height:90px}.upload-label{display:block;font-size:.8rem;margin-top:1.5rem}.upload-label input{font-size:.8rem;margin-top:.5rem}.payout-summary{display:flex;gap:2rem;align-items:center;justify-content:space-between}.payout-summary h2{font-size:1.8rem}.payout-summary p{color:var(--muted);max-width:40rem}.commission-form{display:flex;gap:.5rem;align-items:center}.commission-form input{min-width:85px!important;max-width:110px!important;min-height:40px!important;padding:.4rem!important}.template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem;margin-bottom:2rem}.template-grid h2{text-transform:capitalize}.delivery-list{list-style:none;padding:0}.delivery-list li{display:flex;gap:1rem;flex-wrap:wrap;padding:1rem 0;border-bottom:1px solid var(--line)}.delivery-list small{overflow-wrap:anywhere}.empty-state{padding:4rem 1.5rem;text-align:center;border:1px dashed #bec1b5;margin:1.5rem 0;color:var(--muted)}.empty-state h3{margin-top:1rem;color:var(--ink)}.modal{width:min(650px,calc(100% - 2rem));max-height:90vh;padding:2rem;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);overflow:auto}.modal::backdrop{background:rgba(20,23,18,.5)}.modal-head{display:flex;gap:1rem;justify-content:space-between;align-items:center;margin-bottom:1.5rem}.modal-head h2{font-size:1.9rem;margin:0}.icon-button{display:flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);width:44px;height:44px;border-radius:4px;flex-shrink:0}.booking-details dl{margin:0}.booking-details dl>div{padding:.75rem 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:150px 1fr;gap:1rem}.booking-details dt{color:var(--muted);font-size:.875rem}.booking-details dd{margin:0;overflow-wrap:anywhere}.calendar-heading{display:flex;align-items:center;justify-content:space-between;margin:1.5rem 0;gap:1rem}.calendar-heading h2{font-size:1.7rem;margin:0}.calendar-heading .button{font-size:.8rem;padding:.6rem .8rem}.month-grid{display:grid;grid-template-columns:repeat(7,1fr);border:1px solid var(--line)}.month-grid>strong{text-align:center;padding:.6rem;background:var(--soft);font-size:.8rem}.month-grid>button,.month-grid>span{background:var(--white);border:0;border-right:1px solid var(--line);border-top:1px solid var(--line);min-height:100px;padding:.8rem;display:flex;align-items:flex-start;flex-direction:column;gap:.5rem}.month-grid>button:hover{background:var(--tint)}.month-grid small{font-size:.7rem;color:var(--muted)}.prose{max-width:800px;padding-block:5rem}.prose h1{font-size:3.5rem}.prose h2{font-size:1.8rem;margin-top:2.5rem}.prose p{max-width:70ch}
@media(max-width:1100px){.hero-copy{padding:3rem 2rem}.hero h1{font-size:3.5rem}.hero{min-height:580px}.designer-strip{gap:2rem}.designer-strip>div{gap:2.5rem}.care-layout{gap:2.5rem}.booking-shell{gap:3rem}.workspace{grid-template-columns:210px minmax(0,1fr)}.workspace-header{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:repeat(2,1fr)}.affiliate-grid{grid-template-columns:1fr}.workspace-main{padding:2rem 1.5rem}}
@media(max-width:800px){.header-inner{padding:1rem 1.5rem}.header-actions{gap:1rem}.header-note{display:none}.call-link span{display:none}.header-actions .button{font-size:.8rem;min-height:42px;padding:.7rem 1rem}.logo span{font-size:1.6rem}.hero{grid-template-columns:1fr}.hero-copy{padding:2.5rem 1.5rem 2rem}.hero h1{font-size:clamp(2.8rem,8vw,4rem)}.hero-description{max-width:36rem}.hero-photo{min-height:340px;order:2}.hero-photo img{object-position:50% 40%}.hero-actions .button{min-width:210px}.designer-strip{flex-direction:column;gap:1rem;padding:1.4rem 1.5rem}.designer-strip>div{justify-content:space-between;width:100%;gap:1.3rem;flex-wrap:wrap}.designer-strip span{font-size:.85rem}.designer-strip .brand-cartier{font-size:1.6rem}.section{padding-block:3.5rem}.service-grid{grid-template-columns:1fr}.service-row{padding:1.25rem 0;gap:1rem}.care-section{padding:3.5rem 0}.care-layout{grid-template-columns:1fr;gap:2.5rem}.care-layout>div:first-child p:not(.eyebrow){max-width:42rem}.reassurance{grid-template-columns:1fr;gap:3rem}.footer{grid-template-columns:1fr 1fr;gap:2rem;padding:2.5rem 1.5rem 6.5rem}.footer>.logo{grid-column:1/-1}.mobile-book{display:none;position:fixed;bottom:0;left:0;right:0;padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom));background:rgba(253,252,249,.97);border-top:1px solid var(--line);z-index:20}.mobile-book.visible{display:block}.mobile-book .button{width:100%;min-height:48px}.booking-shell{grid-template-columns:1fr;margin:2.5rem auto 3rem;gap:2rem;max-width:650px}.booking-aside{display:none}.booking-panel{width:100%}.booking-panel h2{font-size:2rem}.booking-ref{margin-bottom:1.5rem}.login-page{grid-template-columns:1fr}.login-editorial{padding:2.5rem 1.5rem}.login-editorial .logo{margin-bottom:2rem}.login-editorial h1{font-size:2.8rem;margin-bottom:1rem}.login-panel{padding:2.5rem 1.5rem;max-width:600px}.workspace{display:block}.sidebar{height:auto;position:relative;padding:1.2rem 1.5rem;border-right:0;border-bottom:1px solid var(--line);gap:1rem}.sidebar>.logo{margin-bottom:.5rem}.workspace-label{display:none}.sidebar nav{flex-direction:row;flex-wrap:wrap;gap:.4rem;padding-bottom:.3rem}.sidebar nav a{white-space:nowrap;font-size:.85rem;padding:.65rem .9rem}.sidebar-bottom{position:absolute;right:1.5rem;top:1.15rem;flex-direction:row;gap:1rem;align-items:center;font-size:.8rem}.sidebar-bottom button{min-height:30px}.workspace-main{padding:2rem 1.5rem}.workspace-header h1{font-size:2.4rem}.referral-panel{padding:1.5rem;gap:1rem;flex-wrap:wrap}.referral-panel h2{font-size:1.65rem}.template-grid{grid-template-columns:1fr}.panel{padding:1.5rem}.payout-summary{align-items:flex-start;flex-direction:column;gap:.5rem;margin-bottom:1rem}.view-tabs small{font-size:.7rem}.month-grid>button,.month-grid>span{min-height:70px;padding:.5rem}.month-grid small{font-size:.6rem}.calendar-heading h2{font-size:1.1rem}.calendar-heading .button{font-size:.7rem;min-height:40px}.link-page .qr{width:180px;height:180px}.modal{padding:1.5rem}.prose{padding-block:3rem}.prose h1{font-size:2.7rem}}
@media(max-width:480px){.container{width:calc(100% - 2.5rem)}.header-inner{padding:1rem 1.25rem}.header-actions{gap:.75rem}.hero-copy{padding:2rem 1.25rem}.hero h1{font-size:2.7rem}.hero-actions{gap:1rem}.hero-actions>.button{width:100%}.hero-photo{min-height:290px}.designer-strip>div{display:grid;grid-template-columns:1fr 1fr;row-gap:1.2rem;text-align:center}.designer-strip>div>span{font-size:1rem}.doctor-grid{gap:1rem}.doctor h3{font-size:1rem}.doctor p{font-size:.8rem}.service-row p{font-size:.8rem}.service-row{gap:.8rem}.service-row h3{font-size:.95rem}.gift{padding:.85rem}.gift small{font-size:.75rem}.footer{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.booking-shell{padding:0 1.25rem}.time-grid{grid-template-columns:1fr 1fr}.stepper small{font-size:.65rem}.form-actions .button{flex:1;padding:.85rem 1rem}.service-choice{gap:.7rem;padding:.9rem .75rem}.service-choice svg{width:20px}.service-choice strong{font-size:.9rem}.service-choice small{font-size:.75rem}.selection-summary{font-size:.8rem;padding:.85rem;gap:.7rem}.calendar-actions{flex-wrap:wrap}.calendar-actions .button{font-size:.8rem;min-width:85px}.workspace-main{padding:1.75rem 1.25rem}.sidebar{padding:1.1rem 1.25rem}.sidebar-bottom{right:1.25rem;gap:.6rem}.sidebar-bottom>a{display:none}.stats{gap:.65rem}.stats article{padding:1rem .8rem}.stats p{font-size:.8rem}.stats strong{font-size:1.9rem}.filters .field{min-width:calc(50% - 1rem)}.filters .field:first-child{flex-basis:100%}.profile-image{flex-direction:column;align-items:flex-start}.affiliate-card-header{gap:.75rem}.affiliate-link{align-items:flex-start}.month-grid small{font-size:.6rem;line-height:1.2}.view-tabs small{max-width:130px}.modal-head h2{font-size:1.5rem}.booking-details dl>div{grid-template-columns:1fr;gap:.2rem}.link-value{font-size:.95rem}.prose h1{font-size:2.5rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

## app/icon.svg

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#202221"/><path d="M14 32s7-12 18-12 18 12 18 12-7 12-18 12-18-12-18-12Z" fill="none" stroke="#eee5ce" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="#b29a64"/></svg>
```

## app/layout.js

```javascript
import './globals.css';
import { Provider } from '@/components/provider';
import { PreviewBar } from '@/components/ui';
import { clinic,DEMO } from '@/lib/config';
export const metadata={title:{default:'Eyecon Optometry | Personal eye care',template:'%s | Eyecon Optometry'},description:'Arrange a personal eye care appointment with Eyecon Optometry. Luxury eyewear and thoughtful care.',icons:{icon:'/icon.svg'},robots:DEMO?{index:false,follow:false}:{index:true,follow:true}};
export default function RootLayout({children}){return <html lang="en-CA" data-scroll-behavior="smooth"><body><Provider><a className="skip-link" href="#main-content">Skip to content</a><PreviewBar/>{children}</Provider></body></html>;}
```

## app/login/page.js

```javascript
import { Suspense } from 'react';
import LoginForm from '@/components/login-form';
import { Loading } from '@/components/ui';
export const metadata={title:'Workspace sign-in',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<Loading/>}><LoginForm/></Suspense>;}
```

## app/not-found.js

```javascript
import { Header,Button,Footer } from '@/components/ui';
export default function NotFound(){return <><Header/><main className="container empty-page" id="main-content"><p className="eyebrow">PAGE NOT FOUND</p><h1>Let’s find your way back</h1><p>This page may have moved or the link may be incomplete.</p><Button href="/">Return to Eyecon</Button></main><Footer/></>;}
```

## app/page.js

```javascript
import Landing from '@/components/landing';
export default function Page(){return <Landing/>;}
```

## app/privacy/page.js

```javascript
import { Header,Footer } from '@/components/ui';
import { clinic,DEMO } from '@/lib/config';
export const metadata={title:'Privacy notice'};
export default function Page(){return <><Header/><main className="container prose" id="main-content"><p className="eyebrow">YOUR INFORMATION</p><h1>Booking privacy notice</h1><p className="notice">Draft notice for clinic review. Eyecon must confirm its legal entity, privacy contact, retention period and service-provider arrangements before live patient use.</p><h2>Information used for your appointment</h2><p>The booking form asks for your name, contact details, selected appointment and first-visit status. Optional insurance information and favourite brands help clinic staff prepare for your visit.</p><h2>Personal referrals</h2><p>If you book through an affiliate, that affiliate can see your name and referral status. Affiliates do not receive your appointment type, insurance information, prescription, email address or phone number through this platform.</p><h2>Appointment reminders</h2><p>Email confirms your booking. SMS reminders are optional and require your consent. Contact the clinic if you would like to withdraw SMS consent. Message and data rates may apply.</p><h2>Access to records</h2><p>Authorised clinic staff manage bookings and optional insurance details. In live mode, policy numbers are encrypted before storage. The clinic must approve the hosting region, retention policy and access arrangements.</p><h2>Contact the clinic</h2>{clinic.email?<a href={'mailto:'+clinic.email}>{clinic.email}</a>:<p>A designated privacy contact will be published before launch.</p>}{DEMO&&<><h2>Design preview</h2><p>This version uses sample records and browser storage. Use fictional information only. Clear site data or reset the demo on the sign-in page to remove demo bookings.</p></>}</main><Footer/></>;}
```

## app/robots.js

```javascript
import { DEMO,clinic } from '@/lib/config';
export default function robots(){return {rules:{userAgent:'*',...(DEMO?{disallow:'/'}:{allow:'/',disallow:['/admin','/affiliate','/booking','/book/','/login','/api/']})}};}
```

## CLAUDE.md

```markdown
@AGENTS.md
```

## components/booking-flow.js

```javascript
'use client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { useApp } from './provider';
import { DEMO,clinic,services,brands,formatDate,instructions } from '@/lib/config';
import { validateBooking,slotTaken } from '@/lib/validation';
import { calendarFile,googleCalendar,outlookCalendar,downloadFile } from '@/lib/calendar';
import { Header,Footer,Button,Field,Gift,Icon,Notice,Loading,Referral } from './ui';
function Captcha({onToken}){const el=useRef(null),[loaded,setLoaded]=useState(false);useEffect(()=>{if(!loaded||!el.current||!window.turnstile)return;const id=window.turnstile.render(el.current,{sitekey:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,action:'booking',callback:onToken,'expired-callback':()=>onToken('')});return()=>window.turnstile?.remove(id);},[loaded]);return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={()=>setLoaded(true)}/><div ref={el}/></>;}
export default function BookingFlow(){
  const params=useSearchParams(),slug=params.get('affiliate'),{data,ready,book}=useApp();const [affiliate,setAffiliate]=useState(null),[slots,setSlots]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[step,setStep]=useState(0),[service,setService]=useState(params.get('service')||''),[day,setDay]=useState(''),[start,setStart]=useState(''),[week,setWeek]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmation,setConfirmation]=useState(null),[captcha,setCaptcha]=useState(''),[captchaKey,setCaptchaKey]=useState(0),[details,setDetails]=useState({name:'',email:'',phone:'',firstVisit:'',insurance:'',policy:'',brands:'',smsConsent:false,website:''});const titleRef=useRef(null);
  useEffect(()=>{if(DEMO){if(!ready)return;const a=slug?data.affiliates.find(a=>a.slug===slug&&a.active):null;if(slug&&!a){setLoadError('This referral is unavailable. You can book directly instead.');setLoading(false);return;}setAffiliate(a);setSlots(data.slots.filter(s=>new Date(s.start)>new Date()&&!slotTaken(s,data.bookings)));setLoading(false);}else{fetch('/api/availability'+(slug?'?affiliate='+encodeURIComponent(slug):'')).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setAffiliate(d.affiliate);setSlots(d.slots);}).catch(e=>setLoadError(e.message)).finally(()=>setLoading(false));}},[ready,slug,data]);
  useEffect(()=>{titleRef.current?.focus();},[step]);
  const dayKey=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:clinic.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
  const days=useMemo(()=>[...new Map(slots.map(s=>[dayKey(s.start),s.start])).entries()], [slots]);
  const visibleDays=days.filter(([,iso])=>{const diff=(new Date(iso)-new Date())/86400000;return diff>=week*7&&diff<(week+1)*7;});
  function change(key,value){setDetails(d=>({...d,[key]:value}));}
  function next(){setError('');if(step===0&&!services.some(s=>s.id===service)){setError('Choose the care you need.');return;}if(step===1&&!start){setError('Choose a date and available time.');return;}setStep(s=>s+1);}
  async function submit(e){e.preventDefault();setError('');setBusy(true);try{const payload=validateBooking({...details,firstVisit:details.firstVisit==='yes'?true:details.firstVisit==='no'?false:null,service,start,affiliateId:affiliate?.id});if(!DEMO&&!captcha)throw new Error('Complete the verification before booking.');const result=await book({...payload,captcha,website:details.website});setConfirmation(result);setStep(3);}catch(e){setError(e.message);setCaptcha('');setCaptchaKey(k=>k+1);}finally{setBusy(false);}}
  if(loading)return <Loading/>;
  if(loadError)return <><Header/><main className="container empty-page" id="main-content"><h1>Arrange your visit</h1><Notice error>{loadError}</Notice>{slug?<Button href="/booking">Book directly</Button>:<Button onClick={()=>window.location.reload()}>Try again</Button>}</main><Footer/></>;
  const labels=['Service','Date & time','Your details','Confirmation'];
  return <><Header bookingHref={affiliate?'/book/'+affiliate.slug:'/'} bookingLabel="Back to Eyecon"/><main className="booking-shell" id="main-content"><aside className="booking-aside"><p className="eyebrow">YOUR EYECON VISIT</p><h1>A little time.<br/><em>A clearer view.</em></h1><p>Choose your appointment, find a time that suits you, and we’ll look forward to welcoming you.</p>{affiliate&&<><Referral affiliate={affiliate}/><Gift compact/></>}<div className="booking-help"><Icon name="phone"/><h3>Prefer a conversation?</h3>{clinic.phone?<a href={'tel:'+clinic.phone}>{clinic.phone}</a>:<p>Clinic phone details will be added before launch.</p>}</div></aside><section className="booking-panel">{affiliate&&<p className="booking-ref">Booking through <strong>{affiliate.name}</strong></p>}<ol className="stepper" aria-label="Booking progress">{labels.map((label,i)=><li key={label} aria-current={i===step?'step':undefined} className={i<=step?'current':''}><span>{i<step?<Icon name="check" size={15}/>:i+1}</span><small>{label}</small></li>)}</ol><h2 ref={titleRef} tabIndex={-1}>{['What would you like to book?','Choose a time','Your details','You’re booked'][step]}</h2><Notice error>{error}</Notice>
  {step===0&&<><div className="service-choices" role="radiogroup" aria-label="Appointment type">{services.map(s=><label key={s.id} className={`service-choice ${service===s.id?'selected':''}`}><input type="radio" name="service" value={s.id} checked={service===s.id} onChange={()=>setService(s.id)}/><Icon name={s.icon}/><span><strong>{s.name}</strong><small>{s.description}</small></span></label>)}</div><div className="urgent-note">Urgent eye concern? {clinic.phone?<a href={'tel:'+clinic.phone}>Call the clinic</a>:<span>Please contact the clinic for guidance.</span>}</div><div className="form-actions"><Button onClick={next}>Continue</Button></div></>}
  {step===1&&<><p className="muted">{services.find(s=>s.id===service)?.name} · Times shown in {clinic.timezone.replace('_',' ')}.</p>{!slots.length?<Notice>No online times are available. Please contact the clinic or check back later.</Notice>:<><div className="week-tabs" aria-label="Date range">{['Next 7 days','Following week','Weeks 3–4','Later'].map((t,i)=><button key={t} className={week===i?'active':''} onClick={()=>{setWeek(i);setDay('');setStart('');}}>{t}</button>)}</div><div className="day-grid" role="group" aria-label="Available days">{(week===2?days.filter(([,iso])=>{let d=(new Date(iso)-new Date())/86400000;return d>=14&&d<28;}):week===3?days.filter(([,iso])=>(new Date(iso)-new Date())/86400000>=28):visibleDays).map(([key,iso])=><button key={key} className={day===key?'active':''} aria-pressed={day===key} onClick={()=>{setDay(key);setStart('');}}><small>{formatDate(iso,{dateStyle:undefined,timeStyle:undefined,weekday:'short'})}</small>{formatDate(iso,{dateStyle:undefined,timeStyle:undefined,month:'short',day:'numeric'})}</button>)}</div>{!day&&<p className="quiet">Select a day to see appointment times.</p>}<div className="time-grid" role="group" aria-label="Available times">{slots.filter(s=>dayKey(s.start)===day).map(s=><button key={s.start} aria-pressed={start===s.start} className={start===s.start?'active':''} onClick={()=>setStart(s.start)}>{formatDate(s.start,{dateStyle:undefined,timeStyle:'short'})}</button>)}</div>{start&&<div className="selection-summary"><Icon name="calendar"/>{formatDate(start)}</div>}</>}<div className="form-actions"><Button secondary onClick={()=>{setStep(0);setError('');}}>Back</Button><Button onClick={next} disabled={!start}>Continue</Button></div></>}
  {step===2&&<form onSubmit={submit} className="stack"><div className="selection-summary"><Icon name="calendar"/><div><strong>{services.find(s=>s.id===service)?.name}</strong><small>{formatDate(start)}</small></div><button type="button" className="text-link" onClick={()=>setStep(1)}>Change</button></div><Field label="Full name" id="patient-name" autoComplete="name" required maxLength={120} value={details.name} onChange={e=>change('name',e.target.value)}/><div className="form-grid"><Field label="Mobile number" id="patient-phone" type="tel" autoComplete="tel" required maxLength={32} placeholder="+14165550123" value={details.phone} onChange={e=>change('phone',e.target.value)}/><Field label="Email address" id="patient-email" type="email" autoComplete="email" required value={details.email} onChange={e=>change('email',e.target.value)}/></div><fieldset className="choice-field"><legend>Is this your first visit to Eyecon?</legend>{['yes','no'].map(v=><label key={v}><input type="radio" name="first-visit" required checked={details.firstVisit===v} onChange={()=>change('firstVisit',v)}/>{v==='yes'?'Yes':'No'}</label>)}</fieldset><details className="optional-fields"><summary>Insurance details <small>Optional</small></summary><div className="stack"><Field label="Insurance company" id="insurance" value={details.insurance} maxLength={120} onChange={e=>change('insurance',e.target.value)}/><Field label="Policy number" id="policy" value={details.policy} maxLength={120} onChange={e=>change('policy',e.target.value)} hint="Only clinic staff can see this information. You may bring your insurance card instead."/></div></details><details className="optional-fields"><summary>Designers you love <small>Optional</small></summary><Field label="Favourite brands" id="brands" placeholder="For example: Cartier, LINDBERG" value={details.brands} maxLength={300} onChange={e=>change('brands',e.target.value)}/></details><label className="checkbox-label"><input type="checkbox" checked={details.smsConsent} onChange={e=>change('smsConsent',e.target.checked)}/><span>Send me appointment reminders by SMS.<small>Optional. Message and data rates may apply. Contact the clinic to withdraw consent.</small></span></label><p className="privacy-note">{affiliate?'Your referrer can see your name and referral status. Your appointment type and insurance details stay with the clinic. ':''}Read our <Link href="/privacy">privacy notice</Link>.</p><div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this blank</label><input id="website" value={details.website} onChange={e=>change('website',e.target.value)} tabIndex={-1} autoComplete="off"/></div>{!DEMO&&<Captcha key={captchaKey} onToken={setCaptcha}/>}<div className="form-actions"><Button type="button" secondary onClick={()=>{setStep(1);setError('');}}>Back</Button><Button disabled={busy} type="submit">{busy?'Confirming…':'Confirm booking'}</Button></div></form>}
  {step===3&&confirmation&&<div className="confirmation"><div className="success-mark"><Icon name="check" size={35}/></div><p>We look forward to seeing you, {confirmation.booking.name.split(' ')[0]}.</p><div className="confirmation-card"><h3>{services.find(s=>s.id===confirmation.booking.service)?.name}</h3><p>{formatDate(confirmation.booking.start)}</p><p>{clinic.address||'Clinic location details will be confirmed by the team.'}</p><small>Booking reference: {confirmation.booking.id.slice(0,8).toUpperCase()}</small></div><h3>Add to your calendar</h3><div className="calendar-actions"><a className="button secondary" href={googleCalendar(confirmation.booking)} target="_blank" rel="noopener noreferrer">Google</a><button className="button secondary" onClick={()=>downloadFile(calendarFile(confirmation.booking),'eyecon-appointment.ics','text/calendar')}>Apple / .ics</button><a className="button secondary" href={outlookCalendar(confirmation.booking)} target="_blank" rel="noopener noreferrer">Outlook</a></div>{affiliate&&<Gift/>}<h3>Before your visit</h3><ul className="check-list">{instructions.map(t=><li key={t}><Icon name="check" size={18}/>{t}</li>)}</ul><Notice>{DEMO?'Demo booking saved in this browser. No email or SMS was sent.':confirmation.notifications?.email==='sent'?'Your confirmation email has been requested. Check your inbox.':'Your booking is saved. Email delivery is not available; keep your booking reference and calendar file.'}</Notice><Button secondary href={affiliate?'/book/'+affiliate.slug:'/'}>Return to Eyecon</Button></div>}
  </section></main><Footer/></>;
}
```

## components/landing.js

```javascript
'use client';
import { useEffect,useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useApp } from './provider';
import { Header,Footer,Button,Icon,Gift,Referral,Loading,Notice } from './ui';
import { DEMO,services,brands,clinic } from '@/lib/config';
export default function Landing({slug}){
  const {data,ready}=useApp(),[affiliate,setAffiliate]=useState(null),[loaded,setLoaded]=useState(!slug),[error,setError]=useState(''),[floating,setFloating]=useState(false);
  useEffect(()=>{if(!slug)return;if(DEMO){if(!ready)return;const a=data.affiliates.find(a=>a.slug===slug&&a.active);setAffiliate(a||null);setLoaded(true);setError(a?'':'This referral page is no longer available.');}else{fetch('/api/availability?affiliate='+encodeURIComponent(slug)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setAffiliate(d.affiliate);}).catch(e=>setError(e.message)).finally(()=>setLoaded(true));}},[slug,data.affiliates,ready]);
  useEffect(()=>{if(!loaded||error)return;const hero=document.querySelector('.hero-actions .button'),final=document.querySelector('.final-cta .button');if(!hero||!final)return;let heroPast=false,finalVisible=false;const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===hero)heroPast=!entry.isIntersecting&&entry.boundingClientRect.top<0;if(entry.target===final)finalVisible=entry.isIntersecting;}setFloating(heroPast&&!finalVisible);});observer.observe(hero);observer.observe(final);return()=>observer.disconnect();},[loaded,error]);
  const booking=affiliate?'/booking?affiliate='+encodeURIComponent(affiliate.slug):'/booking';
  if(!loaded)return <Loading/>;
  if(error)return <><Header/><main className="container empty-page" id="main-content"><h1>Your introduction to Eyecon</h1><Notice error>{error}</Notice><Button href="/booking">Book directly</Button></main><Footer/></>;
  return <><Header bookingHref={booking}/><main id="main-content">
    <section className="hero"><div className="hero-copy">{affiliate?<Referral affiliate={affiliate}/>:<p className="eyebrow">PERSONAL EYE CARE · LUXURY EYEWEAR</p>}<h1>Exceptional vision.<br/><em>{affiliate?'Personally introduced.':'Thoughtfully cared for.'}</em></h1><p className="hero-description">Expert eye care and thoughtfully selected luxury eyewear. A personal experience, from your first visit.</p>{affiliate&&<Gift/>}<div className="hero-actions"><Button href={booking}>Book your appointment</Button><a className="text-link" href="#patient-experiences">Patient experiences</a></div><p className="quiet">Choose a time online. We’ll take care of the rest.</p></div><div className="hero-photo"><Image src="/images/hero.webp" alt="A woman wearing refined optical frames" fill priority sizes="(max-width: 800px) 100vw, 50vw"/><span>VISION, WITH A PERSONAL TOUCH</span></div></section>
    <section className="designer-strip" aria-label="Featured eyewear designers"><p>A selection of our designers</p><div>{['Cartier','Tom Ford','LINDBERG','DITA'].map(b=><span className={'brand-'+b.toLowerCase().replace(' ','-')} key={b}>{b}</span>)}</div></section>
    <section className="section container" id="appointments"><div className="section-intro"><p className="eyebrow">YOUR VISIT</p><h2>Find the right appointment</h2><p>Start with the care you need. Select a service to see available times.</p></div><div className="service-grid">{services.map(s=><Link className="service-row" key={s.id} href={booking+(affiliate?'&':'?')+'service='+s.id}><Icon name={s.icon}/><div><h3>{s.name}</h3><p>{s.description}</p></div><span>Book</span></Link>)}<div className="service-row emergency"><Icon name="phone"/><div><h3>Urgent eye concerns</h3><p>Please contact the clinic so the team can guide your next step.</p></div>{clinic.phone?<a className="text-link" href={'tel:'+clinic.phone}>Call clinic</a>:<span className="muted">Phone pending</span>}</div></div></section>
    <section className="care-section"><div className="container care-layout"><div><p className="eyebrow">PEOPLE FIRST</p><h2>Care from people<br/>you can know</h2><p>Your appointment is a conversation as well as an examination. Our team makes room for your questions, comfort and individual needs.</p><Button href={booking} secondary>Arrange your visit</Button></div><div className="doctor-grid">{['doctor1','doctor2'].map((d,i)=><article className="doctor" key={d}><Image src={'/images/'+d+'.webp'} width={300} height={300} alt={'Concept portrait for doctor profile '+(i+1)} sizes="(max-width: 800px) 45vw, 23vw"/><h3>Meet your optometrist</h3><p>Doctor names, credentials and biographies will be supplied by the clinic.</p></article>)}</div></div></section>
    <section className="section container reassurance"><div><p className="eyebrow">A LITTLE REASSURANCE</p><h2>Questions about coverage?</h2><p>Bring your insurance card to your visit. The clinic will confirm accepted insurers and the details of your coverage.</p><details><summary>What should I bring?</summary><p>Your current glasses or contact lenses, photo ID and insurance card. Clinic-specific instructions will appear with your confirmation.</p></details></div><div id="patient-experiences"><p className="eyebrow">PATIENT EXPERIENCES</p><h2>Trust built through care</h2><p>Verified patient reviews and the clinic’s current rating will appear here when review access is connected.</p>{clinic.reviews&&<a className="text-link" href={clinic.reviews} target="_blank" rel="noopener noreferrer">Read verified Google reviews</a>}</div></section>
    <section className="final-cta"><div className="container"><p className="eyebrow">WE LOOK FORWARD TO MEETING YOU</p><h2>Let’s make time for your vision</h2><Button href={booking}>Book your appointment</Button>{affiliate&&<p>Your personal referral from {affiliate.name}</p>}</div></section>
  </main><Footer/><div className={`mobile-book ${floating?'visible':''}`}><Button href={booking}>Book appointment</Button></div></>;
}
```

## components/login-form.js

```javascript
'use client';
import { useEffect,useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { DEMO } from '@/lib/config';
import { browserClient } from '@/lib/supabase';
import { useApp } from './provider';
import { Logo,Button,Field,Notice } from './ui';
export default function LoginForm(){const {demoSignIn,reload,reset}=useApp(),router=useRouter(),params=useSearchParams();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[resetting,setResetting]=useState(false);const settingPassword=params.get('set-password')||params.get('mode')==='reset';
  async function submit(e){e.preventDefault();setError('');setMessage('');setBusy(true);try{const client=browserClient();if(settingPassword){if(password.length<12)throw new Error('Use a password with at least 12 characters.');const {error}=await client.auth.updateUser({password});if(error)throw error;}else if(resetting){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/login?mode=reset'});if(error)throw error;setMessage('If this account exists, a reset link will arrive in your email.');return;}else{const {error}=await client.auth.signInWithPassword({email,password});if(error)throw new Error('Email or password was not recognised.');}const state=await reload();router.push(state.user.role==='staff'?'/admin':'/affiliate');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <main className="login-page" id="main-content"><div className="login-editorial"><Logo/><h1>Personal introductions.<br/><em>Meaningful connections.</em></h1><p>A workspace for the people who bring Eyecon’s approach to eye care to their community.</p></div><div className="login-panel"><p className="eyebrow">EYECON WORKSPACE</p><h2>{settingPassword?'Set your password':resetting?'Reset your password':'Welcome back'}</h2><p>{DEMO?'Explore the affiliate and staff experiences with sample data.':'Sign in to your affiliate or staff account.'}</p><Notice error>{error}</Notice><Notice>{message}</Notice>{DEMO?<div className="stack"><Button onClick={()=>{demoSignIn('affiliate');router.push('/affiliate');}}>Explore affiliate demo</Button><Button secondary onClick={()=>{demoSignIn('staff');router.push('/admin');}}>Explore staff demo</Button><button className="text-link" onClick={()=>{reset();setMessage('Sample data has been restored.');}}>Reset demo data</button><small>Demo records stay in this browser. No email or SMS is sent.</small></div>:<form onSubmit={submit} className="stack">{!settingPassword&&<Field label="Email address" id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/>} {!resetting&&<Field label={settingPassword?'New password':'Password'} id="password" type="password" autoComplete={settingPassword?'new-password':'current-password'} required minLength={settingPassword?12:1} value={password} onChange={e=>setPassword(e.target.value)}/>}<Button disabled={busy} type="submit">{busy?'Please wait…':settingPassword?'Save password':resetting?'Send reset link':'Sign in'}</Button>{!settingPassword&&<button type="button" className="text-link" onClick={()=>{setResetting(!resetting);setError('');}}>{resetting?'Back to sign in':'Forgot your password?'}</button>}</form>}</div></main>;
}
```

## components/provider.js

```javascript
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DEMO } from '@/lib/config';
import { seedDemo, applyDemo } from '@/lib/demo';
import { browserClient } from '@/lib/supabase';
const Context=createContext(null);
export function Provider({children}){
  const [data,setData]=useState({affiliates:[],bookings:[],templates:[],slots:[],jobs:[]}),[user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  async function headers(){const {data:{session}}=await browserClient().auth.getSession();return {Authorization:'Bearer '+(session?.access_token||'')};}
  async function reload(){const response=await fetch('/api/workspace',{headers:await headers(),cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);setUser(result.user);return result;}
  useEffect(()=>{
    if(DEMO){try{const saved=JSON.parse(localStorage.getItem('eyecon-demo-v1')||'null');setData(saved?.affiliates&&saved?.bookings?saved:seedDemo());const u=JSON.parse(sessionStorage.getItem('eyecon-demo-user')||'null');if(u&&['staff','affiliate'].includes(u.role))setUser(u);}catch{setData(seedDemo());}setReady(true);return;}
    let active=true,subscription;
    try{const client=browserClient();client.auth.getSession().then(async({data:{session}})=>{if(session)try{await reload();}catch(e){if(active)setError(e.message);}if(active)setReady(true);});subscription=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){setUser(null);setData({affiliates:[],bookings:[],templates:[],slots:[]});}}).data.subscription;}catch(e){setError(e.message);setReady(true);}
    return()=>{active=false;subscription?.unsubscribe();};
  },[]);
  useEffect(()=>{if(DEMO&&ready)try{localStorage.setItem('eyecon-demo-v1',JSON.stringify(data));}catch{setError('This browser could not save demo changes. Keep this tab open or reset the demo.');}},[data,ready]);
  async function action(action,payload){
    if(DEMO){let next=applyDemo(data,action,payload,user);setData(next);return action==='booking'?{booking:next.bookings[0],notifications:{email:'demo',sms:'demo'}}:{ok:true};}
    const response=await fetch('/api/workspace',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const result=await response.json();if(!response.ok)throw new Error(result.error);await reload();return result;
  }
  async function book(payload){if(DEMO)return action('booking',payload);const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
  async function photo(file,affiliateId){if(DEMO){const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const a=data.affiliates.find(a=>a.id===affiliateId);return action('profile',{...a,photo:result});}const form=new FormData();form.set('file',file);form.set('affiliateId',affiliateId);const res=await fetch('/api/workspace',{method:'POST',headers:await headers(),body:form});const result=await res.json();if(!res.ok)throw new Error(result.error);await reload();}
  function demoSignIn(role){const u={role,affiliateId:role==='affiliate'?'demo-alex':null};setUser(u);sessionStorage.setItem('eyecon-demo-user',JSON.stringify(u));}
  async function signOut(){if(DEMO)sessionStorage.removeItem('eyecon-demo-user');else await browserClient().auth.signOut();setUser(null);}
  function reset(){setData(seedDemo());sessionStorage.removeItem('eyecon-demo-user');setUser(null);}
  return <Context.Provider value={{data,user,ready,error,reload,action,book,photo,demoSignIn,signOut,reset}}>{children}</Context.Provider>;
}
export function useApp(){return useContext(Context);}
```

## components/ui.js

```javascript
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect,useRef } from 'react';
import { clinic,DEMO } from '@/lib/config';
export function Icon({name='eye',size=24}){const paths={eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,circle:<><circle cx="12" cy="12" r="8"/><path d="m5 18 13-13"/></>,drop:<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>,people:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/></>,scan:<><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M6 12h12"/><circle cx="12" cy="12" r="3"/></>,glasses:<><circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><path d="M10 14h4M2 14l2-7m18 7-2-7"/></>,phone:<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c0 2-3 3-5 2A22 22 0 0 1 3 8c-1-2 0-5 2-5Z"/>,gift:<><path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12"/><path d="M12 9C4 9 5 1 9 4l3 5c8 0 7-8 3-5l-3 5Z"/></>,check:<path d="m5 12 4 4L20 5"/>,menu:<path d="M3 6h18M3 12h18M3 18h18"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></>};return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.eye}</svg>;}
export function Logo(){return <Link href="/" className="logo" aria-label="Eyecon Optometry home"><span>EYECON</span><small>OPTOMETRY</small></Link>;}
export function Button({children,href,secondary=false,className='',...props}){const classes=`button ${secondary?'secondary':''} ${className}`;return href?<Link className={classes} href={href} {...props}>{children}</Link>:<button className={classes} {...props}>{children}</button>;}
export function Header({bookingHref='/booking',bookingLabel='Book appointment'}){return <header className="site-header"><div className="header-inner"><Logo/><div className="header-actions">{clinic.phone?<a className="call-link" href={'tel:'+clinic.phone}><Icon name="phone" size={19}/><span>{clinic.phone}</span></a>:<span className="header-note">Personal eye care</span>}<Button href={bookingHref}>{bookingLabel}</Button></div></div></header>;}
export function PreviewBar(){return DEMO?<div className="preview-bar">Design preview · Use fictional patient details.<Link href="/login">Explore workspaces</Link></div>:null;}
export function Referral({affiliate}){return affiliate?<div className="referral"><img src={affiliate.photo||'/images/affiliate.webp'} width="46" height="46" alt=""/><div><small>Your personal referral from</small><strong>{affiliate.name}</strong></div></div>:null;}
export function Gift({compact=false}){return <div className={`gift ${compact?'compact':''}`}><Icon name="gift" size={24}/><div><strong>$50 referral gift card</strong><small>Subject to the clinic’s confirmed eligibility terms.</small></div></div>;}
export function Footer(){return <footer className="footer"><Logo/><div>{clinic.address&&<p>{clinic.address}</p>}{clinic.hours&&<p>{clinic.hours}</p>}{clinic.phone&&<a href={'tel:'+clinic.phone}>{clinic.phone}</a>}{clinic.email&&<a href={'mailto:'+clinic.email}>{clinic.email}</a>}{!clinic.address&&<p>Clinic contact details will be added before launch.</p>}</div><div><Link href="/privacy">Privacy</Link><Link href="/login">Affiliate & staff sign-in</Link><small>© {new Date().getFullYear()} Eyecon Optometry</small></div></footer>;}
export function Field({label,id,error,hint,children,...props}){return <div className="field"><label htmlFor={id}>{label}</label>{children||<input id={id} aria-invalid={!!error} aria-describedby={hint?id+'-hint':undefined} {...props}/>} {hint&&<small id={id+'-hint'}>{hint}</small>}{error&&<small className="error-text">{error}</small>}</div>;}
export function Notice({children,error=false}){return children?<div role={error?'alert':'status'} className={`notice ${error?'error':''}`}>{children}</div>:null;}
export function Modal({open,title,onClose,children}){const ref=useRef(null);useEffect(()=>{const d=ref.current;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close();},[open]);return <dialog ref={ref} className="modal" onCancel={onClose} onClose={onClose} aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{title}</h2><button onClick={onClose} className="icon-button" aria-label="Close dialog"><Icon name="close"/></button></div>{open&&children}</dialog>;}
export function Loading(){return <div className="loading" role="status"><span className="spinner"/>Loading your Eyecon experience…</div>;}
export function Portrait({src,alt,...props}){return <Image src={src} alt={alt} {...props}/>;}
```

## components/workspace.js

```javascript
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect,useMemo,useState } from 'react';
import { useApp } from './provider';
import { Logo,Button,Field,Notice,Loading,Modal,Icon } from './ui';
import { DEMO,services,statuses,sources,clinic,formatDate,money,serviceName } from '@/lib/config';
import { affiliateRows } from '@/lib/demo';
import { csv,validateBooking,validateSlug,slotTaken } from '@/lib/validation';
import { downloadFile } from '@/lib/calendar';
const affiliateNav=[['','Overview'],['referrals','Referrals'],['link','My link & QR'],['earnings','Earnings'],['profile','Profile']];
const staffNav=[['','Bookings'],['affiliates','Affiliates'],['leads','Leads'],['payouts','Payouts'],['messages','Messages']];
function QR({url}){const [image,setImage]=useState('');useEffect(()=>{let active=true;import('qrcode').then(m=>(m.default||m).toDataURL(url,{width:220,margin:2,color:{dark:'#202221',light:'#ffffff'},errorCorrectionLevel:'M'})).then(s=>{if(active)setImage(s);});return()=>{active=false;};},[url]);return image?<img className="qr" src={image} width="150" height="150" alt="QR code linking to this affiliate’s booking page"/>:<div className="qr" aria-label="Generating QR code"/>;}
function Empty({text='No records match your filters.'}){return <div className="empty-state"><Icon name="calendar" size={32}/><h3>{text}</h3><p>Your next update will appear here.</p></div>;}
export default function Workspace({role,section=''}){
  const app=useApp(),{data,user,ready,error:loadError,action,signOut,photo}=app,router=useRouter();
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[modal,setModal]=useState(''),[selected,setSelected]=useState([]),[query,setQuery]=useState(''),[status,setStatus]=useState('All'),[source,setSource]=useState('All'),[date,setDate]=useState(''),[view,setView]=useState('list'),[month,setMonth]=useState(new Date()),[detail,setDetail]=useState(null);
  const [origin,setOrigin]=useState(clinic.site);
  useEffect(()=>setOrigin(window.location.origin),[]);
  useEffect(()=>{if(ready&&!user&&!loadError)router.replace('/login');},[ready,user,loadError,router]);
  const own=data.affiliates.find(a=>a.id===user?.affiliateId);
  const rows=role==='affiliate'?affiliateRows(data.bookings,user?.affiliateId):data.bookings;
  const activeTitle=(role==='staff'?staffNav:affiliateNav).find(n=>n[0]===section)?.[1]||'Overview';
  const dayKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:clinic.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
  const filtered=rows.filter(b=>(!query||b.name.toLowerCase().includes(query.toLowerCase()))&&(status==='All'||b.status===status)&&(source==='All'||b.source===source)&&(!date||dayKey(b.start)===date));
  const eligible=rows.filter(b=>b.status==='Attended'&&b.commission>0&&b.payout==='Pending');
  const total=eligible.filter(b=>selected.includes(b.id)).reduce((s,b)=>s+b.commission,0);
  async function run(fn,success='Saved successfully.'){setBusy(true);setError('');setMessage('');try{const result=await fn();setMessage(success);return result;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
  async function save(act,payload,success){const result=await run(()=>action(act,payload),success);if(result!==false)setModal('');return result;}
  function exportRows(exported=filtered){const fields=role==='staff'?['name','email','phone','start','service','source','status','commission','payout']:['name','start','status','commission','payout'];downloadFile(csv(exported,fields),'eyecon-'+(section||'bookings')+'.csv','text/csv');setMessage('Your CSV download is ready.');}
  if(!ready)return <Loading/>;
  if(loadError)return <main className="container empty-page"><h1>Workspace unavailable</h1><Notice error>{loadError}</Notice><Button href="/login">Return to sign-in</Button></main>;
  if(!user)return <Loading/>;
  if(user.role!==role)return <main className="container empty-page"><h1>This workspace needs a different account</h1><Button href={user.role==='staff'?'/admin':'/affiliate'}>Open your workspace</Button></main>;
  const referralUrl=origin+'/book/'+own?.slug;
  function table(items,earnings=false){return items.length?<div className="table-wrap" tabIndex={0} role="region" aria-label={activeTitle+' table'}><table><caption className="sr-only">{activeTitle}</caption><thead><tr>{section==='payouts'&&<th scope="col">Select</th>}<th scope="col">Patient</th><th scope="col">{earnings?'Appointment':'Date & time'}</th>{role==='staff'&&<th scope="col">Source</th>}<th scope="col">Status</th>{earnings||role==='affiliate'?<><th scope="col">Commission</th><th scope="col">Payment</th></>:<th scope="col">Actions</th>}</tr></thead><tbody>{items.map(b=><tr key={b.id}>{section==='payouts'&&<td><input aria-label={'Select referral for '+b.name} type="checkbox" disabled={!(b.status==='Attended'&&b.commission>0&&b.payout==='Pending')} checked={selected.includes(b.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,b.id]:s.filter(id=>id!==b.id))}/></td>}<td><strong>{b.name}</strong>{role==='staff'&&b.affiliateId&&<small>{data.affiliates.find(a=>a.id===b.affiliateId)?.name||'Affiliate'}</small>}</td><td>{formatDate(b.start)}{role==='staff'&&<small>{serviceName(b.service)}</small>}</td>{role==='staff'&&<td>{b.source}</td>}<td>{role==='staff'&&!earnings?<select aria-label={'Status for '+b.name} value={b.status} disabled={busy} onChange={e=>run(()=>action('status',{id:b.id,status:e.target.value}),'Attendance updated.')}><option>{b.status}</option>{statuses.filter(s=>s!==b.status).map(s=><option key={s}>{s}</option>)}</select>:<span className={'badge '+b.status.toLowerCase()}>{b.status}</span>}</td>{earnings||role==='affiliate'?<><td>{role==='staff'&&section==='payouts'&&b.payout!=='Paid'?<form className="commission-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);run(()=>action('commission',{id:b.id,amount:Number(form.get('amount'))}),'Commission approved.');}}><input type="number" name="amount" aria-label={'Commission for '+b.name} min="0" max="100000" step="0.01" defaultValue={b.commission} disabled={b.status!=='Attended'||!b.affiliateId}/><button className="text-link" disabled={busy||b.status!=='Attended'||!b.affiliateId}>Save</button></form>:money(b.commission)}</td><td><span className="badge">{b.payout}</span>{b.paidAt&&<small>{formatDate(b.paidAt,{timeStyle:undefined})}</small>}</td></>:<td><button className="text-link" onClick={()=>{setDetail(b);setModal('detail');}}>Details</button></td>}</tr>)}</tbody></table></div>:<Empty/>;}
  return <div className="workspace"><aside className="sidebar"><Logo/><p className="workspace-label">{role==='staff'?'CLINIC WORKSPACE':'AFFILIATE WORKSPACE'}</p><nav aria-label="Workspace navigation">{(role==='staff'?staffNav:affiliateNav).map(([path,label])=><Link key={path} href={'/'+(role==='staff'?'admin':'affiliate')+(path?'/'+path:'')} aria-current={path===section?'page':undefined}>{label}</Link>)}</nav><div className="sidebar-bottom"><Link href="/">View website</Link><button onClick={()=>run(async()=>{await signOut();router.push('/login');},'Signed out.')}>Sign out</button></div></aside><main className="workspace-main" id="main-content"><header className="workspace-header"><div><p className="eyebrow">{DEMO?'DEMO WORKSPACE':'EYECON WORKSPACE'}</p><h1>{role==='affiliate'&&!section?'Good morning, '+(own?.name.split(' ')[0]||'there'):activeTitle}</h1></div><div className="toolbar">{role==='staff'&&(!section||section==='leads')&&<><Button secondary onClick={()=>setModal('slot')}>Add available time</Button><Button onClick={()=>setModal('booking')}>New booking</Button></>}{role==='staff'&&section==='affiliates'&&<Button onClick={()=>setModal('affiliate')}>Add affiliate</Button>}{(section==='referrals'||section==='earnings'||section==='leads')&&<Button secondary onClick={()=>exportRows()}>Export CSV</Button>}</div></header><Notice error>{error}</Notice><Notice>{message}</Notice>
  {role==='affiliate'&&!section&&<><div className="stats">{[['Bookings this month',rows.filter(b=>{let d=new Date(b.start),now=new Date();return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length],['Completed visits',rows.filter(b=>b.status==='Attended').length],['Pending commission',money(rows.filter(b=>b.payout==='Pending').reduce((s,b)=>s+b.commission,0))],['Paid',money(rows.filter(b=>b.payout==='Paid').reduce((s,b)=>s+b.commission,0))]].map(([label,value])=><article key={label}><p>{label}</p><strong>{value}</strong></article>)}</div><p className="quiet">{own?.commissionNote||'Commission terms will be confirmed by the clinic.'}</p><section className="referral-panel"><div><h2>Your personal referral link</h2><p className="link-value">{referralUrl}</p><Button onClick={()=>run(()=>navigator.clipboard.writeText(referralUrl),'Referral link copied.')}>Copy link</Button><Button secondary href="/affiliate/link">View QR code</Button></div><QR url={referralUrl}/></section><div className="section-heading"><h2>Recent referrals</h2><Link className="text-link" href="/affiliate/referrals">View all</Link></div>{table(rows.slice(0,5))}</>}
  {((role==='staff'&&(!section||section==='leads'))||section==='referrals')&&<><div className="filters"><Field label="Search patients" id="search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name"/><Field label="Status" id="status"><select id="status" value={status} onChange={e=>setStatus(e.target.value)}>{['All',...statuses].map(s=><option key={s}>{s}</option>)}</select></Field>{role==='staff'&&<Field label="Source" id="source"><select id="source" value={source} onChange={e=>setSource(e.target.value)}>{['All',...sources].map(s=><option key={s}>{s}</option>)}</select></Field>}<Field label="Date" id="date" type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className="text-link" onClick={()=>{setQuery('');setStatus('All');setSource('All');setDate('');}}>Clear</button></div>{role==='staff'&&!section&&<div className="view-tabs"><button aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button><button aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}>Calendar</button><small>Times in {clinic.timezone}</small></div>}{view==='calendar'&&role==='staff'&&!section?<><div className="calendar-heading"><button className="button secondary" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>Previous month</button><h2>{month.toLocaleDateString('en-CA',{month:'long',year:'numeric'})}</h2><button className="button secondary" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>Next month</button></div><div className="month-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:new Date(month.getFullYear(),month.getMonth(),1).getDay()},(_,i)=><span key={'pad'+i}/>)}{Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>{const key=month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-'+String(i+1).padStart(2,'0');const count=rows.filter(b=>dayKey(b.start)===key).length;return <button key={key} onClick={()=>{setDate(key);setView('list');}} aria-label={key+', '+count+' bookings'}><span>{i+1}</span>{count>0&&<small>{count} bookings</small>}</button>;})}</div></>:table(filtered)}</>}
  {section==='link'&&own&&<section className="panel link-page"><p className="eyebrow">YOUR PERSONAL INTRODUCTION</p><h2>One link. A warm welcome.</h2><p>Share your link or QR code so each appointment connects back to your referral.</p><QR url={referralUrl}/><Field label="Your referral link" id="referral-url" readOnly value={referralUrl}/><div className="toolbar"><Button onClick={()=>run(()=>navigator.clipboard.writeText(referralUrl),'Referral link copied.')}>Copy link</Button><Button secondary onClick={()=>run(async()=>{const m=await import('qrcode');const url=await(m.default||m).toDataURL(referralUrl,{width:1000,margin:3});const a=document.createElement('a');a.href=url;a.download='eyecon-'+own.slug+'-qr.png';a.click();},'QR download ready.')}>Download QR</Button><Button secondary href={'mailto:?subject='+encodeURIComponent('Your introduction to Eyecon')+'&body='+encodeURIComponent('Book your Eyecon appointment through my personal link: '+referralUrl)}>Email link</Button><Button secondary href={'/book/'+own.slug}>Preview my page</Button></div></section>}
  {section==='earnings'&&<><div className="stats"><article><p>Pending commission</p><strong>{money(rows.filter(b=>b.payout!=='Paid').reduce((s,b)=>s+b.commission,0))}</strong></article><article><p>Paid commission</p><strong>{money(rows.filter(b=>b.payout==='Paid').reduce((s,b)=>s+b.commission,0))}</strong></article></div><p className="quiet">Amounts reflect commission approved by clinic staff.</p>{table(rows.filter(b=>b.commission>0),true)}</>}
  {section==='profile'&&own&&<Profile affiliate={own} busy={busy} onSave={p=>save('profile',p)} onPhoto={file=>run(()=>photo(file,own.id),'Photo updated.')}/>}
  {section==='affiliates'&&<div className="affiliate-grid">{data.affiliates.map(a=><article className="panel affiliate-card" key={a.id}><div className="affiliate-card-header"><img src={a.photo} alt={'Profile photo for '+a.name} width="60" height="60"/><div><h2>{a.name}</h2><p>{a.email}</p></div><span className="badge">{a.active?'Active':'Inactive'}</span></div><p>{a.bio||'No biography added yet.'}</p><div className="affiliate-link"><span>{origin+'/book/'+a.slug}</span><QR url={origin+'/book/'+a.slug}/></div><p className="quiet">{a.commissionRate}% reference rate. {a.commissionNote||'Commission approved manually.'}</p><div className="toolbar"><Button secondary href={'/book/'+a.slug}>Preview page</Button><Button secondary disabled={busy} onClick={()=>run(()=>action('toggle-affiliate',{id:a.id}),a.active?'Affiliate deactivated.':'Affiliate activated.')}>{a.active?'Deactivate':'Activate'}</Button></div><label className="upload-label">Update profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>2097152)setError('Use an image smaller than 2 MB.');else run(()=>photo(f,a.id),'Photo updated.');}}}/></label></article>)}</div>}
  {section==='payouts'&&<><div className="payout-summary"><div><h2>Approve commission, then record payment</h2><p>Enter an amount for attended referrals. Select the payments you have completed.</p></div><Button disabled={!selected.length||busy} onClick={()=>setModal('payout')}>Record {money(total)} as paid</Button></div><Notice>Recording a payout updates the ledger. It does not transfer money.</Notice>{table(rows.filter(b=>b.affiliateId),true)}</>}
  {section==='messages'&&<><p className="muted">Plain-text templates. Available fields: {'{name}, {date}, {address}, {phone}, {instructions}, {gift}'}.</p><div className="template-grid">{data.templates.map(t=><Template key={t.id} template={t} busy={busy} onSave={p=>save('template',p)}/>)}</div>{!DEMO&&<section className="panel"><h2>Recent delivery activity</h2>{data.jobs?.length?<ul className="delivery-list">{data.jobs.map((j,i)=><li key={i}><strong>{j.kind}</strong><span>{j.status}</span><small>{JSON.stringify(j.result)}</small></li>)}</ul>:<p>No message delivery activity yet.</p>}</section>}</>}
  </main><Modal open={!!modal} title={{booking:'New manual booking',affiliate:'Add affiliate',slot:'Add available appointment time',payout:'Record completed payments',detail:'Booking details'}[modal]||''} onClose={()=>setModal('')}><Notice error>{error}</Notice>{modal==='booking'&&<ManualForm affiliates={data.affiliates} slots={data.slots.filter(s=>new Date(s.start)>new Date()&&!slotTaken(s,data.bookings))} busy={busy} onSave={p=>{try{return save('booking',validateBooking(p,true),'Manual booking saved.');}catch(e){setError(e.message);}}}/>}{modal==='affiliate'&&<AffiliateForm busy={busy} onSave={p=>{try{validateSlug(p.slug);return save('affiliate',p,DEMO?'Affiliate created with a referral link and QR code.':'Affiliate created. An invitation email has been requested.');}catch(e){setError(e.message);}}}/>}{modal==='slot'&&<form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const d=new Date(f.get('start'));save('slot',{start:d.toISOString(),duration:Number(f.get('duration'))},'Appointment time added.');}}><Field label="Start time (your browser’s local timezone)" id="slot-start" name="start" type="datetime-local" required/><Field label="Duration" id="duration"><select id="duration" name="duration">{[15,30,45,60,90].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></Field><p className="quiet">Add only times the clinic can honour. This calendar is independent of MyVisionExpress.</p><Button disabled={busy}>Add time</Button></form>}{modal==='payout'&&<div className="stack"><p>Record {selected.length} completed payments totalling <strong>{money(total)}</strong>?</p><p>This records an external payment as paid and updates the affiliate’s earnings.</p><Button disabled={busy} onClick={async()=>{const result=await save('payout',{ids:selected},'Payout recorded.');if(result!==false)setSelected([]);}}>Confirm paid</Button><Button secondary onClick={()=>setModal('')}>Cancel</Button></div>}{modal==='detail'&&detail&&<div className="booking-details"><dl>{[['Patient',detail.name],['Email',detail.email],['Phone',detail.phone],['Appointment',serviceName(detail.service)],['Time',formatDate(detail.start)],['Source',detail.source],['Insurance company',detail.insurance||'Not provided'],['Policy number',detail.policy||'Not provided'],['Favourite brands',detail.brands||'Not provided'],['SMS consent',detail.smsConsent?'Yes':'No']].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl></div>}</Modal></div>;
}
function Profile({affiliate,busy,onSave,onPhoto}){return <form className="panel stack narrow-panel" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onSave({id:affiliate.id,name:f.get('name'),bio:f.get('bio')});}}><div className="profile-image"><img src={affiliate.photo} width="100" height="100" alt="Your affiliate profile photo"/><label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f&&f.size<=2097152)onPhoto(f);}}/><small>JPG, PNG or WebP. Maximum 2 MB.</small></label></div><Field label="Display name" id="profile-name" name="name" defaultValue={affiliate.name} required maxLength={120}/><Field label="Short introduction" id="profile-bio"><textarea id="profile-bio" name="bio" defaultValue={affiliate.bio} maxLength={500} rows={5}/></Field><Button disabled={busy}>Save profile</Button></form>;}
function Template({template,busy,onSave}){return <form className="panel stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onSave({id:template.id,subject:f.get('subject'),body:f.get('body')});}}><h2>{template.id.replaceAll('-',' ')}</h2><Field label="Email subject" id={template.id+'-subject'} name="subject" defaultValue={template.subject} required maxLength={150}/><Field label="Message" id={template.id+'-body'}><textarea id={template.id+'-body'} name="body" defaultValue={template.body} rows={6} maxLength={3000} required/></Field><Button disabled={busy}>Save template</Button></form>;}
function ManualForm({affiliates,slots,busy,onSave}){return <form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onSave({name:f.get('name'),email:f.get('email'),phone:f.get('phone'),service:f.get('service'),start:f.get('start'),source:f.get('source'),affiliateId:f.get('affiliateId')||null,firstVisit:f.get('firstVisit')==='yes',smsConsent:f.get('sms')==='on'});}}><div className="form-grid"><Field label="Patient name" id="manual-name" name="name" required/><Field label="Email" id="manual-email" name="email" type="email" required/><Field label="Mobile number" id="manual-phone" name="phone" type="tel" required/><Field label="Source" id="manual-source"><select name="source" id="manual-source">{['Phone','Walk-in','Direct'].map(s=><option key={s}>{s}</option>)}</select></Field></div><Field label="Credit an affiliate" id="manual-affiliate"><select id="manual-affiliate" name="affiliateId"><option value="">No affiliate</option>{affiliates.filter(a=>a.active).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></Field><Field label="Appointment type" id="manual-service"><select id="manual-service" name="service">{services.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></Field><Field label="Available time" id="manual-start"><select id="manual-start" name="start" required><option value="">Choose a time</option>{slots.map(s=><option value={s.start} key={s.start}>{formatDate(s.start)}</option>)}</select></Field><Field label="First visit?" id="manual-first"><select id="manual-first" name="firstVisit"><option value="yes">Yes</option><option value="no">No</option></select></Field><label className="checkbox-label"><input type="checkbox" name="sms"/><span>The patient agreed to SMS reminders.</span></label><Button disabled={busy||!slots.length}>Save manual booking</Button></form>;}
function AffiliateForm({busy,onSave}){return <form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onSave({name:f.get('name'),email:f.get('email'),slug:f.get('slug'),bio:f.get('bio'),commissionRate:Number(f.get('rate')),commissionNote:f.get('note')});}}><Field label="Full name" id="affiliate-name" name="name" required maxLength={120}/><Field label="Email address" id="affiliate-email" name="email" type="email" required/><Field label="Referral page name" id="affiliate-slug" name="slug" placeholder="alex-morgan" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={70} hint="Creates /book/alex-morgan and a matching QR code."/><Field label="Short introduction" id="affiliate-bio"><textarea id="affiliate-bio" name="bio" rows={3} maxLength={500}/></Field><div className="form-grid"><Field label="Reference commission rate (%)" id="affiliate-rate" name="rate" type="number" defaultValue="0" min="0" max="100" step="0.01"/><Field label="Commission terms" id="affiliate-note" name="note" defaultValue="Terms awaiting approval" maxLength={300}/></div><p className="quiet">The rate is informational. Staff enter approved commission amounts after attendance. Upload a profile photo after creating the affiliate.</p><Button disabled={busy}>Create affiliate</Button></form>;}
```

## jsconfig.json

```json
{
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"] } }
}
```

## lib/calendar.js

```javascript
import { clinic, serviceName } from './config.js';
export function escapeICS(s) { return String(s).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\r', ''); }
const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function calendarFile(booking) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Eyecon//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${booking.id}@eyecon-appointments`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(booking.start)}`,`DTEND:${stamp(new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000))}`,`SUMMARY:${escapeICS('Eyecon: ' + serviceName(booking.service))}`,`LOCATION:${escapeICS(clinic.address || 'Contact the clinic for location details')}`,'DESCRIPTION:Please bring your current glasses and insurance card.','END:VEVENT','END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}
export function googleCalendar(booking) {
  const end = new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000);
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: 'Eyecon: ' + serviceName(booking.service), dates: stamp(booking.start) + '/' + stamp(end), location: clinic.address });
}
export function outlookCalendar(booking) { return 'https://outlook.live.com/calendar/0/deeplink/compose?' + new URLSearchParams({ subject: 'Eyecon: ' + serviceName(booking.service), startdt: booking.start, enddt: new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000).toISOString(), location: clinic.address }); }
export function downloadFile(text, filename, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
```

## lib/config.js

```javascript
export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
export const clinic = {
  name: 'Eyecon Optometry',
  phone: process.env.NEXT_PUBLIC_CLINIC_PHONE || '',
  email: process.env.NEXT_PUBLIC_CLINIC_EMAIL || '',
  address: process.env.NEXT_PUBLIC_CLINIC_ADDRESS || '',
  hours: process.env.NEXT_PUBLIC_CLINIC_HOURS || '',
  timezone: process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || 'America/Toronto',
  reviews: process.env.NEXT_PUBLIC_REVIEWS_URL || '',
  site: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
};
export const services = [
  { id: 'eye-exam', name: 'Comprehensive eye exam', description: 'A thorough look at your vision and eye health.', icon: 'eye' },
  { id: 'contacts', name: 'Contact lens fitting', description: 'Find the right contact lenses and a comfortable fit.', icon: 'circle' },
  { id: 'dry-eye', name: 'Dry eye consultation', description: 'Discuss dryness, irritation and your care options.', icon: 'drop' },
  { id: 'children', name: 'Children’s eye exam', description: 'Thoughtful eye care for growing eyes.', icon: 'people' },
  { id: 'testing', name: 'Specialty testing', description: 'Additional testing recommended for your eye care.', icon: 'scan' },
  { id: 'styling', name: 'Frame styling consultation', description: 'Explore frames with a personal styling consultation.', icon: 'glasses' }
];
export const brands = ['Cartier', 'Tom Ford', 'Gucci', 'LINDBERG', 'Maybach', 'DITA', 'Chrome Hearts', 'Maui Jim'];
export const statuses = ['Booked', 'Attended', 'No-show', 'Cancelled'];
export const sources = ['Affiliate', 'Direct', 'Phone', 'Walk-in'];
export const instructions = ['Bring your current glasses and contact lenses.', 'Bring photo ID and your insurance card.', 'Please arrive 10 minutes early.'];
export const defaultTemplates = [
  { id: 'confirmation', subject: 'Your Eyecon appointment', body: 'Hello {name}, your appointment is booked for {date}. {address}\n\n{instructions}\n\n{gift}' },
  { id: 'day-before', subject: 'Your appointment is tomorrow', body: 'Hello {name}, a reminder of your Eyecon appointment: {date}. {address} {gift}' },
  { id: 'same-day', subject: 'Your appointment is today', body: 'Hello {name}, we look forward to seeing you at Eyecon today: {date}. {gift}' },
  { id: 'no-show', subject: 'Would you like to rebook?', body: 'Hello {name}, please contact Eyecon if you would like to arrange another appointment. {phone}' }
];
export function serviceName(id) { return services.find(s => s.id === id)?.name || 'Eye appointment'; }
export function formatDate(iso, options = {}) { return new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, dateStyle: 'medium', timeStyle: 'short', ...options }).format(new Date(iso)); }
export function money(value) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value || 0)); }
```

## lib/demo.js

```javascript
import { defaultTemplates } from './config.js';
import { slotTaken, validateSlug } from './validation.js';
export function demoSlots(now = new Date()) {
  const slots = [];
  for (let day = 1; day <= 35; day++) {
    const date = new Date(now); date.setUTCDate(date.getUTCDate() + day);
    if ([0,6].includes(date.getUTCDay())) continue;
    for (const hour of [14,15,16,18,19,20]) { const start = new Date(date); start.setUTCHours(hour,0,0,0); slots.push({ start: start.toISOString(), duration: 30 }); }
  }
  return slots;
}
export function seedDemo() {
  const slots = demoSlots();
  return {
    affiliates: [{ id: 'demo-alex', name: 'Alex Morgan', slug: 'alex-morgan', email: 'alex@example.com', bio: 'I would love to introduce you to Eyecon’s personal approach to eye care and eyewear.', photo: '/images/affiliate.webp', active: true, commissionRate: 0, commissionNote: 'Commission terms awaiting approval' }],
    bookings: [
      { id:'sample-1',name:'Sample patient 01',email:'sample1@example.com',phone:'+14165550101',start:slots[0].start,duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Booked',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-2',name:'Sample patient 02',email:'sample2@example.com',phone:'+14165550102',start:new Date(Date.now()-86400000*2).toISOString(),duration:30,service:'styling',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:40,payout:'Pending',firstVisit:false,smsConsent:false },
      { id:'sample-3',name:'Sample patient 03',email:'sample3@example.com',phone:'+14165550103',start:new Date(Date.now()-86400000*8).toISOString(),duration:30,service:'contacts',source:'Direct',affiliateId:null,status:'No-show',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-4',name:'Sample patient 04',email:'sample4@example.com',phone:'+14165550104',start:new Date(Date.now()-86400000*10).toISOString(),duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:30,payout:'Paid',paidAt:new Date().toISOString(),firstVisit:false,smsConsent:false }
    ], templates: defaultTemplates.map(t=>({...t})), slots
  };
}
export function affiliateRows(bookings, id) { return bookings.filter(b=>b.affiliateId===id).map(({id,name,status,start,commission,payout,paidAt})=>({id,name,status,start,commission,payout,paidAt})); }
export function applyDemo(data, action, payload, user) {
  const next = structuredClone(data);
  if (action === 'profile') {
    if (!['affiliate','staff'].includes(user?.role)) throw new Error('Please sign in.');
    const a = next.affiliates.find(a=>a.id === (user.role === 'affiliate' ? user.affiliateId : payload.id));
    if (!a) throw new Error('Affiliate not found.');
    Object.assign(a, { name: payload.name, bio: payload.bio, ...(payload.photo ? { photo:payload.photo } : {}) }); return next;
  }
  if (action === 'booking') { const slot=next.slots.find(s=>s.start===payload.start);if(!slot||slotTaken(slot,next.bookings)) throw new Error('That time has just been booked. Please choose another.');if(payload.affiliateId&&!next.affiliates.some(a=>a.id===payload.affiliateId&&a.active))throw new Error('This affiliate is inactive.');next.bookings.unshift({...payload,duration:slot.duration,id:crypto.randomUUID(),status:'Booked',commission:0,payout:'Pending',createdAt:new Date().toISOString()}); return next; }
  if (user?.role !== 'staff') throw new Error('Staff access is required.');
  if (action === 'status') { const b=next.bookings.find(b=>b.id===payload.id); if (!b) throw new Error('Booking not found.'); b.status=payload.status; }
  else if (action === 'commission') { const b=next.bookings.find(b=>b.id===payload.id); if (!b || b.payout==='Paid' || b.status!=='Attended' || !b.affiliateId) throw new Error('Only unpaid, attended referrals can receive commission.');if(!Number.isFinite(payload.amount)||payload.amount<0||payload.amount>100000)throw new Error('Invalid commission amount.'); b.commission=payload.amount; }
  else if (action === 'payout') { const chosen=next.bookings.filter(b=>payload.ids.includes(b.id)); if (!chosen.length || chosen.some(b=>!b.affiliateId || b.status!=='Attended' || !(b.commission>0) || b.payout==='Paid')) throw new Error('Select attended referrals with approved unpaid commission.'); chosen.forEach(b=>{b.payout='Paid';b.paidAt=new Date().toISOString();}); }
  else if (action === 'affiliate') { validateSlug(payload.slug);if(next.affiliates.some(a=>a.slug===payload.slug)) throw new Error('That page name already exists.'); next.affiliates.push({...payload,id:crypto.randomUUID(),active:true,photo:payload.photo||'/images/affiliate.webp'}); }
  else if (action === 'toggle-affiliate') { const a=next.affiliates.find(a=>a.id===payload.id); if(a) a.active=!a.active; }
  else if (action === 'template') { next.templates=next.templates.map(t=>t.id===payload.id?{...t,subject:payload.subject,body:payload.body}:t); }
  else if (action === 'slot') { if(!Number.isFinite(new Date(payload.start).getTime())||new Date(payload.start)<=new Date()||![15,30,45,60,90].includes(payload.duration))throw new Error('Choose a future time and valid duration.');if(next.slots.some(s=>s.start===payload.start)) throw new Error('This slot already exists.');next.slots.push(payload);next.slots.sort((a,b)=>a.start.localeCompare(b.start)); }
  else throw new Error('Unknown action.');
  return next;
}
```

## lib/notifications.js

```javascript
import 'server-only';
import { calendarFile } from './calendar.js';
import { clinic, formatDate, instructions, defaultTemplates } from './config.js';
export function renderTemplate(body,b) { const values={name:b.name,date:formatDate(b.start),address:clinic.address,phone:clinic.phone,instructions:instructions.join('\n'),gift:b.affiliateId?'Your referral includes a $50 gift card, subject to the clinic’s confirmed eligibility terms.':''};return body.replace(/\{(name|date|address|phone|instructions|gift)\}/g,(_,key)=>values[key]); }
export async function sendNotification(db,b,kind) {
  const {data:template}=await db.from('message_templates').select('*').eq('id',kind).single();
  const t=template||defaultTemplates.find(t=>t.id===kind), text=renderTemplate(t.body,b);
  const status={email:'not-configured',sms:b.smsConsent?'not-configured':'not-consented'};
  if(process.env.RESEND_API_KEY && process.env.RESEND_FROM){const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':b.id+'-'+kind},body:JSON.stringify({from:process.env.RESEND_FROM,to:[b.email],subject:t.subject,text,...(kind==='confirmation'?{attachments:[{filename:'eyecon-appointment.ics',content:Buffer.from(calendarFile(b)).toString('base64')}]}:{})}),signal:AbortSignal.timeout(12000)});status.email=res.ok?'sent':'failed';}
  if(b.smsConsent && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER){const res=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+process.env.TWILIO_ACCOUNT_SID+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:process.env.TWILIO_FROM_NUMBER,To:b.phone,Body:text}),signal:AbortSignal.timeout(12000)});status.sms=res.ok?'sent':'failed';}
  return status;
}
export async function claimAndSend(db,b,kind) {
  const {error}=await db.from('notification_jobs').insert({booking_id:b.id,kind,status:'processing'});
  if(error?.code==='23505')return {skipped:true};if(error){console.error('Notification job could not be recorded:',error.code);return {email:'failed',sms:'failed',reviewRequired:true};}
  try{const result=await sendNotification(db,b,kind);await db.from('notification_jobs').update({status:'finished',result}).eq('booking_id',b.id).eq('kind',kind);return result;}catch{await db.from('notification_jobs').update({status:'failed',result:{error:'Delivery failed; staff review required'}}).eq('booking_id',b.id).eq('kind',kind);return {email:'failed',sms:'failed'};}
}
```

## lib/server.js

```javascript
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DEMO } from './config.js';
export function adminClient() {
  if (DEMO) throw new Error('Live services are disabled in demo mode.');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The clinic booking service is not configured yet.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
}
export async function identity(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /,'');
  if (!token) throw new Error('Please sign in.');
  const db=adminClient(); const {data,error}=await db.auth.getUser(token);
  if(error || !data.user) throw new Error('Your session has expired. Please sign in again.');
  const {data:profile}=await db.from('profiles').select('role,affiliate_id').eq('id',data.user.id).single();
  if(!profile) throw new Error('Your account does not have access to this workspace.');
  if(profile.role==='affiliate') { const {data:a}=await db.from('affiliates').select('active').eq('id',profile.affiliate_id).single(); if(!a?.active) throw new Error('This affiliate account is inactive.'); }
  return {id:data.user.id,role:profile.role,affiliateId:profile.affiliate_id,db};
}
export function requireStaff(user) { if(user.role!=='staff') throw new Error('Staff access is required.'); }
export function sameOrigin(request) { const origin=request.headers.get('origin'); if(!origin || origin!==new URL(request.url).origin) throw new Error('This request must come from the Eyecon website.'); }
export function encryptPolicy(value) { if(!value)return null;const key=process.env.INSURANCE_ENCRYPTION_KEY;if(!/^[a-f\d]{64}$/i.test(key||''))throw new Error('Insurance policy storage is not configured. Please leave the policy number blank.');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64'); }
export function decryptPolicy(value) { if(!value)return '';const key=process.env.INSURANCE_ENCRYPTION_KEY;if(!key)return 'Unavailable';try{const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}catch{return 'Unavailable';} }
export function mapBooking(b) { return {id:b.id,name:b.name,email:b.email,phone:b.phone,start:b.start,duration:b.duration,service:b.service,source:b.source,affiliateId:b.affiliate_id,status:b.status,commission:Number(b.commission),payout:b.payout,paidAt:b.paid_at,firstVisit:b.first_visit,smsConsent:b.sms_consent,insurance:b.insurance,policy:decryptPolicy(b.policy_encrypted),brands:b.brands,createdAt:b.created_at}; }
export function mapAffiliate(a) { return {id:a.id,name:a.name,slug:a.slug,bio:a.bio,photo:a.photo,email:a.email,active:a.active,commissionRate:Number(a.commission_rate),commissionNote:a.commission_note}; }
export function publicAffiliate(a) { const {id,name,slug,bio,photo,active}=mapAffiliate(a);return {id,name,slug,bio,photo,active}; }
export function fail(error, status=400) { const text=String(error?.message || 'Something went wrong. Please try again.');const safe=text.includes('fetch failed')?'The booking service is temporarily unavailable. Please try again.':text;return Response.json({error:safe},{status,headers:{'Cache-Control':'no-store'}}); }
export async function audit(db, actor, action, recordId) { const {error}=await db.from('audit_logs').insert({actor_id:actor,action,record_id:String(recordId)});if(error)console.error('Audit log write failed:',error.code); }
```

## lib/supabase.js

```javascript
import { createClient } from '@supabase/supabase-js';
let client;
export function browserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Live sign-in is not configured. Follow the Supabase setup in README.md.');
  client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
```

## lib/validation.js

```javascript
import { services, statuses } from './config.js';
export function clean(value, max = 250) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function validateBooking(input, manual = false) {
  const name = clean(input.name, 120), email = clean(input.email, 254).toLowerCase(), phone = clean(input.phone, 32);
  if (name.length < 2) throw new Error('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (!/^\+?[\d\s().-]{7,25}$/.test(phone)) throw new Error('Please enter a valid mobile number.');
  if (input.smsConsent && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('For SMS reminders, use an international number such as +14165550123.');
  if (!services.some(s => s.id === input.service)) throw new Error('Please choose an appointment type.');
  const date = new Date(input.start);
  if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new Error('Choose an available future appointment.');
  if (typeof input.firstVisit !== 'boolean') throw new Error('Please tell us whether this is your first visit.');
  const source = manual ? (['Phone', 'Walk-in', 'Direct'].includes(input.source) ? input.source : 'Phone') : (input.affiliateId ? 'Affiliate' : 'Direct');
  return { name, email, phone, service: input.service, start: date.toISOString(), firstVisit: input.firstVisit, insurance: clean(input.insurance, 120), policy: clean(input.policy, 120), brands: clean(input.brands, 300), smsConsent: input.smsConsent === true, affiliateId: clean(input.affiliateId, 60) || null, source };
}
export function validateStatus(status) { if (!statuses.includes(status)) throw new Error('Invalid booking status.'); return status; }
export function validateSlug(slug) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 70) throw new Error('Use lowercase letters, numbers and single hyphens for the page name.'); return slug; }
export function safePhoto(url) { return typeof url === 'string' && (url.startsWith('/images/') || /^https:\/\//.test(url)) ? url : '/images/affiliate.webp'; }
export function slotTaken(slot, bookings) { const start=new Date(slot.start).getTime(),end=start+(slot.duration||30)*60000;return bookings.some(b=>b.status!=='Cancelled'&&start<new Date(b.start).getTime()+(b.duration||30)*60000&&end>new Date(b.start).getTime()); }
export function csv(rows, fields) { const cell = x => { let v=String(x ?? '');if(/^\s*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'; }; return [fields.map(cell).join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\r\n'); }
```

## next.config.mjs

```javascript
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ] }];
  }
};
export default nextConfig;
```

## package-lock.json

```json
{
  "name": "eyecon-module-1",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "eyecon-module-1",
      "version": "1.0.0",
      "dependencies": {
        "@supabase/supabase-js": "2.117.2",
        "next": "16.3.8",
        "qrcode": "1.5.4",
        "react": "19.3.0",
        "react-dom": "19.3.0",
        "server-only": "^0.0.1"
      },
      "engines": {
        "node": ">=20.9.0"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.11.3",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
      "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.5.tgz",
      "integrity": "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.5.tgz",
      "integrity": "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-freebsd-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.5.tgz",
      "integrity": "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==",
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.4.tgz",
      "integrity": "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.4.tgz",
      "integrity": "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.3.4.tgz",
      "integrity": "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==",
      "cpu": [
        "arm"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.4.tgz",
      "integrity": "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-ppc64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.3.4.tgz",
      "integrity": "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==",
      "cpu": [
        "ppc64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-riscv64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.3.4.tgz",
      "integrity": "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==",
      "cpu": [
        "riscv64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-s390x": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.3.4.tgz",
      "integrity": "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==",
      "cpu": [
        "s390x"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.3.4.tgz",
      "integrity": "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.3.4.tgz",
      "integrity": "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.3.4.tgz",
      "integrity": "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-linux-arm": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.35.5.tgz",
      "integrity": "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==",
      "cpu": [
        "arm"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.35.5.tgz",
      "integrity": "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-ppc64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.35.5.tgz",
      "integrity": "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==",
      "cpu": [
        "ppc64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-ppc64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-riscv64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.35.5.tgz",
      "integrity": "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==",
      "cpu": [
        "riscv64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-riscv64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-s390x": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.35.5.tgz",
      "integrity": "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==",
      "cpu": [
        "s390x"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-s390x": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linux-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.35.5.tgz",
      "integrity": "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.35.5.tgz",
      "integrity": "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.35.5.tgz",
      "integrity": "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4"
      }
    },
    "node_modules/@img/sharp-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.35.5.tgz",
      "integrity": "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ==",
      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/runtime": "^1.11.3"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-webcontainers-wasm32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-webcontainers-wasm32/-/sharp-webcontainers-wasm32-0.35.5.tgz",
      "integrity": "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA==",
      "cpu": [
        "wasm32"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/sharp-wasm32": "0.35.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-arm64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.35.5.tgz",
      "integrity": "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-ia32": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.35.5.tgz",
      "integrity": "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A==",
      "cpu": [
        "ia32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-x64": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.35.5.tgz",
      "integrity": "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@next/env": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-16.3.8.tgz",
      "integrity": "sha512-Al9zqHVV7TJv0eFuOU4U7Lvv74PTih4Ch63sk2xCIpSTkE3udFnaOcnzP2lQVymiL7yS9Cj2iClUXlR3EQ5sEw==",
      "license": "MIT"
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.8.tgz",
      "integrity": "sha512-2JPRMh2nmQG5CiL7cXGL9AGwnPWJQ//cTtAUCT+w511QHk79SYz3LGv/pc5X643B/WEO0rvu3Yww0hqwt3kgeA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.8.tgz",
      "integrity": "sha512-GZtCCOBKJ4leVIT/Th0llWKhD1ca92lzbQiS5R5ON9QkoiFnilFsebDae1JU2a3HWoKMEmEZWGs1AGLavVM72Q==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.8.tgz",
      "integrity": "sha512-O659ygeQYqneJ1fBKMpFxIFqYkYswu8IAS1OCKK/4f3ZgJJm1dRz4fVJZRi/kLLWjnBKnebOePA4WNv+sV1pVA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.8.tgz",
      "integrity": "sha512-dSjKSyWpzxoO1d3DIZZcP4XJcNaKeLmxQMFOiYl5vuBRMmweIqnAhty8tAmRsvTss779cK1FtYnDMj40e4TQlg==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.3.8.tgz",
      "integrity": "sha512-lbqOuz3RPRcv+o9msNsJw5x4+Y1ZwPTs6vmL6DCf7i0fZfvng/F59wyeDwqHIvV0mK//RBy/jJkZ+nCKsSMXjQ==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.3.8.tgz",
      "integrity": "sha512-+316WswI8ScVgZeUd+1KGaXkHhaYQzCjvH/05TZSpJ8zBizb1a4G7DtO7F12jcBIqMOtsz9ji1t48fmKtzqsGA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.3.8.tgz",
      "integrity": "sha512-ji0gd4kMYUxO+1fJBIbiBVRCjzG/lloiyCccnlebvb1ZJ5qXCPZqYg4Jl1DrrixnWNMKylzgpmMWx0yNDYXlzw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.3.8.tgz",
      "integrity": "sha512-WcTlaKt/TWkh5kUjdJcUmB1XgZ+1c6fz4Y9fDHL73YNSdGaUWjceeWrrlwF0nv19iABYWC4iAq1oX1w4Bn0vfg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@supabase/auth-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/auth-js/-/auth-js-2.117.2.tgz",
      "integrity": "sha512-Z3WnGwrphYZubrLbxp5Iv0tLA9A5GhvKzJ/ZXglxqwd2QEH2R4dXRltjVJ8sIn4xEW2BSFIGT0yALVJIgZeDYw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=22.0.0"
      }
    },
    "node_modules/@supabase/functions-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/functions-js/-/functions-js-2.117.2.tgz",
      "integrity": "sha512-6DT4ZIjmZxa9ANKaBIrjc86AyKrX8M376ynvNeOBBVad3eP7x3UHqWfDR2ynFkHGzCuOpr1A+kObmnahxuwuog==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=22.0.0"
      }
    },
    "node_modules/@supabase/phoenix": {
      "version": "0.4.5",
      "resolved": "https://registry.npmjs.org/@supabase/phoenix/-/phoenix-0.4.5.tgz",
      "integrity": "sha512-aAn9H9ovVyeApKy11OWOrrOGq8DV68yWeH4ud2lN9fzn4aO8Zb5GLL9m1pUg9nLqIcT+ZDfAcsZe0E/nqdv2lw==",
      "license": "MIT"
    },
    "node_modules/@supabase/postgrest-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/postgrest-js/-/postgrest-js-2.117.2.tgz",
      "integrity": "sha512-V1Qhn+M8xzJqCasOxHZ2KG19Fj39PxU7weEAmOK65/KTsWCRXboB4hcQwFvxRvM7ZikeP9IZWNvQkfjvSxzYFw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=22.0.0"
      }
    },
    "node_modules/@supabase/realtime-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/realtime-js/-/realtime-js-2.117.2.tgz",
      "integrity": "sha512-lYXSAIg3eAKA58riUED6Vb+TCzF8jtx18uOoiCaVJ7ZMre6FWBpwB1MPeW+B6vykJT/hPdiuqwcSB7ILMS21ew==",
      "license": "MIT",
      "dependencies": {
        "@supabase/phoenix": "0.4.5",
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=22.0.0"
      }
    },
    "node_modules/@supabase/storage-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/storage-js/-/storage-js-2.117.2.tgz",
      "integrity": "sha512-8gAJoVaxZa/War2kFRfJMxGk4M190Q7lJ70BofwGlRxU/u9pIodd6XyTvmXkxOKXWuIYtkDaYPZrIAUt1T/7FQ==",
      "license": "MIT",
      "dependencies": {
        "iceberg-js": "^0.8.1",
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=22.0.0"
      }
    },
    "node_modules/@supabase/supabase-js": {
      "version": "2.117.2",
      "resolved": "https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.117.2.tgz",
      "integrity": "sha512-eSG2VKnHR+Clp1PmidZ1/weJ8PJwoybjva3L2GgKqFG4YDS1Iqmc61psKGZP5xw6OMT2O7ZorPR42PY6q1BOXg==",
      "license": "MIT",
      "dependencies": {
        "@supabase/auth-js": "2.117.2",
        "@supabase/functions-js": "2.117.2",
        "@supabase/postgrest-js": "2.117.2",
        "@supabase/realtime-js": "2.117.2",
        "@supabase/storage-js": "2.117.2"
      },
      "engines": {
        "node": ">=22.0.0"
      },
      "peerDependencies": {
        "@opentelemetry/api": ">=1.0.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        }
      }
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.23",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.23.tgz",
      "integrity": "sha512-5lSsMOTXURePglDfvuAQUqkGek9Hg2kksOYay2m0+XR++b2NWYL/4sWyuvVBIs8oKnJaxkdi9whaL/sqN13afw==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.11.27",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.27.tgz",
      "integrity": "sha512-ElY12DaROGuan+lMmZ8Cvo/ZUbXPe7Enc/9VU/b1T3Kp4dwytRcNdR8DoSJN5SNJT/CuvcCA0DHDVmMOCePdRQ==",
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/camelcase": {
      "version": "5.3.1",
      "resolved": "https://registry.npmjs.org/camelcase/-/camelcase-5.3.1.tgz",
      "integrity": "sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001814",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001814.tgz",
      "integrity": "sha512-/Uaf1lAzr59XcMpW0o96WoEfr+VXK2OX4U9AgFoiSHsVJ4HppnIFUjtYzsyDH2+tgANaQb2/oxYGwCPapN1FpA==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz",
      "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",
      "license": "MIT"
    },
    "node_modules/cliui": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-6.0.0.tgz",
      "integrity": "sha512-t6wbgtoCXvAzst7QgXxJYqPt0usEfbgQdftEPbLL/cvv6HPE5VgvqCuAIDR0NgU52ds6rFwqrgakNLrHEjCbrQ==",
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.0",
        "wrap-ansi": "^6.2.0"
      }
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "license": "MIT"
    },
    "node_modules/decamelize": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/decamelize/-/decamelize-1.2.0.tgz",
      "integrity": "sha512-z2S+W9X73hAUUki+N+9Za2lBlun89zigOyGrsax+KUQ6wKW4ZoWpEYBkGhQjwAjjDCkWxhY0VKEhk8wzY7F5cA==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "license": "Apache-2.0",
      "optional": true,
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/dijkstrajs": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/dijkstrajs/-/dijkstrajs-1.0.3.tgz",
      "integrity": "sha512-qiSlmBq9+BCdCA/L46dw8Uy93mloxsPSbwnm5yrKn2vMPiy8KyAskTF6zuV/j5BMsmOGZDPs7KjU+mjb670kfA==",
      "license": "MIT"
    },
    "node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "license": "MIT"
    },
    "node_modules/find-up": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-4.1.0.tgz",
      "integrity": "sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw==",
      "license": "MIT",
      "dependencies": {
        "locate-path": "^5.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/iceberg-js": {
      "version": "0.8.1",
      "resolved": "https://registry.npmjs.org/iceberg-js/-/iceberg-js-0.8.1.tgz",
      "integrity": "sha512-1dhVQZXhcHje7798IVM+xoo/1ZdVfzOMIc8/rgVSijRK38EDqOJoGula9N/8ZI5RD8QTxNQtK/Gozpr+qUqRRA==",
      "license": "MIT",
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/locate-path": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-5.0.0.tgz",
      "integrity": "sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g==",
      "license": "MIT",
      "dependencies": {
        "p-locate": "^4.1.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/nanoid": {
      "version": "3.3.19",
      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.19.tgz",
      "integrity": "sha512-Y2tUNy4ouw6tq5oDSKeQYGOyhkUBhNOcGV/02KC+6kd9eDGqdZd++mjMiIDilrBYvjEnCYvVtsuHCuP+okSfug==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/next": {
      "version": "16.3.8",
      "resolved": "https://registry.npmjs.org/next/-/next-16.3.8.tgz",
      "integrity": "sha512-U7QEZaTini6wKrb8A8hqLLqYQyCetegKjCpJOyxk642vWoMoU1x5PyZCJFvgYgiptA8xc5j/9xYlZFO7w9Sjmw==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "16.3.8",
        "@swc/helpers": "0.5.23",
        "baseline-browser-mapping": "^2.9.19",
        "caniuse-lite": "^1.0.30001579",
        "postcss": "8.5.23",
        "styled-jsx": "5.1.6"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "16.3.8",
        "@next/swc-darwin-x64": "16.3.8",
        "@next/swc-linux-arm64-gnu": "16.3.8",
        "@next/swc-linux-arm64-musl": "16.3.8",
        "@next/swc-linux-x64-gnu": "16.3.8",
        "@next/swc-linux-x64-musl": "16.3.8",
        "@next/swc-win32-arm64-msvc": "16.3.8",
        "@next/swc-win32-x64-msvc": "16.3.8",
        "sharp": "^0.35.4"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.51.1",
        "babel-plugin-react-compiler": "*",
        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "babel-plugin-react-compiler": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/p-limit": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-2.3.0.tgz",
      "integrity": "sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w==",
      "license": "MIT",
      "dependencies": {
        "p-try": "^2.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-4.1.0.tgz",
      "integrity": "sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A==",
      "license": "MIT",
      "dependencies": {
        "p-limit": "^2.2.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/p-try": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/p-try/-/p-try-2.2.0.tgz",
      "integrity": "sha512-R4nPAVTAU0B9D35/Gk3uJf/7XYbQcyohSKdvAxIRSNghFl4e71hVoGnBNQz9cWaXxO2I10KTC+3jMdvvoKw6dQ==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "license": "ISC"
    },
    "node_modules/pngjs": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/pngjs/-/pngjs-5.0.0.tgz",
      "integrity": "sha512-40QW5YalBNfQo5yRYmiw7Yz6TKKVr3h6970B2YE+3fQpsWcrbj1PzJgxeJ19DRQjhMbKPIuMY8rFaXc8moolVw==",
      "license": "MIT",
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.23",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.23.tgz",
      "integrity": "sha512-g50586zr4bZmwFiTlflMu8E0bDTb5I5gertgwAKmsdUlTQIhZtunzUlD1WSzwcVWPoAVpsrA6vlfCD7oXvRwgg==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.16",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/qrcode": {
      "version": "1.5.4",
      "resolved": "https://registry.npmjs.org/qrcode/-/qrcode-1.5.4.tgz",
      "integrity": "sha512-1ca71Zgiu6ORjHqFBDpnSMTR2ReToX4l1Au1VFLyVeBTFavzQnv5JxMFr3ukHVKpSrSA2MCk0lNJSykjUfz7Zg==",
      "license": "MIT",
      "dependencies": {
        "dijkstrajs": "^1.0.1",
        "pngjs": "^5.0.0",
        "yargs": "^15.3.1"
      },
      "bin": {
        "qrcode": "bin/qrcode"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/react": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react/-/react-19.3.0.tgz",
      "integrity": "sha512-E8LUcbtBWt20bbl2YoHfx4ZDBdxVTfOKtCZn9cDSJ4l6/nuoApcpIBcj47t2wZoVX8g2ZHuMHbiShgCR1T5Sog==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.3.0",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.0.tgz",
      "integrity": "sha512-JDk8dgif51OjFoDE70+OT9ICyYr+69HlmihNwp1+Nsfbna3t5sIiCa9ZJktDmQ4/1b/rn26hIAR2uYXDMr5r0Q==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.28.0"
      },
      "peerDependencies": {
        "react": "^19.3.0"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/require-main-filename": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/require-main-filename/-/require-main-filename-2.0.0.tgz",
      "integrity": "sha512-NKN5kMDylKuldxYLSUfrbo5Tuzh4hd+2E8NPPX02mZtn1VuREQToYe/ZdlJy+J3uCpfaiGF05e7B8W0iXbQHmg==",
      "license": "ISC"
    },
    "node_modules/scheduler": {
      "version": "0.28.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz",
      "integrity": "sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
      "license": "ISC",
      "optional": true,
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/server-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/server-only/-/server-only-0.0.1.tgz",
      "integrity": "sha512-qepMx2JxAa5jjfzxG79yPPq+8BuFToHd1hm7kI+Z4zAq1ftQiP7HcxMhDDItrbtwVeLg/cY2JnKnrcFkmiswNA==",
      "license": "MIT"
    },
    "node_modules/set-blocking": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/set-blocking/-/set-blocking-2.0.0.tgz",
      "integrity": "sha512-KiKBS8AnWGEyLzofFfmvKwpdPzqiy16LvQfK3yv/fVH7Bj13/wl3JSR1J+rfgRE9q7xUJK4qvgS8raSOeLUehw==",
      "license": "ISC"
    },
    "node_modules/sharp": {
      "version": "0.35.5",
      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz",
      "integrity": "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==",
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/colour": "^1.1.0",
        "detect-libc": "^2.1.2",
        "semver": "^7.8.5"
      },
      "engines": {
        "node": ">=20.9.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-darwin-arm64": "0.35.5",
        "@img/sharp-darwin-x64": "0.35.5",
        "@img/sharp-freebsd-wasm32": "0.35.5",
        "@img/sharp-libvips-darwin-arm64": "1.3.4",
        "@img/sharp-libvips-darwin-x64": "1.3.4",
        "@img/sharp-libvips-linux-arm": "1.3.4",
        "@img/sharp-libvips-linux-arm64": "1.3.4",
        "@img/sharp-libvips-linux-ppc64": "1.3.4",
        "@img/sharp-libvips-linux-riscv64": "1.3.4",
        "@img/sharp-libvips-linux-s390x": "1.3.4",
        "@img/sharp-libvips-linux-x64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-arm64": "1.3.4",
        "@img/sharp-libvips-linuxmusl-x64": "1.3.4",
        "@img/sharp-linux-arm": "0.35.5",
        "@img/sharp-linux-arm64": "0.35.5",
        "@img/sharp-linux-ppc64": "0.35.5",
        "@img/sharp-linux-riscv64": "0.35.5",
        "@img/sharp-linux-s390x": "0.35.5",
        "@img/sharp-linux-x64": "0.35.5",
        "@img/sharp-linuxmusl-arm64": "0.35.5",
        "@img/sharp-linuxmusl-x64": "0.35.5",
        "@img/sharp-webcontainers-wasm32": "0.35.5",
        "@img/sharp-win32-arm64": "0.35.5",
        "@img/sharp-win32-ia32": "0.35.5",
        "@img/sharp-win32-x64": "0.35.5"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        }
      }
    },
    "node_modules/source-map-js": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
      "integrity": "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.6",
      "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
      "integrity": "sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "license": "0BSD"
    },
    "node_modules/which-module": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/which-module/-/which-module-2.0.1.tgz",
      "integrity": "sha512-iBdZ57RDvnOR9AGBhML2vFZf7h8vmBjhoaZqODJBFWHVtKkDmKuHai3cx5PgVMrX5YDNp27AofYbAwctSS+vhQ==",
      "license": "ISC"
    },
    "node_modules/wrap-ansi": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-6.2.0.tgz",
      "integrity": "sha512-r6lPcBGxZXlIcymEu7InxDMhdW0KDxpLgoFLcguasxCaJ/SOIZwINatK9KY/tf+ZrlywOKU0UDj3ATXUBfxJXA==",
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/y18n": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-4.0.3.tgz",
      "integrity": "sha512-JKhqTOwSrqNA1NY5lSztJ1GrBiUodLMmIZuLiDaMRJ+itFd+ABVE8XBjOvIWL+rSqNDC74LCSFmlb/U4UZ4hJQ==",
      "license": "ISC"
    },
    "node_modules/yargs": {
      "version": "15.4.1",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-15.4.1.tgz",
      "integrity": "sha512-aePbxDmcYW++PaqBsJ+HYUFwCdv4LVvdnhBy78E57PIor8/OVvhMrADFFEDh8DHDFRv/O9i3lPhsENjO7QX0+A==",
      "license": "MIT",
      "dependencies": {
        "cliui": "^6.0.0",
        "decamelize": "^1.2.0",
        "find-up": "^4.1.0",
        "get-caller-file": "^2.0.1",
        "require-directory": "^2.1.1",
        "require-main-filename": "^2.0.0",
        "set-blocking": "^2.0.0",
        "string-width": "^4.2.0",
        "which-module": "^2.0.0",
        "y18n": "^4.0.0",
        "yargs-parser": "^18.1.2"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/yargs-parser": {
      "version": "18.1.3",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-18.1.3.tgz",
      "integrity": "sha512-o50j0JeToy/4K6OZcaQmW6lyXXKhq7csREXcDwk2omFPJEwUNOVtJKvmDr9EI1fAJZUyZcRF7kxGBWmRXudrCQ==",
      "license": "ISC",
      "dependencies": {
        "camelcase": "^5.0.0",
        "decamelize": "^1.2.0"
      },
      "engines": {
        "node": ">=6"
      }
    }
  }
}
```

## package.json

```json
{
  "name": "eyecon-module-1",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.9.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test tests/*.test.js",
    "code-guide": "node scripts/generate-code-guide.mjs"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.117.2",
    "next": "16.3.8",
    "qrcode": "1.5.4",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "server-only": "^0.0.1"
  }
}
```

## scripts/generate-code-guide.mjs

````javascript
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set(['node_modules', '.next', '.git', '.vercel', 'coverage', 'SOURCE_CODE.md']);
async function list(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignored.has(entry.name) || (entry.name.startsWith('.env') && entry.name !== '.env.example') || entry.name.endsWith('.log')) continue;
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await list(path.join(dir, entry.name), relative + '/'));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
function tree(files) {
  const nodes = {};
  for (const file of files) {
    let current = nodes;
    for (const part of file.split('/')) current = current[part] ||= {};
  }
  function lines(node, prefix = '') {
    const entries = Object.entries(node);
    return entries.flatMap(([name, child], index) => {
      const last = index === entries.length - 1;
      const directory = Object.keys(child).length > 0;
      return [prefix + (last ? '└── ' : '├── ') + name + (directory ? '/' : ''), ...lines(child, prefix + (last ? '    ' : '│   '))];
    });
  }
  return ['eyecon-module-1/', ...lines(nodes)].join('\n');
}
const files = await list(root);
const assets = files.filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
const source = files.filter(f => f !== 'README.md' && !assets.includes(f));
let result = '# Full folder structure\n\n```text\n' + tree([...files, 'SOURCE_CODE.md']) + '\n```\n\n';
result += 'The ZIP contains these files in their actual folders. `node_modules`, `.next` and `.env.local` are created on your machine and are deliberately excluded. `SOURCE_CODE.md` is this generated guide.\n\n# Complete source files\n\nEvery text source file is reproduced below, including the lockfile. Create each file at its exact relative path. The image restoration command follows the source; the full README and setup instructions are last.\n\n';
for (const file of source) {
  const content = await readFile(path.join(root, file), 'utf8');
  const language = file.endsWith('.js') || file.endsWith('.mjs') ? 'javascript' : file.endsWith('.json') ? 'json' : file.endsWith('.css') ? 'css' : file.endsWith('.sql') ? 'sql' : file.endsWith('.svg') ? 'xml' : file.endsWith('.md') ? 'markdown' : 'text';
  const fences = content.match(/`{3,}/g) || [];
  const fence = '`'.repeat(Math.max(3, ...fences.map(f => f.length + 1)));
  result += '## ' + file + '\n\n' + fence + language + '\n' + content + (content.endsWith('\n') ? '' : '\n') + fence + '\n\n';
}
const encoded = {};
for (const file of assets) encoded[file] = (await readFile(path.join(root, file))).toString('base64');
result += '# Complete image assets\n\nThese are binary WebP files, already included in the ZIP. For manual reconstruction, run the following complete Node.js command from the project root. It restores the exact supplied images from Base64; no external download is required. Paste it as a single command in a terminal that supports the shown quoting, or save the JavaScript between the outer quotes as `restore-images.cjs` and run `node restore-images.cjs`. The temporary restoration script is not needed to run the site.\n\n```bash\nnode -e \'const fs=require("node:fs");const path=require("node:path");const assets=' + JSON.stringify(encoded) + ';for(const [name,data] of Object.entries(assets)){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,Buffer.from(data,"base64"));}\'\n```\n\n';
result += '# README.md — complete setup instructions\n\nSave the following full contents as `README.md`. These instructions follow the source as requested.\n\n' + await readFile(path.join(root, 'README.md'), 'utf8');
await writeFile(path.join(root, 'SOURCE_CODE.md'), result);
console.log(`SOURCE_CODE.md: ${source.length} complete text source files, README, ${assets.length} complete image assets.`);
````

## supabase/schema.sql

```sql
-- Run once in a new Supabase project's SQL Editor. Server API owns all writes.
create extension if not exists pgcrypto;
create table public.affiliates (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 email text not null, bio text not null default '', photo text not null default '/images/affiliate.webp',
 active boolean not null default true, commission_rate numeric not null default 0 check(commission_rate between 0 and 100),
 commission_note text not null default '', created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('staff','affiliate')),
 affiliate_id uuid references public.affiliates(id), check((role='affiliate' and affiliate_id is not null) or role='staff')
);
create table public.appointment_slots (start timestamptz primary key, duration integer not null check(duration in (15,30,45,60,90)));
create table public.bookings (
 id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null,
 start timestamptz not null references public.appointment_slots(start), end_time timestamptz not null, duration integer not null,
 service text not null check(service in ('eye-exam','contacts','dry-eye','children','testing','styling')),
 affiliate_id uuid references public.affiliates(id), source text not null check(source in ('Affiliate','Direct','Phone','Walk-in')),
 status text not null default 'Booked' check(status in ('Booked','Attended','No-show','Cancelled')),
 commission numeric(12,2) not null default 0 check(commission>=0), payout text not null default 'Pending' check(payout in ('Pending','Paid')),
 paid_at timestamptz, first_visit boolean not null, insurance text default '', policy_encrypted text,
 brands text default '', sms_consent boolean not null default false, consent_at timestamptz,
 request_hash text, created_at timestamptz not null default now()
);
create unique index one_active_booking_per_slot on public.bookings(start) where status<>'Cancelled';
alter table public.bookings add constraint no_overlapping_bookings exclude using gist (tstzrange(start,end_time,'[)') with &&) where (status<>'Cancelled');
create index booking_affiliate_index on public.bookings(affiliate_id);
create index booking_rate_index on public.bookings(request_hash,created_at);
create table public.message_templates(id text primary key,subject text not null,body text not null);
insert into public.message_templates values
 ('confirmation','Your Eyecon appointment',E'Hello {name}, your appointment is booked for {date}. {address}\n\n{instructions}\n\n{gift}'),
 ('day-before','Your appointment is tomorrow','Hello {name}, a reminder of your Eyecon appointment: {date}. {address} {gift}'),
 ('same-day','Your appointment is today','Hello {name}, we look forward to seeing you at Eyecon today: {date}. {gift}'),
 ('no-show','Would you like to rebook?','Hello {name}, please contact Eyecon if you would like to arrange another appointment. {phone}');
create table public.audit_logs(id bigint generated always as identity primary key,actor_id uuid,action text not null,record_id text,created_at timestamptz not null default now());
create table public.notification_jobs(id bigint generated always as identity primary key,booking_id uuid references public.bookings(id),kind text not null,status text not null,result jsonb,created_at timestamptz not null default now(),unique(booking_id,kind));
alter table public.affiliates enable row level security;
alter table public.profiles enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.message_templates enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_jobs enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
-- No client insert/update/delete policies. No anonymous access to patient records.
revoke all on public.affiliates,public.appointment_slots,public.bookings,public.message_templates,public.audit_logs,public.notification_jobs from anon,authenticated;
grant select on public.profiles to authenticated;
create function public.available_slots() returns table(start timestamptz,duration integer) language sql security definer set search_path=public as $$
 select s.start,s.duration from appointment_slots s where s.start>now() and s.start<now()+interval '90 days'
 and not exists(select 1 from bookings b where b.status<>'Cancelled' and tstzrange(b.start,b.end_time,'[)') && tstzrange(s.start,s.start+s.duration*interval '1 minute','[)')) order by s.start limit 500;
$$;
create function public.create_booking(p_name text,p_email text,p_phone text,p_start timestamptz,p_service text,p_affiliate uuid,p_source text,p_first_visit boolean,p_insurance text,p_policy text,p_brands text,p_sms boolean,p_request_hash text)
returns setof public.bookings language plpgsql security definer set search_path=public as $$
declare duration_value integer;
begin
 perform pg_advisory_xact_lock(hashtext(coalesce(p_request_hash,p_email)));
 if p_request_hash is not null and (select count(*) from bookings where request_hash=p_request_hash and created_at>now()-interval '1 hour')>=5 then raise exception 'rate limit';end if;
 if p_affiliate is not null and not exists(select 1 from affiliates where id=p_affiliate and active=true) then raise exception 'inactive affiliate';end if;
 select duration into duration_value from appointment_slots where start=p_start and start>now() for update;
 if duration_value is null then raise exception 'unavailable slot';end if;
 return query insert into bookings(name,email,phone,start,end_time,duration,service,affiliate_id,source,first_visit,insurance,policy_encrypted,brands,sms_consent,consent_at,request_hash)
 values(p_name,p_email,p_phone,p_start,p_start+duration_value*interval '1 minute',duration_value,p_service,p_affiliate,p_source,p_first_visit,p_insurance,p_policy,p_brands,p_sms,case when p_sms then now() else null end,p_request_hash) returning *;
end;$$;
create function public.approve_payout(p_ids uuid[],p_actor uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from bookings where id=any(p_ids) for update;
 if cardinality(p_ids)=0 or cardinality(p_ids)<>(select count(*) from bookings where id=any(p_ids) and affiliate_id is not null and status='Attended' and commission>0 and payout='Pending') then raise exception 'Invalid payout selection';end if;
 update bookings set payout='Paid',paid_at=now() where id=any(p_ids);
 insert into audit_logs(actor_id,action,record_id) values(p_actor,'approve_payout',array_to_string(p_ids,','));
end;$$;
revoke all on function public.available_slots() from public,anon,authenticated;
revoke all on function public.create_booking(text,text,text,timestamptz,text,uuid,text,boolean,text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function public.approve_payout(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.available_slots() to service_role;
grant execute on function public.create_booking(text,text,text,timestamptz,text,uuid,text,boolean,text,text,text,boolean,text) to service_role;
grant execute on function public.approve_payout(uuid[],uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('affiliate-photos','affiliate-photos',true,2097152,array['image/jpeg','image/png','image/webp']);
-- Add real availability in Staff admin > Bookings > Add available time.
-- Create your first staff user in Supabase Authentication, then run:
-- insert into public.profiles(id,role) values('YOUR_AUTH_USER_UUID','staff');
```

## tests/core.test.js

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBooking,csv,slotTaken } from '../lib/validation.js';
import { seedDemo,applyDemo,affiliateRows } from '../lib/demo.js';
import { calendarFile } from '../lib/calendar.js';
const patient={name:'Sample Patient',email:'sample@example.com',phone:'+14165550123',service:'eye-exam',firstVisit:true,smsConsent:false,start:new Date(Date.now()+86400000).toISOString()};
test('booking validates patient details, service and future time',()=>{assert.equal(validateBooking(patient).source,'Direct');assert.equal(validateBooking({...patient,affiliateId:'ref'}).source,'Affiliate');assert.throws(()=>validateBooking({...patient,email:'invalid'}));assert.throws(()=>validateBooking({...patient,service:'emergency'}));assert.throws(()=>validateBooking({...patient,firstVisit:null}));assert.throws(()=>validateBooking({...patient,start:'2000-01-01'}));});
test('SMS requires an international-format phone number',()=>{assert.throws(()=>validateBooking({...patient,phone:'416 555 0123',smsConsent:true}));assert.equal(validateBooking({...patient,smsConsent:true}).smsConsent,true);});
test('demo bookings reject simultaneous and overlapping appointments',()=>{const data=seedDemo(),slot=data.slots[1];const next=applyDemo(data,'booking',{...patient,start:slot.start},null);assert.equal(next.bookings[0].duration,30);assert.throws(()=>applyDemo(next,'booking',{...patient,start:slot.start},null));assert.equal(slotTaken({start:new Date(new Date(slot.start).getTime()+15*60000).toISOString(),duration:30},next.bookings),true);assert.equal(slotTaken({start:new Date(new Date(slot.start).getTime()+30*60000).toISOString(),duration:15},next.bookings),false);});
test('affiliate view excludes clinical and contact details',()=>{const rows=affiliateRows(seedDemo().bookings,'demo-alex');assert.ok(rows.length);for(const row of rows){for(const key of ['email','phone','service','policy','insurance','brands'])assert.equal(key in row,false);}});
test('only staff can record valid payouts, and duplicate payment is rejected',()=>{const data=seedDemo();assert.throws(()=>applyDemo(data,'payout',{ids:['sample-2']},{role:'affiliate'}));const paid=applyDemo(data,'payout',{ids:['sample-2']},{role:'staff'});assert.equal(paid.bookings.find(b=>b.id==='sample-2').payout,'Paid');assert.throws(()=>applyDemo(paid,'payout',{ids:['sample-2']},{role:'staff'}));assert.throws(()=>applyDemo(data,'payout',{ids:['sample-1']},{role:'staff'}));});
test('inactive affiliates cannot receive bookings',()=>{let data=seedDemo();data.affiliates[0].active=false;assert.throws(()=>applyDemo(data,'booking',{...patient,start:data.slots[1].start,affiliateId:'demo-alex'},null));});
test('CSV escapes quotes and neutralises spreadsheet formulas',()=>{const output=csv([{name:'=HYPERLINK("x")',status:'Booked'}],['name','status']);assert.ok(output.includes("'="));assert.ok(output.includes('""x""'));});
test('calendar event uses UTC and the slot duration',()=>{const output=calendarFile({...patient,id:'sample',duration:45});assert.ok(output.includes('BEGIN:VEVENT'));assert.ok(output.includes('SUMMARY:Eyecon: Comprehensive eye exam'));assert.ok(output.includes('DTEND:'));assert.ok(output.endsWith('\r\n'));});
```

# Complete image assets

These are binary WebP files, already included in the ZIP. For manual reconstruction, run the following complete Node.js command from the project root. It restores the exact supplied images from Base64; no external download is required. Paste it as a single command in a terminal that supports the shown quoting, or save the JavaScript between the outer quotes as `restore-images.cjs` and run `node restore-images.cjs`. The temporary restoration script is not needed to run the site.

```bash
node -e 'const fs=require("node:fs");const path=require("node:path");const assets={"public/images/affiliate.webp":"UklGRjoEAABXRUJQVlA4IC4EAADwFACdASoxADIAPj0YikOiIaEWCq4AIAPEtIBh8CNBOoHS+b8HfOnxR+c/ZPlHsj/t2cw3vzk/9N/1vGt3HnFzSDegH/weYz6b/8PuFfrF/tuwT6MyA5Nxp4S3ugpb150cx+aYp7jIw+tfc15b1Wt5mtpYT0lt7V4lKPOOazNfTm1oLadQEVhkbU+RqHUI1x4lLCacM1OE2dZ3hn76IPQ1oYa6Bg9PiYFIRPNBjQeL8AD+/+KJt3eBIW6v1fQRQjeLb6TulgkiA3+wYSPyPjvDVVm0YWqANdyaBhOr5Y6qSqRjxM2dwwiUp14lv/txLQn1+HgXVNCzHm3DJCVj5Wnl4ovb0V4IcPj/rIl16/CEGgwk/o+EPNGjNXd/J1XWO+Yh+CQm0BWFvU1z/zwFyLS8cfY41m4hXorYqe2LwCuU4XTvXvzmuu6fHycR1cIVpPgtUdSX5eb/AWGNC/7LWF7PKZrIxiM0/pEcwXv8NfT3VLJCQmxCQVvZzAf0zsuvV77YZnXdW2NDsm36909Sw36q73/Er4XBiy//msm1mlmwknZ8/qjXAkIehh+gy4+/34slOICh4zVCzoChEV6mfX7F/Nwjy6KuuYgNleMjaG7wl+6XMFczoxxPZlq6ApIayeogQfoyf9zpytft3V49RM4thV2WnRshBSLCfDjxqyTgu7fufhi4fzzZyxgS7NYu0FUQynVEJopW/eB6fh8aGrWYvB8TVrAcn2NtsCUy5lTEccu+DCwatbihpt1Zp19ckGPhUUsitD3iyQ87/YxykI4vs3fALbhZ2Gj2kMsnv/FFhsEe48WqKMwN8JSlILRVmhQJY6zLrHrz/VK4XLhSU2I/9SHANxSYLJLAAdiARWuKvjODqQS8qySHerXZIpnrRcP+umHoUua9Djvkmz69N4df+luBWHr7p/pjcbX/6Mzq+eUiNI1zH60cOC594SvdI/2vqBm7v+uI94OWPo/O/55z3Ni+78/f8Vc4nKblF74U+zZlKB+7z/e9TiLjc6/jrPgrBfGDvLrh0V9/3uqfzxjcnqWFqGvaF1dPLnxxtAT455jDjknrJ+IPkHiDNbAAHRiv53JTy7INeLe1h/VSEyrAYoimouDQUqg17ghrmYcZVFu6Arhxn8dOmqo0ajc1RaEh1ZkeiHP23MsFUSnM2r0ZVD/ETPfDcYNtz3O5J2azP5/ZFNPePE+QYX/90HfPoBOa8F1/ohFIGvvxUfJsL8DCH5VjowzPn48x7LYB9C/IlDFva/yj9KvXu+9Vpzhbg0MFv5sUeHBB6jWQ7y0hNSKRBMRc69PTGF+hv9Jx/YxtwJ+XEwZM3/8g79qXXlHzPy5P7XgQxNj3kO/+vI8AvKMBCRlBRTRB62DIq2gAsFlv86/emf9QjlkfZDtBD92xZJbcqLaU6RSfxBhwAAAAAA==","public/images/doctor1.webp":"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","public/images/doctor2.webp":"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","public/images/hero.webp":"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"};for(const [name,data] of Object.entries(assets)){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,Buffer.from(data,"base64"));}'
```

# README.md — complete setup instructions

Save the following full contents as `README.md`. These instructions follow the source as requested.

# Eyecon Optometry — Module 1

A complete Next.js project for the affiliate referral and appointment-booking experience. Open it in VS Code and deploy it to Vercel. The default is an interactive **demo**: no accounts, API keys or database are needed to explore it.

## What is included

- Premium public landing page and personalised affiliate landing pages.
- Four-step booking: service, date/time, patient details and confirmation.
- Referral identity throughout booking; the $50 gift appears only with an active affiliate referral.
- Google, Apple `.ics` and Outlook calendar options.
- Affiliate dashboard, referrals, referral link/QR, earnings, profile editing and photo upload.
- Staff booking list/calendar, patient details, attendance status, manual bookings, availability, affiliate management, leads, commission approvals, payout recording and message templates.
- Supabase database schema, authentication and server-side role checks for live mode.
- Turnstile booking verification, optional Resend email, Twilio SMS with opt-in, and an authenticated reminder endpoint.
- Responsive layouts, keyboard controls, native form labels, focus handling, reduced-motion support and optimised local WebP images.

## Scope and launch status

This implements **Module 1**, the referral/booking platform. It does not implement the later e-commerce, lens builder, virtual try-on, AI concierge, patient portal or MyVisionExpress modules.

The grayscale photography is concept imagery from the design mockup. Doctor panels are explicitly marked as preview content; use approved real portraits, credentials, biographies and photography before launch. Clinic contact details, hours, verified reviews, insurance wording, appointment durations and gift eligibility need confirmation. No invented ratings or testimonials are included. Commission rates are informational; staff explicitly approve commission amounts. Payout recording is a ledger update, not a bank transfer.

Demo data is stored in the current browser and is neither secure nor shared between users. Use fictional details only. Live mode uses Supabase and must be configured and verified with your own services before collecting real patient information. This delivery does not certify privacy compliance, WCAG conformance, production security or a PageSpeed score. No live service credentials were available during development.

## Pages / sitemap

| Address | Page |
| --- | --- |
| `/` | Direct visitor landing page |
| `/book/alex-morgan` | Example affiliate landing page in demo mode |
| `/book/[slug]` | Active affiliate's personalised landing page |
| `/booking?affiliate=alex-morgan` | Booking flow with affiliate referral |
| `/booking` | Direct booking flow |
| `/login` | Demo exploration or live sign-in/password reset |
| `/affiliate` | Affiliate overview |
| `/affiliate/referrals` | Referral status and CSV export |
| `/affiliate/link` | Personal link and downloadable QR code |
| `/affiliate/earnings` | Approved and paid commission |
| `/affiliate/profile` | Display name, introduction and portrait |
| `/admin` | Staff bookings, availability and calendar |
| `/admin/affiliates` | Add, activate/deactivate and photograph affiliates |
| `/admin/leads` | Search/filter/export bookings |
| `/admin/payouts` | Approve commission and record payments |
| `/admin/messages` | Edit templates and inspect live delivery activity |
| `/privacy` | Draft privacy notice requiring clinic review |

An unknown or inactive affiliate page presents a direct-booking alternative. Affiliate workspaces expose referral names, appointment dates/status and commission; contact details, service type and insurance are omitted from live affiliate API responses.

## 1. Create/open the project in VS Code

1. Install the current Node.js **LTS** release from [nodejs.org](https://nodejs.org/en/download). The project requires Node 20.9 or later; use a currently supported LTS release.
2. Install [Visual Studio Code](https://code.visualstudio.com/download) and [Git](https://git-scm.com/downloads).
3. Download and extract `Eyecon_Module_1_Nextjs.zip`. You will see a folder named `eyecon-module-1` containing `package.json`.
4. In VS Code choose **File → Open Folder**, then open that folder. Do not open the folder above it.
5. In the VS Code file list, duplicate `.env.example` and name the copy `.env.local`. Keep `NEXT_PUBLIC_DEMO_MODE=true` for now. No other values are needed for the local demo.

If you prefer to create files manually: make an empty folder named `eyecon-module-1`, open it in VS Code, create each path from `SOURCE_CODE.md`, and paste the complete file contents from its matching code block. Paths and capitalisation must match exactly. The guide includes a complete Base64 asset restoration command for the four WebP images. `package-lock.json` is supplied; do not create `node_modules` or `.next` yourself. The ZIP is the easiest option.

## 2. Terminal commands

Choose **Terminal → New Terminal** in VS Code. It should open inside the project folder. Run one command at a time:

```bash
node --version
npm --version
npm install
npm run dev
```

- `node --version` and `npm --version` confirm the required tools are installed.
- `npm install` downloads the dependencies listed in `package.json`. It creates `node_modules`.
- `npm run dev` starts the local development server and updates the preview when you save a file.

Leave that terminal running. Press **Ctrl+C** when you want to stop it.

Other useful commands, run after stopping the development server:

```bash
npm test
npm run build
npm run start
```

`npm test` checks booking validation, overlapping appointment protection, affiliate data filtering, payout guards, CSV handling and calendars. `npm run build` prepares and checks the production build. `npm run start` runs that production build locally. To reproduce the pinned installation later, use `npm ci` in place of `npm install`.

## 3. Preview and explore locally

1. Open [http://localhost:3000](http://localhost:3000) in your browser, or use the URL printed in the terminal if port 3000 is occupied.
2. Visit [the example affiliate page](http://localhost:3000/book/alex-morgan), choose a service and finish a booking with **fictional** patient details.
3. Open `/login`, click **Explore affiliate demo**, then explore Referrals, My link & QR, Earnings and Profile.
4. Open `/login` again and click **Explore staff demo**. Change a booking to Attended, enter a commission amount in Payouts and record a payment. These actions change only sample data in your browser.
5. Use **Reset demo data** at `/login` to restore the examples and refresh the demo availability dates.
6. To inspect mobile layout, narrow your browser window or use your browser's device toolbar. Check the public page, each booking step and both dashboards.

The demo is intentionally not an authentication system. Each browser has its own records. No emails/SMS are sent, and real staff credentials are not used.

## 4. Put the project on GitHub

The simplest route is [GitHub Desktop](https://desktop.github.com/): choose **File → Add local repository**, select the project folder, create a repository if prompted, then **Publish repository**. Choose a private repository if that suits your project.

For the terminal route, create a new empty repository on [GitHub](https://github.com/new), named `eyecon-module-1`. Do not initialise that remote repository with a README, licence or `.gitignore`; those files already exist locally. Copy its HTTPS URL. In the VS Code terminal run:

```bash
git init
git add .
git commit -m "Build Eyecon Module 1"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/eyecon-module-1.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username. `git init` starts version history; `git add` selects the files; `git commit` saves a version; `git branch` names the branch; `git remote` connects the repository; `git push` uploads it. Complete GitHub's sign-in prompt. Do not use your account password as a Git HTTPS password.

Check the uploaded file list: `.env.local`, `.next` and `node_modules` must not appear. The included `.gitignore` excludes them. `.env.example` contains no secrets and is safe to commit. To upload later edits:

```bash
git add .
git commit -m "Update Eyecon pages"
git push
```

## 5. Connect GitHub to Vercel and publish

1. Sign in to [Vercel](https://vercel.com) with GitHub.
2. Choose **Add New → Project** and import `eyecon-module-1`. Grant access to that repository when requested.
3. Confirm the framework is **Next.js**. The root directory should contain `package.json`; if your repository wraps the project in another folder, select `eyecon-module-1` as the Root Directory. Keep the normal Next.js build settings; do not use a static export.
4. For the first **design preview**, add `NEXT_PUBLIC_DEMO_MODE=true`. This publishes a demo, not a real appointment system. Add the confirmed public clinic values if available.
5. Click **Deploy**. When the build finishes, open the generated deployment URL.
6. Set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS deployment URL in Project Settings → Environment Variables, then redeploy. This makes shared referral links and QR codes point to the published site.
7. Later, add your domain in Project Settings → Domains and follow the DNS instructions Vercel displays. Update `NEXT_PUBLIC_SITE_URL` and the authentication/Turnstile allowed domains when you change domains.
8. Push future edits to GitHub to trigger another deployment. Environment-variable changes require a new deployment; public variables are compiled into the frontend.

Leave preview deployments in demo mode. Only turn the **Production** environment to live mode after the configuration below and staging checks. This project has server API routes, so it cannot be deployed as a plain static website.

## Live mode configuration

These are deployment steps, not required for exploring the demo.

### A. Create the Supabase backend

1. Create a new Supabase project. Choose a region and service agreements appropriate for the clinic's privacy/data-residency decisions.
2. Open **SQL Editor**. Paste the complete `supabase/schema.sql` and run it **once on an empty project**. It creates tables, access rules, booking/payout functions and the affiliate-photo bucket. Running it again will produce "already exists" errors; use reviewed migrations for later changes.
3. In **Authentication**, create the initial staff user with a confirmed email and a strong password. Copy that user's UUID.
4. In SQL Editor run the following, replacing the UUID with the actual user ID:

```sql
insert into public.profiles(id, role)
values ('THE-ACTUAL-AUTH-USER-UUID', 'staff');
```

5. Set Authentication's Site URL to your live URL. Allow the exact login redirect URLs `https://YOUR-DOMAIN/login?set-password=1` and `https://YOUR-DOMAIN/login?mode=reset`. Add the corresponding localhost URLs only for your development environment.
6. Configure Supabase's auth email delivery/SMTP so invitations and password resets reach real users. Public account signup is not required; staff invite affiliates from the dashboard.
7. Copy the project's URL, anon key and service-role key into the matching `.env.local`/Vercel variables. The browser uses the anon key; the server uses the service-role key. **Never expose the service-role key in a NEXT_PUBLIC variable.**

### B. Public booking verification and insurance storage

Create a Cloudflare Turnstile widget for your domain(s); set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The server checks the verification result, hostname and `booking` action. If verification is not configured, public live bookings are rejected.

Generate a private insurance encryption key in a local terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set its full output as `INSURANCE_ENCRYPTION_KEY` in your private environment. Keep a secure backup. Changing or losing it makes existing policy numbers unreadable. Policy numbers are encrypted using AES-256-GCM; other booking fields remain ordinary database records, protected by database/server access rules. Without the key, bookings with a supplied policy number are rejected; the optional field can be left blank.

### C. Confirmations and reminders

- For email, configure a verified sending domain in Resend and set `RESEND_API_KEY` and `RESEND_FROM`. Confirmation emails attach an `.ics` calendar file.
- For SMS, configure a Twilio sending number and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. The application sends only when the patient has opted into SMS. Confirm the actual consent wording and provider setup for your clinic.
- Generate `CRON_SECRET` using the same random-key command. Configure an **hourly authenticated HTTPS scheduler** to call `GET https://YOUR-DOMAIN/api/reminders` with header `Authorization: Bearer YOUR-CRON-SECRET`. Keep the secret in the scheduler's protected header/secret field, not a URL or a public repository. The scheduler itself is not provisioned by this project.
- Reminder windows are 22–26 hours before and within 2 hours of the appointment. A unique job per booking/message type prevents normal duplicate dispatch. Provider acceptance is recorded as `sent`; it is not proof of delivery. Failed, unfinished or unconfigured jobs require staff review and are not retried automatically. No-show templates are triggered by changing status to No-show.

### D. Activate and verify

1. Set every confirmed clinic value, the live URL and service keys. Change **only the configured live environment** to `NEXT_PUBLIC_DEMO_MODE=false`, restart locally or redeploy.
2. Sign in with the real staff account. Add appointment slots using **Add available time**. The input explicitly uses the staff browser's local timezone; patient displays use `NEXT_PUBLIC_CLINIC_TIMEZONE`. Confirm both before adding slots.
3. Add an affiliate and complete the email invitation. Verify their photo, link, QR, active/inactive state and restricted workspace.
4. Book a test appointment from that affiliate link. Verify database persistence, referral attribution, email/SMS, calendar timezone, staff status updates and manually approved commission.
5. Try simultaneous bookings for an overlapping interval and confirm only one succeeds. Test both roles with separate accounts and verify anonymous requests cannot access patient data.
6. Check notification failures, audit records, provider bills, backup/recovery and data retention with the team's deployment owner. Approve real copy, portrait rights, gift terms, privacy wording and clinical scheduling before accepting patients.

The calendar is one shared booking resource with explicit staff-created slots. Durations are assigned to slots, not automatically determined by service/doctor. It does not sync MyVisionExpress, offer self-service rescheduling/cancellation, manage multiple locations or implement a rules-based commission engine. The staff API currently loads at most 2,000 bookings and 100 recent delivery jobs; add server pagination for larger use. Staff have a shared staff role, not per-action permissions or MFA enforcement. Account deletion, data retention, consent withdrawal and retry workflows require the clinic's operational processes or later implementation. For a partial affiliate invitation failure, review the auth user and inactive/missing affiliate/profile in Supabase before retrying; the server does not delete auth accounts automatically.

## Editing the design

| Change | File |
| --- | --- |
| Colours, spacing, mobile breakpoints, typography | `app/globals.css` |
| Public landing page copy/sections | `components/landing.js` |
| Services, brands, pre-visit instructions | `lib/config.js` |
| Booking steps and questions | `components/booking-flow.js` |
| Affiliate and staff screens | `components/workspace.js` |
| Reusable header, footer, buttons and fields | `components/ui.js` |
| Database schema and booking/payout rules | `supabase/schema.sql` |
| Demo records | `lib/demo.js` |
| Local concept images | `public/images/` |

Replace images using the same filenames, or update the references. Keep appropriate permissions and descriptive alt text. Clinic contact values belong in the environment, not hardcoded fictional text. Update the draft privacy page in `app/privacy/page.js` with the clinic's approved notice. The current typography uses local system fonts and a serif display stack; there is no external font dependency or animation library.

## 6. Common errors and fixes

| Problem | Fix |
| --- | --- |
| `npm` / `node` is not recognised | Install Node LTS, close/reopen VS Code and run the version commands again. |
| `ENOENT` / missing `package.json` | Open a terminal inside `eyecon-module-1`, the folder that actually contains `package.json`. |
| Unsupported Node version | Install a current supported LTS release and select it in Vercel's Node settings too. |
| Port 3000 is busy | Open the port printed by Next.js, or stop the other local server. You can run `npm run dev -- --port 3001`. |
| Browser changes look stale | Save the file, reload, check terminal errors. Restart after `.env.local` changes. Public environment changes require a rebuild on Vercel. |
| Old demo dates / sample changes | Use Reset demo data at `/login`; demo data persists in browser storage. |
| Supabase "already exists" error | The supplied SQL is an initial schema, not a repeatable migration. Use a fresh project or review migrations before modifying existing data. |
| Live sign-in succeeds but workspace denied | Verify the user's UUID and role in `public.profiles`. Affiliate accounts must have a matching active affiliate row. |
| No live appointment times | Sign in as staff and add future slots. Only available non-overlapping slots within 90 days are returned. |
| "That time is no longer available" | Select another time; check the database/service logs if every valid slot fails. |
| Turnstile verification rejected | Confirm matching key pair, allowed hostname, exact deployment domain and site URL, then redeploy. |
| Insurance storage not configured | Supply the exact 64-character hex key, or leave the optional policy number blank while configuring it. |
| Email/SMS does not arrive | Check the delivery log and provider dashboards, sender verification, credentials, phone format and SMS consent. Demo never sends messages. |
| Git requests your identity | Run `git config --global user.name "Your Name"` and `git config --global user.email "YOUR-GITHUB-EMAIL"`, then repeat the commit. |
| Git says `remote origin already exists` | Inspect `git remote -v`; if wrong, use `git remote set-url origin YOUR-ACTUAL-REPOSITORY-URL`. |
| GitHub authentication/push rejected | Sign in using GitHub Desktop or Git Credential Manager. Verify you own/have write access to the repository. |
| Vercel cannot find the project | Set Root Directory to the folder containing `package.json` and select the Next.js preset. |
| Vercel build fails | Read the first actual error in Build Logs; check Node version, exact filename case, committed files and env variables. Run `npm run build` locally. |
| Secrets accidentally committed | Revoke/rotate them at the provider immediately, remove them from Git history with a reviewed process, and update deployment variables. |

## References

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [GitHub: add local code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Vercel Git deployment](https://vercel.com/docs/git)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Cloudflare Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)
- [Twilio SMS API](https://www.twilio.com/docs/messaging/api/message-resource)

## Validation

Run `npm test` and `npm run build` after changing the project. The production build and eight core tests passed. Browser checks covered the demo booking, calendar download, referral filtering, attendance, commission, manual booking, affiliate creation and mobile layout with no page errors. An automated axe scan of 17 desktop/mobile screens and states reported no findings for the selected WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rule tags after fixes. This automated scan is not a full accessibility audit. Live Supabase, email/SMS delivery, Turnstile, reminders and Vercel deployment must still be verified with your accounts. No live patient data was used.
