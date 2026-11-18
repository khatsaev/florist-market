import type { Database, SqlJsStatic } from "sql.js";
import type { SqlDatabase, SQLValue } from "./database";
import { initializeSchema } from "./database";

/** Statements are finalized immediately so export/close never retain native handles. */
export function wrapWasmDatabase(database: Database): SqlDatabase {
  return {
    exec(sql) {
      database.exec(sql);
    },
    close() {
      database.close();
    },
    prepare(sql) {
      function read(params: SQLValue[], first: boolean) {
        const statement = database.prepare(sql);
        try {
          statement.bind(params);
          const rows: Record<string, unknown>[] = [];
          while (statement.step()) {
            rows.push(statement.getAsObject());
            if (first) break;
          }
          return rows;
        } finally {
          statement.free();
        }
      }
      return {
        all: (...params) => read(params, false),
        get: (...params) => read(params, true)[0],
        run: (...params) => {
          database.run(sql, params);
        },
      };
    },
  };
}

export function openWasmDatabase(SQL: SqlJsStatic, bytes?: Uint8Array) {
  const raw = new SQL.Database(bytes);
  const db = wrapWasmDatabase(raw);
  try {
    initializeSchema(db);
    return { raw, db };
  } catch (error) {
    raw.close();
    throw error;
  }
}
