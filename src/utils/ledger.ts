import type {
  DashboardMetrics,
  MonthlyDashboardMetrics,
  PaymentRecord,
  Product,
  ProductTier,
  SaleLineItem,
  SaleRecord,
  Shopkeeper,
  ShopSummary,
} from '../types/tally';
import {
  formatDigits,
  formatNumberValue,
  type NumeralMode,
} from './numberFormat';

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clampDiscount(discountPercent: number): number {
  if (!Number.isFinite(discountPercent)) return 0;
  return Math.max(0, Math.min(100, roundCurrency(discountPercent)));
}

export interface LineItemDraft {
  productId: string;
  productName: string;
  tier: ProductTier;
  boxes: number;
  boxPrice: number;
  discountPercent: number;
}

export function calculateLineItem(draft: LineItemDraft): SaleLineItem {
  const safeBoxes = Number.isFinite(draft.boxes) ? Math.max(0, Math.floor(draft.boxes)) : 0;
  const safePrice = Number.isFinite(draft.boxPrice) ? Math.max(0, roundCurrency(draft.boxPrice)) : 0;
  const safeDiscount = clampDiscount(draft.discountPercent);

  const grossTotal = roundCurrency(safeBoxes * safePrice);
  const discountAmount = roundCurrency(grossTotal * (safeDiscount / 100));
  const netTotal = roundCurrency(grossTotal - discountAmount);
  const effectiveBoxPrice =
    safeBoxes > 0
      ? roundCurrency(netTotal / safeBoxes)
      : roundCurrency(safePrice * (1 - safeDiscount / 100));

  return {
    productId: draft.productId,
    productName: draft.productName,
    tier: draft.tier,
    boxes: safeBoxes,
    boxPrice: safePrice,
    grossTotal,
    discountPercent: safeDiscount,
    discountAmount,
    netTotal,
    effectiveBoxPrice,
  };
}

export interface InvoiceTotals {
  totalBoxes: number;
  grossTotal: number;
  totalDiscount: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
}

export function calculateInvoiceTotals(
  items: SaleLineItem[],
  paidAmountInput: number,
): InvoiceTotals {
  let totalBoxes = 0;
  let grossTotal = 0;
  let totalDiscount = 0;
  let netTotal = 0;

  for (const item of items) {
    totalBoxes += item.boxes;
    grossTotal = roundCurrency(grossTotal + item.grossTotal);
    totalDiscount = roundCurrency(totalDiscount + item.discountAmount);
    netTotal = roundCurrency(netTotal + item.netTotal);
  }

  const rawPaid = Number.isFinite(paidAmountInput) ? Math.max(0, roundCurrency(paidAmountInput)) : 0;
  const paidAmount = Math.min(rawPaid, netTotal);
  const dueAmount = roundCurrency(Math.max(0, netTotal - paidAmount));

  return {
    totalBoxes,
    grossTotal,
    totalDiscount,
    netTotal,
    paidAmount,
    dueAmount,
  };
}

export function computeShopSummary(
  shopId: string,
  sales: SaleRecord[],
  payments: PaymentRecord[],
): ShopSummary {
  const shopSales = sales.filter((s) => s.shopId === shopId);
  const shopPayments = payments.filter((p) => p.shopId === shopId);

  let totalBilled = 0;
  let totalPaidAtSale = 0;
  let totalBoxes = 0;
  let lastActivityAt: string | null = null;

  for (const sale of shopSales) {
    totalBilled = roundCurrency(totalBilled + sale.netTotal);
    totalPaidAtSale = roundCurrency(totalPaidAtSale + sale.paidAmount);
    totalBoxes += sale.totalBoxes;
    if (!lastActivityAt || sale.date > lastActivityAt) {
      lastActivityAt = sale.date;
    }
  }

  let totalCollections = 0;
  for (const pay of shopPayments) {
    totalCollections = roundCurrency(totalCollections + pay.amount);
    if (!lastActivityAt || pay.date > lastActivityAt) {
      lastActivityAt = pay.date;
    }
  }

  const totalPaid = roundCurrency(totalPaidAtSale + totalCollections);
  const totalDue = roundCurrency(Math.max(0, totalBilled - totalPaid));

  return {
    shopId,
    totalBilled,
    totalPaidAtSale,
    totalCollections,
    totalPaid,
    totalDue,
    invoiceCount: shopSales.length,
    paymentCount: shopPayments.length,
    totalBoxes,
    lastActivityAt,
  };
}

