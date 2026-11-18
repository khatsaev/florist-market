export type Category = "box" | "flask" | "packaging" | "material";
export type Payment = "cash" | "card" | "sbp";
export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: Category;
  size: string;
  color: string;
  colorHex: string;
  unit: string;
  stock: number;
  minStock: number;
  price: number;
  cost: number;
}
export interface BomItem {
  materialId: string;
  quantity: number;
}
export interface Recipe {
  id: string;
  productId: string;
  name: string;
  version: number;
  labor: number;
  overhead: number;
  items: BomItem[];
}
export interface Production {
  id: string;
  number: string;
  productId: string;
  recipeId: string;
  quantity: number;
  dueDate: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  recipe: Recipe;
  materialCost: number;
  totalCost: number;
  createdAt: string;
  completedAt: string | null;
}
export interface SaleItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  returned: number;
  unitPrice: number;
  netPrice: number;
  unitCost: number;
}
export interface Sale {
  id: string;
  number: string;
  shiftId: string;
  payment: Payment;
  discount: number;
  total: number;
  cost: number;
  customer: string;
  createdAt: string;
  items: SaleItem[];
}
export interface ReturnRecord {
  id: string;
  saleId: string;
  shiftId: string;
  total: number;
  cost: number;
  reason: string;
  createdAt: string;
  items: { productId: string; quantity: number }[];
}
export interface Shift {
  id: string;
  number: string;
  openedAt: string;
  closedAt: string | null;
  opening: number;
  counted: number | null;
  expected: number | null;
}
export interface LedgerEntry {
  id: string;
  kind: "sale" | "return" | "income" | "expense" | "stock" | "debt";
  category: string;
  amount: number;
  account: "cash" | "bank";
  description: string;
  reference: string;
  createdAt: string;
}
export interface Debt {
  id: string;
  party: string;
  direction: "receivable" | "payable";
  amount: number;
  paid: number;
  dueDate: string;
  note: string;
  createdAt: string;
}
export interface Movement {
  id: string;
  productId: string;
  quantity: number;
  kind: string;
  reference: string;
  createdAt: string;
}
export interface Audit {
  id: string;
  action: string;
  entity: string;
  detail: string;
  createdAt: string;
}
export interface AppState {
  products: Product[];
  recipes: Recipe[];
  production: Production[];
  sales: Sale[];
  returns: ReturnRecord[];
  shifts: Shift[];
  ledger: LedgerEntry[];
  debts: Debt[];
  movements: Movement[];
  audit: Audit[];
  csrfToken: string;
  serverTime: string;
  mode: "demo";
}
export type Operation =
  | "product.save"
  | "stock.adjust"
  | "recipe.save"
  | "production.create"
  | "production.start"
  | "production.complete"
  | "production.cancel"
  | "shift.open"
  | "shift.close"
  | "sale.create"
  | "sale.return"
  | "finance.create"
  | "debt.create"
  | "debt.pay";
export const categoryLabels: Record<Category, string> = {
  box: "Шляпные коробки",
  flask: "Колбы «Аква»",
  packaging: "Упаковка",
  material: "Сырьё",
};
export const paymentLabels: Record<Payment, string> = {
  cash: "Наличные",
  card: "Карта",
  sbp: "СБП",
};
