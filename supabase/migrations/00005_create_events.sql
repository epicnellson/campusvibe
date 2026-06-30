create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text not null,
  date date not null,
  time text not null,
  location text not null,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists event_rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(event_id, user_id)
);

alter table events enable row level security;
alter table event_rsvps enable row level security;

create policy "Anyone can view events"
  on events for select
  using (true);

create policy "Authenticated users can create events"
  on events for insert
  with check (auth.role() = 'authenticated');

create policy "Event creators can update events"
  on events for update
  using (auth.uid() = user_id);

create policy "Event creators can delete events"
  on events for delete
  using (auth.uid() = user_id);

create policy "Anyone can view RSVPs"
  on event_rsvps for select
  using (true);

create policy "Authenticated users can RSVP"
  on event_rsvps for insert
  with check (auth.role() = 'authenticated');

create policy "Users can cancel own RSVP"
  on event_rsvps for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "Anyone can view event images"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "Authenticated users can upload event images"
  on storage.objects for insert
  with check (bucket_id = 'event-images' and auth.role() = 'authenticated');

create policy "Uploaders can update event images"
  on storage.objects for update
  using (bucket_id = 'event-images' and auth.role() = 'authenticated');

create policy "Uploaders can delete event images"
  on storage.objects for delete
  using (bucket_id = 'event-images' and auth.role() = 'authenticated');
