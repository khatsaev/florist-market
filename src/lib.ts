import type { AppState, LedgerEntry } from "../shared/types";
export const money = (cents: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
export const qty = (scaled: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(
    scaled / 1000,
  );
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(iso));
export const dayKey = (date: Date | string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(
    new Date(date),
  );
export const today = () => dayKey(new Date());
export const addDays = (day: string, days: number) =>
  new Date(new Date(day + "T12:00:00Z").getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const cents = (value: string | number) =>
  Math.round(Number(value) * 100);
export const scaled = (value: string | number) =>
  Math.round(Number(value) * 1000);
export function isCashFlow(e: LedgerEntry) {
  return e.category !== "Списание запасов";
}
export function metrics(state: AppState, from: string, to: string) {
  const inPeriod = (at: string) => dayKey(at) >= from && dayKey(at) <= to;
  const sales = state.sales.filter((s) => inPeriod(s.createdAt));
  const returns = state.returns.filter((r) => inPeriod(r.createdAt));
  const ledger = state.ledger.filter((e) => inPeriod(e.createdAt));
  const gross = sales.reduce((s, i) => s + i.total, 0);
  const refunds = returns.reduce((s, i) => s + i.total, 0);
  const revenue = gross - refunds;
  const cogs =
    sales.reduce((s, i) => s + i.cost, 0) -
    returns.reduce((s, i) => s + i.cost, 0);
  const expenses = -ledger
    .filter((e) => e.kind === "expense")
    .reduce((s, e) => s + e.amount, 0);
  const otherIncome = ledger
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount, 0);
  const incoming = ledger
    .filter((e) => isCashFlow(e) && e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const outgoing = -ledger
    .filter((e) => isCashFlow(e) && e.amount < 0)
    .reduce((s, e) => s + e.amount, 0);
  return {
    sales,
    returns,
    ledger,
    gross,
    refunds,
    revenue,
    cogs,
    expenses,
    otherIncome,
    profit: revenue - cogs - expenses + otherIncome,
    incoming,
    outgoing,
    cashflow: incoming - outgoing,
    average: sales.length ? Math.round(gross / sales.length) : 0,
  };
}
export function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text))
      text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const data =
    "\uFEFF" +
    [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([data], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
