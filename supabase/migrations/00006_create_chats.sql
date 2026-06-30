create table if not exists channels (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('general', 'department', 'hostel', 'dm')),
  department text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists channel_members (
  id uuid default gen_random_uuid() primary key,
  channel_id uuid references channels(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(channel_id, user_id)
);

create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  channel_id uuid references channels(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table messages replica identity full;

alter publication supabase_realtime add table messages;

insert into channels (name, type, department) values
  ('General', 'general', null),
  ('Hostel', 'hostel', null),
  ('Computer Science', 'department', 'Computer Science'),
  ('Engineering', 'department', 'Engineering'),
  ('Mathematics', 'department', 'Mathematics'),
  ('Physics', 'department', 'Physics'),
  ('Biology', 'department', 'Biology'),
  ('Chemistry', 'department', 'Chemistry'),
  ('Business', 'department', 'Business'),
  ('Arts', 'department', 'Arts'),
  ('Other', 'department', 'Other');

alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;

create policy "Anyone can view channels"
  on channels for select
  using (true);

create policy "Anyone can view channel members"
  on channel_members for select
  using (true);

create policy "Users can join channels"
  on channel_members for insert
  with check (auth.role() = 'authenticated');

create policy "Users can leave channels"
  on channel_members for delete
  using (auth.uid() = user_id);

create policy "Channel members can read messages"
  on messages for select
  using (
    exists (
      select 1 from channel_members
      where channel_id = messages.channel_id
        and user_id = auth.uid()
    )
  );

create policy "Channel members can send messages"
  on messages for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from channel_members
      where channel_id = messages.channel_id
        and user_id = auth.uid()
    )
  );
