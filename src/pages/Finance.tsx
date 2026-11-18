import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Download,
} from "lucide-react";
import { useStore } from "../store";
import {
  money,
  cents,
  today,
  addDays,
  metrics,
  dateTime,
  downloadCsv,
} from "../lib";
import { Modal, ActionForm, Field, Badge, Empty, Stat } from "../components/ui";
import type { Debt } from "../../shared/types";
export default function Finance() {
  const { data, act } = useStore();
  const [tab, setTab] = useState("ledger");
  const [kind, setKind] = useState("all");
  const [editor, setEditor] = useState<"finance" | "debt" | null>(null);
  const [payment, setPayment] = useState<Debt | null>(null);
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());
  const m = metrics(data, from, to);
  const entries = m.ledger.filter(
    (e) => kind === "all" || (kind === "in" ? e.amount > 0 : e.amount < 0),
  );
  const owed = data.debts
    .filter((d) => d.direction === "payable")
    .reduce((s, d) => s + d.amount - d.paid, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Финансы</h1>
          <p>Движение средств, расходы и взаиморасчёты.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setEditor(tab === "ledger" ? "finance" : "debt")}
        >
          <Plus size={18} />
          {tab === "ledger" ? "Добавить операцию" : "Добавить задолженность"}
        </button>
      </div>
      <div className="date-filter">
        <Field label="Период с">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value || from)}
          />
        </Field>
        <Field label="по">
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value || to)}
          />
        </Field>
        <span>Денежные показатели — за выбранный период</span>
      </div>
      <div className="stats-grid three">
        <Stat
          label="Поступило"
          value={money(m.incoming)}
          sub="Продажи, прочие доходы и погашения"
          icon={<ArrowDownLeft size={20} />}
          accent
        />
        <Stat
          label="Выплачено"
          value={money(m.outgoing)}
          sub="Расходы, закупки и возвраты"
          icon={<ArrowUpRight size={20} />}
        />
        <Stat
          label="Должны поставщикам"
          value={money(owed)}
          sub="Текущий непогашенный остаток"
          icon={<Wallet size={20} />}
        />
      </div>
      <div className="tabs page-tabs">
        <button
          aria-pressed={tab === "ledger"}
          onClick={() => setTab("ledger")}
        >
          Операции
        </button>
        <button aria-pressed={tab === "debts"} onClick={() => setTab("debts")}>
          Задолженности{" "}
          <span>{data.debts.filter((d) => d.paid < d.amount).length}</span>
        </button>
      </div>
      <section className="panel">
        {tab === "ledger" ? (
          <>
            <div className="table-toolbar">
              <div className="tabs compact">
                {[
                  ["all", "Все операции"],
                  ["in", "Поступления"],
                  ["out", "Списания"],
                ].map(([v, t]) => (
                  <button
                    key={v}
                    aria-pressed={kind === v}
                    onClick={() => setKind(v)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                className="button"
                onClick={() =>
                  downloadCsv(
                    "florist-finance.csv",
                    ["Дата", "Категория", "Описание", "Сумма ₽", "Счёт"],
                    entries.map((e) => [
                      dateTime(e.createdAt),
                      e.category,
                      e.description,
                      e.amount / 100,
                      e.account === "cash" ? "Касса POS" : "Расчётный счёт",
                    ]),
                  )
                }
              >
                <Download size={16} />
                Экспорт
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Операция</th>
                    <th>Категория</th>
                    <th>Счёт</th>
                    <th className="numeric">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{dateTime(e.createdAt)}</td>
                      <td>
                        <b>{e.description}</b>
                        <small>
                          {e.kind === "sale"
                            ? "Продажа"
                            : e.kind === "return"
                              ? "Возврат"
                              : e.kind === "debt"
                                ? "Погашение долга"
                                : e.kind === "stock"
                                  ? "Закупка"
                                  : e.amount > 0
                                    ? "Доход"
                                    : "Расход"}
                        </small>
                      </td>
                      <td>{e.category}</td>
                      <td>
                        <Badge>
                          {e.category === "Списание запасов"
                            ? "Без движения денег"
                            : e.account === "cash"
                              ? "Касса POS"
                              : "Расчётный счёт"}
                        </Badge>
                      </td>
                      <td
                        className={
                          "numeric strong " + (e.amount > 0 ? "green-text" : "")
                        }
                      >
                        {e.amount > 0 ? "+" : ""}
                        {money(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!entries.length ? (
              <Empty title="В этом периоде нет операций" />
            ) : null}
            <div className="table-footer">
              Продажи и возвраты попадают сюда автоматически. Двойной ввод не
              требуется.
            </div>
          </>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Контрагент</th>
                    <th>Вид долга</th>
                    <th>Срок оплаты</th>
                    <th className="numeric">Сумма</th>
                    <th className="numeric">Остаток</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.debts.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <b>{d.party}</b>
                        <small>{d.note}</small>
                      </td>
                      <td>
                        {d.direction === "receivable"
                          ? "Нам должны"
                          : "Мы должны"}
                      </td>
                      <td>{new Date(d.dueDate).toLocaleDateString("ru-RU")}</td>
                      <td className="numeric">{money(d.amount)}</td>
                      <td className="numeric strong">
                        {money(d.amount - d.paid)}
                      </td>
                      <td>
                        <Badge
                          tone={
                            d.paid === d.amount
                              ? "green"
                              : d.dueDate < today()
                                ? "red"
                                : "amber"
                          }
                        >
                          {d.paid === d.amount
                            ? "Погашен"
                            : d.dueDate < today()
                              ? "Просрочен"
                              : d.paid
                                ? "Частично"
                                : "Ожидает оплаты"}
                        </Badge>
                      </td>
                      <td>
                        {d.paid < d.amount ? (
                          <button
                            className="button small-button"
                            onClick={() => setPayment(d)}
                          >
                            Погасить
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              Долги ведутся отдельным реестром. Погашение меняет движение денег,
              но повторно не создаёт доход или расход.
            </div>
          </>
        )}
      </section>
      <div className="notice section-space">
        <Wallet size={20} />
        <p>
          Управленческий учёт. Налоги, проводки и регламентированная отчётность
          здесь не рассчитываются. Для юридически значимого учёта потребуется
          интеграция с бухгалтерской системой.
        </p>
      </div>
      {editor === "finance" ? (
        <FinanceEditor onClose={() => setEditor(null)} />
      ) : null}
      {editor === "debt" ? (
        <DebtEditor onClose={() => setEditor(null)} />
      ) : null}
      {payment ? (
        <Modal
          title="Погасить задолженность"
          subtitle={payment.party}
          onClose={() => setPayment(null)}
        >
          <ActionForm
            label="Провести оплату"
            onCancel={() => setPayment(null)}
            onSubmit={async (f) => {
              const r = await act(
                "debt.pay",
                { id: payment.id, amount: cents(String(f.get("amount"))) },
                "Оплата отражена. Остаток долга обновлён.",
              );
              if (r) setPayment(null);
            }}
          >
            <Field
              label="Сумма оплаты, ₽"
              hint={`Остаток: ${money(payment.amount - payment.paid)}`}
            >
              <input
                name="amount"
                type="number"
                required
                min=".01"
                max={(payment.amount - payment.paid) / 100}
                step=".01"
                defaultValue={(payment.amount - payment.paid) / 100}
              />
            </Field>
            <p className="form-note">
              Будет зарегистрировано{" "}
              {payment.direction === "receivable"
                ? "поступление на расчётный счёт"
                : "списание с расчётного счёта"}
              . Банковский перевод приложение не выполняет.
            </p>
          </ActionForm>
        </Modal>
      ) : null}
    </>
  );
}
function FinanceEditor({ onClose }: { onClose: () => void }) {
  const { act } = useStore();
  const [kind, setKind] = useState("expense");
  return (
    <Modal
      title="Финансовая операция"
      subtitle="Ручная операция по расчётному счёту"
      onClose={onClose}
    >
      <ActionForm
        onCancel={onClose}
        onSubmit={async (f) => {
          const r = await act(
            "finance.create",
            {
              kind,
              category: f.get("category"),
              amount: cents(String(f.get("amount"))),
              description: f.get("description"),
            },
            "Финансовая операция сохранена",
          );
          if (r) onClose();
        }}
      >
        <Field label="Тип операции">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="expense">Расход</option>
            <option value="income">Прочий доход</option>
          </select>
        </Field>
        <Field label="Категория">
          <input
            name="category"
            required
            maxLength={150}
            placeholder={
              kind === "expense"
                ? "Например, аренда"
                : "Например, услуги упаковки"
            }
          />
        </Field>
        <Field label="Сумма, ₽">
          <input
            name="amount"
            type="number"
            required
            min=".01"
            max="1000000"
            step=".01"
          />
        </Field>
        <Field label="Описание / документ">
          <input name="description" required maxLength={150} />
        </Field>
        <p className="form-note">
          Не используйте эту форму для закупки запасов, погашения долга или
          продаж: для них есть отдельные операции.
        </p>
      </ActionForm>
    </Modal>
  );
}
function DebtEditor({ onClose }: { onClose: () => void }) {
  const { act } = useStore();
  return (
    <Modal
      title="Новая задолженность"
      subtitle="Отдельный реестр расчётов с контрагентами"
      onClose={onClose}
    >
      <ActionForm
        onCancel={onClose}
        onSubmit={async (f) => {
          const r = await act(
            "debt.create",
            {
              party: f.get("party"),
              direction: f.get("direction"),
              amount: cents(String(f.get("amount"))),
              dueDate: f.get("dueDate"),
              note: f.get("note"),
            },
            "Задолженность добавлена",
          );
          if (r) onClose();
        }}
      >
        <Field label="Контрагент">
          <input name="party" required maxLength={150} />
        </Field>
        <Field label="Направление">
          <select name="direction">
            <option value="receivable">Клиент должен нам</option>
            <option value="payable">Мы должны поставщику</option>
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Сумма, ₽">
            <input
              name="amount"
              type="number"
              required
              min=".01"
              max="1000000"
              step=".01"
            />
          </Field>
          <Field label="Срок оплаты">
            <input name="dueDate" type="date" required defaultValue={today()} />
          </Field>
        </div>
        <Field label="Основание">
          <input
            name="note"
            maxLength={500}
            placeholder="Накладная, договор или начальный остаток"
          />
        </Field>
        <p className="form-note">
          Создание долга не меняет остатки товара, выручку и движение денег.
          Учитывайте основание соответствующей операцией.
        </p>
      </ActionForm>
    </Modal>
  );
}
