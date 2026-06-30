alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Users can upload their own profile photo"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own profile photo"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own profile photo"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
