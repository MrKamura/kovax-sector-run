ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS target_user_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS chat_messages_private_idx
  ON chat_messages (scope, user_id, target_user_id, created_at DESC)
  WHERE scope = 'private';
