create table if not exists listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text not null,
  price text not null,
  category text not null check (category in ('Textbooks', 'Electronics', 'Clothing', 'Other')),
  photos jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table listings enable row level security;

create policy "Anyone can view listings"
  on listings for select
  using (true);

create policy "Authenticated users can create listings"
  on listings for insert
  with check (auth.role() = 'authenticated');

create policy "Sellers can update own listings"
  on listings for update
  using (auth.uid() = user_id);

create policy "Sellers can delete own listings"
  on listings for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "Authenticated users can upload listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.role() = 'authenticated');

create policy "Uploaders can update listing photos"
  on storage.objects for update
  using (bucket_id = 'listing-photos' and auth.role() = 'authenticated');

create policy "Uploaders can delete listing photos"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.role() = 'authenticated');
