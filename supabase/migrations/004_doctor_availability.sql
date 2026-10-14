-- Every appointment belongs to one optometrist, and availability is kept per optometrist, so two optometrists can
-- see patients at the same moment while one optometrist can never be double-booked.
-- Run this once in the Supabase SQL editor, after the previous migration (002_gift_cards.sql; number 003 is not in use).
-- Doctor values are the slugs in lib/config.js (for example 'doctor-1').

create extension if not exists btree_gist;

-- 1. Appointment slots: one row per optometrist per start time.
alter table public.appointment_slots add column if not exists doctor text;
-- STAFF, PLEASE REVIEW: every slot that existed before this migration has been given to 'doctor-1'. In Staff admin,
-- add the same times for the other optometrists where they also work, and contact the clinic's developer to move
-- any time that really belongs to someone else.
update public.appointment_slots set doctor = 'doctor-1' where doctor is null;
alter table public.appointment_slots alter column doctor set not null;
alter table public.appointment_slots add constraint appointment_slots_doctor_slug check (doctor ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- The bookings foreign key depends on the old primary key, so it goes first and returns below as (doctor, start).
alter table public.bookings drop constraint if exists bookings_start_fkey;
alter table public.appointment_slots drop constraint appointment_slots_pkey;
alter table public.appointment_slots add primary key (doctor, start);

-- 2. Bookings: the optometrist is the one the patient asked for, or 'doctor-1' when no preference was given.
-- preferred_doctor stays for history; the website now writes doctor.
alter table public.bookings add column if not exists doctor text;
update public.bookings set doctor = coalesce(preferred_doctor, 'doctor-1') where doctor is null;
alter table public.bookings alter column doctor set not null;

-- A booking whose preferred optometrist differs from the slot's new owner needs a matching slot for that optometrist.
insert into public.appointment_slots (doctor, start, duration)
select distinct on (doctor, start) doctor, start, duration from public.bookings
on conflict (doctor, start) do nothing;
alter table public.bookings add constraint bookings_doctor_slot_fkey foreign key (doctor, start) references public.appointment_slots (doctor, start);

-- 3. One active booking per optometrist per start time, and no overlapping bookings for the same optometrist.
drop index if exists public.one_active_booking_per_slot;
alter table public.bookings drop constraint if exists no_overlapping_bookings;
create unique index one_active_booking_per_doctor_slot on public.bookings (doctor, start) where status <> 'Cancelled';
alter table public.bookings add constraint no_overlapping_bookings_per_doctor exclude using gist (doctor with =, tstzrange(start, end_time, '[)') with &&) where (status <> 'Cancelled');
create index if not exists booking_doctor_start_index on public.bookings (doctor, start);

-- 4. Open times now say whose they are. A slot is free when that optometrist has no overlapping active booking.
drop function if exists public.available_slots();
create function public.available_slots() returns table(doctor text, start timestamptz, duration integer) language sql security definer set search_path=public as $$
 select s.doctor, s.start, s.duration from appointment_slots s where s.start > now() and s.start < now() + interval '90 days'
 and not exists(select 1 from bookings b where b.status <> 'Cancelled' and b.doctor = s.doctor and tstzrange(b.start, b.end_time, '[)') && tstzrange(s.start, s.start + s.duration * interval '1 minute', '[)'))
 order by s.start, s.doctor limit 1500;
$$;
revoke all on function public.available_slots() from public, anon, authenticated;
grant execute on function public.available_slots() to service_role;

-- 5. Booking requires an optometrist and locks that optometrist's slot.
drop function if exists public.create_booking(text,text,text,timestamptz,text,uuid,text,boolean,text,text,text,boolean,text);
create function public.create_booking(p_name text,p_email text,p_phone text,p_doctor text,p_start timestamptz,p_service text,p_affiliate uuid,p_source text,p_first_visit boolean,p_insurance text,p_policy text,p_brands text,p_sms boolean,p_request_hash text)
returns setof public.bookings language plpgsql security definer set search_path=public as $$
declare duration_value integer;
begin
 if p_doctor is null or p_doctor = '' then raise exception 'doctor required'; end if;
 perform pg_advisory_xact_lock(hashtext(coalesce(p_request_hash,p_email)));
 if p_request_hash is not null and (select count(*) from bookings where request_hash=p_request_hash and created_at>now()-interval '1 hour')>=5 then raise exception 'rate limit';end if;
 if p_affiliate is not null and not exists(select 1 from affiliates where id=p_affiliate and active=true) then raise exception 'inactive affiliate';end if;
 select duration into duration_value from appointment_slots where doctor=p_doctor and start=p_start and start>now() for update;
 if duration_value is null then raise exception 'unavailable slot';end if;
 return query insert into bookings(name,email,phone,doctor,start,end_time,duration,service,affiliate_id,source,first_visit,insurance,policy_encrypted,brands,sms_consent,consent_at,request_hash)
 values(p_name,p_email,p_phone,p_doctor,p_start,p_start+duration_value*interval '1 minute',duration_value,p_service,p_affiliate,p_source,p_first_visit,p_insurance,p_policy,p_brands,p_sms,case when p_sms then now() else null end,p_request_hash) returning *;
end;$$;
revoke all on function public.create_booking(text,text,text,text,timestamptz,text,uuid,text,boolean,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.create_booking(text,text,text,text,timestamptz,text,uuid,text,boolean,text,text,text,boolean,text) to service_role;

-- 6. The confirmation message names the optometrist. Only the default wording is changed; a template staff have
-- rewritten is left alone (they can add {doctor} themselves in Staff admin > Messages).
update public.message_templates set body = replace(body, 'your appointment is booked for', 'your appointment with {doctor} is booked for')
where id = 'confirmation' and body not like '%{doctor}%';
