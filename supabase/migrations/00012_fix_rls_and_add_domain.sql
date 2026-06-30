-- ==========================================================
-- 00012: Fix RLS policies for data isolation by university
-- 1. Add email_domain column to profiles
-- 2. Fix profiles SELECT policy (was too restrictive)
-- 3. Scoped SELECT policies on all content tables by domain
-- ==========================================================

-- ==========================================================
-- PROFILES — add email_domain column FIRST
-- ==========================================================
alter table profiles
add column if not exists email_domain text;

-- Helper function to get the current user's email domain
-- Used in RLS policies to scope data to same university
create or replace function get_current_user_domain()
returns text
language sql
stable
as $$
  select email_domain from profiles where id = auth.uid();
$$;

-- Fix: allow reading other users' profiles within same domain
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (
    auth.uid() = id
    or
    email_domain = get_current_user_domain()
  );

-- ==========================================================
-- POSTS + LIKES
-- ==========================================================
drop policy if exists "Anyone can view posts" on posts;
create policy "Users can view same-university posts"
  on posts for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = posts.user_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

drop policy if exists "Anyone can view likes" on likes;
create policy "Users can view same-university likes"
  on likes for select
  using (
    exists (
      select 1 from posts
      inner join profiles on profiles.id = posts.user_id
      where posts.id = likes.post_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- CONFESSIONS + CONFESSION_LIKES
-- ==========================================================
drop policy if exists "Anyone can view confessions" on confessions;
create policy "Users can view same-university confessions"
  on confessions for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = confessions.user_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

drop policy if exists "Anyone can view confession likes" on confession_likes;
create policy "Users can view same-university confession likes"
  on confession_likes for select
  using (
    exists (
      select 1 from confessions
      inner join profiles on profiles.id = confessions.user_id
      where confessions.id = confession_likes.confession_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- EVENTS + EVENT_RSVPS
-- ==========================================================
drop policy if exists "Anyone can view events" on events;
create policy "Users can view same-university events"
  on events for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = events.user_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

drop policy if exists "Anyone can view RSVPs" on event_rsvps;
create policy "Users can view same-university RSVPs"
  on event_rsvps for select
  using (
    exists (
      select 1 from events
      inner join profiles on profiles.id = events.user_id
      where events.id = event_rsvps.event_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- LISTINGS
-- ==========================================================
drop policy if exists "Anyone can view listings" on listings;
create policy "Users can view same-university listings"
  on listings for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = listings.user_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- FOLLOWS
-- ==========================================================
drop policy if exists "Users can view follows" on follows;
create policy "Users can view follows"
  on follows for select
  using (
    auth.uid() = follower_id
    or
    auth.uid() = following_id
    or
    exists (
      select 1 from profiles
      where profiles.id = follows.follower_id
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- STORAGE: profile-photos
-- ==========================================================
drop policy if exists "Anyone can view profile photos" on storage.objects;
create policy "Anyone can view same-university profile photos"
  on storage.objects for select
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from profiles
      where profiles.id = owner_id::uuid
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- STORAGE: event-images
-- ==========================================================
drop policy if exists "Anyone can view event images" on storage.objects;
create policy "Anyone can view same-university event images"
  on storage.objects for select
  using (
    bucket_id = 'event-images'
    and exists (
      select 1 from events
      inner join profiles on profiles.id = events.user_id
      where events.id::text = (storage.foldername(name))[1]
        and profiles.email_domain = get_current_user_domain()
    )
  );

-- ==========================================================
-- STORAGE: listing-photos
-- ==========================================================
drop policy if exists "Anyone can view listing photos" on storage.objects;
create policy "Anyone can view same-university listing photos"
  on storage.objects for select
  using (
    bucket_id = 'listing-photos'
    and exists (
      select 1 from listings
      inner join profiles on profiles.id = listings.user_id
      where listings.id::text = (storage.foldername(name))[1]
        and profiles.email_domain = get_current_user_domain()
    )
  );
