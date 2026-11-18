import { useEffect, useState, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  Boxes,
  Factory,
  Wallet,
  ShoppingBag,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
import { useStore } from "./store";
import { browserDemo } from "./config";
import { Badge } from "./components/ui";
import Dashboard from "./pages/Dashboard";
const Inventory = lazy(() => import("./pages/Inventory"));
const Production = lazy(() => import("./pages/Production"));
const Finance = lazy(() => import("./pages/Finance"));
const Pos = lazy(() => import("./pages/Pos"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/Settings"));
export type Page =
  | "dashboard"
  | "inventory"
  | "production"
  | "finance"
  | "pos"
  | "reports"
  | "settings";
const nav = [
  { id: "dashboard", label: "Обзор", icon: LayoutDashboard },
  { id: "inventory", label: "Товары и склад", icon: Boxes },
  { id: "production", label: "Производство", icon: Factory },
  { id: "finance", label: "Финансы", icon: Wallet },
  { id: "pos", label: "Касса", icon: ShoppingBag },
  { id: "reports", label: "Отчёты", icon: ChartNoAxesCombined },
] as const;
function getPage(): Page {
  const value = location.hash.slice(1);
  return [...nav.map((n) => n.id), "settings"].includes(value)
    ? (value as Page)
    : "dashboard";
}
export default function App() {
  const { data } = useStore();
  const [page, setPage] = useState<Page>(getPage);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState(false);
  useEffect(() => {
    const update = () => setPage(getPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobile(false);
        setAlerts(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const go = (p: Page) => {
    location.hash = p;
    setPage(p);
    setMobile(false);
    setAlerts(false);
  };
  const low = data.products.filter((p) => p.stock < p.minStock);
  const production = data.production.filter(
    (p) => p.status === "in_progress" || p.status === "planned",
  );
  const shift = data.shifts.find((s) => !s.closedAt);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start" });
        }}
      >
        Перейти к содержимому
      </a>
      {mobile ? (
        <button
          aria-label="Закрыть меню"
          className="menu-overlay"
          onClick={() => setMobile(false)}
        />
      ) : null}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a href="#dashboard" className="brand" onClick={() => go("dashboard")}>
          <span className="brand-icon">
            <Leaf size={25} />
          </span>
          <span>
            флорист<span>маркет</span>
          </span>
        </a>
        <div className="workspace-chip">
          <div className="shop-symbol">ФМ</div>
          <div>
            <b>Флорист Маркет</b>
            <span>Магазин и производство</span>
          </div>
          <ChevronDown size={15} aria-hidden />
        </div>
        <div className="nav-caption">Рабочее пространство</div>
        <nav aria-label="Главная навигация">
          {nav.map((n) => (
            <a
              href={"#" + n.id}
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "production" ? (
                <span className="nav-count">{production.length}</span>
              ) : n.id === "pos" ? (
                <span className={"nav-dot " + (shift ? "on" : "")} />
              ) : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="status-dot" />
            <b>Демо-пространство</b>
            <p>Можно пробовать: здесь только тестовые данные.</p>
            <button onClick={() => go("settings")}>
              О приложении <ArrowUpRight size={14} />
            </button>
          </div>
          <a
            className={
              "settings-link " + (page === "settings" ? "selected" : "")
            }
            href="#settings"
            onClick={() => go("settings")}
          >
            <Settings size={18} />
            Настройки
          </a>
          <div className="user-card">
            <span className="avatar">ФМ</span>
            <div>
              <b>Управляющий</b>
              <small>
                {browserDemo ? "Демо в браузере" : "Локальный доступ"}
              </small>
            </div>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label={mobile ? "Закрыть меню" : "Открыть меню"}
            >
              {mobile ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>Рабочее пространство</span>
            <span className="slash">/</span>
            <b>{nav.find((n) => n.id === page)?.label ?? "Настройки"}</b>
          </div>
          <div className="topbar-actions">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                go("inventory");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Поиск товаров и SKU"
                placeholder="Поиск товаров и SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <Badge tone="green">{browserDemo ? "Демо" : "Локально"}</Badge>
            <button
              className="icon-button notification-button"
              onClick={() => setAlerts(!alerts)}
              aria-label="Открыть уведомления"
              aria-expanded={alerts}
            >
              <Bell size={19} />
              {low.length ? <i /> : null}
            </button>
            <span className="avatar small">ФМ</span>
          </div>
          {alerts ? (
            <div className="notification-panel">
              <h3>Требуют внимания</h3>
              <button onClick={() => go("inventory")}>
                <Boxes size={18} />
                <span>
                  {low.length} позиций ниже минимума
                  <small>Проверьте остатки на складе</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
              <button onClick={() => go("production")}>
                <Factory size={18} />
                <span>
                  {production.length} заказов в работе
                  <small>План и выпуск продукции</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          ) : null}
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {browserDemo ? (
            <div className="notice demo-notice">
              Демоверсия · данные сохраняются только в этом браузере. Можно
              пробовать все операции.
            </div>
          ) : null}
          <Suspense fallback={<div className="empty">Загружаем раздел…</div>}>
            {page === "dashboard" ? (
              <Dashboard go={go} />
            ) : page === "inventory" ? (
              <Inventory search={search} setSearch={setSearch} />
            ) : page === "production" ? (
              <Production />
            ) : page === "finance" ? (
              <Finance />
            ) : page === "pos" ? (
              <Pos />
            ) : page === "reports" ? (
              <Reports />
            ) : (
              <SettingsPage />
            )}
          </Suspense>
          <footer className="app-footer">
            <span>Флорист Маркет · Рабочее пространство</span>
            <span>Учебный режим · без фискализации</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
