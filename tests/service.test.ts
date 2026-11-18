import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db";
import { StoreService } from "../server/service";
import { metrics } from "../src/lib";
import type { Operation, AppState } from "../shared/types";
import initSqlJs from "sql.js";
import { openWasmDatabase } from "../shared/wasm-database";

const wasm =
  process.env.TEST_SQL_DRIVER === "wasm" ? await initSqlJs() : undefined;

function fixture() {
  const db = wasm ? openWasmDatabase(wasm).db : openDatabase(":memory:");
  let date = new Date("2026-11-18T08:00:00Z");
  const s = new StoreService(db, () => date);
  const op = (kind: Operation, body: unknown, key = randomUUID()) =>
    s.execute(kind, body, key) as { id: string };
  const product = (
    sku: string,
    category = "box",
    cost = 10000,
    price = 25000,
    unit = "шт",
  ) =>
    op("product.save", {
      sku,
      name: sku,
      barcode: "",
      category,
      size: "20×20",
      color: "Роза",
      colorHex: "#bd919d",
      unit,
      minStock: 1000,
      price,
      cost,
    }).id;
  const p = product("BOX");
  const m = product("RAW", "material", 5000, 0, "м²");
  op("stock.adjust", {
    productId: p,
    kind: "receipt",
    quantity: 10000,
    unitCost: 10000,
    reason: "Начальный остаток",
  });
  op("stock.adjust", {
    productId: m,
    kind: "receipt",
    quantity: 20000,
    unitCost: 5000,
    reason: "Начальный остаток",
  });
  const r = op("recipe.save", {
    productId: p,
    name: "Рецепт",
    labor: 1000,
    overhead: 500,
    items: [{ materialId: m, quantity: 2000 }],
  }).id;
  return {
    db,
    s,
    op,
    p,
    m,
    r,
    product,
    setTime: (d: string) => (date = new Date(d)),
  };
}
function withFixture(fn: (f: ReturnType<typeof fixture>) => void) {
  const f = fixture();
  try {
    fn(f);
  } finally {
    f.db.close();
  }
}
test("production writes off raw materials, freezes costs and capitalizes output", () =>
  withFixture(({ op, p, m, r, s }) => {
    const o = op("production.create", {
      recipeId: r,
      quantity: 3,
      dueDate: "2026-11-19",
    }).id;
    op("production.start", { id: o });
    assert.equal(s.product(m).stock, 14000);
    assert.equal(s.product(p).stock, 10000);
    assert.equal(s.order(o).materialCost, 30000);
    op("production.complete", { id: o });
    assert.equal(s.product(p).stock, 13000);
    assert.equal(s.order(o).totalCost, 34500);
    assert.equal(
      s.product(p).cost,
      Math.round((10000 * 10000 + 34500 * 1000) / 13000),
    );
    assert.throws(() => op("production.complete", { id: o }), /Сначала/);
    assert.equal(s.product(p).stock, 13000);
  }));
test("insufficient production materials rolls back earlier material writes", () =>
  withFixture(({ op, p, m, s, product }) => {
    const m2 = product("EMPTY", "material", 200, 0);
    const r = op("recipe.save", {
      productId: p,
      name: "Two materials",
      labor: 0,
      overhead: 0,
      items: [
        { materialId: m, quantity: 1000 },
        { materialId: m2, quantity: 1000 },
      ],
    }).id;
    const o = op("production.create", {
      recipeId: r,
      quantity: 1,
      dueDate: "2026-11-20",
    }).id;
    const count = s.state().movements.length;
    assert.throws(() => op("production.start", { id: o }), /Недостаточно/);
    assert.equal(s.product(m).stock, 20000);
    assert.equal(s.state().movements.length, count);
    assert.equal(s.order(o).status, "planned");
  }));
test("recipe version edits never change existing production snapshots", () =>
  withFixture(({ op, p, m, r, s }) => {
    const o = op("production.create", {
      recipeId: r,
      quantity: 1,
      dueDate: "2026-11-19",
    }).id;
    op("recipe.save", {
      id: r,
      productId: p,
      name: "Изменён",
      labor: 9999,
      overhead: 0,
      items: [{ materialId: m, quantity: 4000 }],
    });
    assert.equal(s.recipe(r).version, 2);
    assert.equal(s.order(o).recipe.version, 1);
    assert.equal(s.order(o).recipe.labor, 1000);
  }));
