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
