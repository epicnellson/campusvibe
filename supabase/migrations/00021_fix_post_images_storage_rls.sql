-- Fix post-images storage RLS: replace auth.role() = 'authenticated' with auth.uid() IS NOT NULL
-- auth.role() can return inconsistent values in certain storage API contexts (e.g. web multipart uploads),
-- while auth.uid() reliably checks for a valid authenticated session.

-- Drop existing policies
drop policy if exists "Authenticated users can upload post images" on storage.objects;
drop policy if exists "Anyone can view post images" on storage.objects;
drop policy if exists "Authenticated users can update post images" on storage.objects;
drop policy if exists "Authenticated users can delete post images" on storage.objects;

-- Recreate with auth.uid() IS NOT NULL
create policy "Authenticated users can upload post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

create policy "Anyone can view post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Authenticated users can update post images"
  on storage.objects for update
  using (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

create policy "Authenticated users can delete post images"
  on storage.objects for delete
  using (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);