test("weighted receipt cost and inventory count", () =>
  withFixture(({ op, p, s }) => {
    op("stock.adjust", {
      productId: p,
      kind: "receipt",
      quantity: 10000,
      unitCost: 20000,
      reason: "Новая поставка",
      paid: true,
    });
    assert.equal(s.product(p).cost, 15000);
    op("stock.adjust", {
      productId: p,
      kind: "inventory",
      quantity: 18000,
      unitCost: 15000,
      reason: "Пересчёт",
    });
    assert.equal(s.product(p).stock, 18000);
    assert.equal(
      s.state().ledger.find((l) => l.kind === "stock")!.amount,
      -200000,
    );
    assert.equal(
      s.state().ledger.find((l) => l.category === "Списание запасов")!.amount,
      -30000,
    );
  }));
test("writeoff cannot produce negative stock or ledger entries", () =>
  withFixture(({ op, p, s }) => {
    assert.throws(
      () =>
        op("stock.adjust", {
          productId: p,
          kind: "writeoff",
          quantity: 11000,
          unitCost: 100,
          reason: "Ошибка",
        }),
      /Недостаточно/,
    );
    assert.equal(s.product(p).stock, 10000);
    assert.equal(s.state().ledger.length, 0);
  }));
test("sale requires a shift and cannot sell material", () =>
  withFixture(({ op, p, m, s }) => {
    assert.throws(
      () =>
        op("sale.create", {
          items: [{ productId: p, quantity: 1 }],
          discount: 0,
          payment: "card",
        }),
      /Откройте/,
    );
    op("shift.open", { opening: 0 });
    assert.throws(
      () =>
        op("sale.create", {
          items: [{ productId: m, quantity: 1 }],
          discount: 0,
          payment: "card",
        }),
      /Сырьё/,
    );
    assert.equal(s.state().sales.length, 0);
  }));
test("sale discount and partial returns use immutable original prices and costs", () =>
  withFixture(({ op, p, s }) => {
    op("shift.open", { opening: 0 });
    const id = op("sale.create", {
      items: [{ productId: p, quantity: 3 }],
      discount: 15,
      payment: "card",
    }).id;
    assert.equal(s.sale(id).total, 63750);
    const product = s.product(p);
    op("product.save", { ...product, price: 99000, cost: 99000 });
    op("stock.adjust", {
      productId: p,
      kind: "receipt",
      quantity: 7000,
      unitCost: 30000,
      reason: "Изменение стоимости",
    });
    assert.equal(s.product(p).cost, 20000);
    op("sale.return", {
      saleId: id,
      items: [{ productId: p, quantity: 1 }],
      reason: "Размер",
    });
    assert.equal(s.state().returns[0].total, 21250);
    assert.equal(s.state().returns[0].cost, 10000);
    assert.equal(s.sale(id).items[0].returned, 1);
    assert.equal(
      s.product(p).cost,
      Math.round((14000 * 20000 + 1000 * 10000) / 15000),
    );
    op("sale.return", {
      saleId: id,
      items: [{ productId: p, quantity: 2 }],
      reason: "Остаток",
    });
    assert.throws(
      () =>
        op("sale.return", {
          saleId: id,
          items: [{ productId: p, quantity: 1 }],
          reason: "Повтор",
        }),
      /превышает/,
    );
    assert.equal(
      s.state().returns.reduce((v, r) => v + r.total, 0),
      63750,
    );
  }));
test("idempotency prevents double sales and rejects changed payload", () =>
  withFixture(({ op, p, s }) => {
    op("shift.open", { opening: 0 });
    const key = randomUUID();
    const body = {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "sbp",
    };
    const a = op("sale.create", body, key);
    const b = op("sale.create", body, key);
    assert.equal(a.id, b.id);
    assert.equal(s.state().sales.length, 1);
    assert.equal(s.product(p).stock, 9000);
    assert.throws(
      () => op("sale.create", { ...body, discount: 5 }, key),
      /Ключ/,
    );
  }));
