import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { openDatabase } from "../server/db";
import { openWasmDatabase } from "../shared/wasm-database";
import { StoreService } from "../shared/service";
import { parseProductImport, MAX_IMPORT_BYTES } from "../shared/product-import";
import type { OperationResult } from "../shared/types";

const catalog = parseProductImport(
  readFileSync(
    new URL("../public/imports/florist-market-catalog.json", import.meta.url),
    "utf8",
  ),
);
const wasm =
  process.env.TEST_SQL_DRIVER === "wasm" ? await initSqlJs() : undefined;
function fixture(run: (service: StoreService) => void) {
  const db = wasm ? openWasmDatabase(wasm).db : openDatabase(":memory:");
  try {
    run(new StoreService(db, () => new Date("2026-11-20T12:00:00Z")));
  } finally {
    db.close();
  }
}

test("catalog import adds all 57 cards without stock or financial movements and retries safely", () =>
  fixture((s) => {
    assert.equal(catalog.products.length, 57);
    assert.equal(new Set(catalog.products.map((p) => p.sku)).size, 57);
    assert.deepEqual(
      Object.fromEntries(
        ["PL", "BP", "JN", "TS", "LZ", "BN"].map((prefix) => [
          prefix,
          catalog.products.filter((p) => p.sku.startsWith(prefix)).length,
        ]),
      ),
      { PL: 27, BP: 1, JN: 3, TS: 10, LZ: 6, BN: 10 },
    );
    const requestId = randomUUID();
    const result = s.execute(
      "product.import",
      catalog,
      requestId,
    ) as OperationResult;
    assert.equal(result.imported?.length, 57);
    assert.deepEqual(result.skipped, []);
    const after = s.state();
    assert.equal(after.products.length, 57);
    for (const source of catalog.products) {
      const actual = after.products.find((p) => p.sku === source.sku)!;
      assert.ok(actual.id);
      const { id: _id, stock, ...fields } = actual;
      assert.equal(stock, 0);
      assert.deepEqual(fields, source);
    }
    assert.equal(after.movements.length, 0);
    assert.equal(after.ledger.length, 0);
    assert.equal(after.sales.length, 0);
    assert.deepEqual(s.execute("product.import", catalog, requestId), result);
    assert.deepEqual(s.state(), after);
  }));

test("repeat import skips existing SKUs and preserves prices, stock and other records", () =>
  fixture((s) => {
    const original = {
      ...catalog.products[0],
      price: 35000,
      cost: 12000,
      name: "Название владельца",
    };
    const { id } = s.execute(
      "product.save",
      original,
      randomUUID(),
    ) as OperationResult;
    s.execute(
      "stock.adjust",
      {
        productId: id,
        kind: "receipt",
        quantity: 5000,
        unitCost: 12000,
        reason: "Проверка",
      },
      randomUUID(),
    );
    const before = s.state();
    const result = s.execute(
      "product.import",
      catalog,
      randomUUID(),
    ) as OperationResult;
    assert.equal(result.imported?.length, 56);
    assert.deepEqual(result.skipped, [original.sku]);
    assert.deepEqual(s.product(id), before.products[0]);
    assert.deepEqual(s.state().movements, before.movements);
    assert.deepEqual(s.state().ledger, before.ledger);
    const all = s.state().products;
    const repeat = s.execute(
      "product.import",
      catalog,
      randomUUID(),
    ) as OperationResult;
    assert.deepEqual(repeat.imported, []);
    assert.equal(repeat.skipped?.length, 57);
    assert.deepEqual(s.state().products, all);
  }));

test("invalid rows, duplicate keys and existing barcode conflicts leave no partial import", () =>
  fixture((s) => {
    s.execute(
      "product.save",
      { ...catalog.products[0], sku: "EXISTING", barcode: "12345" },
      randomUUID(),
    );
    const before = s.state();
    const first = catalog.products[0];
    const second = catalog.products[1];
    for (const products of [
      [first, { ...second, price: -1 }],
      [first, { ...second, id: "must-not-update" }],
      [first, { ...second, stock: 10000 }],
      [first, { ...second, unit: "м" }],
      [first, { ...second, sku: ` ${first.sku} ` }],
      [
        { ...first, barcode: "999" },
        { ...second, barcode: "999" },
      ],
      [first, { ...second, barcode: "12345" }],
    ]) {
      assert.throws(() =>
        s.execute("product.import", { version: 1, products }, randomUUID()),
      );
      assert.deepEqual(s.state(), before);
    }
    assert.equal(s.all("SELECT * FROM requests").length, 1);
  }));

test("database failure after an earlier insertion rolls back cards, audit and request key", () =>
  fixture((s) => {
    const before = s.state();
    s.db.exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON products WHEN NEW.sku='PL002' BEGIN SELECT RAISE(ABORT, 'test import failure'); END;",
    );
    const key = randomUUID();
    assert.throws(
      () => s.execute("product.import", catalog, key),
      /test import failure/,
    );
    assert.deepEqual(s.state(), before);
    assert.equal(s.all("SELECT * FROM requests").length, 0);
    s.db.exec("DROP TRIGGER fail_import");
    assert.equal(
      (s.execute("product.import", catalog, key) as OperationResult).imported
        ?.length,
      57,
    );
  }));

test("file parser rejects malformed, oversized, unsupported and empty input", () => {
  for (const input of [
    "{",
    "null",
    JSON.stringify({ ...catalog, version: 2 }),
    JSON.stringify({ version: 1, products: [] }),
    JSON.stringify({
      version: 1,
      products: Array(101).fill(catalog.products[0]),
    }),
    " ".repeat(MAX_IMPORT_BYTES + 1),
  ]) {
    assert.throws(() => parseProductImport(input));
  }
  assert.deepEqual(
    parseProductImport("\uFEFF" + JSON.stringify(catalog)),
    catalog,
  );
});
