-- Allow any authenticated user to delete posts, events, confessions
-- (app UI allows all users to delete any content for moderation)

-- Posts
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
DROP POLICY IF EXISTS "Authenticated users can delete posts" ON posts;
CREATE POLICY "Authenticated users can delete posts"
  ON posts FOR DELETE
  USING (auth.role() = 'authenticated');

-- Events
DROP POLICY IF EXISTS "Event creators can delete events" ON events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON events;
CREATE POLICY "Authenticated users can delete events"
  ON events FOR DELETE
  USING (auth.role() = 'authenticated');

-- Confessions
DROP POLICY IF EXISTS "Users can delete own confessions" ON confessions;
DROP POLICY IF EXISTS "Authenticated users can delete confessions" ON confessions;
CREATE POLICY "Authenticated users can delete confessions"
  ON confessions FOR DELETE
  USING (auth.role() = 'authenticated');