test("failed basket rolls back all items and cash entries", () =>
  withFixture(({ op, p, s, product }) => {
    op("shift.open", { opening: 0 });
    const empty = product("EMPTY");
    assert.throws(
      () =>
        op("sale.create", {
          items: [
            { productId: p, quantity: 1 },
            { productId: empty, quantity: 1 },
          ],
          discount: 0,
          payment: "cash",
        }),
      /Недостаточно/,
    );
    assert.equal(s.product(p).stock, 10000);
    assert.equal(s.state().sales.length, 0);
    assert.equal(s.state().ledger.length, 0);
  }));
test("same product cannot appear twice in sale or BOM", () =>
  withFixture(({ op, p, m }) => {
    op("shift.open", { opening: 0 });
    assert.throws(
      () =>
        op("sale.create", {
          items: [
            { productId: p, quantity: 1 },
            { productId: p, quantity: 1 },
          ],
          discount: 0,
          payment: "cash",
        }),
      /Объедините/,
    );
    assert.throws(
      () =>
        op("recipe.save", {
          productId: p,
          name: "bad",
          labor: 0,
          overhead: 0,
          items: [
            { materialId: m, quantity: 1000 },
            { materialId: m, quantity: 1000 },
          ],
        }),
      /повторяется/,
    );
  }));
test("shift balances include cash only and record discrepancy", () =>
  withFixture(({ op, p, s }) => {
    const shift = op("shift.open", { opening: 50000 }).id;
    op("sale.create", {
      items: [{ productId: p, quantity: 2 }],
      discount: 0,
      payment: "cash",
    });
    op("sale.create", {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "card",
    });
    assert.equal(s.cashExpected(shift), 100000);
    op("shift.close", { counted: 99000 });
    const closed = s.state().shifts[0];
    assert.equal(closed.expected, 100000);
    assert.equal(closed.counted, 99000);
    assert.ok(closed.closedAt);
  }));
test("24-hour shift boundary blocks sale and refund but permits closing", () =>
  withFixture(({ op, p, setTime, s }) => {
    op("shift.open", { opening: 0 });
    const sale = op("sale.create", {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "card",
    }).id;
    setTime("2026-11-19T08:00:00Z");
    assert.throws(
      () =>
        op("sale.create", {
          items: [{ productId: p, quantity: 1 }],
          discount: 0,
          payment: "card",
        }),
      /24 часа/,
    );
    assert.throws(
      () =>
        op("sale.return", {
          saleId: sale,
          items: [{ productId: p, quantity: 1 }],
          reason: "Возврат",
        }),
      /24 часа/,
    );
    op("shift.close", { counted: 0 });
    assert.ok(s.state().shifts[0].closedAt);
  }));
test("only one open shift, historical cash refund uses current shift", () =>
  withFixture(({ op, p, s, setTime }) => {
    op("shift.open", { opening: 0 });
    assert.throws(() => op("shift.open", { opening: 0 }), /Уже/);
    const sale = op("sale.create", {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "cash",
    }).id;
    op("shift.close", { counted: 25000 });
    setTime("2026-11-19T08:00:00Z");
    const shift = op("shift.open", { opening: 30000 }).id;
    op("sale.return", {
      saleId: sale,
      items: [{ productId: p, quantity: 1 }],
      reason: "Возврат на следующий день",
    });
    assert.equal(s.state().returns[0].shiftId, shift);
    assert.equal(s.cashExpected(shift), 5000);
  }));
test("cash refund with insufficient funds is fully rolled back", () =>
  withFixture(({ op, p, s }) => {
    op("shift.open", { opening: 0 });
    const sale = op("sale.create", {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "cash",
    }).id;
    op("shift.close", { counted: 25000 });
    op("shift.open", { opening: 0 });
    assert.throws(
      () =>
        op("sale.return", {
          saleId: sale,
          items: [{ productId: p, quantity: 1 }],
          reason: "Возврат",
        }),
      /Недостаточно наличных/,
    );
    assert.equal(s.product(p).stock, 9000);
    assert.equal(s.sale(sale).items[0].returned, 0);
    assert.equal(s.state().returns.length, 0);
  }));
test("partial debt settlement cannot exceed balance or create duplicate income", () =>
  withFixture(({ op, s }) => {
    const id = op("debt.create", {
      party: "Клиент",
      direction: "receivable",
      amount: 10000,
      dueDate: "2026-11-20",
    }).id;
    op("debt.pay", { id, amount: 3000 });
    assert.equal(s.state().debts[0].paid, 3000);
    assert.throws(() => op("debt.pay", { id, amount: 8000 }), /превышает/);
    const m = metrics(
      { ...s.state(), csrfToken: "" } as AppState,
      "2026-11-18",
      "2026-11-18",
    );
    assert.equal(m.incoming, 3000);
    assert.equal(m.profit, 0);
  }));
