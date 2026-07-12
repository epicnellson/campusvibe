-- Ensure the post-images bucket exists
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- Allow public read access
drop policy if exists "Anyone can view post images" on storage.objects;
create policy "Anyone can view post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Allow authenticated users to upload
drop policy if exists "Authenticated users can upload post images" on storage.objects;
create policy "Authenticated users can upload post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images' and auth.role() = 'authenticated');

-- Allow authenticated users to update
drop policy if exists "Authenticated users can update post images" on storage.objects;
create policy "Authenticated users can update post images"
  on storage.objects for update
  using (bucket_id = 'post-images' and auth.role() = 'authenticated');

-- Allow authenticated users to delete
drop policy if exists "Authenticated users can delete post images" on storage.objects;
create policy "Authenticated users can delete post images"
  on storage.objects for delete
  using (bucket_id = 'post-images' and auth.role() = 'authenticated');
