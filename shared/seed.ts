const randomUUID = () => globalThis.crypto.randomUUID();
import { StoreService } from "./service";
import type { Operation } from "./types";

export function seed(service: StoreService) {
  if (service.get<{ n: number }>("SELECT COUNT(*) n FROM products")!.n > 0)
    return;
  let at = new Date();
  at.setUTCDate(at.getUTCDate() - 28);
  at.setUTCHours(8, 0, 0, 0);
  const s = new StoreService(service.db, () => at);
  const act = (op: Operation, body: unknown) =>
    s.execute(op, body, randomUUID()) as { id: string };
  const colors = [
    ["Пыльная роза", "#bd919d"],
    ["Фисташковый", "#a8baa1"],
    ["Бордовый", "#853f51"],
    ["Молочный", "#e4ddce"],
    ["Фуксия", "#c564a4"],
    ["Лавандовый", "#a59ac5"],
    ["Графит", "#606b72"],
    ["Персиковый", "#d9ad94"],
    ["Голубой", "#99baca"],
    ["Белый", "#e8eded"],
  ];
  const materialDefs = [
    ["Картон переплётный", "м²", 6800, 160],
    ["Бумага дизайнерская", "м²", 4200, 110],
    ["Клей ПВА", "кг", 24000, 24],
    ["Лента атласная", "м", 1800, 460],
    ["ПЭТ-лист прозрачный", "м²", 18500, 75],
    ["Дно для колбы", "шт", 3500, 700],
  ] as const;
  const materials = materialDefs.map(([name, unit, cost, stock], i) => {
    const r = act("product.save", {
      sku: `RAW-00${i + 1}`,
      name,
      category: "material",
      size: "",
      color: "Натуральный",
      colorHex: "#a5b5aa",
      unit,
      minStock: 20_000,
      price: 0,
      cost,
      barcode: "",
    });
    act("stock.adjust", {
      productId: r.id,
      kind: "receipt",
      quantity: stock * 1000,
      unitCost: cost,
      reason: "Начальные тестовые остатки",
      paid: false,
    });
    return r.id;
  });
  const goods: { id: string; recipeId?: string }[] = [];
  const sizes = [
    "10×10",
    "12×12",
    "14×14",
    "16×16",
    "18×18",
    "20×20",
    "25×22",
    "30×24",
  ];
  const flasks = ["18×21", "20×23", "22×24", "25×25", "30×27"];
  for (let i = 0; i < 18; i++) {
    const flask = i >= 12;
    const [color, colorHex] = colors[i % colors.length];
    const size = flask ? flasks[(i - 12) % 5] : sizes[i % 8];
    const price = flask ? 27000 + ((i - 12) % 5) * 8000 : 8000 + (i % 8) * 3800;
    const { id: pid } = act("product.save", {
      sku: `${flask ? "AQ" : "HB"}-${size.replace("×", "")}-${i + 1}`,
      barcode: `200000000${String(i + 1).padStart(4, "0")}`,
      name: flask ? "Колба «Аква»" : "Шляпная коробка",
      category: flask ? "flask" : "box",
      size: `${size} см`,
      color,
      colorHex,
      unit: "шт",
      minStock: 25000,
      price,
      cost: Math.round(price * 0.46),
    });
    act("stock.adjust", {
      productId: pid,
      kind: "receipt",
      quantity: (i === 2 ? 18 : 100 + i * 4) * 1000,
      unitCost: Math.round(price * 0.46),
      reason: "Начальные тестовые остатки",
      paid: false,
    });
    const { id: recipeId } = act("recipe.save", {
      productId: pid,
      name: `${flask ? "Аква" : "Коробка"} ${size} / ${color}`,
      labor: flask ? 2700 : 2200,
      overhead: 1000,
      items: flask
        ? [
            { materialId: materials[4], quantity: 240 },
            { materialId: materials[5], quantity: 1000 },
            { materialId: materials[2], quantity: 15 },
          ]
        : [
            { materialId: materials[0], quantity: 220 + (i % 8) * 30 },
            { materialId: materials[1], quantity: 250 + (i % 8) * 40 },
            { materialId: materials[2], quantity: 25 },
            { materialId: materials[3], quantity: 600 },
          ],
    });
    goods.push({ id: pid, recipeId });
  }
  ["Плёнка матовая", "Бумага тишью", "Лента декоративная"].forEach(
    (name, i) => {
      const { id: pid } = act("product.save", {
        sku: `PK-00${i + 1}`,
        barcode: `210000000000${i}`,
        name,
        category: "packaging",
        size:
          i === 0
            ? "60 см × 10 м"
            : i === 1
              ? "50 × 66 см / 10 л"
              : "25 мм × 20 м",
        color: colors[i][0],
        colorHex: colors[i][1],
        unit: "шт",
        minStock: 20000,
        price: 19000 + i * 5000,
        cost: 8000 + i * 3000,
      });
      act("stock.adjust", {
        productId: pid,
        kind: "receipt",
        quantity: 90_000,
        unitCost: 8000 + i * 3000,
        reason: "Начальные тестовые остатки",
        paid: false,
      });
      goods.push({ id: pid });
    },
  );
  // Seed sales through the same transactional use cases as real demo operations.
  for (let day = 20; day >= 0; day--) {
    at = new Date();
    at.setUTCDate(at.getUTCDate() - day);
    at.setUTCHours(7, 0, 0, 0);
    act("shift.open", { opening: 500000 });
    const count = 3 + ((20 - day) % 5);
    for (let j = 0; j < count; j++) {
      if (day === 0) at = new Date(Date.now() - (count - j) * 25 * 60000);
      else at.setUTCHours(8 + j, 15, 0, 0);
      const a = goods[(day * 3 + j) % goods.length];
      const b = goods[(day + j + 7) % goods.length];
      const items = [{ productId: a.id, quantity: 1 + (j % 3) }];
      if (a.id !== b.id) items.push({ productId: b.id, quantity: 1 });
      try {
        act("sale.create", {
          items,
          discount: j === 2 ? 5 : 0,
          payment: (["card", "sbp", "cash"] as const)[j % 3],
          customer: [
            "Студия «Цветочный»",
            "Розничный покупатель",
            "Букетная мастерская",
          ][j % 3],
        });
      } catch {
        /* Low-stock seed items intentionally remain for attention alerts. */
      }
    }
    if (day > 0) {
      at.setUTCHours(17);
      const shift = s.get<{ id: string }>(
        "SELECT id FROM shifts WHERE closedAt IS NULL",
      )!;
      act("shift.close", { counted: s.cashExpected(shift.id) });
    }
  }
  at = new Date();
  act("finance.create", {
    kind: "expense",
    category: "Аренда",
    amount: 3200000,
    description: "Аренда магазина за текущий месяц",
  });
  act("finance.create", {
    kind: "expense",
    category: "Доставка",
    amount: 280000,
    description: "Доставка упаковки на склад",
  });
  act("finance.create", {
    kind: "income",
    category: "Прочие доходы",
    amount: 450000,
    description: "Услуга упаковки заказа",
  });
  const date = (days: number) =>
    new Date(at.getTime() + days * 86400000).toISOString().slice(0, 10);
  act("debt.create", {
    party: "Студия «Цветочный»",
    direction: "receivable",
    amount: 1875000,
    dueDate: date(-2),
    note: "Тестовый начальный долг, заказ ОПТ-104",
  });
  act("debt.create", {
    party: "Бумага и картон",
    direction: "payable",
    amount: 2460000,
    dueDate: date(4),
    note: "Тестовая задолженность по поставке",
  });
  act("debt.create", {
    party: "Букетная мастерская",
    direction: "receivable",
    amount: 940000,
    dueDate: date(3),
    note: "Тестовый начальный долг",
  });
  for (let i = 0; i < 4; i++) {
    const { id: oid } = act("production.create", {
      recipeId: goods[i === 3 ? 12 : i].recipeId,
      quantity: 20 + i * 10,
      dueDate: date(i - 1),
    });
    if (i < 2) act("production.start", { id: oid });
    if (i === 0) act("production.complete", { id: oid });
  }
  s.audit(
    "Демо-база создана",
    "seed",
    "Тестовые товары, операции и контрагенты. Это не данные бизнеса.",
  );
}
