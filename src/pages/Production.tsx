import { useState } from "react";
import {
  Plus,
  Factory,
  Play,
  Check,
  ClipboardList,
  Pencil,
  Trash2,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../store";
import { money, qty, scaled, cents, today } from "../lib";
import {
  Modal,
  ActionForm,
  Field,
  Badge,
  ProductArt,
  Empty,
  SectionHead,
  Stat,
} from "../components/ui";
import type { Production as Order, Recipe, BomItem } from "../../shared/types";
const labels = {
  planned: "Запланирован",
  in_progress: "В производстве",
  completed: "Выпущен",
  cancelled: "Отменён",
} as const;
const tones = {
  planned: "amber",
  in_progress: "blue",
  completed: "green",
  cancelled: "neutral",
} as const;
export default function Production() {
  const { data } = useStore();
  const [tab, setTab] = useState("orders");
  const [status, setStatus] = useState("active");
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [recipeEditor, setRecipeEditor] = useState<Recipe | "new" | null>(null);
  const orders = data.production.filter(
    (o) =>
      status === "all" ||
      (status === "active"
        ? o.status === "planned" || o.status === "in_progress"
        : o.status === status),
  );
  const wip = data.production.filter((o) => o.status === "in_progress");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Производство</h1>
          <p>Превращайте материалы в готовую продукцию.</p>
        </div>
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={18} />
          Новый заказ
        </button>
      </div>
      <div className="stats-grid three">
        <Stat
          label="В производстве"
          value={`${wip.reduce((s, o) => s + o.quantity, 0)} шт`}
          sub={`Партий в работе: ${wip.length} · сырьё списано`}
          icon={<Factory size={20} />}
          accent
        />
        <Stat
          label="Незавершённое производство"
          value={money(wip.reduce((s, o) => s + o.materialCost, 0))}
          sub="Материалы в активных партиях"
          icon={<Layers size={20} />}
        />
        <Stat
          label="Спецификации"
          value={`${data.recipes.length}`}
          sub="Коробки и колбы · версионный состав"
          icon={<ClipboardList size={20} />}
        />
      </div>
      <div className="tabs page-tabs">
        <button
          aria-pressed={tab === "orders"}
          onClick={() => setTab("orders")}
        >
          Производственные заказы
        </button>
        <button
          aria-pressed={tab === "recipes"}
          onClick={() => setTab("recipes")}
        >
          Спецификации
        </button>
      </div>
      {tab === "orders" ? (
        <section className="panel">
          <div className="table-toolbar">
            <div className="tabs compact">
              {[
                ["active", "В работе"],
                ["completed", "Выпущенные"],
                ["all", "Все заказы"],
              ].map(([v, t]) => (
                <button
                  key={v}
                  aria-pressed={status === v}
                  onClick={() => setStatus(v)}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="muted">Заказов в списке: {orders.length}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Заказ / изделие</th>
                  <th>Количество</th>
                  <th>Плановая дата</th>
                  <th>Статус</th>
                  <th className="numeric">Себестоимость партии</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const p = data.products.find((p) => p.id === o.productId)!;
                  const estimate =
                    o.status === "completed"
                      ? o.totalCost
                      : (o.status === "in_progress"
                          ? o.materialCost
                          : o.recipe.items.reduce(
                              (s, i) =>
                                s +
                                Math.round(
                                  (i.quantity *
                                    o.quantity *
                                    data.products.find(
                                      (p) => p.id === i.materialId,
                                    )!.cost) /
                                    1000,
                                ),
                              0,
                            )) +
                        (o.recipe.labor + o.recipe.overhead) * o.quantity;
                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="product-cell">
                          <ProductArt product={p} />
                          <div>
                            <b>
                              {o.number}{" "}
                              <span className="muted">· {p.name}</span>
                            </b>
                            <small>
                              {p.size} · {p.color}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className="strong">{o.quantity} шт</td>
                      <td
                        className={
                          o.dueDate < today() && o.status !== "completed"
                            ? "amber-text"
                            : ""
                        }
                      >
                        {new Date(o.dueDate).toLocaleDateString("ru-RU")}
                      </td>
                      <td>
                        <Badge tone={tones[o.status]}>{labels[o.status]}</Badge>
                      </td>
                      <td className="numeric">
                        {money(estimate)}
                        <small>
                          {o.status === "completed"
                            ? "Фактическая"
                            : "Расчётная"}
                        </small>
                      </td>
                      <td>
                        <button
                          className="button small-button"
                          onClick={() => setSelected(o)}
                        >
                          Открыть <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!orders.length ? (
            <Empty
              title="В этой группе пока нет заказов"
              description="Создайте партию по готовой спецификации."
            />
          ) : null}
        </section>
      ) : (
        <section className="panel">
          <SectionHead
            title="Спецификации изделий"
            description="Нормы материалов на одно изделие"
            action={
              <button className="button" onClick={() => setRecipeEditor("new")}>
                <Plus size={16} />
                Спецификация
              </button>
            }
          />
          <div className="recipe-grid">
            {data.recipes.map((r) => {
              const p = data.products.find((p) => p.id === r.productId)!;
              const cost =
                r.items.reduce(
                  (sum, i) =>
                    sum +
                    Math.round(
                      (i.quantity *
                        data.products.find((p) => p.id === i.materialId)!
                          .cost) /
                        1000,
                    ),
                  0,
                ) +
                r.labor +
                r.overhead;
              return (
                <button
                  className="recipe-card"
                  key={r.id}
                  onClick={() => setRecipeEditor(r)}
                >
                  <div className="recipe-top">
                    <ProductArt product={p} />
                    <Badge>v{r.version}</Badge>
                    <Pencil size={15} />
                  </div>
                  <h3>{r.name}</h3>
                  <p>
                    {r.items.length} материала · {p.sku}
                  </p>
                  <div>
                    <span>Расчёт на единицу</span>
                    <b>{money(cost)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {create ? <CreateOrder onClose={() => setCreate(false)} /> : null}
      {selected ? (
        <OrderDetail
          order={data.production.find((o) => o.id === selected.id)!}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {recipeEditor ? (
        <RecipeEditor
          recipe={recipeEditor === "new" ? undefined : recipeEditor}
          onClose={() => setRecipeEditor(null)}
        />
      ) : null}
    </>
  );
}
function CreateOrder({ onClose }: { onClose: () => void }) {
  const { data, act } = useStore();
  const [rid, setRid] = useState(data.recipes[0]?.id ?? "");
  const [amount, setAmount] = useState(20);
  const r = data.recipes.find((r) => r.id === rid);
  return (
    <Modal
      title="Новый производственный заказ"
      subtitle="Спецификация сохранится в заказе как отдельная версия."
      onClose={onClose}
    >
      <ActionForm
        onCancel={onClose}
        label="Создать заказ"
        onSubmit={async (f) => {
          if (!r) throw new Error("Сначала создайте спецификацию");
          const result = await act(
            "production.create",
            { recipeId: rid, quantity: amount, dueDate: f.get("dueDate") },
            "Заказ добавлен в план",
          );
          if (result) onClose();
        }}
      >
        <Field label="Спецификация">
          <select value={rid} onChange={(e) => setRid(e.target.value)} required>
            <option value="" disabled>
              Выберите изделие
            </option>
            {data.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · v{r.version}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Количество изделий, шт">
            <input
              type="number"
              min="1"
              max="10000"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="Плановая дата выпуска">
            <input type="date" name="dueDate" required defaultValue={today()} />
          </Field>
        </div>
        {r ? (
          <div className="bom-preview">
            <h3>Потребность в материалах</h3>
            {r.items.map((i) => {
              const p = data.products.find((p) => p.id === i.materialId)!;
              return (
                <div key={i.materialId}>
                  <span>{p.name}</span>
                  <b
                    className={
                      p.stock < i.quantity * amount ? "amber-text" : ""
                    }
                  >
                    {qty(i.quantity * amount)} {p.unit}
                  </b>
                  <small>есть {qty(p.stock)}</small>
                </div>
              );
            })}
          </div>
        ) : null}
        <p className="form-note">
          Создание плана не резервирует сырьё. При запуске система проверит
          остатки и спишет материалы в производство.
        </p>
      </ActionForm>
    </Modal>
  );
}
function OrderDetail({
  order: o,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { data, act, busy } = useStore();
  const [error, setError] = useState("");
  const [cancel, setCancel] = useState(false);
  const product = data.products.find((p) => p.id === o.productId)!;
  const materialCost =
    o.status === "planned"
      ? o.recipe.items.reduce(
          (s, i) =>
            s +
            Math.round(
              (i.quantity *
                o.quantity *
                data.products.find((p) => p.id === i.materialId)!.cost) /
                1000,
            ),
          0,
        )
      : o.materialCost;
  const total =
    materialCost + (o.recipe.labor + o.recipe.overhead) * o.quantity;
  async function action(type: "start" | "complete" | "cancel") {
    setError("");
    try {
      await act(
        `production.${type}`,
        { id: o.id },
        type === "start"
          ? "Материалы списаны. Заказ в производстве."
          : type === "complete"
            ? "Готовая продукция поступила на склад"
            : "Заказ отменён",
      );
      if (type === "cancel") onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={`Заказ ${o.number}`}
      subtitle={`${product.name} · ${product.color} · ${product.size}`}
      wide
      onClose={onClose}
    >
      <div className="detail-content">
        <div className="order-detail-summary">
          <ProductArt product={product} large />
          <div>
            <Badge tone={tones[o.status]}>{labels[o.status]}</Badge>
            <h3>{o.quantity} шт</h3>
            <p>
              Спецификация v{o.recipe.version} · Выпуск до{" "}
              {new Date(o.dueDate).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Материал</th>
                <th>Норма / шт</th>
                <th>На партию</th>
                <th>На складе сейчас</th>
              </tr>
            </thead>
            <tbody>
              {o.recipe.items.map((i) => {
                const p = data.products.find((p) => p.id === i.materialId)!;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      {qty(i.quantity)} {p.unit}
                    </td>
                    <td>
                      {qty(i.quantity * o.quantity)} {p.unit}
                    </td>
                    <td
                      className={
                        o.status === "planned" &&
                        p.stock < i.quantity * o.quantity
                          ? "amber-text"
                          : ""
                      }
                    >
                      {qty(p.stock)} {p.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cost-breakdown">
          <div>
            <span>
              Материалы {o.status === "planned" ? "(оценка)" : "(при запуске)"}
            </span>
            <b>{money(materialCost)}</b>
          </div>
          <div>
            <span>Работа и накладные</span>
            <b>{money((o.recipe.labor + o.recipe.overhead) * o.quantity)}</b>
          </div>
          <div className="total">
            <span>Себестоимость партии</span>
            <b>{money(total)}</b>
          </div>
          <div>
            <span>На одно изделие</span>
            <b>{money(Math.round(total / o.quantity))}</b>
          </div>
        </div>
        <p className="form-note">
          Труд и накладные включаются в стоимость выпуска по нормативу. Денежные
          выплаты отражаются отдельно. Нормы должны включать технологический
          отход.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {cancel ? (
          <div className="notice amber">
            Отменить запланированный заказ? Склад не изменится.
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void action("cancel")}
            >
              Подтвердить отмену
            </button>
          </div>
        ) : null}
      </div>
      <div className="modal-actions">
        {o.status === "planned" ? (
          <>
            <button
              className="button"
              disabled={busy}
              onClick={() => setCancel(true)}
            >
              Отменить заказ
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void action("start")}
            >
              <Play size={16} />
              Запустить производство
            </button>
          </>
        ) : o.status === "in_progress" ? (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void action("complete")}
          >
            <Check size={17} />
            Выпустить {o.quantity} шт на склад
          </button>
        ) : (
          <button className="button" onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>
    </Modal>
  );
}
function RecipeEditor({
  recipe: r,
  onClose,
}: {
  recipe?: Recipe;
  onClose: () => void;
}) {
  const { data, act } = useStore();
  const materials = data.products.filter((p) => p.category === "material");
  const [items, setItems] = useState<BomItem[]>(
    r?.items ?? [{ materialId: materials[0]?.id ?? "", quantity: 1000 }],
  );
  return (
    <Modal
      title={r ? "Редактировать спецификацию" : "Новая спецификация"}
      wide
      onClose={onClose}
    >
      <ActionForm
        onCancel={onClose}
        onSubmit={async (f) => {
          const result = await act(
            "recipe.save",
            {
              id: r?.id,
              productId: r?.productId ?? f.get("productId"),
              name: f.get("name"),
              labor: cents(String(f.get("labor"))),
              overhead: cents(String(f.get("overhead"))),
              items,
            },
            "Спецификация сохранена",
          );
          if (result) onClose();
        }}
      >
        <Field label="Готовое изделие">
          <select name="productId" disabled={!!r} defaultValue={r?.productId}>
            {data.products
              .filter((p) => p.category === "box" || p.category === "flask")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Название спецификации">
          <input name="name" required defaultValue={r?.name} maxLength={150} />
        </Field>
        <h3>Материалы на одну единицу</h3>
        {items.map((item, index) => (
          <div className="bom-edit-row" key={index}>
            <Field label={`Материал ${index + 1}`}>
              <select
                value={item.materialId}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index ? { ...i, materialId: e.target.value } : i,
                    ),
                  )
                }
              >
                {materials.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Норма">
              <input
                aria-label={`Норма материала ${index + 1}`}
                type="number"
                required
                min=".001"
                step=".001"
                max="1000"
                value={item.quantity / 1000}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, quantity: scaled(e.target.value) }
                        : i,
                    ),
                  )
                }
              />
            </Field>
            <button
              className="icon-button"
              type="button"
              aria-label={`Удалить материал ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== index))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          className="button"
          type="button"
          onClick={() =>
            setItems([
              ...items,
              { materialId: materials[0]?.id ?? "", quantity: 1000 },
            ])
          }
        >
          <Plus size={16} />
          Добавить материал
        </button>
        <div className="form-grid">
          <Field label="Работа на единицу, ₽">
            <input
              name="labor"
              type="number"
              required
              min="0"
              max="1000000"
              step=".01"
              defaultValue={(r?.labor ?? 0) / 100}
            />
          </Field>
          <Field label="Накладные на единицу, ₽">
            <input
              name="overhead"
              type="number"
              required
              min="0"
              max="1000000"
              step=".01"
              defaultValue={(r?.overhead ?? 0) / 100}
            />
          </Field>
        </div>
        <p className="form-note">
          Изменения создают следующую версию. Уже созданные заказы сохраняют
          прежний состав и нормы.
        </p>
      </ActionForm>
    </Modal>
  );
}
