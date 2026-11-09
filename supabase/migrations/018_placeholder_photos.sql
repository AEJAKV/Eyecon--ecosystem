-- Neutral placeholder photo (a grey silhouette, /images/placeholder-person.svg) for affiliates and doctors with no
-- photo of their own, instead of the sample portraits. New affiliates get it by default; existing records still on a
-- sample portrait are moved to it. Doctors with no photo store '' and the site shows the placeholder.
-- Run this once in the Supabase SQL editor, after 017_new_booking_seen.sql.

alter table public.affiliates alter column photo set default '/images/placeholder-person.svg';
update public.affiliates set photo = '/images/placeholder-person.svg' where photo = '/images/affiliate.webp';
update public.doctors set photo = '', photo_alt = '' where photo in ('/images/doctors/doctor-1.webp', '/images/doctors/doctor-2.webp');
