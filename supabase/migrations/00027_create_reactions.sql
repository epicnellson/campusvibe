CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('❤️', '😂', '😮', '😢', '😡', '👍')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reactions"
  ON reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert reactions"
  ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON reactions FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON reactions TO authenticated;
GRANT ALL ON reactions TO anon;
