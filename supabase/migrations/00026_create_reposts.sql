CREATE TABLE IF NOT EXISTS reposts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view reposts" ON reposts;
CREATE POLICY "Authenticated users can view reposts"
  ON reposts FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert reposts" ON reposts;
CREATE POLICY "Authenticated users can insert reposts"
  ON reposts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reposts" ON reposts;
CREATE POLICY "Users can delete own reposts"
  ON reposts FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON reposts TO authenticated;
GRANT ALL ON reposts TO anon;
