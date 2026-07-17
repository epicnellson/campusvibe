-- Fix storage RLS policies: replace auth.role() = 'authenticated' with auth.uid() IS NOT NULL
-- auth.role() can return inconsistent values in web multipart upload contexts, causing
-- "new row violates row-level security policy" errors on storage uploads.
-- auth.uid() reliably checks for a valid authenticated session.

-- Ensure buckets exist
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- ==========================================================
-- profile-photos
-- ==========================================================
drop policy if exists "Authenticated users can upload profile photos" on storage.objects;
create policy "Authenticated users can upload profile photos"
  on storage.objects for insert
  with check (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can update profile photos" on storage.objects;
create policy "Authenticated users can update profile photos"
  on storage.objects for update
  using (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can delete profile photos" on storage.objects;
create policy "Authenticated users can delete profile photos"
  on storage.objects for delete
  using (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);

-- ==========================================================
-- event-images
-- ==========================================================
drop policy if exists "Authenticated users can upload event images" on storage.objects;
create policy "Authenticated users can upload event images"
  on storage.objects for insert
  with check (bucket_id = 'event-images' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can update event images" on storage.objects;
create policy "Authenticated users can update event images"
  on storage.objects for update
  using (bucket_id = 'event-images' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can delete event images" on storage.objects;
create policy "Authenticated users can delete event images"
  on storage.objects for delete
  using (bucket_id = 'event-images' AND auth.uid() IS NOT NULL);

-- ==========================================================
-- listing-photos
-- ==========================================================
drop policy if exists "Authenticated users can upload listing photos" on storage.objects;
create policy "Authenticated users can upload listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can update listing photos" on storage.objects;
create policy "Authenticated users can update listing photos"
  on storage.objects for update
  using (bucket_id = 'listing-photos' AND auth.uid() IS NOT NULL);

drop policy if exists "Authenticated users can delete listing photos" on storage.objects;
create policy "Authenticated users can delete listing photos"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' AND auth.uid() IS NOT NULL);
