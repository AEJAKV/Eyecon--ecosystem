-- Eyecon database setup, part 2: migrations 004 to 010 in one go.
-- Convenience copy of supabase/migrations/004 to 010 for pasting into the SQL Editor in one go, for a project that
-- already ran schema.sql, 001 and 002. The numbered migration files remain the source of truth.
-- Paste ALL of this into Supabase > SQL Editor > New query, then press Run once.
-- Supabase will warn that it contains destructive operations: that is expected (the database is still empty).
-- Everything runs as one transaction: if any line fails, nothing is changed.
begin;

-- ==================== 004_doctor_availability.sql ====================
-- Every appointment belongs to one optometrist, and availability is kept per optometrist, so two optometrists can
-- see patients at the same moment while one optometrist can never be double-booked.
-- Run this once in the Supabase SQL editor, after the previous migration (002_gift_cards.sql; number 003 is not in use).
-- Doctor values are the slugs in lib/config.js (for example 'doctor-1').

create extension if not exists btree_gist with schema extensions;

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

-- ==================== 005_documents.sql ====================
-- "Complete your file": the patient's residency status, a valid government ID and optional additional documents,
-- uploaded after booking through the website's /api/documents route with a single-use, expiring link.
-- Run this once in the Supabase SQL editor, after 004_doctor_availability.sql.
-- Only the server (service role) can read or write any of this. Affiliates never see it.

-- 1. The residency status chosen from the list in lib/config.js (stored as its label).
alter table public.bookings add column if not exists residency_status text check (residency_status is null or char_length(residency_status) <= 120);

-- 2. One upload link per booking. Only the SHA-256 hash of the token is stored; the token itself exists only in the
-- patient's browser and confirmation email. used_at is set when the form is submitted, so the link works once.
create table public.booking_document_tokens (
 booking_id uuid primary key references public.bookings(id) on delete cascade,
 token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);

-- 3. The uploaded files. file_path is the object's path inside the private 'booking-documents' bucket.
create table public.booking_documents (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 kind text not null check (kind in ('government-id','diploma','certificate','high-school-diploma','english-test','other')),
 file_path text not null unique,
 original_name text not null check (char_length(original_name) between 1 and 200),
 size integer not null check (size > 0 and size <= 10485760),
 mime text not null check (mime in ('application/pdf','image/jpeg','image/png')),
 uploaded_at timestamptz not null default now()
);
create index booking_documents_booking_index on public.booking_documents(booking_id);
create unique index one_government_id_per_booking on public.booking_documents(booking_id) where kind = 'government-id';

alter table public.booking_document_tokens enable row level security;
alter table public.booking_documents enable row level security;
-- No policies: nobody but the service role can touch these tables.
revoke all on public.booking_document_tokens, public.booking_documents from anon, authenticated;

-- 4. A PRIVATE bucket. public = false means there are no public URLs, and with no storage.objects policies for this
-- bucket, signed-in users and anonymous visitors cannot list, read or write it. Staff see files only through
-- signed URLs the server creates, which expire after 5 minutes. Do not add storage policies for this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-documents', 'booking-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 5. The confirmation message carries the upload link. Only a template without {documents_link} is changed.
update public.message_templates
set body = replace(body, E'{instructions}\n\n', E'{instructions}\n\nComplete your file before your visit: {documents_link}\n\n')
where id = 'confirmation' and body not like '%{documents_link}%';

-- ==================== 006_booking_lookup.sql ====================
-- Booking lookup for patients without an account (/my-booking): a short booking reference, a rate-limited lookup by
-- reference and email, and more than one "Complete your file" link per booking (the lookup page can issue a new one).
-- Run this once in the Supabase SQL editor, after 005_documents.sql.

-- 1. Booking references: 8 characters from the gift card alphabet (no 0, 1, I or O), e.g. 7K2M9QXB. Unique.
-- gen_random_bytes comes from pgcrypto, which Supabase installs in the "extensions" schema.
create or replace function public.new_booking_reference() returns text language plpgsql volatile set search_path=public, extensions as $$
declare alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; ref text; b bytea;
begin
 loop
  b := gen_random_bytes(8); ref := '';
  for i in 0..7 loop ref := ref || substr(alphabet, (get_byte(b, i) & 31) + 1, 1); end loop;
  exit when not exists (select 1 from bookings where reference = ref);
 end loop;
 return ref;
