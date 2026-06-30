-- ==========================================================
-- 00013: Student ID verification system
-- 1. Add verification_status column to profiles
-- 2. Create private storage bucket student-id-verification
-- 3. RLS policies for the private bucket
-- ==========================================================

-- Add verification_status to profiles
alter table profiles
add column if not exists verification_status text
  default null
  check (verification_status in ('pending', 'approved', 'rejected'));

-- Existing users get auto-approved
update profiles
set verification_status = 'approved'
where verification_status is null;

-- Create private storage bucket for student ID images
insert into storage.buckets (id, name, public)
values ('student-id-verification', 'student-id-verification', false)
on conflict (id) do nothing;

-- Only the uploader can view their own ID images
create policy "Users can view own student ID"
  on storage.objects for select
  using (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
  );

-- Only authenticated users can upload ID images
create policy "Users can upload own student ID"
  on storage.objects for insert
  with check (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
  );

-- Users can update own student ID (for re-upload after rejection)
create policy "Users can update own student ID"
  on storage.objects for update
  with check (
    bucket_id = 'student-id-verification'
    and owner_id = auth.uid()::text
  );

-- Admins can view all student ID images
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
