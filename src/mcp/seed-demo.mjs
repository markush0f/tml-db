import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Run with Node (not Bun): DBHub also uses Node's built-in SQLite driver.
const filename = process.argv[2];
if (!filename) throw new Error("Missing demo database path");
mkdirSync(dirname(filename), { recursive: true });
const database = new DatabaseSync(filename);
try {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
    INSERT OR IGNORE INTO users (id, name, email) VALUES
      (1, 'Ana', 'ana@example.com'),
      (2, 'Luis', 'luis@example.com'),
      (3, 'Marta', 'marta@example.com');
  `);
} finally {
  database.close();
}
