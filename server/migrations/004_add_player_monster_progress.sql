ALTER TABLE players
  ADD COLUMN IF NOT EXISTS "monsterProgress" JSONB NOT NULL DEFAULT '{}'::jsonb;
