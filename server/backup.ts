import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const source = resolve(process.env.DB_PATH ?? "data/florist.sqlite");
if (!existsSync(source))
  throw new Error("База ещё не создана. Сначала запустите приложение.");
mkdirSync("backups", { recursive: true });
const file = resolve(
  "backups",
  `florist-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`,
);
const db = new DatabaseSync(source);
db.prepare("VACUUM INTO ?").run(file);
db.close();
console.log(`Резервная копия: ${file}`);
