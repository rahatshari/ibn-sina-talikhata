import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEditedPaymentRecord,
  buildEditedSaleRecord,
  calculateLineItem,
  calculateInvoiceTotals,
  computeMonthlySalesAndCollection,
  computeShopSummary,
  computeDashboardMetrics,
  formatBDT,
  formatCount,
  formatDateTimeBn,
  formatMonthYearBn,
  getAvailableMonthKeys,
  getDueShopSummaries,
  getMonthKeyFromIso,
  mergeCatalogProducts,
} from './ledger';
import { INITIAL_IBN_SINA_PRODUCTS } from '../data/ibnSinaProducts';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';

test('calculateLineItem calculates gross, discount, net total, and effective box price', () => {
  const item = calculateLineItem({
    productId: 'ibn-dexlan',
    productName: 'Dexlan',
    tier: 'Super Star',
    boxes: 5,
    boxPrice: 480,
    discountPercent: 10,
  });

  assert.equal(item.grossTotal, 2400);
  assert.equal(item.discountAmount, 240);
  assert.equal(item.netTotal, 2160);
  assert.equal(item.effectiveBoxPrice, 432);
});

test('calculateLineItem clamps invalid discount percentages and negative boxes', () => {
  const overDiscount = calculateLineItem({
    productId: 'ibn-linax',
    productName: 'Linax',
    tier: 'Super Star',
    boxes: 2,
    boxPrice: 400,
    discountPercent: 140,
  });
  assert.equal(overDiscount.discountPercent, 100);
  assert.equal(overDiscount.netTotal, 0);

  const negativeBoxes = calculateLineItem({
    productId: 'ibn-linax',
    productName: 'Linax',
    tier: 'Super Star',
    boxes: -3,
    boxPrice: 400,
    discountPercent: 10,
  });
  assert.equal(negativeBoxes.boxes, 0);
  assert.equal(negativeBoxes.netTotal, 0);
});

test('calculateInvoiceTotals aggregates multiple products and calculates remaining due', () => {
  const item1 = calculateLineItem({
    productId: 'ibn-dexlan',
    productName: 'Dexlan',
    tier: 'Super Star',
    boxes: 5,
    boxPrice: 480,
    discountPercent: 10,
  }); // net 2160
  const item2 = calculateLineItem({
    productId: 'ibn-esolok-mups',
    productName: 'Esolok MUPS',
    tier: 'Promising Star',
    boxes: 4,
    boxPrice: 500,
    discountPercent: 15,
  }); // gross 2000, disc 300, net 1700

  const totals = calculateInvoiceTotals([item1, item2], 2500);
  assert.equal(totals.totalBoxes, 9);
  assert.equal(totals.grossTotal, 4400);
  assert.equal(totals.totalDiscount, 540);
  assert.equal(totals.netTotal, 3860);
  assert.equal(totals.paidAmount, 2500);
  assert.equal(totals.dueAmount, 1360);
});

