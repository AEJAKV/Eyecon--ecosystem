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
