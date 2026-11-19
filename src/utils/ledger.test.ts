import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLineItem,
  calculateInvoiceTotals,
  computeShopSummary,
  computeDashboardMetrics,
  formatDateTimeBn,
  getDueShopSummaries,
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

test('formatDateTimeBn displays both Bengali date and 12-hour time for ISO timestamps', () => {
  const formatted = formatDateTimeBn('2026-11-18T10:30:00.000Z');
  assert.match(formatted, /২০২৬/);
  assert.match(formatted, /:/);
  assert.match(formatted, /(AM|PM|পূর্বাহ্ণ|অপরাহ্ণ)/i);

  const dateOnly = formatDateTimeBn('2026-11-18');
  assert.match(dateOnly, /২০২৬/);
  assert.doesNotMatch(dateOnly, /:/);
});