test('computeShopSummary and computeDashboardMetrics reflect sales and due collections', () => {
  const shops: Shopkeeper[] = [
    {
      id: 'shop-1',
      shopName: 'মা ফার্মেসি',
      ownerName: 'করিম উদ্দিন',
      phone: '01711000001',
      area: 'শাহবাগ',
      createdAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 'shop-2',
      shopName: 'নিউ মডার্ন ড্রাগ হাউস',
      ownerName: 'রফিকুল ইসলাম',
      phone: '01811000002',
      area: 'মিটফোর্ড',
      createdAt: '2026-11-11T09:00:00.000Z',
    },
  ];

  const sales: SaleRecord[] = [
    {
      id: 'sale-1',
      invoiceNo: 'INV-101',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-12T10:00:00.000Z',
      items: [],
      totalBoxes: 10,
      grossTotal: 5000,
      totalDiscount: 500,
      netTotal: 4500,
      paidAmount: 2000,
      dueAmount: 2500,
    },
    {
      id: 'sale-2',
      invoiceNo: 'INV-102',
      shopId: 'shop-2',
      shopName: 'নিউ মডার্ন ড্রাগ হাউস',
      date: '2026-11-13T10:00:00.000Z',
      items: [],
      totalBoxes: 6,
      grossTotal: 3000,
      totalDiscount: 0,
      netTotal: 3000,
      paidAmount: 3000,
      dueAmount: 0,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay-1',
      receiptNo: 'REC-201',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-15T12:00:00.000Z',
      amount: 1500,
      method: 'Cash',
    },
  ];

  const s1 = computeShopSummary('shop-1', sales, payments);
  assert.equal(s1.totalBilled, 4500);
  assert.equal(s1.totalPaid, 3500);
  assert.equal(s1.totalDue, 1000);

  const metrics = computeDashboardMetrics(shops, sales, payments);
  assert.equal(metrics.totalSales, 7500);
  assert.equal(metrics.totalCollected, 6500);
  assert.equal(metrics.totalDue, 1000);
  assert.equal(metrics.dueShopCount, 1);
});

test('INITIAL_IBN_SINA_PRODUCTS contains all 55 unique products from the sheet', () => {
  assert.equal(INITIAL_IBN_SINA_PRODUCTS.length, 55);
  const uniqueNames = new Set(INITIAL_IBN_SINA_PRODUCTS.map((p) => p.name));
  assert.equal(uniqueNames.size, 55);
  const merged = mergeCatalogProducts(undefined, INITIAL_IBN_SINA_PRODUCTS);
  assert.equal(merged.length, 55);
});

test('getDueShopSummaries returns only shops with due > 0 sorted highest first', () => {
  const shops: Shopkeeper[] = [
    {
      id: 's1',
      shopName: 'দোকান ক',
      ownerName: 'আব্দুল',
      phone: '01700000001',
      area: 'শাহবাগ',
      createdAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 's2',
      shopName: 'দোকান খ',
      ownerName: 'কামাল',
      phone: '01700000002',
      area: 'ধানমন্ডি',
      createdAt: '2026-11-11T09:00:00.000Z',
    },
    {
      id: 's3',
      shopName: 'দোকান গ',
      ownerName: 'জামাল',
      phone: '01700000003',
      area: 'মিরপুর',
      createdAt: '2026-11-12T09:00:00.000Z',
    },
  ];
  const sales: SaleRecord[] = [
    {
      id: 'sale-a',
      invoiceNo: 'INV-101',
      shopId: 's1',
      shopName: 'দোকান ক',
      date: '2026-11-12T10:00:00.000Z',
      items: [],
      totalBoxes: 2,
      grossTotal: 1000,
      totalDiscount: 0,
      netTotal: 1000,
      paidAmount: 1000,
      dueAmount: 0,
    },
    {
      id: 'sale-b',
      invoiceNo: 'INV-102',
      shopId: 's2',
      shopName: 'দোকান খ',
      date: '2026-11-12T10:00:00.000Z',
      items: [],
      totalBoxes: 5,
      grossTotal: 2000,
      totalDiscount: 0,
      netTotal: 2000,
      paidAmount: 500,
      dueAmount: 1500,
    },
    {
      id: 'sale-c',
      invoiceNo: 'INV-103',
      shopId: 's3',
      shopName: 'দোকান গ',
      date: '2026-11-12T10:00:00.000Z',
      items: [],
      totalBoxes: 8,
      grossTotal: 4000,
      totalDiscount: 0,
      netTotal: 4000,
      paidAmount: 1000,
      dueAmount: 3000,
    },
  ];

  const dueList = getDueShopSummaries(shops, sales, []);
  assert.equal(dueList.length, 2);
  assert.equal(dueList[0]?.shop.id, 's3');
  assert.equal(dueList[0]?.summary.totalDue, 3000);
  assert.equal(dueList[1]?.shop.id, 's2');
  assert.equal(dueList[1]?.summary.totalDue, 1500);
});

