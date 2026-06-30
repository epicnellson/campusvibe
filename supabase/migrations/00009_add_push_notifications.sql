create table if not exists push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles
add column if not exists notification_preferences jsonb
default '{"likes":true,"messages":true,"new_events":true,"popular_confessions":true}'::jsonb;

alter table push_tokens enable row level security;

create policy "Users can manage own push token"
  on push_tokens for all
  using (auth.uid() = user_id);
