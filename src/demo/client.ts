import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { ZodError } from "zod";
import { openWasmDatabase } from "../../shared/wasm-database";
import { StoreService } from "../../shared/service";
import { seed } from "../../shared/seed";
import type { AppState, Operation, OperationResult } from "../../shared/types";
import { openSnapshots, updateSnapshot } from "./persistence";

let runtime:
  Promise<[Awaited<ReturnType<typeof initSqlJs>>, IDBDatabase]> | undefined;
function ready() {
  runtime ??= Promise.all([
    initSqlJs({ locateFile: () => wasmUrl }),
    openSnapshots(indexedDB, "florist-market-demo-v1"),
  ]).catch((error) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}

export async function demoRequest(
  operation?: Operation,
  body?: unknown,
  requestId?: string,
) {
  try {
    const [SQL, snapshots] = await ready();
    return await updateSnapshot(snapshots, (bytes) => {
      const { db, raw } = openWasmDatabase(SQL, bytes);
      try {
        const service = new StoreService(db);
        if (!bytes) seed(service);
        const result = operation
          ? (service.execute(operation, body, requestId!) as OperationResult)
          : null;
        const state: AppState = {
          ...service.state(),
          csrfToken: "browser-demo",
        };
        return { bytes: raw.export(), result: { result, state } };
      } finally {
        db.close();
      }
    });
  } catch (error) {
    if (error instanceof ZodError)
      throw new Error(
        `Проверьте поля: ${error.issues.map((issue) => issue.message).join("; ")}`,
      );
    if (error instanceof DOMException)
      throw new Error(
        "Браузер не разрешил сохранить данные. Проверьте свободное место и доступ к хранилищу сайта.",
      );
    throw error;
  }
}
