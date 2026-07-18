-- seen_posts table for feed aggregator repeat avoidance
CREATE TABLE IF NOT EXISTS seen_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  source TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seen_posts_user ON seen_posts(user_id, seen_at);
CREATE INDEX IF NOT EXISTS idx_seen_posts_external ON seen_posts(user_id, external_id);

ALTER TABLE seen_posts ENABLE ROW LEVEL SECURITY;

-- Users can read their own seen posts
DROP POLICY IF EXISTS "Users read own seen posts" ON seen_posts;
CREATE POLICY "Users read own seen posts" ON seen_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own seen posts
DROP POLICY IF EXISTS "Users insert own seen posts" ON seen_posts;
CREATE POLICY "Users insert own seen posts" ON seen_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all (for edge function)
DROP POLICY IF EXISTS "Service role manages seen posts" ON seen_posts;
CREATE POLICY "Service role manages seen posts" ON seen_posts
  FOR ALL USING (auth.role() = 'service_role');