end;$$;
revoke all on function public.new_booking_reference() from public, anon, authenticated;

alter table public.bookings add column if not exists reference text;
update public.bookings set reference = public.new_booking_reference() where reference is null;
alter table public.bookings alter column reference set default public.new_booking_reference();
alter table public.bookings alter column reference set not null;
alter table public.bookings add constraint bookings_reference_format check (reference ~ '^[2-9A-HJ-NP-Z]{8}$');
create unique index booking_reference_unique on public.bookings(reference);

-- 2. Lookup attempts, counted per hashed IP (the same hash the booking form uses). At most 10 per hour.
create table public.lookup_attempts (
 id bigint generated always as identity primary key,
 request_hash text not null,
 created_at timestamptz not null default now()
);
create index lookup_attempts_hash_index on public.lookup_attempts(request_hash, created_at);
alter table public.lookup_attempts enable row level security;
revoke all on public.lookup_attempts from anon, authenticated;

-- Records the attempt, refuses the 11th within an hour, then returns the booking only when BOTH the reference and the
-- email match. Not found and wrong email look the same to the caller.
create function public.lookup_booking(p_reference text, p_email text, p_request_hash text)
returns setof public.bookings language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('lookup:' || p_request_hash));
 delete from lookup_attempts where request_hash = p_request_hash and created_at < now() - interval '1 day';
 if (select count(*) from lookup_attempts where request_hash = p_request_hash and created_at > now() - interval '1 hour') >= 10 then raise exception 'rate limit'; end if;
 insert into lookup_attempts(request_hash) values (p_request_hash);
 return query select * from bookings where reference = upper(p_reference) and email = lower(trim(p_email)) limit 1;
end;$$;
revoke all on function public.lookup_booking(text,text,text) from public, anon, authenticated;
grant execute on function public.lookup_booking(text,text,text) to service_role;

-- 3. Several "Complete your file" links per booking: the emailed one and any issued by the lookup page. Submitting
-- through one closes the others (the website does that), and one_government_id_per_booking still allows one ID.
alter table public.booking_document_tokens drop constraint booking_document_tokens_pkey;
alter table public.booking_document_tokens add column id bigint generated always as identity primary key;
create index booking_document_tokens_booking_index on public.booking_document_tokens(booking_id);

-- 4. The confirmation message gives the reference and a "Find my booking" link. Only a template without {reference}
-- is changed.
update public.message_templates
set body = body || E'\n\nYour booking reference is {reference}. Find your booking any time: {lookup_link}'
where id = 'confirmation' and body not like '%{reference}%';

-- ==================== 007_commission.sql ====================
-- Calculated affiliate commission. Staff enter what the patient was billed and any discount; the database works out
-- the rest:  net = max(gross − discount − operation cost, 0),  commission = round(net × rate ÷ 100, 2), and only
-- for bookings that came from an affiliate. The affiliate's commission_rate is now the real rate (a percentage).
-- Run this once in the Supabase SQL editor, after 006_booking_lookup.sql.
-- None of these amounts are ever sent to affiliates; they see only their commission.

-- 1. Retail price and operation cost per procedure (service id from lib/config.js). Seeded at 0 until staff fill in
-- Staff admin > Pricing.
create table public.procedure_costs (
 service text primary key check (service in ('eye-exam','contacts','dry-eye','children','testing','styling')),
 retail_price numeric(12,2) not null default 0 check (retail_price >= 0),
 operation_cost numeric(12,2) not null default 0 check (operation_cost >= 0),
 updated_at timestamptz not null default now()
);
insert into public.procedure_costs (service, retail_price, operation_cost) values
 ('eye-exam',0,0),('contacts',0,0),('dry-eye',0,0),('children',0,0),('testing',0,0),('styling',0,0)
