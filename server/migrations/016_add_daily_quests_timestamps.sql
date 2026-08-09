-- Add created_at and updated_at to daily_quests if missing (Sequelize timestamps)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_quests' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE daily_quests ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'daily_quests' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE daily_quests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;
