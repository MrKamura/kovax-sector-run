-- Persist player's current sector so they respawn in the same sector after restart.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS "sectorId" VARCHAR(32) REFERENCES sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_sector_id ON players("sectorId");
