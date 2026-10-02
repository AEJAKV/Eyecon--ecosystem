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
