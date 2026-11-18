import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Factory,
  Plus,
  CalendarDays,
  Wallet,
  Package,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useStore } from "../store";
import { money, qty, today, addDays, metrics, dateTime } from "../lib";
import {
  Badge,
  Stat,
  SectionHead,
  TextLink,
  ProductArt,
  Empty,
} from "../components/ui";
import { RevenueChart } from "../components/Chart";
import type { Page } from "../App";
import { paymentLabels } from "../../shared/types";
export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const { data } = useStore();
  const [days, setDays] = useState(14);
  const to = today();
  const m = metrics(data, addDays(to, 1 - days), to);
  const low = data.products.filter((p) => p.stock < p.minStock);
  const orders = data.production.filter(
    (o) => o.status === "planned" || o.status === "in_progress",
  );
  const stocks = data.products.reduce(
    (s, p) => s + Math.round((p.stock * p.cost) / 1000),
    0,
  );
  const receivable = data.debts
    .filter((d) => d.direction === "receivable")
    .reduce((s, d) => s + d.amount - d.paid, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            Ваш бизнес в одном месте
          </div>
          <h1>Обзор магазина</h1>
          <p>Всё, что важно сегодня для «Флорист Маркета».</p>
        </div>
        <button className="button primary" onClick={() => go("pos")}>
          <Plus size={18} />
          Новая продажа
        </button>
      </div>
      <div className="overview-toolbar">
        <div className="tabs compact" aria-label="Период обзора">
          {[7, 14, 30].map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {n === 7 ? "Неделя" : n === 14 ? "14 дней" : "Месяц"}
            </button>
          ))}
        </div>
        <span className="date-range">
          <CalendarDays size={16} />
          {new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "long",
          }).format(new Date(addDays(to, 1 - days)))}{" "}
          —{" "}
          {new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(to))}
        </span>
      </div>
      <section className="stats-grid" aria-label="Основные показатели">
        <Stat
          label="Выручка"
          value={money(m.revenue)}
          sub={`Продаж за выбранный период: ${m.sales.length}`}
          icon={<ArrowUpRight size={18} />}
          accent
        />
        <Stat
          label="Управленческая прибыль"
          value={money(m.profit)}
          sub="После себестоимости и расходов"
          icon={<Wallet size={18} />}
        />
        <Stat
          label="Запасы на складе"
          value={money(stocks)}
          sub={`${data.products.length} SKU · по себестоимости`}
          icon={<Package size={18} />}
        />
        <Stat
          label="Клиенты должны"
          value={money(receivable)}
          sub={`Долгов к погашению: ${data.debts.filter((d) => d.direction === "receivable" && d.amount > d.paid).length}`}
          icon={<ArrowDownLeft size={18} />}
        />
      </section>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <SectionHead
            title="Динамика продаж"
            description="Как меняется выручка магазина"
            action={<Badge tone="green">{days} дней</Badge>}
          />
          <div className="chart-summary">
            <strong>{money(m.revenue)}</strong>
            <span>
              Средний чек <b>{money(m.average)}</b>
            </span>
          </div>
          <RevenueChart data={data} days={days} to={to} />
        </section>
        <section className="panel production-preview">
          <SectionHead
            title="Производство"
            action={
              <TextLink onClick={() => go("production")}>Все заказы</TextLink>
            }
          />
          <div className="production-count">
            <strong>{orders.length.toString().padStart(2, "0")}</strong>
            <div>
              {orders.length === 1
                ? "заказ в работе"
                : orders.length >= 2 && orders.length <= 4
                  ? "заказа в работе"
                  : "заказов в работе"}
              <small>
                {orders.reduce((s, o) => s + o.quantity, 0)} шт в плане
              </small>
            </div>
            <div className="factory-art">
              <Factory size={35} strokeWidth={1.1} />
            </div>
          </div>
          <div className="order-previews">
            {orders.slice(0, 3).map((o) => {
              const p = data.products.find((p) => p.id === o.productId)!;
              return (
                <button
                  key={o.id}
                  onClick={() => go("production")}
                  className="order-preview"
                >
                  <ProductArt product={p} />
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.size} · {p.color}
                    </small>
                    <span>
                      {o.number} <i>·</i> {o.quantity} шт
                    </span>
                  </div>
                  <span
                    className={
                      "tiny-dot " +
                      (o.status === "in_progress" ? "blue" : "amber")
                    }
                    title={
                      o.status === "in_progress"
                        ? "В производстве"
                        : "Запланирован"
                    }
                  />
                </button>
              );
            })}
          </div>
          {!orders.length ? <Empty title="Все партии выпущены" /> : null}
          <button className="button block" onClick={() => go("production")}>
            <Plus size={16} />
            Создать заказ
          </button>
        </section>
      </div>
      <div className="dashboard-grid lower">
        <section className="panel">
          <SectionHead
            title="Последние продажи"
            description="Операции кассы"
            action={
              <TextLink onClick={() => go("pos")}>Открыть кассу</TextLink>
            }
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Продажа</th>
                  <th>Покупатель</th>
                  <th>Оплата</th>
                  <th className="numeric">Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sales.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.number}</b>
                      <small>{dateTime(s.createdAt)}</small>
                    </td>
                    <td>{s.customer}</td>
                    <td>
                      <Badge>{paymentLabels[s.payment]}</Badge>
                    </td>
                    <td className="numeric strong">{money(s.total)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Открыть кассу для ${s.number}`}
                        onClick={() => go("pos")}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel attention-panel">
          <SectionHead
            title="Пора пополнить"
            action={<Badge tone="amber">{low.length} SKU</Badge>}
          />
          <p className="panel-description">
            Остатки ниже установленного минимума.
          </p>
          {low.slice(0, 3).map((p) => (
            <div className="low-row" key={p.id}>
              <ProductArt product={p} />
              <div>
                <b>{p.name}</b>
                <small>
                  {p.color} · {p.size || p.unit}
                </small>
              </div>
              <div className="low-qty">
                <b>
                  {qty(p.stock)} {p.unit}
                </b>
                <small>мин. {qty(p.minStock)}</small>
              </div>
            </div>
          ))}
          {low.length === 0 ? <Empty title="Запасов достаточно" /> : null}
          <button className="text-link" onClick={() => go("inventory")}>
            Перейти к остаткам <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="workflow-note">
        <ShoppingBag size={20} />
        <span>От сырья до продажи</span>
        <p>
          Склад, производство и финансы связаны. Каждая операция обновляет
          данные во всех разделах.
        </p>
        <button
          className="icon-button"
          aria-label="Посмотреть устройство приложения"
          onClick={() => go("settings")}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
    </>
  );
}
