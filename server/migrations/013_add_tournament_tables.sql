-- 013_add_tournament_tables.sql
-- Tournament leaderboards: PvE/PvP stats, weekly top 50, top 3 titles.

-- Running stats per player (updated in real time). Week-scoped fields reset each week.
CREATE TABLE IF NOT EXISTS player_tournament_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- PvE
  monster_kills_total INTEGER NOT NULL DEFAULT 0,
  monster_kills_week INTEGER NOT NULL DEFAULT 0,
  monster_streak_best INTEGER NOT NULL DEFAULT 0,
  monster_streak_current INTEGER NOT NULL DEFAULT 0,
  quest_completions_week INTEGER NOT NULL DEFAULT 0,
  -- PvP
  pvp_kills_total INTEGER NOT NULL DEFAULT 0,
  pvp_kills_week INTEGER NOT NULL DEFAULT 0,
  pvp_streak_best INTEGER NOT NULL DEFAULT 0,
  pvp_streak_current INTEGER NOT NULL DEFAULT 0,
  revenge_kills_week INTEGER NOT NULL DEFAULT 0,
  -- Week boundary (Moscow midnight Monday); when week rolls, weekly_* reset
  week_start_utc TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_user_id ON player_tournament_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_monster_kills_week ON player_tournament_stats(monster_kills_week DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_monster_streak_best ON player_tournament_stats(monster_streak_best DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_pvp_kills_week ON player_tournament_stats(pvp_kills_week DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_pvp_streak_best ON player_tournament_stats(pvp_streak_best DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_quest_completions_week ON player_tournament_stats(quest_completions_week DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_revenge_kills_week ON player_tournament_stats(revenge_kills_week DESC);

-- Top 3 per category per week (snapshot when week ends; used for titles)
CREATE TABLE IF NOT EXISTS tournament_winners (
  id SERIAL PRIMARY KEY,
  week_start_utc TIMESTAMP NOT NULL,
  category VARCHAR(80) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 3),
  value INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(week_start_utc, category, rank)
);

CREATE INDEX IF NOT EXISTS idx_tournament_winners_week ON tournament_winners(week_start_utc);
CREATE INDEX IF NOT EXISTS idx_tournament_winners_user ON tournament_winners(user_id);

-- Titles/achievements awarded from tournament (top 3)
CREATE TABLE IF NOT EXISTS user_titles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_key VARCHAR(120) NOT NULL,
  week_start_utc TIMESTAMP NOT NULL,
  awarded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_titles_user_id ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_week ON user_titles(week_start_utc);

COMMENT ON TABLE player_tournament_stats IS 'Real-time tournament stats; weekly fields reset each week (Moscow Monday 00:00).';
COMMENT ON TABLE tournament_winners IS 'Top 3 per category per week (snapshot at week end).';
COMMENT ON TABLE user_titles IS 'Titles/achievements from tournament top 3.';
