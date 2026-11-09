-- Removing an optometrist (Staff admin > Doctors > Remove). One who never had a booking is deleted outright; one with
-- past bookings is archived instead (removed_at set, hidden, hours cleared) so those bookings keep the doctor's name.
-- Staff can't remove an optometrist who still has upcoming appointments.
-- Run this once in the Supabase SQL editor, after 018_placeholder_photos.sql.

alter table public.doctors add column if not exists removed_at timestamptz;
