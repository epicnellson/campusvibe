alter table posts add column if not exists image_url text;

-- Update the PostgREST relationship to target profiles(id) instead of auth.users(id)
alter table posts drop constraint if exists posts_user_id_fkey;
alter table posts add constraint posts_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