export function computeDashboardMetrics(
  shops: Shopkeeper[],
  sales: SaleRecord[],
  payments: PaymentRecord[],
): DashboardMetrics {
  let totalSales = 0;
  let totalDiscountGiven = 0;
  let totalBoxesSold = 0;
  let totalPaidAtSale = 0;

  for (const sale of sales) {
    totalSales = roundCurrency(totalSales + sale.netTotal);
    totalDiscountGiven = roundCurrency(totalDiscountGiven + sale.totalDiscount);
    totalBoxesSold += sale.totalBoxes;
    totalPaidAtSale = roundCurrency(totalPaidAtSale + sale.paidAmount);
  }

  let totalCollections = 0;
  for (const pay of payments) {
    totalCollections = roundCurrency(totalCollections + pay.amount);
  }

  const totalCollected = roundCurrency(totalPaidAtSale + totalCollections);
  let totalDue = 0;
  let dueShopCount = 0;

  for (const shop of shops) {
    const summary = computeShopSummary(shop.id, sales, payments);
    totalDue = roundCurrency(totalDue + summary.totalDue);
    if (summary.totalDue > 0) {
      dueShopCount += 1;
    }
  }

  return {
    totalSales,
    totalCollected,
    totalDue,
    totalDiscountGiven,
    totalBoxesSold,
    activeShopCount: shops.length,
    dueShopCount,
  };
}

export function getMonthKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getMonthKeyFromIso(isoString: string): string | null {
  const trimmed = isoString.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return getMonthKeyFromDate(date);
}

export function getAvailableMonthKeys(
  sales: SaleRecord[],
  payments: PaymentRecord[],
  now: Date = new Date(),
): string[] {
  const keys = new Set<string>([getMonthKeyFromDate(now)]);
  for (const sale of sales) {
    const k = getMonthKeyFromIso(sale.date);
    if (k) keys.add(k);
  }
  for (const pay of payments) {
    const k = getMonthKeyFromIso(pay.date);
    if (k) keys.add(k);
  }
  return Array.from(keys).sort((a, b) => b.localeCompare(a));
}

export function formatMonthYearBn(monthKey: string, mode?: NumeralMode): string {
  const match = monthKey.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  const sampleDate = new Date(year, month - 1, 15);
  const formatted = sampleDate.toLocaleDateString('bn-BD', {
    month: 'long',
    year: 'numeric',
  });
  return formatDigits(formatted, mode);
}

export function computeMonthlySalesAndCollection(
  sales: SaleRecord[],
  payments: PaymentRecord[],
  monthKey: string,
): MonthlyDashboardMetrics {
  let totalSales = 0;
  let totalDiscountGiven = 0;
  let totalBoxesSold = 0;
  let invoiceCount = 0;
  let paidAtSale = 0;
  let saleDue = 0;

  for (const sale of sales) {
    if (getMonthKeyFromIso(sale.date) !== monthKey) continue;
    totalSales = roundCurrency(totalSales + sale.netTotal);
    totalDiscountGiven = roundCurrency(totalDiscountGiven + sale.totalDiscount);
    totalBoxesSold += sale.totalBoxes;
    invoiceCount += 1;
    paidAtSale = roundCurrency(paidAtSale + sale.paidAmount);
    saleDue = roundCurrency(saleDue + sale.dueAmount);
  }

  let dueCollections = 0;
  for (const pay of payments) {
    if (getMonthKeyFromIso(pay.date) !== monthKey) continue;
    dueCollections = roundCurrency(dueCollections + pay.amount);
  }

  const totalCollected = roundCurrency(paidAtSale + dueCollections);

  return {
    monthKey,
    totalSales,
    totalDiscountGiven,
    totalBoxesSold,
    invoiceCount,
    paidAtSale,
    dueCollections,
    totalCollected,
    saleDue,
  };
}

export type KpiPeriodMode = 'all' | 'monthly';
export const KPI_PERIOD_MODE_KEY = 'ibn_sina_kpi_period_mode_v1';

export function loadKpiPeriodMode(): KpiPeriodMode {
  if (typeof window === 'undefined') return 'all';
  try {
    const saved = window.localStorage.getItem(KPI_PERIOD_MODE_KEY);
    return saved === 'monthly' ? 'monthly' : 'all';
  } catch {
    return 'all';
  }
}

