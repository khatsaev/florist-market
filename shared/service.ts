import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
const randomUUID = () => globalThis.crypto.randomUUID();
import type { SqlDatabase, SQLValue } from "./database";
import { z } from "zod";
import {
  productSchema,
  productImportSchema,
  planProductImport,
  ProductImportError,
} from "./product-import";
import type {
  Product,
  Recipe,
  Production,
  Sale,
  SaleItem,
  Shift,
  Debt,
  AppState,
  Operation,
  LedgerEntry,
} from "./types";

const id = z.string().min(1).max(80);
const text = z.string().trim().min(1).max(150);
const money = z.number().int().min(0).max(100_000_000);
const positiveMoney = money.refine(
  (v) => v > 0,
  "Сумма должна быть больше нуля",
);
const quantity = z.number().int().min(1).max(1_000_000);
const scaledQuantity = z.number().int().min(1).max(1_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(new Date(v).getTime()) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Некорректная дата",
  );
const note = z.string().trim().max(500).default("");
const recipeSchema = z.object({
  id: id.optional(),
  productId: id,
  name: text,
  labor: money,
  overhead: money,
  items: z
    .array(z.object({ materialId: id, quantity: scaledQuantity }))
    .min(1)
    .max(30),
});
const saleSchema = z.object({
  items: z
    .array(z.object({ productId: id, quantity }))
    .min(1)
    .max(100),
  discount: z.number().int().min(0).max(100),
  payment: z.enum(["cash", "card", "sbp"]),
  customer: z.string().trim().max(150).default("Розничный покупатель"),
});
export class DomainError extends Error {}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message);
}
function safe(value: number) {
  ensure(
    Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000_000,
    "Сумма операции слишком велика",
  );
  return value;
}

