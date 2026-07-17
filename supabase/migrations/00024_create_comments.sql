-- Create comments table for post replies

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table comments enable row level security;

-- Everyone can read comments
create policy "Anyone can read comments"
  on comments for select
  using (true);

-- Authenticated users with verified status can insert
create policy "Verified users can create comments"
  on comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from profiles
      where id = auth.uid()
      and verification_status = 'approved'
    )
  );

-- Owner can delete their own comment
create policy "Users can delete own comments"
  on comments for delete
  using (auth.uid() = user_id);

-- Admin can delete any comment
create policy "Admins can delete any comment"
  on comments for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and is_admin = true
    )
  );
