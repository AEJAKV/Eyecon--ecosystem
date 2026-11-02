-- The blog. Affiliates, the front desk and staff admin write posts in their workspace; staff admin review every post
-- and publish it, send it back with a note, or decide not to publish it. Readers' comments wait for staff approval.
-- Run this once in the Supabase SQL editor, after 015_front_desk.sql.
-- Only the server (service role) reads and writes these tables; row level security is on with no policies.
-- Posts never hold patient details. Authors confirm this before they submit, and staff check it before publishing.

-- 1. Posts. draft is the author's working copy; published is the copy readers see (null until approved, and again
--    after staff unpublish). Editing a published post changes draft only, so the live copy stays as it was until
--    staff approve the changes. status is the state of the working copy:
--      draft      being written (or being edited after publication)
--      review     submitted; only staff admin can change it
--      changes    sent back with review_note
--      approved   the working copy is the published copy
--      rejected   staff decided not to publish it (review_note says why)
--    published_at is when the published copy goes live: a future time means it is scheduled.
--    author_name is the author's full name when the post was created; readers only ever see the first name and the
--    first letter of the last name (bylineName in lib/blog.js). author_affiliate gives booking buttons in an
--    affiliate's post that affiliate's referral, while the affiliate is active.
create table if not exists public.blog_posts (
 id uuid primary key default gen_random_uuid(),
 slug text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 author_id uuid not null references auth.users(id) on delete restrict,
 author_role text not null check (author_role in ('staff','front-desk','affiliate')),
 author_name text not null default '' check (char_length(author_name) <= 120),
 author_affiliate uuid references public.affiliates(id) on delete set null,
 status text not null default 'draft' check (status in ('draft','review','changes','approved','rejected')),
 draft jsonb not null check (jsonb_typeof(draft) = 'object'),
 published jsonb check (published is null or jsonb_typeof(published) = 'object'),
 published_at timestamptz,
 review_note text not null default '' check (char_length(review_note) <= 1000),
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((published is null) = (published_at is null)),
 check (published is null or slug is not null)
);
create index if not exists blog_posts_author_idx on public.blog_posts(author_id, updated_at desc);
create index if not exists blog_posts_status_idx on public.blog_posts(status);
create index if not exists blog_posts_live_idx on public.blog_posts(published_at desc) where published is not null;
alter table public.blog_posts enable row level security;

-- 2. Comments. Readers give a first name and the comment, nothing else. A comment is shown only once staff approve it.
--    request_hash is the reader's IP hashed with a server secret, for the rate limit; the IP itself is never stored.
create table if not exists public.blog_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.blog_posts(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 40),
 body text not null check (char_length(body) between 2 and 1000),
 status text not null default 'pending' check (status in ('pending','approved')),
 request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists blog_comments_post_idx on public.blog_comments(post_id, status, created_at);
create index if not exists blog_comments_rate_idx on public.blog_comments(request_hash, created_at);
alter table public.blog_comments enable row level security;

revoke all on public.blog_posts from anon, authenticated;
revoke all on public.blog_comments from anon, authenticated;

-- 3. Pictures. Drafts' pictures are private: the author and staff see them through links that expire after an hour.
--    When staff publish a post its pictures are copied to the public bucket, under the same name, so the published
--    page loads them directly. Images only, 4 MB (the editor shrinks pictures before uploading). Uploaded by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-drafts', 'blog-drafts', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
