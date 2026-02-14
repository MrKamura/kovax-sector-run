-- 015_add_player_mutations.sql
-- Mutation system: purchased skills, upgrade levels, one upgrade in progress (endsAt).

ALTER TABLE players ADD COLUMN IF NOT EXISTS mutations JSONB NOT NULL DEFAULT '{"purchasedSkills":[],"skillLevels":{},"upgradeInProgress":null}';

COMMENT ON COLUMN players.mutations IS 'Mutation state: purchasedSkills[], skillLevels{}, upgradeInProgress { skillId, endsAt }.';
