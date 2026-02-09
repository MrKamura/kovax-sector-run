-- 012_add_user_quest_completions.sql
-- Record quest completions per user per sector (history for stats/display).

CREATE TABLE IF NOT EXISTS user_quest_completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id VARCHAR(255) NOT NULL,
  quest_type VARCHAR(50) NOT NULL CHECK (quest_type IN ('mob_kills', 'pvp_kills')),
  completed_at TIMESTAMP NOT NULL,
  reward_exp INTEGER NOT NULL DEFAULT 0,
  reward_tokens INTEGER NOT NULL DEFAULT 0,
  daily_quest_id INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quest_completions_user_id ON user_quest_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_completions_sector_id ON user_quest_completions(sector_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_completions_user_sector ON user_quest_completions(user_id, sector_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_completions_completed_at ON user_quest_completions(completed_at);

COMMENT ON TABLE user_quest_completions IS 'One row per quest completion per user per sector (durable record for stats/history).';
