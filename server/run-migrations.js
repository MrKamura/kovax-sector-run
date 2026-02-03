#!/usr/bin/env node
/**
 * Runs all SQL migrations from server/migrations in order.
 * Usage: npm run migrate  or  node server/run-migrations.js
 * Loads .env.local and .env from project root (DATABASE_URL).
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const projectRoot = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(projectRoot, ".env.local") });
require("dotenv").config({ path: path.join(projectRoot, ".env") });

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local or .env in the project root.");
    process.exit(1);
  }

  let files = [];
  try {
    files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (err) {
    console.error("Migrations dir read error:", err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log("Running:", file);
      await client.query(sql);
      console.log("OK:", file);
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
  console.log("Migrations finished.");
}

run();
