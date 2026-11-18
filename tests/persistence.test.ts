import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import initSqlJs from "sql.js";
import { openSnapshots, updateSnapshot } from "../src/demo/persistence";
import { openWasmDatabase } from "../shared/wasm-database";
import { StoreService } from "../shared/service";
import { seed } from "../shared/seed";

test("browser demo persists sales, returns and idempotency across database reload", async () => {
  const snapshots = await openSnapshots(new IDBFactory(), "test");
  const SQL = await initSqlJs();
  const use = <T>(fn: (service: StoreService) => T) =>
    updateSnapshot(snapshots, (previous) => {
      const { raw, db } = openWasmDatabase(SQL, previous);
      try {
        const service = new StoreService(db);
        if (!previous) seed(service);
        const result = fn(service);
        return { bytes: raw.export(), result };
      } finally {
        db.close();
      }
    });
  try {
    const before = await use((s) => s.state());
    const p = before.products.find(
      (p) => p.category === "box" && p.stock >= 3000,
    )!;
    const key = crypto.randomUUID();
    const body = {
      items: [{ productId: p.id, quantity: 2 }],
      discount: 10,
      payment: "card",
    };
    const result = await use(
      (s) => s.execute("sale.create", body, key) as { id: string },
    );
    const repeated = await use((s) => s.execute("sale.create", body, key));
    assert.deepEqual(repeated, result);
    const after = await use((s) => s.state());
    assert.equal(after.sales.length, before.sales.length + 1);
    assert.equal(
      after.products.find((v) => v.id === p.id)!.stock,
      p.stock - 2000,
    );
    await use((s) =>
      s.execute(
        "sale.return",
        {
          saleId: result.id,
          items: [{ productId: p.id, quantity: 1 }],
          reason: "Проверка",
        },
        crypto.randomUUID(),
      ),
    );
    const restored = await use((s) => s.state());
    assert.equal(
      restored.products.find((v) => v.id === p.id)!.stock,
      p.stock - 1000,
    );
    assert.equal(restored.returns.length, before.returns.length + 1);
    await assert.rejects(
      use((s) =>
        s.execute(
          "sale.create",
          { ...body, items: [{ productId: p.id, quantity: 999999 }] },
          crypto.randomUUID(),
        ),
      ),
      /Недостаточно/,
    );
    assert.equal(
      (await use((s) => s.state())).sales.length,
      after.sales.length,
    );
  } finally {
    snapshots.close();
  }
});

test("concurrent tabs serialize updates instead of overwriting a stale snapshot", async () => {
  const factory = new IDBFactory();
  const a = await openSnapshots(factory, "shared");
  const b = await openSnapshots(factory, "shared");
  try {
    const update = (db: IDBDatabase) =>
      updateSnapshot(db, (previous) => {
        const value = (previous?.[0] ?? 0) + 1;
        return { bytes: new Uint8Array([value]), result: value };
      });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => update(i % 2 ? a : b)),
    );
    assert.deepEqual(
      results,
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  } finally {
    a.close();
    b.close();
  }
});

test("failed computation aborts persistence and preserves the prior snapshot", async () => {
  const db = await openSnapshots(new IDBFactory(), "rollback");
  try {
    await updateSnapshot(db, () => ({ bytes: new Uint8Array([7]), result: 7 }));
    await assert.rejects(
      updateSnapshot(db, () => {
        throw new Error("storage failure");
      }),
      /storage failure/,
    );
    const value = await updateSnapshot(db, (bytes) => ({
      bytes: bytes!,
      result: bytes![0],
    }));
    assert.equal(value, 7);
  } finally {
    db.close();
  }
});
