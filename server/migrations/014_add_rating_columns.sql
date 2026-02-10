-- 014_add_rating_columns.sql
-- General and weekly rating: points from PvE (by mob level), PvP (by victim level), social (quests).

ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_pve_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_pve_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_pvp_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_pvp_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_social_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_social_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_tournament_stats ADD COLUMN IF NOT EXISTS rating_week INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_rating_total ON player_tournament_stats(rating_total DESC);
CREATE INDEX IF NOT EXISTS idx_player_tournament_stats_rating_week ON player_tournament_stats(rating_week DESC);

COMMENT ON COLUMN player_tournament_stats.rating_pve_total IS 'Rating points from PvE (mob kills by level).';
COMMENT ON COLUMN player_tournament_stats.rating_pvp_total IS 'Rating points from PvP kills (by victim level).';
COMMENT ON COLUMN player_tournament_stats.rating_social_total IS 'Rating points from social (quest completions).';
COMMENT ON COLUMN player_tournament_stats.rating_total IS 'Sum of pve+pvp+social total.';
COMMENT ON COLUMN player_tournament_stats.rating_week IS 'Sum of pve+pvp+social week.';
