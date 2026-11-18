import { useState } from "react";
import {
  Download,
  ChartNoAxesCombined,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { useStore } from "../store";
import { money, today, addDays, metrics, downloadCsv, qty } from "../lib";
import { Stat, SectionHead, Field, Badge } from "../components/ui";
import { RevenueChart } from "../components/Chart";
export default function Reports() {
  const { data } = useStore();
  const [from, setFrom] = useState(addDays(today(), -29));
  const [to, setTo] = useState(today());
  const m = metrics(data, from, to);
  const rows = [
    ["Выручка от продаж", m.gross],
    ["Возвраты", -m.refunds],
    ["Чистая выручка", m.revenue],
    ["Себестоимость продаж", -m.cogs],
    ["Валовая прибыль", m.revenue - m.cogs],
    ["Прочие доходы", m.otherIncome],
    ["Управленческие расходы", -m.expenses],
    ["Результат до налогов", m.profit],
  ] as [string, number][];
  const productTotals = new Map<
    string,
    {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      cost: number;
    }
  >();
  for (const s of m.sales)
    for (const i of s.items) {
      const p = productTotals.get(i.productId) ?? {
        name: i.name,
        sku: i.sku,
        quantity: 0,
        revenue: 0,
        cost: 0,
      };
      p.quantity += i.quantity;
      p.revenue += i.netPrice * i.quantity;
      p.cost += i.unitCost * i.quantity;
      productTotals.set(i.productId, p);
    }
  for (const r of m.returns) {
    const s = data.sales.find((s) => s.id === r.saleId)!;
    for (const i of r.items) {
      const original = s.items.find((l) => l.productId === i.productId)!;
      const p = productTotals.get(i.productId) ?? {
        name: original.name,
        sku: original.sku,
        quantity: 0,
        revenue: 0,
        cost: 0,
      };
      p.quantity -= i.quantity;
      p.revenue -= original.netPrice * i.quantity;
      p.cost -= original.unitCost * i.quantity;
      productTotals.set(i.productId, p);
    }
  }
  const top = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue);
  const stock = data.products.reduce(
    (sum, p) => sum + Math.round((p.stock * p.cost) / 1000),
    0,
  );
  const days = Math.max(
    1,
    Math.min(
      30,
      Math.round(
        (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
      ) + 1,
    ),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Отчёты</h1>
          <p>Понимайте результат бизнеса на основе проведённых операций.</p>
        </div>
        <button
          className="button"
          onClick={() =>
            downloadCsv(
              `florist-report-${from}-${to}.csv`,
              ["Показатель", "Сумма ₽"],
              rows.map(([label, value]) => [label, value / 100]),
            )
          }
        >
          <Download size={17} />
          Экспорт отчёта
        </button>
      </div>
      <div className="date-filter">
        <Field label="Начало периода">
          <input
            type="date"
            value={from}
            max={to}
            required
            onChange={(e) => setFrom(e.target.value || from)}
          />
        </Field>
        <Field label="Конец периода">
          <input
            type="date"
            value={to}
            min={from}
            required
            onChange={(e) => setTo(e.target.value || to)}
          />
        </Field>
        <Badge>Время Москвы</Badge>
      </div>
      <div className="stats-grid three">
        <Stat
          label="Выручка за вычетом возвратов"
          value={money(m.revenue)}
          sub={`${m.sales.length} продаж · ${m.returns.length} возвратов`}
          icon={<ArrowUpRight size={20} />}
          accent
        />
        <Stat
          label="Результат до налогов"
          value={money(m.profit)}
          sub="Управленческая оценка"
          icon={<ChartNoAxesCombined size={20} />}
        />
        <Stat
          label="Денежный поток"
          value={money(m.cashflow)}
          sub="Поступления минус выплаты"
          icon={<Wallet size={20} />}
        />
      </div>
      <div className="reports-grid">
        <section className="panel">
          <SectionHead
            title="Доходы и расходы"
            description="Управленческий отчёт о результате"
          />
          <div className="report-lines">
            {rows.map(([label, value], i) => (
              <div
                className={
                  i === 7 ? "total" : i === 2 || i === 4 ? "subtotal" : ""
                }
                key={label}
              >
                <span>{label}</span>
                <b className={i === 7 && value >= 0 ? "green-text" : ""}>
                  {money(value)}
                </b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <SectionHead
            title="Движение денежных средств"
            description="Не включает неденежные списания запасов"
          />
          <div className="report-lines">
            <div>
              <span>Поступления</span>
              <b className="green-text">{money(m.incoming)}</b>
            </div>
            <div>
              <span>Выплаты</span>
              <b>{money(m.outgoing)}</b>
            </div>
            <div className="total">
              <span>Чистый поток</span>
              <b>{money(m.cashflow)}</b>
            </div>
          </div>
          <div className="accounting-note">
            <h3>Почему прибыль и деньги отличаются?</h3>
            <p>
              Закупка материалов уменьшает деньги, но запас становится расходом
              по мере продажи. Погашение долга влияет на деньги и не создаёт
              выручку повторно.
            </p>
          </div>
          <div className="report-lines">
            <div>
              <span>Запасы сейчас</span>
              <b>{money(stock)}</b>
            </div>
            <div>
              <span>Сырьё в производстве</span>
              <b>
                {money(
                  data.production
                    .filter((o) => o.status === "in_progress")
                    .reduce((s, o) => s + o.materialCost, 0),
                )}
              </b>
            </div>
          </div>
        </section>
      </div>
      <section className="panel section-space">
        <SectionHead
          title="Выручка по дням"
          description={
            days === 30
              ? "Последние 30 дней выбранного периода"
              : "Выбранный период"
          }
        />
        <RevenueChart data={data} days={days} to={to} />
      </section>
      <section className="panel section-space">
        <SectionHead
          title="Продажи по товарам"
          description="Возвраты относятся к дате возврата, даже если продажа была раньше"
          action={
            <button
              className="button"
              onClick={() =>
                downloadCsv(
                  "florist-products-report.csv",
                  [
                    "Товар",
                    "SKU",
                    "Количество",
                    "Выручка ₽",
                    "Валовая прибыль ₽",
                  ],
                  top.map((p) => [
                    p.name,
                    p.sku,
                    p.quantity,
                    p.revenue / 100,
                    (p.revenue - p.cost) / 100,
                  ]),
                )
              }
            >
              <Download size={16} />
              CSV
            </button>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>SKU</th>
                <th className="numeric">Продано, шт</th>
                <th className="numeric">Выручка</th>
                <th className="numeric">Валовая прибыль</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.sku}>
                  <td>
                    <b>{p.name}</b>
                  </td>
                  <td className="muted">{p.sku}</td>
                  <td className="numeric">{p.quantity}</td>
                  <td className="numeric">{money(p.revenue)}</td>
                  <td className="numeric green-text">
                    {money(p.revenue - p.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="report-disclaimer">
        Это управленческие отчёты по тестовым данным, не бухгалтерский баланс и
        не налоговая декларация. НДС не выделяется; суммы показаны целиком.
        Стоимость труда и накладных в производстве нормативная.
      </p>
    </>
  );
}