test('formatDateTimeBn displays date and 12-hour time in Bengali or English numerals', () => {
  const formattedBn = formatDateTimeBn('2026-11-18T10:30:00.000Z', 'bn');
  assert.match(formattedBn, /২০২৬/);
  assert.match(formattedBn, /:/);
  assert.match(formattedBn, /(AM|PM|পূর্বাহ্ণ|অপরাহ্ণ)/i);

  const formattedEn = formatDateTimeBn('2026-11-18T10:30:00.000Z', 'en');
  assert.match(formattedEn, /2026/);
  assert.match(formattedEn, /:/);

  const dateOnly = formatDateTimeBn('2026-11-18', 'bn');
  assert.match(dateOnly, /২০২৬/);
  assert.doesNotMatch(dateOnly, /:/);

  assert.equal(formatBDT(1250, 'bn'), '৳১,২৫০');
  assert.equal(formatBDT(1250, 'en'), '৳1,250');
  assert.equal(formatCount(55, 'bn'), '৫৫');
  assert.equal(formatCount(55, 'en'), '55');
});

test('getMonthKeyFromIso, getAvailableMonthKeys, and formatMonthYearBn parse and sort months accurately', () => {
  assert.equal(getMonthKeyFromIso('2026-11-18'), '2026-11');
  assert.equal(getMonthKeyFromIso('2026-10-15T10:30:00.000Z'), '2026-10');
  assert.equal(getMonthKeyFromIso('invalid-date'), null);

  const sales: SaleRecord[] = [
    {
      id: 's1',
      invoiceNo: 'INV-101',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-10-15T10:00:00.000Z',
      items: [],
      totalBoxes: 4,
      grossTotal: 2000,
      totalDiscount: 0,
      netTotal: 2000,
      paidAmount: 1000,
      dueAmount: 1000,
    },
    {
      id: 's2',
      invoiceNo: 'INV-102',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-16T10:00:00.000Z',
      items: [],
      totalBoxes: 6,
      grossTotal: 3000,
      totalDiscount: 300,
      netTotal: 2700,
      paidAmount: 1500,
      dueAmount: 1200,
    },
  ];
  const payments: PaymentRecord[] = [
    {
      id: 'p1',
      receiptNo: 'REC-201',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-17T12:00:00.000Z',
      amount: 800,
      method: 'Cash',
    },
  ];

  const months = getAvailableMonthKeys(sales, payments, new Date(2026, 10, 19));
  assert.deepEqual(months, ['2026-11', '2026-10']);

  assert.match(formatMonthYearBn('2026-11', 'bn'), /নভেম্বর/);
  assert.match(formatMonthYearBn('2026-11', 'bn'), /২০২৬/);
  assert.match(formatMonthYearBn('2026-11', 'en'), /নভেম্বর/);
  assert.match(formatMonthYearBn('2026-11', 'en'), /2026/);
});

