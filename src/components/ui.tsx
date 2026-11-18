import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, ArrowUpRight, PackageOpen } from "lucide-react";
import type { Product } from "../../shared/types";
import { useStore } from "../store";
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть окно"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ActionForm({
  children,
  onSubmit,
  label = "Сохранить",
  onCancel,
}: {
  children: ReactNode;
  onSubmit: (f: FormData) => Promise<unknown>;
  label?: string;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const { busy } = useStore();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-fields">
        {children}
      </fieldset>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="modal-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Отмена
        </button>
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Сохраняем…" : label}
        </button>
      </div>
    </form>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "blue" | "red" | "neutral";
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={32} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={"stat " + (accent ? "accent" : "")}>
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}
export function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function ProductArt({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const c = product.colorHex;
  return (
    <div
      className={"product-art " + (large ? "large" : "")}
      style={{ "--product-color": c } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 90" fill="none">
        {product.category === "flask" ? (
          <>
            <ellipse cx="50" cy="75" rx="26" ry="8" fill={c} opacity=".3" />
            <path
              d="M24 23v47c0 12 52 12 52 0V23"
              fill={c}
              fillOpacity=".12"
              stroke={c}
              strokeWidth="2"
            />
            <ellipse
              cx="50"
              cy="23"
              rx="26"
              ry="9"
              fill={c}
              fillOpacity=".14"
              stroke={c}
              strokeWidth="2"
            />
            <path
              d="M31 30v34"
              stroke="white"
              strokeOpacity=".35"
              strokeWidth="3"
            />
            <ellipse cx="50" cy="70" rx="24" ry="7" fill={c} fillOpacity=".4" />
          </>
        ) : product.category === "packaging" ||
          product.category === "material" ? (
          <>
            <path d="M24 24l40-8 16 45-39 14z" fill={c} />
            <path d="M24 24l17 51-12 4-17-48z" fill={c} opacity=".65" />
            <path
              d="M36 26l15 43M46 24l15 43M56 22l15 43"
              stroke="#fff"
              strokeOpacity=".18"
            />
          </>
        ) : (
          <>
            <ellipse cx="50" cy="76" rx="34" ry="8" fill="#000" opacity=".18" />
            <path d="M19 30v36c0 16 62 16 62 0V30" fill={c} />
            <path d="M50 37v40c17 0 31-5 31-11V30" fill="#000" opacity=".12" />
            <ellipse cx="50" cy="30" rx="32" ry="12" fill={c} />
            <ellipse
              cx="50"
              cy="28"
              rx="33"
              ry="12"
              fill={c}
              stroke="white"
              strokeOpacity=".25"
            />
            <path
              d="M17 29v6c5 14 61 14 66 0v-6"
              stroke="#000"
              strokeOpacity=".18"
            />
            <path
              d="M46 43v26M54 43v26"
              stroke="#fff"
              strokeOpacity=".25"
              strokeWidth="1.5"
            />
            <text
              x="50"
              y="63"
              textAnchor="middle"
              fill="#fff"
              fillOpacity=".7"
              fontSize="10"
              fontFamily="serif"
            >
              ф
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