on conflict (service) do nothing;
alter table public.procedure_costs enable row level security;
revoke all on public.procedure_costs from anon, authenticated;

-- 2. The amounts behind each commission. operation_cost and commission_rate are snapshots taken the first time the
-- appointment is completed, so later price or rate changes do not alter an existing calculation.
alter table public.bookings add column if not exists gross_amount numeric(12,2) check (gross_amount is null or gross_amount >= 0);
alter table public.bookings add column if not exists discount_amount numeric(12,2) check (discount_amount is null or discount_amount >= 0);
alter table public.bookings add column if not exists operation_cost numeric(12,2) check (operation_cost is null or operation_cost >= 0);
alter table public.bookings add column if not exists net_amount numeric(12,2) check (net_amount is null or net_amount >= 0);
alter table public.bookings add column if not exists commission_rate numeric(5,2) check (commission_rate is null or commission_rate between 0 and 100);

-- 3. Complete an appointment: mark it Attended and calculate its commission. Paid bookings are locked.
create function public.complete_appointment(p_id uuid, p_gross numeric, p_discount numeric, p_actor uuid)
returns setof public.bookings language plpgsql security definer set search_path=public as $$
declare b bookings; v_gross numeric(12,2); v_discount numeric(12,2); v_cost numeric(12,2); v_rate numeric(5,2); v_net numeric(12,2);
begin
 select * into b from bookings where id = p_id for update;
 if not found then raise exception 'booking not found'; end if;
 if b.payout = 'Paid' then raise exception 'paid bookings are locked'; end if;
 v_gross := round(p_gross, 2); v_discount := round(coalesce(p_discount, 0), 2);
 if v_gross is null or v_gross < 0 or v_gross > 1000000 then raise exception 'invalid gross amount'; end if;
 if v_discount < 0 or v_discount > v_gross then raise exception 'invalid discount'; end if;
 v_cost := coalesce(b.operation_cost, (select operation_cost from procedure_costs where service = b.service), 0);
 if b.affiliate_id is not null then
  v_rate := coalesce(b.commission_rate, (select round(commission_rate, 2) from affiliates where id = b.affiliate_id), 0);
 end if;
 v_net := greatest(v_gross - v_discount - v_cost, 0);
 return query update bookings set status = 'Attended', gross_amount = v_gross, discount_amount = v_discount, operation_cost = v_cost,
  net_amount = v_net, commission_rate = v_rate, commission = case when b.affiliate_id is null then 0 else round(v_net * v_rate / 100, 2) end
 where id = p_id returning *;
 insert into audit_logs(actor_id, action, record_id) values (p_actor, 'complete_appointment', p_id::text);
end;$$;
revoke all on function public.complete_appointment(uuid,numeric,numeric,uuid) from public, anon, authenticated;
grant execute on function public.complete_appointment(uuid,numeric,numeric,uuid) to service_role;

-- ==================== 008_services.sql ====================
-- Adds the Non-Invasive Skin Tightening service (id 'skin-tightening') and an optional per-booking service option,
-- used for the skin tightening technology the patient chose (a slug from skinTechnologies in lib/config.js).
-- Run this once in the Supabase SQL editor, after 007_commission.sql.

-- 1. Bookings may be for skin tightening. The original check came from schema.sql (named bookings_service_check).
alter table public.bookings drop constraint if exists bookings_service_check;
alter table public.bookings add constraint bookings_service_check
 check (service in ('eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling'));

