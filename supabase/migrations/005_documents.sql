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
