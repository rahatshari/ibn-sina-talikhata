import test from 'node:test';
import assert from 'node:assert/strict';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import {
  buildPrintableReceiptHtml,
  buildReceiptFileName,
  buildReceiptSummaryText,
  buildShopLedgerRows,
  buildShopStatementHtml,
  escapeHtml,
  textToBase64,
} from './receiptGenerator';

const sampleShop: Shopkeeper = {
  id: 'shop-1',
  shopName: 'মা মেডিকেল <হল>',
  ownerName: 'হাজী করিম',
  phone: '01711-000111',
  area: 'শাহবাগ',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const sampleSale: SaleRecord = {
  id: 'sale-1',
  invoiceNo: 'INV-0042',
  shopId: 'shop-1',
  shopName: 'মা মেডিকেল <হল>',
  date: '2026-11-18T10:30:00.000Z',
  items: [
    {
      productId: 'p-1',
      productName: 'Dexlan 30mg',
      tier: 'Super Star',
      boxes: 2,
      boxPrice: 480,
      discountPercent: 10,
      grossTotal: 960,
      discountAmount: 96,
      netTotal: 864,
      effectiveBoxPrice: 432,
    },
  ],
  totalBoxes: 2,
  grossTotal: 960,
  totalDiscount: 96,
  netTotal: 864,
  paidAmount: 500,
  dueAmount: 364,
  note: 'নগদ আংশিক জমা',
};

const samplePayments: PaymentRecord[] = [
  {
    id: 'pay-1',
    receiptNo: 'REC-0010',
    shopId: 'shop-1',
    shopName: 'মা মেডিকেল <হল>',
    date: '2026-11-19T09:00:00.000Z',
    amount: 200,
    method: 'Cash',
    note: 'বাকি আদায়',
  },
];

test('buildReceiptFileName formats clean png file name', () => {
  assert.equal(buildReceiptFileName(sampleSale), 'ibn-sina-receipt-INV-0042.png');
});

test('escapeHtml neutralizes HTML injection characters', () => {
  assert.equal(escapeHtml('<script>"alert"</script>'), '&lt;script&gt;&quot;alert&quot;&lt;/script&gt;');
});

test('buildPrintableReceiptHtml escapes shop name and includes totals', () => {
  const html = buildPrintableReceiptHtml(sampleSale);
  assert.match(html, /মা মেডিকেল &lt;হল&gt;/);
  assert.match(html, /INV-0042/);
  assert.match(html, /Dexlan 30mg/);
  assert.match(html, /নগদ আংশিক জমা/);
});

test('buildReceiptSummaryText contains shop, items, date/time, and due amount', () => {
  const txt = buildReceiptSummaryText(sampleSale);
  assert.match(txt, /INV-0042/);
  assert.match(txt, /তারিখ ও সময়:.*:/);
  assert.match(txt, /Dexlan 30mg/);
  assert.match(txt, /মন্তব্য: নগদ আংশিক জমা/);
});

test('textToBase64 encodes UTF-8 Bengali text cleanly', () => {
  const b64 = textToBase64('ইবনে সিনা টালিখাতা');
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  assert.equal(decoded, 'ইবনে সিনা টালিখাতা');
});

test('buildShopLedgerRows computes chronological running due across sales and payments', () => {
  const rows = buildShopLedgerRows('shop-1', [sampleSale], samplePayments);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].code, 'INV-0042');
  assert.equal(rows[0].runningDue, 364);
  assert.equal(rows[1].code, 'REC-0010');
  assert.equal(rows[1].runningDue, 164);
});

test('buildShopStatementHtml escapes shop info and includes statement rows', () => {
  const html = buildShopStatementHtml(sampleShop, [sampleSale], samplePayments);
  assert.match(html, /মা মেডিকেল &lt;হল&gt;/);
  assert.match(html, /হাজী করিম/);
  assert.match(html, /INV-0042/);
  assert.match(html, /REC-0010/);
  assert.match(html, /চলমান বাকি/);
});
