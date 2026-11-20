import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppState, Operation, OperationResult } from "../shared/types";
import { browserDemo } from "./config";
interface Store {
  data: AppState;
  busy: boolean;
  act: (
    op: Operation,
    body: unknown,
    message?: string,
  ) => Promise<OperationResult | null>;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
}
const Context = createContext<Store | null>(null);
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error("Store missing");
  return c;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppState>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const inFlight = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | undefined>(
    undefined,
  );
  async function refresh() {
    try {
      if (browserDemo) {
        const { demoRequest } = await import("./demo/client");
        setData((await demoRequest()).state);
      } else {
        const r = await fetch("/api/state");
        if (!r.ok) throw new Error("Сервер недоступен");
        setData(await r.json());
      }
      setError("");
    } catch (e) {
      setError(
        browserDemo
          ? e instanceof Error
            ? e.message
            : "Не удалось открыть демоверсию. Обновите браузер и повторите попытку."
          : "Не удалось подключиться. Проверьте, что приложение запущено.",
      );
    }
  }
  useEffect(() => {
    void refresh();
    const update = () => {
      if (document.visibilityState === "visible" && !inFlight.current)
        void refresh();
    };
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  async function act(
    op: Operation,
    body: unknown,
    message = "Операция сохранена",
  ) {
    if (!data || inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    const fingerprint = JSON.stringify({ op, body });
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, id: crypto.randomUUID() };
    try {
      if (browserDemo) {
        const { demoRequest } = await import("./demo/client");
        const json = await demoRequest(op, body, retry.current.id);
        setData(json.state);
        retry.current = undefined;
        setToast(message);
        return json.result;
      }
      const r = await fetch("/api/operations/" + op, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": data.csrfToken,
          "Idempotency-Key": retry.current.id,
        },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Не удалось сохранить");
      setData(json.state);
      retry.current = undefined;
      setToast(message);
      return json.result as OperationResult;
    } catch (e) {
      throw new Error(
        e instanceof Error
          ? e.message
          : "Проверьте подключение и повторите операцию",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="loading-screen">
        <span className="brand-icon">ф</span>
        <h1>Флорист Маркет</h1>
        <p>{error || "Загружаем рабочее пространство…"}</p>
        {error ? (
          <button onClick={() => void refresh()}>Повторить подключение</button>
        ) : (
          <span className="loader" />
        )}
      </div>
    );
  return (
    <Context.Provider value={{ data, busy, act, notify: setToast, refresh }}>
      {children}
      {toast ? (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
          <button aria-label="Закрыть уведомление" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      ) : null}
    </Context.Provider>
  );
}
