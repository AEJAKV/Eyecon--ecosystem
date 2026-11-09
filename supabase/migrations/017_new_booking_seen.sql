-- New-booking indicators (the gold dot in the workspaces). Each signed-in user (staff admin, front desk, affiliate)
-- has their own "seen" state: bookings made after seen_at are new to them until they open one (booking_views) or
-- press "Mark all seen" (which moves seen_at to now).
-- Run this once in the Supabase SQL editor, after 016_blog.sql.
-- Only the server (service role) reads and writes these tables; row level security is on with no policies.

create table if not exists public.workspace_seen(
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);

create table if not exists public.booking_views(
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(user_id, booking_id)
);

-- Finding bookings made since a user's seen time.
create index if not exists bookings_created_at_idx on public.bookings(created_at desc);

alter table public.workspace_seen enable row level security;
alter table public.booking_views enable row level security;
revoke all on public.workspace_seen, public.booking_views from anon, authenticated;
