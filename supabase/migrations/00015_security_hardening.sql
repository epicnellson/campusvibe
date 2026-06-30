-- ==========================================================
-- 00015: Security hardening for student ID verification
--
-- 1. Enable RLS on storage.objects explicitly
-- 2. File extension checks in storage policies (jpg/jpeg/png/pdf)
-- 3. Trigger: auto-set verification_status = 'pending' on ID upload
-- 4. Prevent users from changing own verification_status via RLS
-- 5. Admin audit log table (admin_actions)
-- 6. RLS on content tables — block unverified users from inserting
-- 7. DELETE policy for admins on student-id-verification bucket
-- ==========================================================

-- ==========================================================
-- 1. RLS on storage.objects is already enabled by default in
--    Supabase — no alter needed (requires storage owner role).
-- ==========================================================
-- 2. Drop old storage policies and recreate with extension check
-- ==========================================================

-- Drop old policies
drop policy if exists "Users can upload own student ID" on storage.objects;
drop policy if exists "Users can update own student ID" on storage.objects;
drop policy if exists "Admins can view all student IDs" on storage.objects;
drop policy if exists "Users can view own student ID" on storage.objects;

-- Users can view own student ID
create policy "Users can view own student ID"
  on storage.objects for select
  using (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
  );

-- Upload with file extension check — only jpg, jpeg, png, pdf
create policy "Users can upload own student ID"
  on storage.objects for insert
  with check (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
    and storage.extension(name) in ('jpg', 'jpeg', 'png', 'pdf')
  );

-- Re-upload (update) with file extension check
create policy "Users can update own student ID"
  on storage.objects for update
  with check (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
    and storage.extension(name) in ('jpg', 'jpeg', 'png', 'pdf')
  );

-- Admins can view all student IDs
create policy "Admins can view all student IDs"
  on storage.objects for select
  using (
    bucket_id = 'student-id-verification'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- Admins can delete student IDs (e.g., after rejection)
create policy "Admins can delete student IDs"
  on storage.objects for delete
  using (
    bucket_id = 'student-id-verification'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- ==========================================================
-- 3. Trigger: auto-set verification_status on student ID upload
--     Removes the need for the client to update this column.
-- ==========================================================
create or replace function handle_student_id_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bucket_id = 'student-id-verification' then
    update profiles
    set verification_status = 'pending'
    where id = new.owner_id
      and verification_status is distinct from 'approved';
  end if;
  return new;
end;
$$;

create trigger on_student_id_upload
  after insert on storage.objects
  for each row
  when (new.bucket_id = 'student-id-verification')
  execute function handle_student_id_upload();

-- ==========================================================
-- 4. Prevent users from changing own verification_status
--     Drop the permissive "Users can update own profile" policy
--     and recreate it with a WITH CHECK that blocks
--     verification_status changes for non-admin users.
-- ==========================================================
drop policy if exists "Users can update own profile" on profiles;

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Allow any column change EXCEPT verification_status
    and coalesce(verification_status, '') = coalesce(
      (select p.verification_status from profiles p where p.id = auth.uid()),
      ''
    )
  );

-- ==========================================================
-- 5. Admin audit log
-- ==========================================================
create table if not exists admin_actions (
  id uuid default gen_random_uuid() primary key,
  admin_email text not null,
  action text not null check (action in ('approved', 'rejected')),
  target_user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table admin_actions enable row level security;

-- Only admins can view the audit log
create policy "Admins can view admin actions"
  on admin_actions for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

-- service_role can insert (used by edge function)
create policy "Service role can insert admin actions"
  on admin_actions for insert
  with check (auth.role() = 'service_role');

-- ==========================================================
-- 6. Block unverified users from inserting content
--     Only users with verification_status = 'approved' can
--     create posts, confessions, events, listings, messages,
--     likes, and RSVPs.
-- ==========================================================

-- Posts
drop policy if exists "Authenticated users can insert posts" on posts;
create policy "Verified users can insert posts"
  on posts for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Confessions
drop policy if exists "Authenticated users can insert confessions" on confessions;
create policy "Verified users can insert confessions"
  on confessions for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Events
drop policy if exists "Authenticated users can create events" on events;
create policy "Verified users can create events"
  on events for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Event RSVPs
drop policy if exists "Authenticated users can RSVP" on event_rsvps;
create policy "Verified users can RSVP"
  on event_rsvps for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Listings
drop policy if exists "Authenticated users can create listings" on listings;
create policy "Verified users can create listings"
  on listings for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Messages (chat)
drop policy if exists "Channel members can send messages" on messages;
create policy "Verified users can send messages"
  on messages for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
    and exists (
      select 1 from channel_members
      where channel_members.channel_id = messages.channel_id
        and channel_members.user_id = auth.uid()
    )
  );

-- Likes on posts
drop policy if exists "Authenticated users can insert likes" on likes;
create policy "Verified users can insert likes"
  on likes for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Likes on confessions
drop policy if exists "Authenticated users can insert confession likes" on confession_likes;
create policy "Verified users can insert confession likes"
  on confession_likes for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );

-- Channel members (join channels)
drop policy if exists "Users can join channels" on channel_members;
create policy "Verified users can join channels"
  on channel_members for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
    )
  );