-- 2. The optional choice within the service. Empty when the patient made none.
alter table public.bookings add column if not exists service_option text
 check (service_option is null or service_option ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- 3. Pricing (migration 007) has the same list of services, and a row per service starting at 0.
alter table public.procedure_costs drop constraint if exists procedure_costs_service_check;
alter table public.procedure_costs add constraint procedure_costs_service_check
 check (service in ('eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling'));
insert into public.procedure_costs (service, retail_price, operation_cost) values ('skin-tightening', 0, 0)
on conflict (service) do nothing;

-- ==================== 009_direct_uploads.sql ====================
-- "Complete your file" uploads go straight from the patient's browser to the private 'booking-documents' bucket with
-- one-time signed upload links, because the website's host (Vercel) refuses requests over about 4.5 MB.
-- This table remembers each unfinished upload: which booking and link it belongs to, the residency status, and the
-- exact storage paths the patient was allowed to upload to (with each file's declared name, size, type and kind).
-- /api/documents checks the stored files against it before recording them in booking_documents, then deletes the row.
-- Rows left unfinished are removed (with their files) by the hourly /api/reminders job.
-- Run this once in the Supabase SQL editor, after 008_services.sql.
-- Only the server (service role) can read or write this. Affiliates never see it.

create table public.booking_document_uploads (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
 residency_status text not null check (char_length(residency_status) between 1 and 120),
 files jsonb not null check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 8),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index booking_document_uploads_token_index on public.booking_document_uploads(token_hash);
create index booking_document_uploads_expiry_index on public.booking_document_uploads(expires_at);

alter table public.booking_document_uploads enable row level security;
-- No policies: nobody but the service role can touch this table.
revoke all on public.booking_document_uploads from anon, authenticated;

-- The bucket stays private with no storage policies. A signed upload link lets the holder create exactly one object at
-- the path the server chose; it cannot read, list or overwrite anything. The bucket's own limits (10 MB, PDF/JPG/PNG,
-- set in 005_documents.sql) still apply to every upload.

-- ==================== 010_doctors_and_schedules.sql ====================
-- Optometrist profiles and schedules, managed by staff in Staff admin > Doctors.
--  * doctors: the profile the website shows (name, short line, intro, focus, languages, frames they wear, photo), the
--    services they perform (null = every service), whether they are shown and bookable online, display order and
--    their appointment length.
--  * doctor_weekly_hours: working hours per weekday, in clinic time. Several rows per day are allowed, so a lunch
--    break is just a gap.
--  * doctor_time_off: vacations, half days and blocked hours (from/to instants).
--  * doctor_extra_hours: one-off extra days, in clinic time.
--  * generate_doctor_slots turns all of this into bookable appointment_slots, always 90 days ahead. It runs whenever
--    staff save a schedule and every hour from /api/reminders. It never removes a slot that has a booking, and never
--    touches times staff added by hand (Staff admin > Bookings > Add available time).
-- Existing bookings and the per-optometrist double-booking protection (migration 004) are unchanged.
-- Run this once in the Supabase SQL editor, after 009_direct_uploads.sql. It creates the public 'doctor-photos' bucket.
-- Only the server (service role) can read or write these tables. The website receives the public profile fields only.

-- 1. Profiles. The two bracketed placeholders from lib/config.js are copied in, so the website looks the same until
-- staff enter the real details.
create table public.doctors (
 slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70),
 title text not null default 'Dr.' check (char_length(title) <= 20),
 first_name text not null check (char_length(first_name) between 1 and 60),
 last_name text not null check (char_length(last_name) between 1 and 60),
 line text not null default '' check (char_length(line) <= 200),
 intro text not null default '' check (char_length(intro) <= 1200),
 focus text not null default '' check (char_length(focus) <= 200),
 languages text not null default '' check (char_length(languages) <= 200),
 wears text not null default '' check (char_length(wears) <= 200),
 photo text not null default '' check (char_length(photo) <= 500),
 photo_alt text not null default '' check (char_length(photo_alt) <= 200),
 services text[] check (services is null or services <@ array['eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling']),
 visible boolean not null default true,
 display_order integer not null default 0,
 slot_minutes integer not null default 30 check (slot_minutes in (15,30,45,60,90)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
insert into public.doctors (slug, first_name, last_name, line, intro, focus, languages, wears, photo, photo_alt, display_order) values
 ('doctor-1','[First]','[Last]','[One short sentence about their focus.]','[First sentence introducing the doctor.] [Second sentence about how they work with patients.]','[Areas of focus]','[Languages spoken]','[The frames they wear]','/images/doctors/doctor-1.webp','Placeholder portrait',1),
 ('doctor-2','[First]','[Last]','[One short sentence about their focus.]','[First sentence introducing the doctor.] [Second sentence about how they work with patients.]','[Areas of focus]','[Languages spoken]','[The frames they wear]','/images/doctors/doctor-2.webp','Placeholder portrait',2)
on conflict (slug) do nothing;
-- Any other optometrist already used by a slot or booking gets a hidden placeholder profile, so nothing is orphaned.
insert into public.doctors (slug, first_name, last_name, visible, display_order)
select distinct x.doctor, '[First]', '[Last]', false, 99 from (select doctor from public.appointment_slots union select doctor from public.bookings) x
where x.doctor is not null on conflict (slug) do nothing;
alter table public.appointment_slots add constraint appointment_slots_doctor_fkey foreign key (doctor) references public.doctors(slug) on update cascade;

-- 2. Schedules.
create table public.doctor_weekly_hours (
 id bigint generated always as identity primary key,
 doctor text not null references public.doctors(slug) on update cascade on delete cascade,
 weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 Monday … 7 Sunday
 start_time time not null,
 end_time time not null,
 check (end_time > start_time)
);
create index doctor_weekly_hours_doctor_index on public.doctor_weekly_hours(doctor, weekday);
create table public.doctor_time_off (
 id bigint generated always as identity primary key,
 doctor text not null references public.doctors(slug) on update cascade on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 reason text not null default '' check (char_length(reason) <= 120),
 created_at timestamptz not null default now(),
 check (ends_at > starts_at)
);
create index doctor_time_off_doctor_index on public.doctor_time_off(doctor, ends_at);
create table public.doctor_extra_hours (
 id bigint generated always as identity primary key,
 doctor text not null references public.doctors(slug) on update cascade on delete cascade,
 day date not null,
 start_time time not null,
 end_time time not null,
 check (end_time > start_time)
);
create index doctor_extra_hours_doctor_index on public.doctor_extra_hours(doctor, day);

-- 3. Slots made from a schedule are marked generated. Slots staff add by hand stay generated = false and are kept.
alter table public.appointment_slots add column if not exists generated boolean not null default false;

alter table public.doctors enable row level security;
alter table public.doctor_weekly_hours enable row level security;
alter table public.doctor_time_off enable row level security;
alter table public.doctor_extra_hours enable row level security;
-- No policies: the server reads and writes these with the service role; the website gets public fields from the API.
revoke all on public.doctors, public.doctor_weekly_hours, public.doctor_time_off, public.doctor_extra_hours from anon, authenticated;

-- 4. The slots a schedule asks for (lib/schedule.js planSlots does the same for the demo). For each visible
-- optometrist (or just p_doctor): every slot of their length that fits inside their weekly hours and extra days, from
-- now to p_days ahead in the clinic's time zone, except slots touching their time off.
create function public.planned_doctor_slots(p_doctor text, p_timezone text, p_days integer)
returns table(doctor text, start timestamptz, duration integer) language sql stable security definer set search_path=public as $$
 with days as (
  select ((now() at time zone p_timezone)::date + i) as day from generate_series(0, least(greatest(p_days, 0), 366)) i
 ), windows as (
  select d.slug as doctor, d.slot_minutes as minutes, (days.day + h.start_time) at time zone p_timezone as w_start, (days.day + h.end_time) at time zone p_timezone as w_end
  from doctors d join doctor_weekly_hours h on h.doctor = d.slug join days on extract(isodow from days.day) = h.weekday
  where d.visible and (p_doctor is null or d.slug = p_doctor)
  union all
  select d.slug, d.slot_minutes, (days.day + x.start_time) at time zone p_timezone, (days.day + x.end_time) at time zone p_timezone
  from doctors d join doctor_extra_hours x on x.doctor = d.slug join days on days.day = x.day
  where d.visible and (p_doctor is null or d.slug = p_doctor)
 )
 select distinct w.doctor, s.start, w.minutes
 from windows w cross join lateral generate_series(w.w_start, w.w_end - make_interval(mins => w.minutes), make_interval(mins => w.minutes)) as s(start)
 where s.start > now()
 and not exists (select 1 from doctor_time_off t where t.doctor = w.doctor
  and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(s.start, s.start + make_interval(mins => w.minutes), '[)'));
$$;

-- 5. Bring generated slots in line with the schedule. Removes future generated slots the schedule no longer asks for
-- (unless booked), then adds the missing ones. Returns how many were added.
create function public.generate_doctor_slots(p_doctor text default null, p_timezone text default 'Etc/GMT+6', p_days integer default 90)
returns integer language plpgsql security definer set search_path=public as $$
declare added integer;
begin
 perform pg_advisory_xact_lock(hashtext('generate_doctor_slots'));
 with planned as materialized (select * from planned_doctor_slots(p_doctor, p_timezone, p_days))
 delete from appointment_slots s
 where s.generated and s.start > now() and (p_doctor is null or s.doctor = p_doctor)
 and not exists (select 1 from bookings b where b.doctor = s.doctor and b.start = s.start)
 and not exists (select 1 from planned p where p.doctor = s.doctor and p.start = s.start and p.duration = s.duration);
 with planned as materialized (select * from planned_doctor_slots(p_doctor, p_timezone, p_days))
 insert into appointment_slots (doctor, start, duration, generated)
 select p.doctor, p.start, p.duration, true from planned p
 on conflict (doctor, start) do nothing;
 get diagnostics added = row_count;
 return added;
end;$$;

-- 6. Save one optometrist's appointment length and weekly hours in one step, then regenerate their slots.
-- p_hours is a JSON array of {weekday, start, end}, already checked by the server (lib/schedule.js).
create function public.save_doctor_hours(p_doctor text, p_slot_minutes integer, p_hours jsonb, p_timezone text)
returns integer language plpgsql security definer set search_path=public as $$
begin
 update doctors set slot_minutes = p_slot_minutes, updated_at = now() where slug = p_doctor;
 if not found then raise exception 'doctor not found'; end if;
 delete from doctor_weekly_hours where doctor = p_doctor;
 insert into doctor_weekly_hours (doctor, weekday, start_time, end_time)
 select p_doctor, (h->>'weekday')::smallint, (h->>'start')::time, (h->>'end')::time from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) h;
 return generate_doctor_slots(p_doctor, p_timezone, 90);
end;$$;

-- 7. Open times leave out hidden optometrists and anything inside time off (including times added by hand).
create or replace function public.available_slots() returns table(doctor text, start timestamptz, duration integer) language sql security definer set search_path=public as $$
 select s.doctor, s.start, s.duration from appointment_slots s join doctors d on d.slug = s.doctor and d.visible
 where s.start > now() and s.start < now() + interval '90 days'
 and not exists (select 1 from bookings b where b.status <> 'Cancelled' and b.doctor = s.doctor and tstzrange(b.start, b.end_time, '[)') && tstzrange(s.start, s.start + s.duration * interval '1 minute', '[)'))
 and not exists (select 1 from doctor_time_off t where t.doctor = s.doctor and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(s.start, s.start + s.duration * interval '1 minute', '[)'))
 order by s.start, s.doctor limit 5000;
$$;

revoke all on function public.planned_doctor_slots(text,text,integer) from public, anon, authenticated;
revoke all on function public.generate_doctor_slots(text,text,integer) from public, anon, authenticated;
revoke all on function public.save_doctor_hours(text,integer,jsonb,text) from public, anon, authenticated;
revoke all on function public.available_slots() from public, anon, authenticated;
grant execute on function public.planned_doctor_slots(text,text,integer) to service_role;
grant execute on function public.generate_doctor_slots(text,text,integer) to service_role;
grant execute on function public.save_doctor_hours(text,integer,jsonb,text) to service_role;
grant execute on function public.available_slots() to service_role;

-- 8. Doctor portraits: public (they appear on the website), images only, 2 MB. Uploaded by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-photos', 'doctor-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

commit;