test('computeMonthlySalesAndCollection isolates sales and collections for the selected month', () => {
  const sales: SaleRecord[] = [
    {
      id: 's-oct',
      invoiceNo: 'INV-101',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-10-15T10:00:00.000Z',
      items: [],
      totalBoxes: 5,
      grossTotal: 5000,
      totalDiscount: 500,
      netTotal: 4500,
      paidAmount: 2000,
      dueAmount: 2500,
    },
    {
      id: 's-nov-1',
      invoiceNo: 'INV-102',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-12T10:00:00.000Z',
      items: [],
      totalBoxes: 8,
      grossTotal: 4000,
      totalDiscount: 400,
      netTotal: 3600,
      paidAmount: 1600,
      dueAmount: 2000,
    },
    {
      id: 's-nov-2',
      invoiceNo: 'INV-103',
      shopId: 'shop-2',
      shopName: 'নিউ মডার্ন',
      date: '2026-11-15T10:00:00.000Z',
      items: [],
      totalBoxes: 4,
      grossTotal: 2000,
      totalDiscount: 0,
      netTotal: 2000,
      paidAmount: 2000,
      dueAmount: 0,
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'p-oct',
      receiptNo: 'REC-201',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-10-20T12:00:00.000Z',
      amount: 500,
      method: 'Cash',
    },
    {
      id: 'p-nov',
      receiptNo: 'REC-202',
      shopId: 'shop-1',
      shopName: 'মা ফার্মেসি',
      date: '2026-11-16T12:00:00.000Z',
      amount: 1200,
      method: 'bKash',
    },
  ];

  const nov = computeMonthlySalesAndCollection(sales, payments, '2026-11');
  assert.equal(nov.monthKey, '2026-11');
  assert.equal(nov.totalSales, 5600);
  assert.equal(nov.totalDiscountGiven, 400);
  assert.equal(nov.totalBoxesSold, 12);
  assert.equal(nov.invoiceCount, 2);
  assert.equal(nov.paidAtSale, 3600);
  assert.equal(nov.dueCollections, 1200);
  assert.equal(nov.totalCollected, 4800);
  assert.equal(nov.saleDue, 2000);

  const oct = computeMonthlySalesAndCollection(sales, payments, '2026-10');
  assert.equal(oct.totalSales, 4500);
  assert.equal(oct.totalCollected, 2500);
});

test('buildEditedSaleRecord recalculates boxes, discount, net total, due, and validates limits', () => {
  const existingSale: SaleRecord = {
    id: 'sale-1',
    invoiceNo: 'INV-101',
    shopId: 'shop-1',
    shopName: 'মা ফার্মেসি',
    date: '2026-11-12T10:00:00.000Z',
    items: [
      calculateLineItem({
        productId: 'ibn-dexlan',
        productName: 'Dexlan',
        tier: 'Super Star',
        boxes: 10,
        boxPrice: 480,
        discountPercent: 10,
      }),
    ],
    totalBoxes: 10,
    grossTotal: 4800,
    totalDiscount: 480,
    netTotal: 4320,
    paidAmount: 2000,
    dueAmount: 2320,
    note: 'পুরানো নোট',
  };

  // User accidentally entered 10 boxes, reduces to 5 boxes and adds Linax 2 boxes, updates paid to 1500
  const editedItems = [
    calculateLineItem({
      productId: 'ibn-dexlan',
      productName: 'Dexlan',
      tier: 'Super Star',
      boxes: 5,
      boxPrice: 480,
      discountPercent: 10,
    }), // net 2160
    calculateLineItem({
      productId: 'ibn-linax',
      productName: 'Linax',
      tier: 'Super Star',
      boxes: 2,
      boxPrice: 400,
      discountPercent: 0,
    }), // net 800
  ];

  const okRes = buildEditedSaleRecord(existingSale, editedItems, 1500, '  সংশোধিত হিসাব  ');
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.sale.id, 'sale-1');
    assert.equal(okRes.sale.invoiceNo, 'INV-101');
    assert.equal(okRes.sale.totalBoxes, 7);
    assert.equal(okRes.sale.grossTotal, 3200);
    assert.equal(okRes.sale.totalDiscount, 240);
    assert.equal(okRes.sale.netTotal, 2960);
    assert.equal(okRes.sale.paidAmount, 1500);
    assert.equal(okRes.sale.dueAmount, 1460);
    assert.equal(okRes.sale.note, 'সংশোধিত হিসাব');
  }

  // Empty items must fail
  const emptyRes = buildEditedSaleRecord(existingSale, [], 0);
  assert.equal(emptyRes.ok, false);

  // Overpayment (> netTotal) must fail
  const overpayRes = buildEditedSaleRecord(existingSale, editedItems, 3500);
  assert.equal(overpayRes.ok, false);
});

