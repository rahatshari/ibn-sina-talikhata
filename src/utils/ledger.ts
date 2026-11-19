import type {
  DashboardMetrics,
  PaymentRecord,
  Product,
  ProductTier,
  SaleLineItem,
  SaleRecord,
  Shopkeeper,
  ShopSummary,
} from '../types/tally';

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

export function formatBDT(amount: number): string {
  const rounded = roundCurrency(amount);
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  return `৳${rounded.toLocaleString('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTimeBn(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
): Product[] {
  if (!stored || stored.length === 0) return defaults;
  const byId = new Map(stored.map((p) => [p.id, p]));
  const merged = defaults.map((def) => byId.get(def.id) ?? def);
  const defaultIds = new Set(defaults.map((d) => d.id));
  const custom = stored.filter((p) => !defaultIds.has(p.id));
  return [...merged, ...custom];
}
