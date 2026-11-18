import { useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  Printer,
  Check,
  DoorOpen,
  DoorClosed,
} from "lucide-react";
import { useStore } from "../store";
import { money, qty, cents, dateTime } from "../lib";
import {
  Modal,
  ActionForm,
  Field,
  Badge,
  ProductArt,
  Empty,
} from "../components/ui";
import {
  categoryLabels,
  paymentLabels,
  type Payment,
  type Sale,
  type Category,
} from "../../shared/types";
export default function Pos() {
  const { data, act, busy } = useStore();
  const [tab, setTab] = useState("sale");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>(
    [],
  );
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<Payment>("card");
  const [customer, setCustomer] = useState("");
  const [error, setError] = useState("");
  const [shiftDialog, setShiftDialog] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const shift = data.shifts.find((s) => !s.closedAt);
  const expired =
    !!shift && Date.now() - new Date(shift.openedAt).getTime() >= 86400000;
  const products = data.products.filter(
    (p) =>
      p.category !== "material" &&
      (category === "all" || p.category === category) &&
      [p.name, p.sku, p.barcode, p.color, p.size]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const gross = cart.reduce(
    (sum, line) =>
      sum +
      data.products.find((p) => p.id === line.productId)!.price * line.quantity,
    0,
  );
  const total = cart.reduce(
    (sum, line) =>
      sum +
      Math.round(
        (data.products.find((p) => p.id === line.productId)!.price *
          (100 - discount)) /
          100,
      ) *
        line.quantity,
    0,
  );
  const cash = shift
    ? shift.opening +
      data.sales
        .filter((s) => s.shiftId === shift.id && s.payment === "cash")
        .reduce((sum, s) => sum + s.total, 0) -
      data.returns
        .filter(
          (r) =>
            r.shiftId === shift.id &&
            data.sales.find((s) => s.id === r.saleId)?.payment === "cash",
        )
        .reduce((sum, r) => sum + r.total, 0)
    : 0;
  function add(pid: string, delta = 1) {
    const p = data.products.find((p) => p.id === pid)!;
    const current = cart.find((i) => i.productId === pid);
    const next = (current?.quantity ?? 0) + delta;
    if (next * 1000 > p.stock) {
      setError(`На складе доступно ${qty(p.stock)} шт: ${p.name}`);
      return;
    }
    setError("");
    setCart(
      next <= 0
        ? cart.filter((i) => i.productId !== pid)
        : current
          ? cart.map((i) =>
              i.productId === pid ? { ...i, quantity: next } : i,
            )
          : [...cart, { productId: pid, quantity: next }],
    );
  }
  const receipt = receiptId
    ? data.sales.find((s) => s.id === receiptId)
    : undefined;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Касса</h1>
          <p>Продажи и возвраты с обновлением склада и финансов.</p>
        </div>
        <div className="actions">
          <Badge tone={!shift ? "neutral" : expired ? "red" : "green"}>
            {!shift
              ? "Смена закрыта"
              : expired
                ? "Смена старше 24 часов"
                : `${shift.number} · открыта`}
          </Badge>
          <button className="button" onClick={() => setShiftDialog(true)}>
            {shift ? <DoorClosed size={17} /> : <DoorOpen size={17} />}{" "}
            {shift ? "Закрыть смену" : "Открыть смену"}
          </button>
        </div>
      </div>
      <div className="pos-demo">
        <span className="demo-label">Учебная касса</span>
        <span>
          ККТ и эквайринг не подключены. Операции не принимают реальные платежи.
        </span>
      </div>
      <div className="tabs page-tabs">
        <button aria-pressed={tab === "sale"} onClick={() => setTab("sale")}>
          Новая продажа
        </button>
        <button
          aria-pressed={tab === "history"}
          onClick={() => setTab("history")}
        >
          Продажи и возвраты
        </button>
        <button
          aria-pressed={tab === "shifts"}
          onClick={() => setTab("shifts")}
        >
          История смен
        </button>
      </div>
      {tab === "sale" ? (
        <div className="pos-layout">
          <section className="pos-catalog">
            <form
              className="search-input pos-search"
              onSubmit={(e) => {
                e.preventDefault();
                const p = data.products.find(
                  (p) => p.barcode === search || p.sku === search,
                );
                if (p && p.category !== "material") {
                  add(p.id);
                  setSearch("");
                } else if (products.length === 1) add(products[0].id);
                else setError("Уточните SKU или выберите товар из каталога");
              }}
            >
              <Search size={18} />
              <input
                placeholder="Название, SKU или сканирование штрихкода"
                aria-label="Поиск товара в кассе"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <div className="tabs compact catalog-tabs">
              {(["all", "box", "flask", "packaging"] as const).map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c === "all" ? "Все" : categoryLabels[c]}
                </button>
              ))}
            </div>
            <div className="product-grid">
              {products.map((p) => (
                <button
                  key={p.id}
                  className="pos-product"
                  onClick={() => add(p.id)}
                  disabled={p.stock < 1000 || busy}
                  aria-label={`Добавить ${p.sku}`}
                >
                  <div className="pos-product-visual">
                    <ProductArt product={p} large />
                    <span className="stock-chip">{qty(p.stock)} шт</span>
                  </div>
                  <div className="pos-product-info">
                    <h3>{p.name}</h3>
                    <p>
                      {p.size} · {p.color}
                    </p>
                    <div>
                      <b>{money(p.price)}</b>
                      <span className="add-circle">
                        <Plus size={16} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!products.length ? (
              <Empty
                title="Товар не найден"
                description="Проверьте название или штрихкод."
              />
            ) : null}
          </section>
          <aside className="panel cart">
            <div className="cart-title">
              <h2>
                Текущая продажа{" "}
                <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              </h2>
              <button
                className="icon-button"
                aria-label="Очистить корзину"
                disabled={!cart.length || busy}
                onClick={() => setCart([])}
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="cart-items">
              {cart.length ? (
                cart.map((line) => {
                  const p = data.products.find((p) => p.id === line.productId)!;
                  return (
                    <div className="cart-item" key={p.id}>
                      <ProductArt product={p} />
                      <div className="cart-item-info">
                        <b>{p.name}</b>
                        <small>
                          {p.color} · {p.size}
                        </small>
                        <div>
                          <div className="quantity-stepper">
                            <button
                              aria-label={`Уменьшить ${p.sku}`}
                              onClick={() => add(p.id, -1)}
                              disabled={busy}
                            >
                              <Minus size={13} />
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              aria-label={`Увеличить ${p.sku}`}
                              onClick={() => add(p.id)}
                              disabled={busy}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <strong>
                            {money(
                              Math.round((p.price * (100 - discount)) / 100) *
                                line.quantity,
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <Empty
                  title="Корзина пока пуста"
                  description="Выберите товар слева или отсканируйте штрихкод."
                />
              )}
            </div>
            <div className="cart-bottom">
              <Field label="Покупатель">
                <input
                  value={customer}
                  maxLength={150}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Розничный покупатель"
                />
              </Field>
              <div className="cart-discount">
                <label htmlFor="discount">Скидка на товары</label>
                <div>
                  <input
                    id="discount"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(
                        Math.max(
                          0,
                          Math.min(100, Math.round(Number(e.target.value))),
                        ),
                      )
                    }
                    disabled={busy}
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="cart-subtotal">
                <span>Без скидки</span>
                <b>{money(gross)}</b>
              </div>
              {discount > 0 ? (
                <div className="cart-subtotal">
                  <span>Скидка</span>
                  <b>−{money(gross - total)}</b>
                </div>
              ) : null}
              <div className="payment-methods" aria-label="Способ оплаты">
                {(
                  [
                    { id: "card", icon: CreditCard },
                    { id: "cash", icon: Banknote },
                    { id: "sbp", icon: QrCode },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={payment === p.id}
                    onClick={() => setPayment(p.id)}
                  >
                    <p.icon size={18} />
                    {paymentLabels[p.id]}
                  </button>
                ))}
              </div>
              <div className="cart-total">
                <span>Итого</span>
                <strong>{money(total)}</strong>
              </div>
              {error ? (
                <p role="alert" className="form-error">
                  {error}
                </p>
              ) : null}
              <button
                className="button primary block checkout"
                disabled={!cart.length || !shift || expired || busy}
                onClick={() => setCheckout(true)}
              >
                <Check size={18} />
                Оформить продажу
              </button>
              {!shift || expired ? (
                <p className="amber-text cart-hint">
                  {expired
                    ? "Закройте смену и откройте новую."
                    : "Откройте смену, чтобы провести продажу."}
                </p>
              ) : (
                <p className="cart-hint">
                  Учебная операция · без фискального чека
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : tab === "history" ? (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Продажа</th>
                  <th>Покупатель</th>
                  <th>Оплата</th>
                  <th className="numeric">Сумма</th>
                  <th>Возврат</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => {
                  const returned = s.items.reduce((n, i) => n + i.returned, 0);
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{s.number}</b>
                        <small>{dateTime(s.createdAt)}</small>
                      </td>
                      <td>{s.customer}</td>
                      <td>{paymentLabels[s.payment]}</td>
                      <td className="numeric strong">{money(s.total)}</td>
                      <td>
                        <Badge tone={returned ? "amber" : "green"}>
                          {returned
                            ? `${returned} шт возвращено`
                            : "Без возврата"}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Просмотреть ${s.number}`}
                            onClick={() => setReceiptId(s.id)}
                          >
                            <ShoppingBag size={17} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={
                              !shift ||
                              expired ||
                              s.items.every((i) => i.returned === i.quantity)
                            }
                            aria-label={`Возврат ${s.number}`}
                            onClick={() => setReturnSale(s)}
                          >
                            <RotateCcw size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Смена</th>
                  <th>Открыта</th>
                  <th>Закрыта</th>
                  <th className="numeric">В начале</th>
                  <th className="numeric">Ожидалось</th>
                  <th className="numeric">По пересчёту</th>
                  <th className="numeric">Расхождение</th>
                </tr>
              </thead>
              <tbody>
                {data.shifts.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.number}</b>
                    </td>
                    <td>{dateTime(s.openedAt)}</td>
                    <td>
                      {s.closedAt ? (
                        dateTime(s.closedAt)
                      ) : (
                        <Badge tone="green">Открыта</Badge>
                      )}
                    </td>
                    <td className="numeric">{money(s.opening)}</td>
                    <td className="numeric">{money(s.expected ?? cash)}</td>
                    <td className="numeric">
                      {s.counted !== null ? money(s.counted) : "—"}
                    </td>
                    <td className="numeric">
                      {s.counted !== null && s.expected !== null ? (
                        <span
                          className={
                            s.counted !== s.expected
                              ? "amber-text"
                              : "green-text"
                          }
                        >
                          {money(s.counted - s.expected)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {shiftDialog ? (
        <Modal
          title={shift ? "Закрыть кассовую смену" : "Открыть кассовую смену"}
          subtitle="Учебная смена: ККТ не подключена"
          onClose={() => setShiftDialog(false)}
        >
          <ActionForm
            label={shift ? "Закрыть смену" : "Открыть смену"}
            onCancel={() => setShiftDialog(false)}
            onSubmit={async (f) => {
              const result = await act(
                shift ? "shift.close" : "shift.open",
                shift
                  ? { counted: cents(String(f.get("amount"))) }
                  : { opening: cents(String(f.get("amount"))) },
                shift ? "Смена закрыта" : "Смена открыта",
              );
              if (result) setShiftDialog(false);
            }}
          >
            {shift ? (
              <div className="notice">
                Ожидаемые наличные: <b>{money(cash)}</b>
              </div>
            ) : null}
            <Field
              label={
                shift ? "Наличные по пересчёту, ₽" : "Разменный остаток, ₽"
              }
            >
              <input
                name="amount"
                type="number"
                required
                min="0"
                max="1000000"
                step=".01"
                defaultValue={shift ? cash / 100 : 5000}
              />
            </Field>
            <p className="form-note">
              В кассовый остаток входят только наличные продажи, возвраты и
              начальный размен. Безналичные платежи показываются в финансах.
            </p>
          </ActionForm>
        </Modal>
      ) : null}
      {checkout ? (
        <Modal
          title="Подтвердить учебную продажу"
          subtitle={`${cart.reduce((s, i) => s + i.quantity, 0)} шт · ${paymentLabels[payment]}`}
          onClose={() => setCheckout(false)}
        >
          <ActionForm
            label={`Провести ${money(total)}`}
            onCancel={() => setCheckout(false)}
            onSubmit={async () => {
              const result = await act(
                "sale.create",
                { items: cart, discount, payment, customer },
                "Продажа сохранена. Склад и финансы обновлены.",
              );
              if (result) {
                setCart([]);
                setDiscount(0);
                setCustomer("");
                setCheckout(false);
                setReceiptId(result.id);
              }
            }}
          >
            <div className="checkout-total">{money(total)}</div>
            <p className="form-note">
              Деньги не списываются. Будет создана учебная продажа и внутренний
              документ без фискального признака.
            </p>
          </ActionForm>
        </Modal>
      ) : null}
      {receipt ? (
        <Receipt sale={receipt} onClose={() => setReceiptId(null)} />
      ) : null}
      {returnSale ? (
        <ReturnDialog
          sale={data.sales.find((s) => s.id === returnSale.id)!}
          onClose={() => setReturnSale(null)}
        />
      ) : null}
    </>
  );
}
function Receipt({ sale: s, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal
      title={`Продажа ${s.number}`}
      subtitle="Внутренний документ — не кассовый чек"
      onClose={onClose}
    >
      <div className="receipt">
        <div className="receipt-brand">флорист маркет</div>
        <Badge tone="amber">Учебный документ</Badge>
        <p>
          {dateTime(s.createdAt)}
          <br />
          {s.customer}
        </p>
        {s.items.map((i) => (
          <div className="receipt-line" key={i.productId}>
            <div>
              <b>{i.name}</b>
              <small>
                {i.sku} · {i.quantity} × {money(i.netPrice)}
                {i.returned ? ` · возвращено ${i.returned} шт` : ""}
              </small>
            </div>
            <strong>{money(i.netPrice * i.quantity)}</strong>
          </div>
        ))}
        <div className="receipt-total">
          <b>Итого</b>
          <strong>{money(s.total)}</strong>
        </div>
        <p>
          Оплата: {paymentLabels[s.payment]}
          <br />
          Скидка: {s.discount}%
        </p>
        <p className="form-note">
          ККТ, ФН и ОФД не подключены. Документ не подтверждает фискализацию или
          реальный приём платежа.
        </p>
      </div>
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Закрыть
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Printer size={17} />
          Печатать документ
        </button>
      </div>
    </Modal>
  );
}
function ReturnDialog({
  sale: s,
  onClose,
}: {
  sale: Sale;
  onClose: () => void;
}) {
  const { act } = useStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const total = s.items.reduce(
    (sum, i) => sum + (quantities[i.productId] ?? 0) * i.netPrice,
    0,
  );
  return (
    <Modal
      title={`Возврат по ${s.number}`}
      subtitle={`Возврат на исходный способ оплаты: ${paymentLabels[s.payment]}`}
      onClose={onClose}
    >
      <ActionForm
        label={`Оформить возврат ${money(total)}`}
        onCancel={onClose}
        onSubmit={async (f) => {
          const items = Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([productId, quantity]) => ({ productId, quantity }));
          if (!items.length)
            throw new Error("Выберите количество хотя бы одного товара");
          const result = await act(
            "sale.return",
            { saleId: s.id, items, reason: f.get("reason") },
            "Возврат проведён. Товар вернулся на склад.",
          );
          if (result) onClose();
        }}
      >
        {s.items
          .filter((i) => i.returned < i.quantity)
          .map((i) => (
            <Field
              key={i.productId}
              label={`${i.name} · ${i.sku}`}
              hint={`Можно вернуть ${i.quantity - i.returned} шт по ${money(i.netPrice)}`}
            >
              <input
                type="number"
                min="0"
                max={i.quantity - i.returned}
                step="1"
                value={quantities[i.productId] ?? 0}
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [i.productId]: Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        <Field label="Причина возврата">
          <input
            name="reason"
            required
            maxLength={150}
            placeholder="Например, покупателю не подошёл размер"
          />
        </Field>
        <p className="form-note">
          Сумма и себестоимость берутся из исходной продажи, включая скидку.
          Возврат только целых единиц. Повторно вернуть один товар нельзя.
        </p>
      </ActionForm>
    </Modal>
  );
}
