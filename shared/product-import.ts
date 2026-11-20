import { z } from "zod";
import type { Product } from "./types";

const money = z.number().int().min(0).max(100_000_000);
const text = z.string().trim().min(1).max(150);
export const productSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  sku: text,
  barcode: z.string().trim().max(50).default(""),
  name: text,
  category: z.enum(["box", "flask", "packaging", "material"]),
  size: z.string().trim().max(60),
  color: z.string().trim().max(60),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  unit: z.enum(["шт", "м", "м²", "кг", "л"]),
  minStock: money,
  price: money,
  cost: money,
});

export const MAX_IMPORT_BYTES = 90 * 1024;
export const MAX_IMPORT_PRODUCTS = 100;
export const productImportSchema = z
  .object({
    version: z.literal(1),
    products: z
      .array(
        productSchema
          .omit({ id: true })
          .strict()
          .refine((p) => p.category === "material" || p.unit === "шт", {
            message: "Готовая продукция учитывается в штуках",
            path: ["unit"],
          }),
      )
      .min(1)
      .max(MAX_IMPORT_PRODUCTS),
  })
  .strict();
export type ProductImport = z.infer<typeof productImportSchema>;
export class ProductImportError extends Error {}

export function parseProductImport(text: string): ProductImport {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new ProductImportError("Файл превышает 90 КБ.");
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new ProductImportError(
      "Не удалось прочитать JSON. Проверьте формат файла.",
    );
  }
  const parsed = productImportSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row =
      typeof issue.path[1] === "number" ? `, товар ${issue.path[1] + 1}` : "";
    throw new ProductImportError(
      `Проверьте файл${row}: ${issue.path.join(".") || "формат"} — ${issue.message}`,
    );
  }
  return parsed.data;
}

/** Preview and service share the same checks; the service rechecks inside its transaction. */
export function planProductImport(
  batch: ProductImport,
  existing: Pick<Product, "sku" | "barcode">[],
) {
  const bySku = new Map(existing.map((p) => [p.sku, p]));
  const byBarcode = new Map(
    existing.filter((p) => p.barcode).map((p) => [p.barcode, p]),
  );
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  const added: ProductImport["products"] = [];
  const skipped: string[] = [];
  for (const p of batch.products) {
    if (skus.has(p.sku))
      throw new ProductImportError(`Артикул ${p.sku} повторяется в файле.`);
    skus.add(p.sku);
    if (p.barcode && barcodes.has(p.barcode))
      throw new ProductImportError(
        `Штрихкод ${p.barcode} повторяется в файле.`,
      );
    if (p.barcode) barcodes.add(p.barcode);
    if (bySku.has(p.sku)) {
      skipped.push(p.sku);
      continue;
    }
    const owner = p.barcode ? byBarcode.get(p.barcode) : undefined;
    if (owner)
      throw new ProductImportError(
        `Товар ${p.sku}: штрихкод уже принадлежит ${owner.sku}.`,
      );
    added.push(p);
  }
  return { added, skipped };
}
