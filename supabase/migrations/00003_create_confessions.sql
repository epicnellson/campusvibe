create table if not exists confessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists confession_likes (
  id uuid default gen_random_uuid() primary key,
  confession_id uuid references confessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(confession_id, user_id)
);

alter table confessions enable row level security;
alter table confession_likes enable row level security;

create policy "Anyone can view confessions"
  on confessions for select
  using (true);

create policy "Authenticated users can insert confessions"
  on confessions for insert
  with check (auth.role() = 'authenticated');

create policy "Users can delete own confessions"
  on confessions for delete
  using (auth.uid() = user_id);

create policy "Anyone can view confession likes"
  on confession_likes for select
  using (true);

create policy "Authenticated users can insert confession likes"
  on confession_likes for insert
  with check (auth.role() = 'authenticated');

create policy "Users can delete own confession likes"
  on confession_likes for delete
  using (auth.uid() = user_id);
