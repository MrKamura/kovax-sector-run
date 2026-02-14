-- 009_add_daily_quests.sql - Упрощенная версия
-- Добавляем поддержку нескольких типов квестов

-- 0. Создаем таблицу если не существует (для чистой БД)
CREATE TABLE IF NOT EXISTS daily_quests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  sector_id VARCHAR(255) NOT NULL,
  quest_type VARCHAR(50) NOT NULL DEFAULT 'mob_kills',
  kills_required INTEGER NOT NULL DEFAULT 20,
  kills_completed INTEGER NOT NULL DEFAULT 0,
  time_limit_minutes INTEGER NOT NULL DEFAULT 15,
  started_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  reward_exp INTEGER NOT NULL DEFAULT 250,
  reward_tokens INTEGER NOT NULL DEFAULT 75,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 1. Удаляем старые индексы
DROP INDEX IF EXISTS daily_quests_user_id_sector_id_started_at_key;

-- 2. Добавляем новые поля
ALTER TABLE daily_quests 
  ADD COLUMN IF NOT EXISTS quest_type VARCHAR(50) NOT NULL DEFAULT 'mob_kills';

ALTER TABLE daily_quests 
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

-- 3. Добавляем CHECK ограничение отдельно
ALTER TABLE daily_quests 
  DROP CONSTRAINT IF EXISTS valid_quest_type;

ALTER TABLE daily_quests 
  ADD CONSTRAINT valid_quest_type 
  CHECK (quest_type IN ('mob_kills', 'pvp_kills'));

-- 4. Обновляем существующие записи
UPDATE daily_quests SET quest_type = 'mob_kills' WHERE quest_type IS NULL OR quest_type = '';

-- 5. Создаем новый уникальный индекс (без проверки даты, только на активные квесты)
-- Этот индекс предотвращает несколько активных квестов одного типа в одном секторе
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_quests_unique_active 
  ON daily_quests(user_id, sector_id, quest_type) 
  WHERE completed_at IS NULL AND failed_at IS NULL;

-- 6. Создаем другие полезные индексы
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_sector ON daily_quests(user_id, sector_id);
CREATE INDEX IF NOT EXISTS idx_daily_quests_user_quest_type ON daily_quests(user_id, quest_type);
CREATE INDEX IF NOT EXISTS idx_daily_quests_expires_at ON daily_quests(expires_at);
CREATE INDEX IF NOT EXISTS idx_daily_quests_started_at ON daily_quests(started_at);