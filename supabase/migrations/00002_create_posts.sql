create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(post_id, user_id)
);

alter table posts enable row level security;
alter table likes enable row level security;

create policy "Anyone can view posts"
  on posts for select
  using (true);

create policy "Authenticated users can insert posts"
  on posts for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update own posts"
  on posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on posts for delete
  using (auth.uid() = user_id);

create policy "Anyone can view likes"
  on likes for select
  using (true);

create policy "Authenticated users can insert likes"
  on likes for insert
  with check (auth.role() = 'authenticated');

create policy "Users can delete own likes"
  on likes for delete
  using (auth.uid() = user_id);
