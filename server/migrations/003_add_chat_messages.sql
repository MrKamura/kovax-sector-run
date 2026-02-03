CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  sector_id TEXT NULL,
  user_id INTEGER NOT NULL,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_scope_created_at_idx
  ON chat_messages (scope, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_sector_created_at_idx
  ON chat_messages (sector_id, created_at DESC);

