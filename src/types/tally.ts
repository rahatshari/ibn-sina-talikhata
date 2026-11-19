export type ProductTier =
  | 'Super Star'
  | 'Priority Star'
  | 'Promising Star'
  | 'Star Line (Group B)'
  | 'Priority Line (Group B)'
  | 'Promising Line (Group B)'
  | 'Custom';

export interface Product {
  id: string;
  name: string;
  tier: ProductTier;
  boxPrice: number;
  packInfo: string;
  active: boolean;
}

export interface Shopkeeper {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  area: string;
  createdAt: string;
}

export interface SaleLineItem {
  productId: string;
  productName: string;
  tier: ProductTier;
  boxes: number;
  boxPrice: number;
  grossTotal: number;
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
  effectiveBoxPrice: number;
}

export interface SaleRecord {
  id: string;
  invoiceNo: string;
  shopId: string;
  shopName: string;
  date: string;
  items: SaleLineItem[];
  totalBoxes: number;
  grossTotal: number;
  totalDiscount: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  note?: string;
}

export interface PaymentRecord {
  id: string;
  receiptNo: string;
  shopId: string;
  shopName: string;
  date: string;
  amount: number;
  method: 'Cash' | 'bKash' | 'Nagad' | 'Bank';
  note?: string;
}

export interface ShopSummary {
  shopId: string;
  totalBilled: number;
  totalPaidAtSale: number;
  totalCollections: number;
  totalPaid: number;
  totalDue: number;
  invoiceCount: number;
  paymentCount: number;
  totalBoxes: number;
  lastActivityAt: string | null;
}

export interface DashboardMetrics {
  totalSales: number;
  totalCollected: number;
  totalDue: number;
  totalDiscountGiven: number;
  totalBoxesSold: number;
  activeShopCount: number;
  dueShopCount: number;
}

export interface MonthlyDashboardMetrics {
  monthKey: string;
  totalSales: number;
  totalDiscountGiven: number;
  totalBoxesSold: number;
  invoiceCount: number;
  paidAtSale: number;
  dueCollections: number;
  totalCollected: number;
  saleDue: number;
}

export interface SessionAccountProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
