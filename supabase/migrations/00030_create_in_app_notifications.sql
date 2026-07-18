-- In-app notifications table
-- Stores like, repost, follow, and comment notifications

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'follow', 'comment')),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'confession', 'event', 'profile')),
  content_id UUID NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON in_app_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON in_app_notifications(user_id, read) WHERE read = false;

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON in_app_notifications;
CREATE POLICY "Users read own notifications" ON in_app_notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users mark own notifications read" ON in_app_notifications;
CREATE POLICY "Users mark own notifications read" ON in_app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users create notifications" ON in_app_notifications;
CREATE POLICY "Authenticated users create notifications" ON in_app_notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