test('buildEditedPaymentRecord updates amount, method, note and validates bounds', () => {
  const existingPay: PaymentRecord = {
    id: 'pay-1',
    receiptNo: 'REC-201',
    shopId: 'shop-1',
    shopName: 'মা ফার্মেসি',
    date: '2026-11-15T12:00:00.000Z',
    amount: 1500,
    method: 'Cash',
    note: 'নগদ',
  };

  const okRes = buildEditedPaymentRecord(existingPay, 1800, 'bKash', '  বিকাশে সংশোধন  ');
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.payment.id, 'pay-1');
    assert.equal(okRes.payment.receiptNo, 'REC-201');
    assert.equal(okRes.payment.amount, 1800);
    assert.equal(okRes.payment.method, 'bKash');
    assert.equal(okRes.payment.note, 'বিকাশে সংশোধন');
  }

  assert.equal(buildEditedPaymentRecord(existingPay, 0, 'Cash').ok, false);
  assert.equal(buildEditedPaymentRecord(existingPay, -100, 'Cash').ok, false);
});

test('stripLegacyDemoData removes hardcoded demo records while preserving user-created data', async () => {
  const { stripLegacyDemoData } = await import('./ledger');

  const pureDemo = stripLegacyDemoData({
    shops: [
      { id: 'shop-maa-medical', shopName: 'মা মেডিকেল হল' },
      { id: 'shop-bismillah', shopName: 'বিসমিল্লাহ ফার্মেসি' },
    ],
    sales: [{ id: 'sale-101', shopId: 'shop-maa-medical' }],
    payments: [{ id: 'pay-201', shopId: 'shop-maa-medical' }],
  });

  assert.equal(pureDemo.changed, true);
  assert.equal(pureDemo.shops.length, 0);
  assert.equal(pureDemo.sales.length, 0);
  assert.equal(pureDemo.payments.length, 0);

  const mixed = stripLegacyDemoData({
    shops: [
      { id: 'shop-maa-medical', shopName: 'মা মেডিকেল হল' },
      { id: 'shop-real-1', shopName: 'নতুন ফার্মেসি' },
    ],
    sales: [
      { id: 'sale-101', shopId: 'shop-maa-medical' },
      { id: 'sale-real-1', shopId: 'shop-maa-medical' },
      { id: 'sale-real-2', shopId: 'shop-real-1' },
    ],
    payments: [{ id: 'pay-real-1', shopId: 'shop-real-1' }],
  });

  assert.equal(mixed.changed, true);
  // shop-maa-medical is kept because it has a real sale (sale-real-1)
  assert.deepEqual(
    mixed.shops.map((s) => s.id),
    ['shop-maa-medical', 'shop-real-1'],
  );
  assert.deepEqual(
    mixed.sales.map((s) => s.id),
    ['sale-real-1', 'sale-real-2'],
  );
  assert.deepEqual(
    mixed.payments.map((p) => p.id),
    ['pay-real-1'],
  );

  const { findLegacyCloudDemoDocsToDelete } = await import('./ledger');
  const toDelete = findLegacyCloudDemoDocsToDelete({
    shops: [
      { id: 'shop-maa-medical', shopName: 'মা মেডিকেল হল' },
      { id: 'shop-bismillah', shopName: 'বিসমিল্লাহ ফার্মেসি' },
      { id: 'shop-real-1', shopName: 'নতুন ফার্মেসি' },
    ],
    sales: [
      { id: 'sale-101', shopId: 'shop-maa-medical' },
      { id: 'sale-real-1', shopId: 'shop-maa-medical' },
      { id: 'sale-102', shopId: 'shop-bismillah' },
    ],
    payments: [{ id: 'pay-201', shopId: 'shop-maa-medical' }],
  });

  // shop-maa-medical has sale-real-1 so it must NOT be deleted; shop-bismillah has no real sales so it CAN be deleted
  assert.deepEqual(toDelete.shopIds, ['shop-bismillah']);
  assert.deepEqual(toDelete.saleIds, ['sale-101', 'sale-102']);
  assert.deepEqual(toDelete.paymentIds, ['pay-201']);
});




