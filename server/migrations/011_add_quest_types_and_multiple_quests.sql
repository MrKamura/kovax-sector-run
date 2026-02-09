-- 011_add_quest_types_and_multiple_quests.sql

-- 1. Удаляем старый уникальный индекс
DROP INDEX IF EXISTS daily_quests_user_id_sector_id_started_at_key;

-- 2. Добавляем поле quest_type если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_quests' AND column_name = 'quest_type'
    ) THEN
        ALTER TABLE daily_quests 
        ADD COLUMN quest_type VARCHAR(50) NOT NULL DEFAULT 'mob_kills';
    END IF;
END $$;

-- 3. Добавляем поле failed_at если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_quests' AND column_name = 'failed_at'
    ) THEN
        ALTER TABLE daily_quests 
        ADD COLUMN failed_at TIMESTAMP;
    END IF;
END $$;

-- 4. Удаляем CHECK ограничение если оно существует, чтобы не было конфликта
ALTER TABLE daily_quests 
DROP CONSTRAINT IF EXISTS valid_quest_type;

-- 5. Добавляем CHECK ограничение
ALTER TABLE daily_quests 
ADD CONSTRAINT valid_quest_type 
CHECK (quest_type IN ('mob_kills', 'pvp_kills'));

-- 6. Обновляем существующие записи, чтобы они имели тип mob_kills
UPDATE daily_quests SET quest_type = 'mob_kills' 
WHERE quest_type IS NULL OR quest_type = '' OR quest_type NOT IN ('mob_kills', 'pvp_kills');

-- 7. Удаляем старый индекс если он существует
DROP INDEX IF EXISTS idx_daily_quests_user_sector_type_date;

-- 8. Создаем новый уникальный индекс (вариант без DATE функции)
-- Используем частичный индекс для активных квестов
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_quests_user_sector_type_active 
ON daily_quests(user_id, sector_id, quest_type) 
WHERE completed_at IS NULL AND failed_at IS NULL;

-- 9. Создаем дополнительные индексы для оптимизации (если их еще нет)
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_id ON daily_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_quests_sector_id ON daily_quests(sector_id);
CREATE INDEX IF NOT EXISTS idx_daily_quests_quest_type ON daily_quests(quest_type);
CREATE INDEX IF NOT EXISTS idx_daily_quests_completed_at ON daily_quests(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_quests_failed_at ON daily_quests(failed_at) WHERE failed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_quests_expires_at ON daily_quests(expires_at);
CREATE INDEX IF NOT EXISTS idx_daily_quests_started_at ON daily_quests(started_at);