export function saveKpiPeriodMode(mode: KpiPeriodMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KPI_PERIOD_MODE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function formatCount(value: number | string, mode?: NumeralMode): string {
  if (typeof value === 'string') {
    return formatDigits(value, mode);
  }
  return formatNumberValue(value, { mode });
}

export function formatBDT(amount: number, mode?: NumeralMode): string {
  const rounded = roundCurrency(amount);
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return `৳${formatNumberValue(rounded, {
    mode,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTimeBn(isoString: string, mode?: NumeralMode): string {
  const trimmed = isoString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const localDate = new Date(y, m - 1, d);
    if (Number.isNaN(localDate.getTime())) return isoString;
    const formatted = localDate.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return formatDigits(formatted, mode);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return isoString;
  const datePart = date.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('bn-BD', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return formatDigits(`${datePart}, ${timePart}`, mode);
}

export function generateNextInvoiceNo(sales: SaleRecord[]): string {
  const nextNum = sales.length + 101;
  return `INV-${nextNum}`;
}

export function generateNextReceiptNo(payments: PaymentRecord[]): string {
  const nextNum = payments.length + 201;
  return `REC-${nextNum}`;
}

export function mergeCatalogProducts(
  stored: Product[] | undefined,
  defaults: Product[],
  deletedIds: string[] = [],
): Product[] {
  const deletedSet = new Set(deletedIds);
  const activeDefaults = defaults.filter((def) => !deletedSet.has(def.id));
  if (!stored || (stored.length === 0 && deletedSet.size === 0)) {
    return activeDefaults;
  }
  const byId = new Map(stored.map((p) => [p.id, p]));
  const merged = activeDefaults.map((def) => byId.get(def.id) ?? def);
  const defaultIds = new Set(defaults.map((d) => d.id));
  const custom = stored.filter((p) => !defaultIds.has(p.id) && !deletedSet.has(p.id));
  return [...merged, ...custom];
}

export interface ShopWithSummary {
  shop: Shopkeeper;
  summary: ShopSummary;
}

export function getDueShopSummaries(
  shops: Shopkeeper[],
  sales: SaleRecord[],
  payments: PaymentRecord[],
): ShopWithSummary[] {
  return shops
    .map((shop) => ({
      shop,
      summary: computeShopSummary(shop.id, sales, payments),
    }))
    .filter(({ summary }) => summary.totalDue > 0)
    .sort((a, b) => b.summary.totalDue - a.summary.totalDue);
}

export function buildEditedSaleRecord(
  existingSale: SaleRecord,
  itemsInput: SaleLineItem[],
  paidAmountInput: number,
  noteInput?: string,
): { ok: true; sale: SaleRecord } | { ok: false; error: string } {
  const validItems = itemsInput.filter((item) => item.boxes > 0).slice(0, 60);
  if (validItems.length === 0) {
    return {
      ok: false,
      error: 'কমপক্ষে ১টি প্রোডাক্টে ১ বা তার বেশি বক্স সংখ্যা রাখুন। (পুরো চালান বাদ দিতে চাইলে রিপোর্ট থেকে ডিলিট করুন।)',
    };
  }

  const safePaidRaw = Number.isFinite(paidAmountInput) ? roundCurrency(paidAmountInput) : Number.NaN;
  if (!Number.isFinite(safePaidRaw) || safePaidRaw < 0) {
    return { ok: false, error: 'জমা টাকার পরিমাণ ০ বা তার বেশি হতে হবে।' };
  }

  const totals = calculateInvoiceTotals(validItems, safePaidRaw);
  if (safePaidRaw > totals.netTotal) {
    return {
      ok: false,
      error: `জমা টাকা সর্বমোট বিল (${formatBDT(totals.netTotal)}) এর চেয়ে বেশি হতে পারবে না।`,
    };
  }

  const trimmedNote = (noteInput ?? '').trim().slice(0, 300);
  const updated: SaleRecord = {
    id: existingSale.id,
    invoiceNo: existingSale.invoiceNo,
    shopId: existingSale.shopId,
    shopName: existingSale.shopName,
    date: existingSale.date,
    items: validItems,
    totalBoxes: totals.totalBoxes,
    grossTotal: totals.grossTotal,
    totalDiscount: totals.totalDiscount,
    netTotal: totals.netTotal,
    paidAmount: totals.paidAmount,
    dueAmount: totals.dueAmount,
    ...(trimmedNote ? { note: trimmedNote } : {}),
  };

  return { ok: true, sale: updated };
}

const ALLOWED_PAYMENT_METHODS: ReadonlyArray<PaymentRecord['method']> = [
  'Cash',
  'bKash',
  'Nagad',
  'Bank',
];

export function buildEditedPaymentRecord(
  existingPayment: PaymentRecord,
  amountInput: number,
  methodInput: PaymentRecord['method'],
  noteInput?: string,
): { ok: true; payment: PaymentRecord } | { ok: false; error: string } {
  const safeAmount = Number.isFinite(amountInput) ? roundCurrency(amountInput) : Number.NaN;
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return { ok: false, error: 'সঠিক টাকার পরিমাণ লিখুন (০ এর বেশি)।' };
  }
  if (safeAmount > 10000000) {
    return { ok: false, error: 'টাকার পরিমাণ ১,০০,০০,০০০ এর বেশি হতে পারবে না।' };
  }

  const method = ALLOWED_PAYMENT_METHODS.includes(methodInput) ? methodInput : existingPayment.method;
  const trimmedNote = (noteInput ?? '').trim().slice(0, 300);

  const updated: PaymentRecord = {
    id: existingPayment.id,
    receiptNo: existingPayment.receiptNo,
    shopId: existingPayment.shopId,
    shopName: existingPayment.shopName,
    date: existingPayment.date,
    amount: safeAmount,
    method,
    ...(trimmedNote ? { note: trimmedNote } : {}),
  };

  return { ok: true, payment: updated };
}

const LEGACY_DEMO_SHOP_IDS = new Set([
  'shop-maa-medical',
  'shop-bismillah',
  'shop-al-madina',
  'shop-jonoseba',
]);

const LEGACY_DEMO_SALE_IDS = new Set([
  'sale-101',
  'sale-102',
  'sale-103',
  'sale-104',
]);

const LEGACY_DEMO_PAYMENT_IDS = new Set(['pay-201']);

export function stripLegacyDemoData<
  TShop extends { id: string },
  TSale extends { id: string; shopId: string },
  TPay extends { id: string; shopId: string },
>(state: {
  shops: TShop[];
  sales: TSale[];
  payments: TPay[];
}): {
  shops: TShop[];
  sales: TSale[];
  payments: TPay[];
  changed: boolean;
} {
  const sales = state.sales.filter((s) => !LEGACY_DEMO_SALE_IDS.has(s.id));
  const payments = state.payments.filter((p) => !LEGACY_DEMO_PAYMENT_IDS.has(p.id));

  const activeShopIdsWithRealActivity = new Set<string>();
  for (const s of sales) activeShopIdsWithRealActivity.add(s.shopId);
  for (const p of payments) activeShopIdsWithRealActivity.add(p.shopId);

  const shops = state.shops.filter(
    (shop) => !LEGACY_DEMO_SHOP_IDS.has(shop.id) || activeShopIdsWithRealActivity.has(shop.id),
  );

  const changed =
    shops.length !== state.shops.length ||
    sales.length !== state.sales.length ||
    payments.length !== state.payments.length;

  return { shops, sales, payments, changed };
}

export function findLegacyCloudDemoDocsToDelete<
  TShop extends { id: string },
  TSale extends { id: string; shopId: string },
  TPay extends { id: string; shopId: string },
>(state: {
  shops: TShop[];
  sales: TSale[];
  payments: TPay[];
}): {
  shopIds: string[];
  saleIds: string[];
  paymentIds: string[];
} {
  const saleIds = state.sales
    .filter((s) => LEGACY_DEMO_SALE_IDS.has(s.id))
    .map((s) => s.id);
  const paymentIds = state.payments
    .filter((p) => LEGACY_DEMO_PAYMENT_IDS.has(p.id))
    .map((p) => p.id);

  const saleSet = new Set(saleIds);
  const paySet = new Set(paymentIds);
  const realActiveShopIds = new Set<string>();
  for (const s of state.sales) {
    if (!saleSet.has(s.id)) realActiveShopIds.add(s.shopId);
  }
  for (const p of state.payments) {
    if (!paySet.has(p.id)) realActiveShopIds.add(p.shopId);
  }

  const shopIds = state.shops
    .filter((shop) => LEGACY_DEMO_SHOP_IDS.has(shop.id) && !realActiveShopIds.has(shop.id))
    .map((shop) => shop.id);

  return { shopIds, saleIds, paymentIds };
}



