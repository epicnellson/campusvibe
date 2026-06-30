-- Migration 00018: Fix PostgREST embedded resource relationships
--
-- PostgREST needs FK constraints directly to `profiles` to resolve
-- joins like `profiles(name)` and `creator:profiles(name)` in select queries.
-- Previously FKs pointed to `auth.users`, which prevented PostgREST from
-- auto-detecting the profiles relationship.
--
-- All content tables had user_id → auth.users(id). Since profiles.id also
-- references auth.users(id), we can safely switch the FK target to profiles.

-- Profiles (FK: id → auth.users) – unchanged, already correct:
--   CREATE TABLE profiles (id uuid references auth.users on delete cascade primary key)

-- Posts
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Confessions
ALTER TABLE confessions DROP CONSTRAINT IF EXISTS confessions_user_id_fkey;
ALTER TABLE confessions ADD CONSTRAINT confessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_user_id_fkey;
ALTER TABLE events ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Listings
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_user_id_fkey;
ALTER TABLE listings ADD CONSTRAINT listings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- messages: channel_id → channels, user_id → profiles
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- channel_members
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_user_id_fkey;
ALTER TABLE channel_members ADD CONSTRAINT channel_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- likes
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE likes ADD CONSTRAINT likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- confession_likes
ALTER TABLE confession_likes DROP CONSTRAINT IF EXISTS confession_likes_user_id_fkey;
ALTER TABLE confession_likes ADD CONSTRAINT confession_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- event_rsvps
ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_user_id_fkey;
ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- reports: reporter_id → profiles
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- follows: follower_id already references profiles(id) (migration 00011)
-- following_id needs an FK
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_following_id_fkey
  FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;
