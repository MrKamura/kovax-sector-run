-- Сброс всех ежедневных квестов для пользователя
-- Замените USER_ID на ваш user_id (можно найти в таблице users)

-- Вариант 1: Удалить все квесты пользователя
-- DELETE FROM daily_quests WHERE user_id = USER_ID;

-- Вариант 2: Сбросить completed_at для всех квестов пользователя (чтобы они считались невыполненными)
-- UPDATE daily_quests SET completed_at = NULL WHERE user_id = USER_ID;

-- Вариант 3: Удалить все квесты пользователя за сегодня
-- DELETE FROM daily_quests 
-- WHERE user_id = USER_ID 
-- AND DATE(started_at) >= CURRENT_DATE;

-- Пример для user_id = 6 (замените на ваш):
-- DELETE FROM daily_quests WHERE user_id = 6;

-- Или сбросить только completed_at:
-- UPDATE daily_quests SET completed_at = NULL WHERE user_id = 6;
