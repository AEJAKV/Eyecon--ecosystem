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
