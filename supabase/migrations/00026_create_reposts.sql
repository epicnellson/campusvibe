CREATE TABLE reposts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reposts"
  ON reposts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert reposts"
  ON reposts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reposts"
  ON reposts FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON reposts TO authenticated;
GRANT ALL ON reposts TO anon;
