-- Adds the optional "preferred optometrist" chosen on the website when booking.
-- Holds a doctor's slug from lib/config.js (for example 'doctor-1'), or null when no preference was given.
-- Run this once in the Supabase SQL editor after schema.sql.
alter table public.bookings add column if not exists preferred_doctor text;
