/** Minimal synchronous SQL contract shared by native SQLite and the browser demo. */
export type SQLValue = string | number | null | Uint8Array;
export interface SqlDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    all(...params: SQLValue[]): Record<string, unknown>[];
    get(...params: SQLValue[]): Record<string, unknown> | undefined;
    run(...params: SQLValue[]): unknown;
  };
  close(): void;
}
export function initializeSchema(db: SqlDatabase) {
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, barcode TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT NOT NULL, size TEXT NOT NULL, color TEXT NOT NULL, colorHex TEXT NOT NULL,
      unit TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), minStock INTEGER NOT NULL,
      price INTEGER NOT NULL CHECK(price>=0), cost INTEGER NOT NULL CHECK(cost>=0));
    CREATE UNIQUE INDEX IF NOT EXISTS unique_barcode ON products(barcode) WHERE barcode<>'';
    CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, version INTEGER NOT NULL, labor INTEGER NOT NULL, overhead INTEGER NOT NULL, items TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS production (id TEXT PRIMARY KEY, number TEXT NOT NULL, productId TEXT NOT NULL REFERENCES products(id), recipeId TEXT NOT NULL REFERENCES recipes(id), quantity INTEGER NOT NULL CHECK(quantity>0), dueDate TEXT NOT NULL, status TEXT NOT NULL, recipe TEXT NOT NULL, materialCost INTEGER NOT NULL, totalCost INTEGER NOT NULL, createdAt TEXT NOT NULL, completedAt TEXT);
    CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, number TEXT NOT NULL, openedAt TEXT NOT NULL, closedAt TEXT, opening INTEGER NOT NULL, counted INTEGER, expected INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS single_open_shift ON shifts((1)) WHERE closedAt IS NULL;
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, number TEXT NOT NULL, shiftId TEXT NOT NULL REFERENCES shifts(id), payment TEXT NOT NULL, discount INTEGER NOT NULL, total INTEGER NOT NULL, cost INTEGER NOT NULL, customer TEXT NOT NULL, createdAt TEXT NOT NULL, items TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS returns (id TEXT PRIMARY KEY, saleId TEXT NOT NULL REFERENCES sales(id), shiftId TEXT NOT NULL REFERENCES shifts(id), total INTEGER NOT NULL, cost INTEGER NOT NULL, reason TEXT NOT NULL, createdAt TEXT NOT NULL, items TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, kind TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL, account TEXT NOT NULL, description TEXT NOT NULL, reference TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS debts (id TEXT PRIMARY KEY, party TEXT NOT NULL, direction TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), paid INTEGER NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=amount), dueDate TEXT NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, kind TEXT NOT NULL, reference TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity TEXT NOT NULL, detail TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
    PRAGMA user_version=1;
  `);
}
