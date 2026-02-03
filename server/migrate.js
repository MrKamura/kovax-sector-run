require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const migrationsDir = path.join(__dirname, "migrations");

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required for migrations.");
    process.exit(1);
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = await client.query(
    `SELECT id FROM schema_migrations ORDER BY id`
  );
  const appliedIds = new Set(applied.rows.map((row) => row.id));

  for (const file of files) {
    if (appliedIds.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (id) VALUES ($1)`,
        [file]
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Failed migration: ${file}`);
      throw error;
    }
  }

  await client.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
