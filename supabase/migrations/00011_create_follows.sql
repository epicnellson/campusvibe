create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check(follower_id <> following_id)
);

alter table follows enable row level security;

-- Users can see who they follow and who follows them
create policy "Users can view follows"
  on follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

-- Users can only follow/unfollow as themselves
create policy "Users can insert their own follows"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can delete their own follows"
  on follows for delete
  using (auth.uid() = follower_id);
