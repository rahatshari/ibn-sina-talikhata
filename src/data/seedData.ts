import { calculateInvoiceTotals, calculateLineItem } from '../utils/ledger';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';

export const SEED_SHOPS: Shopkeeper[] = [
  {
    id: 'shop-maa-medical',
    shopName: 'মা মেডিকেল হল',
    ownerName: 'মোঃ আব্দুল করিম',
    phone: '01711-345678',
    area: 'শাহবাগ বাজার',
    createdAt: '2026-11-05T08:30:00.000Z',
  },
  {
    id: 'shop-bismillah',
    shopName: 'বিসমিল্লাহ ফার্মেসি',
    ownerName: 'হাজী রফিকুল ইসলাম',
    phone: '01819-223344',
    area: 'কলাবাগান',
    createdAt: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'shop-al-madina',
    shopName: 'আল-মদিনা ড্রাগ হাউস',
    ownerName: 'জসিম উদ্দিন',
    phone: '01912-887766',
    area: 'মিরপুর ১০',
    createdAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'shop-jonoseba',
    shopName: 'জনসেবা ফার্মেসি',
    ownerName: 'সুমন আহমেদ',
    phone: '01675-445566',
    area: 'উত্তরা সেক্টর ৭',
    createdAt: '2026-11-12T11:20:00.000Z',
  },
];

function buildSeedSale(
  id: string,
  invoiceNo: string,
  shop: Shopkeeper,
  date: string,
  draftItems: Parameters<typeof calculateLineItem>[0][],
  paidAmount: number,
  note?: string,
): SaleRecord {
  const items = draftItems.map(calculateLineItem);
  const totals = calculateInvoiceTotals(items, paidAmount);
  return {
    id,
    invoiceNo,
    shopId: shop.id,
    shopName: shop.shopName,
    date,
    items,
    totalBoxes: totals.totalBoxes,
    grossTotal: totals.grossTotal,
    totalDiscount: totals.totalDiscount,
    netTotal: totals.netTotal,
    paidAmount: totals.paidAmount,
    dueAmount: totals.dueAmount,
    note,
  };
}

export const SEED_SALES: SaleRecord[] = [
  buildSeedSale(
    'sale-101',
    'INV-101',
    SEED_SHOPS[0],
    '2026-11-14T10:30:00.000Z',
    [
      {
        productId: 'ibn-dexlan',
        productName: 'Dexlan',
        tier: 'Super Star',
        boxes: 5,
        boxPrice: 480,
        discountPercent: 10,
      },
      {
        productId: 'ibn-linax-plus',
        productName: 'Linax Plus',
        tier: 'Super Star',
        boxes: 4,
        boxPrice: 540,
        discountPercent: 12,
      },
      {
        productId: 'ibn-esolok-mups',
        productName: 'Esolok MUPS',
        tier: 'Promising Star',
        boxes: 3,
        boxPrice: 520,
        discountPercent: 8,
      },
    ],
    2500,
    'প্রথম চালান ডেলিভারি',
  ),
  buildSeedSale(
    'sale-102',
    'INV-102',
    SEED_SHOPS[1],
    '2026-11-15T14:20:00.000Z',
    [
      {
        productId: 'ibn-cefixim',
        productName: 'Cefixim',
        tier: 'Star Line (Group B)',
        boxes: 6,
        boxPrice: 680,
        discountPercent: 15,
      },
      {
        productId: 'ibn-montex',
        productName: 'Montex',
        tier: 'Star Line (Group B)',
        boxes: 4,
        boxPrice: 440,
        discountPercent: 10,
      },
    ],
    3000,
    'সাপ্তাহিক অর্ডার',
  ),
  buildSeedSale(
    'sale-103',
    'INV-103',
    SEED_SHOPS[2],
    '2026-11-16T11:10:00.000Z',
    [
      {
        productId: 'ibn-vitalgin',
        productName: 'Vitalgin',
        tier: 'Super Star',
        boxes: 8,
        boxPrice: 320,
        discountPercent: 10,
      },
      {
        productId: 'ibn-gavisol',
        productName: 'Gavisol',
        tier: 'Star Line (Group B)',
        boxes: 5,
        boxPrice: 340,
        discountPercent: 10,
      },
    ],
    3834,
    'নগদ পরিশোধ',
  ),
  buildSeedSale(
    'sale-104',
    'INV-104',
    SEED_SHOPS[3],
    '2026-11-17T16:45:00.000Z',
    [
      {
        productId: 'ibn-meroclav',
        productName: 'Meroclav',
        tier: 'Super Star',
        boxes: 3,
        boxPrice: 720,
        discountPercent: 12,
      },
      {
        productId: 'ibn-glipatab-m',
        productName: 'Glipatab-M',
        tier: 'Promising Line (Group B)',
        boxes: 4,
        boxPrice: 510,
        discountPercent: 10,
      },
    ],
    1500,
    'বাকি আগামী সপ্তাহে দিবে',
  ),
];

export const SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-201',
    receiptNo: 'REC-201',
    shopId: 'shop-maa-medical',
    shopName: 'মা মেডিকেল হল',
    date: '2026-11-16T15:00:00.000Z',
    amount: 1500,
    method: 'Cash',
    note: 'পূর্বের বাকি থেকে আংশিক জমা',
  },
];
