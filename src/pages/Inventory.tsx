import { lazy, Suspense, useState } from "react";
import {
  Plus,
  Search,
  Download,
  Upload,
  ArrowDownToLine,
  SlidersHorizontal,
  Pencil,
  History,
} from "lucide-react";
import { useStore } from "../store";
import { money, qty, scaled, cents, dateTime, downloadCsv } from "../lib";
import {
  Modal,
  ActionForm,
  Field,
  Badge,
  ProductArt,
  Empty,
  SectionHead,
} from "../components/ui";
import type { Product, Category } from "../../shared/types";
import { categoryLabels } from "../../shared/types";
const ProductImport = lazy(() => import("../components/ProductImport"));
type Editor =
  | { kind: "product"; product?: Product }
  | { kind: "stock"; product?: Product }
  | { kind: "import" }
  | null;
export default function Inventory({
  search,
  setSearch,
}: {
  search: string;
  setSearch: (s: string) => void;
}) {
  const { data, act } = useStore();
  const [category, setCategory] = useState<Category | "all">("all");
  const [low, setLow] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [history, setHistory] = useState(false);
  const products = data.products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (!low || p.stock < p.minStock) &&
      [p.name, p.sku, p.barcode, p.size, p.color]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Товары и склад</h1>
          <p>Ассортимент, варианты и движение запасов.</p>
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={() => setEditor({ kind: "stock" })}
          >
            <ArrowDownToLine size={17} />
            Приёмка / списание
          </button>
          <button
            className="button primary"
            onClick={() => setEditor({ kind: "product" })}
          >
            <Plus size={18} />
            Добавить товар
          </button>
        </div>
      </div>
      <div className="inventory-summary">
        <div>
          <span>Номенклатура</span>
          <b>{data.products.length} SKU</b>
        </div>
        <div>
          <span>Стоимость запасов</span>
          <b>
            {money(
              data.products.reduce(
                (s, p) => s + Math.round((p.stock * p.cost) / 1000),
                0,
              ),
            )}
          </b>
        </div>
        <div>
          <span>Ниже минимума</span>
          <b className="amber-text">
            {data.products.filter((p) => p.stock < p.minStock).length} SKU
          </b>
        </div>
        <div>
          <span>Место хранения</span>
          <b>Основной склад</b>
        </div>
      </div>
      <div className="tabs page-tabs">
        {(["all", "box", "flask", "packaging", "material"] as const).map(
          (c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "Все товары" : categoryLabels[c]}
              <span>
                {
                  data.products.filter((p) => c === "all" || p.category === c)
                    .length
                }
              </span>
            </button>
          ),
        )}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Поиск по ассортименту"
              placeholder="Название, SKU, цвет или штрихкод"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="actions">
            <button
              className="button"
              onClick={() => setEditor({ kind: "import" })}
            >
              <Upload size={17} aria-hidden="true" />
              Импорт товаров
            </button>
            <button
              className={"button " + (low ? "selected" : "")}
              aria-pressed={low}
              onClick={() => setLow(!low)}
            >
              <SlidersHorizontal size={16} />
              Низкий остаток
            </button>
            <button
              className="icon-button"
              aria-label="Экспорт товаров CSV"
              onClick={() =>
                downloadCsv(
                  "florist-stock.csv",
                  [
                    "SKU",
                    "Название",
                    "Категория",
                    "Размер",
                    "Цвет",
                    "Остаток",
                    "Единица",
                    "Цена ₽",
                    "Себестоимость ₽",
                  ],
                  products.map((p) => [
                    p.sku,
                    p.name,
                    categoryLabels[p.category],
                    p.size,
                    p.color,
                    p.stock / 1000,
                    p.unit,
                    p.price / 100,
                    p.cost / 100,
                  ]),
                )
              }
            >
              <Download size={18} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Товар / SKU</th>
                <th>Размер</th>
                <th>Цвет</th>
                <th className="numeric">Остаток</th>
                <th className="numeric">Себестоимость</th>
                <th className="numeric">Цена</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="product-cell">
                      <ProductArt product={p} />
                      <div>
                        <b>{p.name}</b>
                        <small>{p.sku}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.size || "—"}</td>
                  <td>
                    <span className="color-label">
                      <i style={{ background: p.colorHex }} />
                      {p.color || "—"}
                    </span>
                  </td>
                  <td className="numeric strong">
                    {qty(p.stock)} <span className="muted">{p.unit}</span>
                  </td>
                  <td className="numeric">{money(p.cost)}</td>
                  <td className="numeric strong">
                    {p.category === "material" ? "—" : money(p.price)}
                  </td>
                  <td>
                    <Badge
                      tone={
                        p.stock === 0
                          ? "red"
                          : p.stock < p.minStock
                            ? "amber"
                            : "green"
                      }
                    >
                      {p.stock === 0
                        ? "Нет в наличии"
                        : p.stock < p.minStock
                          ? "Мало"
                          : "В наличии"}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Изменить ${p.sku}`}
                        onClick={() =>
                          setEditor({ kind: "product", product: p })
                        }
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Движение ${p.sku}`}
                        onClick={() => setEditor({ kind: "stock", product: p })}
                      >
                        <ArrowDownToLine size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 ? (
          <Empty
            title="Товары не найдены"
            description="Измените поиск или отключите фильтр."
          />
        ) : null}
        <div className="table-footer">
          <span>
            Показано {products.length} из {data.products.length} SKU
          </span>
          <button className="text-link" onClick={() => setHistory(!history)}>
            <History size={16} />
            {history ? "Скрыть журнал" : "Журнал движений"}
          </button>
        </div>
      </section>
      {history ? (
        <section className="panel section-space">
          <SectionHead
            title="Движение запасов"
            description="Последние 100 операций основного склада"
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Операция</th>
                  <th>Товар</th>
                  <th>Изменение</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.slice(0, 100).map((m) => {
                  const p = data.products.find((p) => p.id === m.productId)!;
                  return (
                    <tr key={m.id}>
                      <td>{dateTime(m.createdAt)}</td>
                      <td>{m.kind}</td>
                      <td>
                        {p.name}
                        <small>{p.sku}</small>
                      </td>
                      <td
                        className={m.quantity > 0 ? "green-text" : "amber-text"}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {qty(m.quantity)} {p.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {editor?.kind === "import" ? (
        <Suspense
          fallback={
            <Modal title="Импорт товаров" onClose={() => setEditor(null)}>
              <p className="form-fields" role="status">
                Загружаем форму…
              </p>
            </Modal>
          }
        >
          <ProductImport onClose={() => setEditor(null)} />
        </Suspense>
      ) : editor?.kind === "product" ? (
        <ProductEditor
          product={editor.product}
          onClose={() => setEditor(null)}
        />
      ) : editor?.kind === "stock" ? (
        <StockEditor product={editor.product} onClose={() => setEditor(null)} />
      ) : null}
    </>
  );
}
function ProductEditor({
  product: p,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { act } = useStore();
  const [category, setCategory] = useState<Category>(p?.category ?? "box");
  return (
    <Modal
      title={p ? "Карточка товара" : "Новый товар"}
      subtitle="Каждый размер и цвет — отдельный SKU."
      onClose={onClose}
    >
      <ActionForm
        onCancel={onClose}
        onSubmit={async (f) => {
          const result = await act(
            "product.save",
            {
              id: p?.id,
              name: f.get("name"),
              sku: f.get("sku"),
              barcode: f.get("barcode"),
              category,
              size: f.get("size"),
              color: f.get("color"),
              colorHex: f.get("colorHex"),
              unit: p?.unit ?? (category === "material" ? f.get("unit") : "шт"),
              minStock: scaled(String(f.get("minStock"))),
              price: cents(String(f.get("price"))),
              cost: p?.cost ?? cents(String(f.get("cost"))),
            },
            "Карточка товара сохранена",
          );
          if (result) onClose();
        }}
      >
        <Field label="Название">
          <input name="name" required maxLength={150} defaultValue={p?.name} />
        </Field>
        <div className="form-grid">
          <Field label="SKU">
            <input name="sku" required maxLength={80} defaultValue={p?.sku} />
          </Field>
          <Field label="Штрихкод">
            <input name="barcode" maxLength={50} defaultValue={p?.barcode} />
          </Field>
          <Field label="Категория">
            <select
              value={category}
              disabled={!!p}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {Object.entries(categoryLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Размер">
            <input
              name="size"
              maxLength={60}
              defaultValue={p?.size}
              placeholder="20×20 см"
            />
          </Field>
          <Field label="Название цвета">
            <input name="color" maxLength={60} defaultValue={p?.color} />
          </Field>
          <Field label="Оттенок">
            <input
              name="colorHex"
              type="color"
              defaultValue={p?.colorHex ?? "#bd919d"}
            />
          </Field>
          {category === "material" ? (
            <Field label="Единица измерения">
              <select name="unit" disabled={!!p} defaultValue={p?.unit ?? "м²"}>
                {["шт", "м", "м²", "кг", "л"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Минимальный остаток">
            <input
              name="minStock"
              type="number"
              min="0"
              max="100000"
              step={category === "material" ? ".001" : "1"}
              defaultValue={(p?.minStock ?? 25000) / 1000}
              required
            />
          </Field>
          <Field label="Цена продажи, ₽">
            <input
              name="price"
              type="number"
              min="0"
              max="1000000"
              step=".01"
              defaultValue={(p?.price ?? 0) / 100}
              required
            />
          </Field>
          {!p ? (
            <Field label="Начальная себестоимость, ₽">
              <input
                name="cost"
                type="number"
                min="0"
                max="1000000"
                step=".01"
                defaultValue="0"
                required
              />
            </Field>
          ) : null}
        </div>
        <p className="form-note">
          Остатки меняются через приёмку, списание и инвентаризацию.
          Себестоимость пересчитывается по средневзвешенной стоимости.
        </p>
      </ActionForm>
    </Modal>
  );
}
function StockEditor({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { data, act } = useStore();
  const [pid, setPid] = useState(product?.id ?? data.products[0].id);
  const [kind, setKind] = useState("receipt");
  const p = data.products.find((p) => p.id === pid)!;
  return (
    <Modal
      title="Складская операция"
      subtitle="Основной склад"
      onClose={onClose}
    >
      <ActionForm
        label="Провести операцию"
        onCancel={onClose}
        onSubmit={async (f) => {
          const r = await act(
            "stock.adjust",
            {
              productId: pid,
              kind,
              quantity: scaled(String(f.get("quantity"))),
              unitCost: cents(String(f.get("cost"))),
              reason: f.get("reason"),
              paid: f.get("paid") === "on",
            },
            "Остатки обновлены",
          );
          if (r) onClose();
        }}
      >
        <Field label="Товар">
          <select value={pid} onChange={(e) => setPid(e.target.value)}>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sku}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Операция">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="receipt">Приёмка</option>
            <option value="writeoff">Списание</option>
            <option value="inventory">Инвентаризация</option>
          </select>
        </Field>
        <div className="notice">
          Сейчас на складе:{" "}
          <b>
            {qty(p.stock)} {p.unit}
          </b>
        </div>
        <div className="form-grid">
          <Field
            label={
              kind === "inventory"
                ? `Фактический остаток, ${p.unit}`
                : `Количество, ${p.unit}`
            }
          >
            <input
              name="quantity"
              type="number"
              required
              min={kind === "inventory" ? 0 : p.unit === "шт" ? 1 : 0.001}
              max="100000"
              step={p.unit === "шт" ? 1 : 0.001}
              defaultValue="1"
            />
          </Field>
          <Field
            label="Стоимость единицы, ₽"
            hint="Применяется при увеличении остатка"
          >
            <input
              key={pid}
              name="cost"
              type="number"
              required
              min="0"
              max="1000000"
              step=".01"
              defaultValue={p.cost / 100}
            />
          </Field>
        </div>
        <Field label="Основание / номер документа">
          <input
            name="reason"
            required
            maxLength={150}
            placeholder="Накладная № 18 от…"
          />
        </Field>
        {kind === "receipt" ? (
          <label className="checkbox-label">
            <input name="paid" type="checkbox" />
            Оплачено с расчётного счёта — отразить в движении денег
          </label>
        ) : null}
        <p className="form-note">
          Неоплаченная приёмка не создаёт долг автоматически. При необходимости
          добавьте его в разделе «Финансы».
        </p>
      </ActionForm>
    </Modal>
  );
}