/** All mutations execute in a single SQLite transaction, including idempotency and audit. */
export class StoreService {
  constructor(
    public db: SqlDatabase,
    private clock: () => Date = () => new Date(),
  ) {}
  now() {
    return this.clock().toISOString();
  }
  all<T>(sql: string, ...params: SQLValue[]): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }
  get<T>(sql: string, ...params: SQLValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as unknown as T | undefined;
  }
  run(sql: string, ...params: SQLValue[]) {
    return this.db.prepare(sql).run(...params);
  }
  insert(table: string, row: Record<string, SQLValue>) {
    const keys = Object.keys(row);
    this.run(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      ...Object.values(row),
    );
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  product(productId: string) {
    const p = this.get<Product>("SELECT * FROM products WHERE id=?", productId);
    ensure(p, "Товар не найден");
    return p;
  }
  recipe(recipeId: string) {
    const r = this.get<Omit<Recipe, "items"> & { items: string }>(
      "SELECT * FROM recipes WHERE id=?",
      recipeId,
    );
    ensure(r, "Спецификация не найдена");
    return { ...r, items: JSON.parse(r.items) } as Recipe;
  }
  order(orderId: string) {
    const p = this.get<Omit<Production, "recipe"> & { recipe: string }>(
      "SELECT * FROM production WHERE id=?",
      orderId,
    );
    ensure(p, "Заказ не найден");
    return { ...p, recipe: JSON.parse(p.recipe) } as Production;
  }
  sale(saleId: string) {
    const s = this.get<Omit<Sale, "items"> & { items: string }>(
      "SELECT * FROM sales WHERE id=?",
      saleId,
    );
    ensure(s, "Продажа не найдена");
    return { ...s, items: JSON.parse(s.items) } as Sale;
  }
  shift() {
    const s = this.get<Shift>("SELECT * FROM shifts WHERE closedAt IS NULL");
    ensure(s, "Откройте кассовую смену");
    ensure(
      this.clock().getTime() - new Date(s.openedAt).getTime() <
        24 * 60 * 60 * 1000,
      "Смена длится 24 часа или больше. Закройте её и откройте новую",
    );
    return s;
  }
  audit(action: string, entity: string, detail: string) {
    this.insert("audit", {
      id: randomUUID(),
      action,
      entity,
      detail,
      createdAt: this.now(),
    });
  }
  move(productId: string, delta: number, kind: string, reference: string) {
    const p = this.product(productId);
    safe(delta);
    ensure(p.stock + delta >= 0, `Недостаточно остатка: ${p.name} (${p.sku})`);
    this.run("UPDATE products SET stock=stock+? WHERE id=?", delta, productId);
    this.insert("movements", {
      id: randomUUID(),
      productId,
      quantity: delta,
      kind,
      reference,
      createdAt: this.now(),
    });
  }
  ledger(
    kind: LedgerEntry["kind"],
    category: string,
    amount: number,
    account: "cash" | "bank",
    description: string,
    reference: string,
  ) {
    safe(amount);
    this.insert("ledger", {
      id: randomUUID(),
      kind,
      category,
      amount,
      account,
      description,
      reference,
      createdAt: this.now(),
    });
  }
  cashExpected(shiftId: string) {
    const s = this.get<Shift>("SELECT * FROM shifts WHERE id=?", shiftId);
    ensure(s, "Смена не найдена");
    const saleTotal = this.get<{ v: number }>(
      "SELECT COALESCE(SUM(total),0) v FROM sales WHERE shiftId=? AND payment='cash'",
      shiftId,
    )!.v;
    const returnTotal = this.get<{ v: number }>(
      "SELECT COALESCE(SUM(r.total),0) v FROM returns r JOIN sales s ON r.saleId=s.id WHERE r.shiftId=? AND s.payment='cash'",
      shiftId,
    )!.v;
    return s.opening + saleTotal - returnTotal;
  }
  execute(operation: Operation, body: unknown, requestId: string) {
    z.string().uuid().parse(requestId);
    const fingerprint = bytesToHex(
      sha256(utf8ToBytes(JSON.stringify({ operation, body }))),
    );
    return this.transaction(() => {
      const prior = this.get<{ fingerprint: string; result: string }>(
        "SELECT * FROM requests WHERE id=?",
        requestId,
      );
      if (prior) {
        ensure(
          prior.fingerprint === fingerprint,
          "Ключ повторной операции уже использован с другими данными",
        );
        return JSON.parse(prior.result);
      }
      let result: unknown;
      switch (operation) {
        case "product.save":
          result = this.saveProduct(body);
          break;
        case "product.import":
          result = this.importProducts(body, requestId);
          break;
        case "stock.adjust":
          result = this.adjustStock(body);
          break;
        case "recipe.save":
          result = this.saveRecipe(body);
          break;
        case "production.create":
          result = this.createProduction(body);
          break;
        case "production.start":
          result = this.startProduction(body);
          break;
        case "production.complete":
          result = this.completeProduction(body);
          break;
        case "production.cancel":
          result = this.cancelProduction(body);
          break;
        case "shift.open":
          result = this.openShift(body);
          break;
        case "shift.close":
          result = this.closeShift(body);
          break;
        case "sale.create":
          result = this.createSale(body);
          break;
        case "sale.return":
          result = this.returnSale(body);
          break;
        case "finance.create":
          result = this.createFinance(body);
          break;
        case "debt.create":
          result = this.createDebt(body);
          break;
        case "debt.pay":
          result = this.payDebt(body);
          break;
        default:
          throw new DomainError("Неизвестная операция");
      }
      this.insert("requests", {
        id: requestId,
        fingerprint,
        result: JSON.stringify(result),
      });
      return result;
    });
  }
  importProducts(body: unknown, requestId: string) {
    const batch = productImportSchema.parse(body);
    try {
      const plan = planProductImport(
        batch,
        this.all<Product>("SELECT * FROM products"),
      );
      for (const product of plan.added) this.saveProduct(product);
      this.audit(
        "Импорт товаров",
        requestId,
        `Добавлено: ${plan.added.length}; пропущено: ${plan.skipped.length}`,
      );
      return {
        id: requestId,
        imported: plan.added.map((p) => p.sku),
        skipped: plan.skipped,
      };
    } catch (error) {
      if (error instanceof ProductImportError)
        throw new DomainError(error.message);
      throw error;
    }
  }
  saveProduct(body: unknown) {
    const data = productSchema.parse(body);
    const productId = data.id ?? randomUUID();
    ensure(
      data.category === "material" || data.unit === "шт",
      "Готовая продукция учитывается в штуках",
    );
    const existing = data.id ? this.product(data.id) : null;
    ensure(
      !existing || existing.category === data.category,
      "Категорию существующего товара менять нельзя",
    );
    ensure(
      !existing || existing.unit === data.unit,
      "Единицу существующего товара менять нельзя",
    );
    ensure(
      !this.get(
        "SELECT id FROM products WHERE sku=? AND id<>?",
        data.sku,
        productId,
      ),
      "SKU уже существует",
    );
    ensure(
      !data.barcode ||
        !this.get(
          "SELECT id FROM products WHERE barcode=? AND id<>?",
          data.barcode,
          productId,
        ),
      "Штрихкод уже существует",
    );
    if (existing) {
      this.run(
        "UPDATE products SET sku=?,barcode=?,name=?,size=?,color=?,colorHex=?,minStock=?,price=? WHERE id=?",
        data.sku,
        data.barcode,
        data.name,
        data.size,
        data.color,
        data.colorHex,
        data.minStock,
        data.price,
        productId,
      );
    } else this.insert("products", { ...data, id: productId, stock: 0 });
    this.audit("Карточка товара", productId, data.name);
    return { id: productId };
  }
  adjustStock(body: unknown) {
    const d = z
      .object({
        productId: id,
        kind: z.enum(["receipt", "writeoff", "inventory"]),
        quantity: z.number().int().min(0).max(100_000_000),
        unitCost: money,
        reason: text,
        paid: z.boolean().default(false),
      })
      .parse(body);
    const p = this.product(d.productId);
    ensure(
      p.category === "material" || d.quantity % 1000 === 0,
      "Количество штучного товара должно быть целым",
    );
    const delta =
      d.kind === "inventory"
        ? d.quantity - p.stock
        : d.kind === "writeoff"
          ? -d.quantity
          : d.quantity;
    ensure(delta !== 0, "Количество не меняется");
    const ref = randomUUID();
    const names = {
      receipt: "Приёмка",
      writeoff: "Списание",
      inventory: "Инвентаризация",
    };
    if (delta > 0) {
      const cost = Math.round(
        (p.stock * p.cost + delta * d.unitCost) / (p.stock + delta),
      );
      this.run("UPDATE products SET cost=? WHERE id=?", safe(cost), p.id);
    }
    this.move(p.id, delta, names[d.kind], ref);
    if (d.kind === "receipt" && d.paid)
      this.ledger(
        "stock",
        "Закупка материалов и товаров",
        -Math.round((delta * d.unitCost) / 1000),
        "bank",
        d.reason,
        ref,
      );
    if (delta < 0)
      this.ledger(
        "expense",
        "Списание запасов",
        -Math.round((-delta * p.cost) / 1000),
        "bank",
        d.reason,
        ref,
      ); // Non-cash entry is excluded from cash-flow reports.
    this.audit(names[d.kind], p.id, d.reason);
    return { id: ref };
  }
  saveRecipe(body: unknown) {
    const d = recipeSchema.parse(body);
    const p = this.product(d.productId);
    ensure(
      p.category === "box" || p.category === "flask",
      "Спецификации доступны для коробок и колб",
    );
    ensure(
      new Set(d.items.map((i) => i.materialId)).size === d.items.length,
      "Материал повторяется",
    );
    for (const i of d.items) {
      const m = this.product(i.materialId);
      ensure(m.category === "material", "В составе допускается только сырьё");
      ensure(
        m.unit !== "шт" || i.quantity % 1000 === 0,
        "Норма штучного материала должна быть целой",
      );
    }
    const rid = d.id ?? randomUUID();
    const prior = d.id ? this.recipe(d.id) : null;
    ensure(
      !prior || prior.productId === d.productId,
      "Нельзя менять изделие в существующей спецификации",
    );
    if (prior)
      this.run(
        "UPDATE recipes SET name=?,version=version+1,labor=?,overhead=?,items=? WHERE id=?",
        d.name,
        d.labor,
        d.overhead,
        JSON.stringify(d.items),
        rid,
      );
    else
      this.insert("recipes", {
        ...d,
        id: rid,
        version: 1,
        items: JSON.stringify(d.items),
      });
    this.audit("Спецификация", rid, d.name);
    return { id: rid };
  }
  createProduction(body: unknown) {
    const d = z.object({ recipeId: id, quantity, dueDate: date }).parse(body);
    const recipe = this.recipe(d.recipeId);
    const pid = randomUUID();
    const count = this.get<{ n: number }>(
      "SELECT COUNT(*) n FROM production",
    )!.n;
    this.insert("production", {
      id: pid,
      number: `ПР-${String(count + 1).padStart(4, "0")}`,
      productId: recipe.productId,
      ...d,
      status: "planned",
      recipe: JSON.stringify(recipe),
      materialCost: 0,
      totalCost: 0,
      createdAt: this.now(),
      completedAt: null,
    });
    this.audit("Заказ производства", pid, `${recipe.name}, ${d.quantity} шт`);
    return { id: pid };
  }
  startProduction(body: unknown) {
    const d = z.object({ id }).parse(body);
    const p = this.order(d.id);
    ensure(p.status === "planned", "Заказ уже запущен или отменён");
    let cost = 0;
    for (const item of p.recipe.items) {
      const material = this.product(item.materialId);
      const required = safe(item.quantity * p.quantity);
      this.move(item.materialId, -required, "В производство", p.id);
      cost += Math.round((required * material.cost) / 1000);
    }
    safe(cost);
    this.run(
      "UPDATE production SET status='in_progress',materialCost=? WHERE id=?",
      cost,
      p.id,
    );
    this.audit(
      "Запуск производства",
      p.id,
      "Материалы переданы в незавершённое производство",
    );
    return { id: p.id };
  }
  completeProduction(body: unknown) {
    const d = z.object({ id }).parse(body);
    const p = this.order(d.id);
    ensure(
      p.status === "in_progress",
      "Сначала запустите заказ в производство",
    );
    const product = this.product(p.productId);
    const total = safe(
      p.materialCost + (p.recipe.labor + p.recipe.overhead) * p.quantity,
    );
    const output = p.quantity * 1000;
    const cost = Math.round(
      (product.stock * product.cost + total * 1000) / (product.stock + output),
    );
    this.run("UPDATE products SET cost=? WHERE id=?", safe(cost), product.id);
    this.move(product.id, output, "Выпуск продукции", p.id);
    this.run(
      "UPDATE production SET status='completed',totalCost=?,completedAt=? WHERE id=?",
      total,
      this.now(),
      p.id,
    );
    this.audit(
      "Выпуск продукции",
      p.id,
      `${p.quantity} шт, себестоимость партии ${total / 100} ₽`,
    );
    return { id: p.id };
  }
  cancelProduction(body: unknown) {
    const d = z.object({ id }).parse(body);
    const p = this.order(d.id);
    ensure(p.status === "planned", "Отмена доступна только до списания сырья");
    this.run("UPDATE production SET status='cancelled' WHERE id=?", p.id);
    this.audit("Отмена заказа", p.id, "Материалы не списывались");
    return { id: p.id };
  }
  openShift(body: unknown) {
    const d = z.object({ opening: money }).parse(body);
    ensure(
      !this.get("SELECT id FROM shifts WHERE closedAt IS NULL"),
      "Уже есть открытая смена",
    );
    const sid = randomUUID();
    const n = this.get<{ n: number }>("SELECT COUNT(*) n FROM shifts")!.n;
    this.insert("shifts", {
      id: sid,
      number: `СМ-${String(n + 1).padStart(4, "0")}`,
      openedAt: this.now(),
      closedAt: null,
      opening: d.opening,
      counted: null,
      expected: null,
    });
    this.audit("Открытие смены", sid, "Учебная касса");
    return { id: sid };
  }
  closeShift(body: unknown) {
    const d = z.object({ counted: money }).parse(body);
    const shift = this.get<Shift>(
      "SELECT * FROM shifts WHERE closedAt IS NULL",
    );
    ensure(shift, "Нет открытой смены");
    const expected = this.cashExpected(shift.id);
    this.run(
      "UPDATE shifts SET closedAt=?,counted=?,expected=? WHERE id=?",
      this.now(),
      d.counted,
      expected,
      shift.id,
    );
    this.audit(
      "Закрытие смены",
      shift.id,
      `Расхождение ${(d.counted - expected) / 100} ₽`,
    );
    return { id: shift.id, expected };
  }
  createSale(body: unknown) {
    const d = saleSchema.parse(body);
    const shift = this.shift();
    ensure(
      new Set(d.items.map((i) => i.productId)).size === d.items.length,
      "Объедините одинаковые товары",
    );
    const sid = randomUUID();
    const items: SaleItem[] = d.items.map((i) => {
      const p = this.product(i.productId);
      ensure(p.category !== "material", "Сырьё не продаётся через POS");
      ensure(p.price > 0, "Установите цену товара");
      this.move(p.id, -i.quantity * 1000, "Продажа", sid);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        quantity: i.quantity,
        returned: 0,
        unitPrice: p.price,
        netPrice: Math.round((p.price * (100 - d.discount)) / 100),
        unitCost: p.cost,
      };
    });
    const total = safe(items.reduce((s, i) => s + i.netPrice * i.quantity, 0));
    const cost = safe(items.reduce((s, i) => s + i.unitCost * i.quantity, 0));
    const n = this.get<{ n: number }>("SELECT COUNT(*) n FROM sales")!.n;
    this.insert("sales", {
      id: sid,
      number: `П-${String(n + 1).padStart(5, "0")}`,
      shiftId: shift.id,
      payment: d.payment,
      discount: d.discount,
      total,
      cost,
      customer: d.customer || "Розничный покупатель",
      createdAt: this.now(),
      items: JSON.stringify(items),
    });
    this.ledger(
      "sale",
      "Продажи",
      total,
      d.payment === "cash" ? "cash" : "bank",
      d.customer || "Розничный покупатель",
      sid,
    );
    this.audit("Продажа", sid, "Учебная продажа, без фискализации");
    return { id: sid };
  }
  returnSale(body: unknown) {
    const d = z
      .object({
        saleId: id,
        items: z
          .array(z.object({ productId: id, quantity }))
          .min(1)
          .max(100),
        reason: text,
      })
      .parse(body);
    const shift = this.shift();
    const sale = this.sale(d.saleId);
    ensure(
      new Set(d.items.map((i) => i.productId)).size === d.items.length,
      "Товар повторяется",
    );
    const rid = randomUUID();
    let total = 0,
      cost = 0;
    for (const item of d.items) {
      const line = sale.items.find((i) => i.productId === item.productId);
      ensure(line, "Товар отсутствует в продаже");
      ensure(
        item.quantity <= line.quantity - line.returned,
        "Количество возврата превышает проданное",
      );
      const p = this.product(item.productId);
      const added = item.quantity * 1000;
      const nextCost = Math.round(
        (p.stock * p.cost + added * line.unitCost) / (p.stock + added),
      );
      this.run("UPDATE products SET cost=? WHERE id=?", safe(nextCost), p.id);
      this.move(item.productId, added, "Возврат", rid);
      line.returned += item.quantity;
      total += line.netPrice * item.quantity;
      cost += line.unitCost * item.quantity;
    }
    ensure(
      sale.payment !== "cash" || this.cashExpected(shift.id) >= total,
      "Недостаточно наличных в текущей смене для возврата",
    );
    this.run(
      "UPDATE sales SET items=? WHERE id=?",
      JSON.stringify(sale.items),
      sale.id,
    );
    this.insert("returns", {
      id: rid,
      saleId: sale.id,
      shiftId: shift.id,
      total: safe(total),
      cost: safe(cost),
      reason: d.reason,
      createdAt: this.now(),
      items: JSON.stringify(d.items),
    });
    this.ledger(
      "return",
      "Возвраты",
      -total,
      sale.payment === "cash" ? "cash" : "bank",
      d.reason,
      rid,
    );
    this.audit("Возврат продажи", rid, d.reason);
    return { id: rid };
  }
  createFinance(body: unknown) {
    const d = z
      .object({
        kind: z.enum(["income", "expense"]),
        category: text,
        amount: positiveMoney,
        description: text,
      })
      .parse(body);
    ensure(
      d.category !== "Списание запасов",
      "Эта категория создаётся только при складском списании",
    );
    const fid = randomUUID();
    this.ledger(
      d.kind,
      d.category,
      d.kind === "income" ? d.amount : -d.amount,
      "bank",
      d.description,
      fid,
    );
    this.audit(
      d.kind === "income" ? "Прочий доход" : "Расход",
      fid,
      d.description,
    );
    return { id: fid };
  }
  createDebt(body: unknown) {
    const d = z
      .object({
        party: text,
        direction: z.enum(["receivable", "payable"]),
        amount: positiveMoney,
        dueDate: date,
        note,
      })
      .parse(body);
    const did = randomUUID();
    this.insert("debts", { ...d, id: did, paid: 0, createdAt: this.now() });
    this.audit("Задолженность", did, d.party);
    return { id: did };
  }
  payDebt(body: unknown) {
    const d = z.object({ id, amount: positiveMoney }).parse(body);
    const debt = this.get<Debt>("SELECT * FROM debts WHERE id=?", d.id);
    ensure(debt, "Задолженность не найдена");
    ensure(
      d.amount <= debt.amount - debt.paid,
      "Сумма превышает остаток долга",
    );
    this.run("UPDATE debts SET paid=paid+? WHERE id=?", d.amount, debt.id);
    this.ledger(
      "debt",
      "Погашение задолженности",
      debt.direction === "receivable" ? d.amount : -d.amount,
      "bank",
      debt.party,
      debt.id,
    );
    this.audit("Погашение долга", debt.id, debt.party);
    return { id: debt.id };
  }
  state(): Omit<AppState, "csrfToken"> {
    const parseRows = <T>(
      table: string,
      key: string,
      order = "createdAt DESC",
    ): T[] =>
      this.all<Record<string, unknown>>(
        `SELECT * FROM ${table} ORDER BY ${order}`,
      ).map((row) => ({
        ...row,
        [key]: JSON.parse(row[key] as string),
      })) as T[];
    return {
      products: this.all<Product>(
        "SELECT * FROM products ORDER BY category, name, size",
      ),
      recipes: parseRows("recipes", "items", "name"),
      production: parseRows("production", "recipe"),
      sales: parseRows("sales", "items"),
      returns: parseRows("returns", "items"),
      shifts: this.all("SELECT * FROM shifts ORDER BY openedAt DESC"),
      ledger: this.all("SELECT * FROM ledger ORDER BY createdAt DESC"),
      debts: this.all("SELECT * FROM debts ORDER BY dueDate"),
      movements: this.all("SELECT * FROM movements ORDER BY createdAt DESC"),
      audit: this.all("SELECT * FROM audit ORDER BY createdAt DESC LIMIT 200"),
      serverTime: this.now(),
      mode: "demo",
    };
  }
}
