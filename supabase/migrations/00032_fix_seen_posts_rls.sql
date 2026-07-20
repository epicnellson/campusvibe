-- Fix seen_posts RLS for authenticated users (migration 00029 may not have been applied)
-- Safe to run multiple times

-- Grant permissions
GRANT ALL ON TABLE public.seen_posts TO authenticated;
GRANT ALL ON TABLE public.seen_posts TO anon;

-- Ensure RLS policies exist
ALTER TABLE seen_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own seen posts" ON seen_posts;
CREATE POLICY "Users read own seen posts" ON seen_posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own seen posts" ON seen_posts;
CREATE POLICY "Users insert own seen posts" ON seen_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
