create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  content_id uuid not null,
  content_type text not null check (content_type in ('post', 'confession', 'listing')),
  reason text not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles
add column if not exists is_admin boolean default false,
add column if not exists banned boolean default false;

alter table reports enable row level security;

create policy "Authenticated users can report content"
  on reports for insert
  with check (auth.role() = 'authenticated');

create policy "Anyone can view their own reports"
  on reports for select
  using (auth.uid() = reporter_id);

create policy "Admins can view all reports"
  on reports for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

create policy "Admins can delete reports"
  on reports for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

-- Allow admins to delete from content tables
create policy "Admins can delete posts"
  on posts for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

create policy "Admins can delete confessions"
  on confessions for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

create policy "Admins can delete listings"
  on listings for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );

-- Allow admins to update profiles (ban users)
create policy "Admins can update profiles"
  on profiles for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and is_admin = true
    )
  );
