import { useRef, useState } from "react";
import { Field, Modal } from "./ui";
import { useStore } from "../store";
import { money } from "../lib";
import { categoryLabels, type OperationResult } from "../../shared/types";
import {
  MAX_IMPORT_BYTES,
  parseProductImport,
  planProductImport,
  type ProductImport as ImportFile,
} from "../../shared/product-import";

export default function ProductImport({ onClose }: { onClose: () => void }) {
  const { data, act, busy } = useStore();
  const [batch, setBatch] = useState<ImportFile>();
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<OperationResult>();
  const fileVersion = useRef(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  let plan: ReturnType<typeof planProductImport> | undefined;
  let conflict = "";
  if (batch && !result) {
    try {
      plan = planProductImport(batch, data.products);
    } catch (e) {
      conflict =
        e instanceof Error ? e.message : "Проверьте артикулы и штрихкоды.";
    }
  }
  async function readFile(file?: File) {
    const version = ++fileVersion.current;
    setBatch(undefined);
    setError("");
    setResult(undefined);
    setReading(!!file);
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("Файл превышает 90 КБ.");
      const text = await file.text();
      if (version !== fileVersion.current) return;
      const parsed = parseProductImport(text);
      planProductImport(parsed, data.products);
      setBatch(parsed);
    } catch (e) {
      if (version === fileVersion.current)
        setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    } finally {
      if (version === fileVersion.current) setReading(false);
    }
  }
  return (
    <Modal
      title="Импорт товаров"
      subtitle="Добавление карточек из одного файла."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!batch || !plan?.added.length || reading || busy || result)
            return;
          setError("");
          try {
            const saved = await act(
              "product.import",
              batch,
              "Импорт товаров завершён",
            );
            if (saved) setResult(saved);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Импорт не выполнен.");
            requestAnimationFrame(() => errorRef.current?.focus());
          }
        }}
      >
        <div className="form-fields product-import">
          {result ? (
            <div role="status">
              <h3>Импорт завершён</h3>
              <p>
                Добавлено: {result.imported?.length ?? 0}. Пропущено:{" "}
                {result.skipped?.length ?? 0}.
              </p>
              <p>
                Карточки сохранены. Цены и поступления можно заполнить в разделе
                «Товары и склад».
              </p>
            </div>
          ) : (
            <>
              <Field
                label="Файл товаров JSON"
                hint="До 100 товаров, не более 90 КБ."
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy || reading}
                  aria-describedby="import-rules"
                  onChange={(event) => void readFile(event.target.files?.[0])}
                />
              </Field>
              <p id="import-rules">
                Совпадения по артикулу будут пропущены. Новые карточки добавятся
                с нулевым остатком. Если в файле есть ошибка, весь импорт
                отменяется.
              </p>
              <a
                href={`${import.meta.env.BASE_URL}imports/florist-market-catalog.json`}
                download
              >
                Скачать подготовленный каталог · 57 товаров
              </a>
              {reading ? <p role="status">Проверяем файл…</p> : null}
              {plan ? (
                <>
                  <p role="status">
                    <strong>Добавится: {plan.added.length}</strong> · Уже
                    существуют: {plan.skipped.length}
                  </p>
                  {plan.added.some((p) => p.price === 0) ? (
                    <p className="import-warning">
                      Без цены: {plan.added.filter((p) => p.price === 0).length}
                      . В карточках будет 0 ₽ — укажите цены перед продажей.
                    </p>
                  ) : null}
                  <div
                    className="table-scroll import-preview"
                    role="region"
                    aria-label="Предпросмотр импорта"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Название</th>
                          <th>Категория</th>
                          <th>Цена</th>
                          <th>Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch!.products.map((p) => (
                          <tr key={p.sku}>
                            <td>{p.sku}</td>
                            <td>{p.name}</td>
                            <td>{categoryLabels[p.category]}</td>
                            <td>{p.price ? money(p.price) : "Не указана"}</td>
                            <td>
                              {plan!.skipped.includes(p.sku)
                                ? "Пропуск"
                                : "Добавление"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
        {error || conflict ? (
          <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>
            {error || conflict}
          </p>
        ) : null}
        <div className="modal-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            {result ? "Готово" : "Отмена"}
          </button>
          {!result ? (
            <button
              type="submit"
              className="button primary"
              disabled={busy || reading || !plan?.added.length || !!conflict}
            >
              {busy
                ? "Импортируем…"
                : `Добавить товары${plan ? ` (${plan.added.length})` : ""}`}
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
