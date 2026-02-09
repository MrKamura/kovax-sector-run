#!/usr/bin/env node
/**
 * Сброс всех ежедневных квестов для пользователя
 * Usage: node server/reset-user-quests.js [user_id]
 * Или: node server/reset-user-quests.js [nickname]
 */

const path = require("path");
const { Client } = require("pg");

const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env.local") });
require("dotenv").config({ path: path.join(projectRoot, ".env") });

async function resetQuests(userIdOrNickname) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local or .env in the project root.");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    let userId;
    
    // Проверяем, это user_id или nickname
    if (/^\d+$/.test(userIdOrNickname)) {
      // Это user_id
      userId = parseInt(userIdOrNickname, 10);
      console.log(`Resetting quests for user_id: ${userId}`);
    } else {
      // Это nickname, нужно найти user_id
      const userResult = await client.query(
        'SELECT id FROM users WHERE nickname = $1',
        [userIdOrNickname]
      );
      
      if (userResult.rows.length === 0) {
        console.error(`User with nickname "${userIdOrNickname}" not found.`);
        process.exit(1);
      }
      
      userId = userResult.rows[0].id;
      console.log(`Found user_id: ${userId} for nickname: ${userIdOrNickname}`);
    }
    
    // Проверяем, сколько квестов у пользователя
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM daily_quests WHERE user_id = $1',
      [userId]
    );
    const questCount = parseInt(countResult.rows[0].count, 10);
    console.log(`Found ${questCount} quest(s) for user_id ${userId}`);
    
    if (questCount === 0) {
      console.log("No quests to reset.");
      return;
    }
    
    // Удаляем все квесты пользователя
    const deleteResult = await client.query(
      'DELETE FROM daily_quests WHERE user_id = $1',
      [userId]
    );
    
    console.log(`✓ Successfully deleted ${deleteResult.rowCount} quest(s) for user_id ${userId}`);
    console.log("All daily quests have been reset. You can now take new quests.");
    
  } catch (err) {
    console.error("Error resetting quests:", err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

const userIdOrNickname = process.argv[2];
if (!userIdOrNickname) {
  console.error("Usage: node server/reset-user-quests.js [user_id or nickname]");
  console.error("Example: node server/reset-user-quests.js 6");
  console.error("Example: node server/reset-user-quests.js MyNickname");
  process.exit(1);
}

resetQuests(userIdOrNickname);