test("stock purchases do not reduce profit until sale; writeoffs are noncash expenses", () =>
  withFixture(({ op, p, s }) => {
    op("stock.adjust", {
      productId: p,
      kind: "receipt",
      quantity: 1000,
      unitCost: 10000,
      reason: "Поставка",
      paid: true,
    });
    op("stock.adjust", {
      productId: p,
      kind: "writeoff",
      quantity: 1000,
      unitCost: 0,
      reason: "Брак",
    });
    const m = metrics(
      { ...s.state(), csrfToken: "" } as AppState,
      "2026-11-18",
      "2026-11-18",
    );
    assert.equal(m.outgoing, 10000);
    assert.equal(m.expenses, 10000);
    assert.equal(m.profit, -10000);
  }));
test("SKU, barcode, nonnegative money, valid dates, and whole unit stock are validated", () =>
  withFixture(({ op, p, s, product }) => {
    assert.throws(() => product("BOX"), /SKU/);
    assert.throws(
      () =>
        op("stock.adjust", {
          productId: p,
          kind: "receipt",
          quantity: 500,
          unitCost: 10,
          reason: "bad",
        }),
      /целым/,
    );
    assert.throws(() =>
      op("finance.create", {
        kind: "expense",
        category: "Расход",
        amount: -1,
        description: "bad",
      }),
    );
    assert.throws(() =>
      op("debt.create", {
        party: "Client",
        direction: "payable",
        amount: 100,
        dueDate: "2026-02-30",
      }),
    );
    const original = s.product(p);
    op("product.save", { ...original, barcode: "123" });
    const second = product("BOX2");
    assert.throws(
      () => op("product.save", { ...s.product(second), barcode: "123" }),
      /Штрихкод/,
    );
  }));
test("production cancellation is limited to planned orders", () =>
  withFixture(({ op, r, s }) => {
    const o = op("production.create", {
      recipeId: r,
      quantity: 1,
      dueDate: "2026-11-19",
    }).id;
    op("production.cancel", { id: o });
    assert.equal(s.order(o).status, "cancelled");
    assert.throws(() => op("production.start", { id: o }), /отменён/);
    const o2 = op("production.create", {
      recipeId: r,
      quantity: 1,
      dueDate: "2026-11-19",
    }).id;
    op("production.start", { id: o2 });
    assert.throws(() => op("production.cancel", { id: o2 }), /только до/);
  }));
test("database persists all operations after reopening", () => {
  const dir = mkdtempSync(join(tmpdir(), "florist-test-"));
  try {
    const path = join(dir, "db.sqlite");
    let db = openDatabase(path);
    let s = new StoreService(db);
    const id = (
      s.execute(
        "product.save",
        {
          sku: "KEEP",
          barcode: "",
          name: "Saved",
          category: "box",
          size: "",
          color: "",
          colorHex: "#aabbcc",
          unit: "шт",
          minStock: 0,
          price: 100,
          cost: 50,
        },
        randomUUID(),
      ) as { id: string }
    ).id;
    db.close();
    db = openDatabase(path);
    s = new StoreService(db);
    assert.equal(s.product(id).sku, "KEEP");
    assert.equal(s.state().audit.length, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("return is reported on return date with original historical cost", () =>
  withFixture(({ op, p, s, setTime }) => {
    op("shift.open", { opening: 0 });
    const sale = op("sale.create", {
      items: [{ productId: p, quantity: 1 }],
      discount: 0,
      payment: "card",
    }).id;
    op("shift.close", { counted: 0 });
    setTime("2026-11-19T08:00:00Z");
    op("shift.open", { opening: 0 });
    op("sale.return", {
      saleId: sale,
      items: [{ productId: p, quantity: 1 }],
      reason: "Return",
    });
    const state = { ...s.state(), csrfToken: "" } as AppState;
    assert.equal(metrics(state, "2026-11-18", "2026-11-18").profit, 15000);
    assert.equal(metrics(state, "2026-11-19", "2026-11-19").profit, -15000);
    assert.equal(metrics(state, "2026-11-18", "2026-11-19").profit, 0);
  }));
