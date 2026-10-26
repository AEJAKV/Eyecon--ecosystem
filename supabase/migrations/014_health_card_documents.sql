-- "Complete your file" no longer asks for residency status, and its optional second upload is now the patient's
-- Care Card / Alberta Health Card. Run this once in the Supabase SQL editor, after 013_gift_redemption.sql.
-- Existing documents and residency answers are kept; older kinds (diploma and so on) stay valid for files already stored.
alter table public.booking_document_uploads alter column residency_status drop not null;
alter table public.booking_documents drop constraint if exists booking_documents_kind_check;
alter table public.booking_documents add constraint booking_documents_kind_check check (kind in ('government-id','health-card','diploma','certificate','high-school-diploma','english-test','other'));
