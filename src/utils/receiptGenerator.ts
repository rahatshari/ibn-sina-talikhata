import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { getActiveFontOption } from './fontPreferences';
import { computeShopSummary, formatBDT, formatCount, formatDateTimeBn } from './ledger';
import { getActiveNumeralMode } from './numberFormat';

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReceiptFileName(sale: SaleRecord): string {
  const safeInvoice = (sale.invoiceNo || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `ibn-sina-receipt-${safeInvoice}.png`;
}

export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function buildReceiptSummaryText(sale: SaleRecord): string {
  const lines = [
    "THE IBN SINA'S Production — বিক্রয় রসিদ",
    `দোকান: ${sale.shopName}`,
    `ইনভয়েস: ${sale.invoiceNo}`,
    `তারিখ ও সময়: ${formatDateTimeBn(sale.date)}`,
    `মোট আইটেম: ${formatCount(sale.items.length)}টি (${formatCount(sale.totalBoxes)} বক্স)`,
    '--------------------------------',
    ...sale.items.map(
      (item, idx) =>
        `${formatCount(idx + 1)}. ${item.productName} (${formatCount(item.boxes)} বক্স × ${formatBDT(item.effectiveBoxPrice)}) = ${formatBDT(item.netTotal)}`,
    ),
    '--------------------------------',
    `আসল দাম: ${formatBDT(sale.grossTotal)}`,
    `মোট ছাড়: -${formatBDT(sale.totalDiscount)}`,
    `সর্বমোট প্রদেয়: ${formatBDT(sale.netTotal)}`,
    `নগদ জমা: ${formatBDT(sale.paidAmount)}`,
    `বাকি: ${formatBDT(sale.dueAmount)}`,
  ];
  if (sale.note) {
    lines.push(`মন্তব্য: ${sale.note}`);
  }
  return lines.join('\n');
}

export function buildPrintableReceiptHtml(sale: SaleRecord): string {
  const itemRows = sale.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;color:#0f172a;">${formatCount(idx + 1)}. ${escapeHtml(item.productName)}</div>
          <div style="font-size:11px;color:#64748b;">${escapeHtml(item.tier)}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCount(item.boxes)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatBDT(item.boxPrice))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#b45309;">${formatCount(item.discountPercent)}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#047857;">${escapeHtml(formatBDT(item.effectiveBoxPrice))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${escapeHtml(formatBDT(item.netTotal))}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>রসিদ - ${escapeHtml(sale.invoiceNo)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 24px; }
    .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { font-size: 12px; font-weight: 700; color: #047857; letter-spacing: 0.4px; }
    .shop { font-size: 20px; font-weight: 700; margin: 4px 0; }
    .meta { font-size: 12px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { background: #f8fafc; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-size: 12px; color: #475569; }
    th.num { text-align: right; }
    .totals { margin-top: 18px; margin-left: auto; max-width: 320px; font-size: 13px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; }
    .net { border-top: 1px solid #cbd5e1; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 15px; }
    .due { color: #dc2626; font-weight: 700; }
    .note { margin-top: 16px; font-size: 12px; color: #475569; background: #f8fafc; padding: 10px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">ব্যক্তিগত টালিখাতা</div>
    <div class="shop">${escapeHtml(sale.shopName)}</div>
    <div class="meta">ইনভয়েস: ${escapeHtml(sale.invoiceNo)} · ${escapeHtml(formatDateTimeBn(sale.date))} · মোট ${formatCount(sale.totalBoxes)} বক্স</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>প্রোডাক্ট</th>
        <th class="num">বক্স</th>
        <th class="num">দাম</th>
        <th class="num">ছাড়</th>
        <th class="num">নিট/বক্স</th>
        <th class="num">মোট</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>মোট আসল দাম</span><span>${escapeHtml(formatBDT(sale.grossTotal))}</span></div>
    <div class="row" style="color:#b45309;"><span>মোট ডিসকাউন্ট ছাড়</span><span>-${escapeHtml(formatBDT(sale.totalDiscount))}</span></div>
    <div class="row net"><span>সর্বমোট প্রদেয় বিল</span><span>${escapeHtml(formatBDT(sale.netTotal))}</span></div>
    <div class="row" style="color:#047857;"><span>নগদ জমা</span><span>${escapeHtml(formatBDT(sale.paidAmount))}</span></div>
    <div class="row due"><span>বাকি আছে</span><span>${escapeHtml(formatBDT(sale.dueAmount))}</span></div>
  </div>
  ${sale.note ? `<div class="note"><strong>মন্তব্য:</strong> ${escapeHtml(sale.note)}</div>` : ''}
</body>
</html>`;
}

export interface ShopLedgerRow {
  id: string;
  kind: 'sale' | 'payment';
  date: string;
  code: string;
  details: string;
  boxes: number;
  billed: number;
  paid: number;
  runningDue: number;
}

export function buildShopLedgerRows(
  shopId: string,
  sales: SaleRecord[],
  payments: PaymentRecord[],
): ShopLedgerRow[] {
  const combined = [
    ...sales
      .filter((s) => s.shopId === shopId)
      .map((s) => ({
        id: s.id,
        kind: 'sale' as const,
        date: s.date,
        code: s.invoiceNo,
        details: s.items
          .map((item) => `${item.productName} (${formatCount(item.boxes)} বক্স, ${formatCount(item.discountPercent)}% ছাড়)`)
          .join(', '),
        boxes: s.totalBoxes,
        billed: s.netTotal,
        paid: s.paidAmount,
      })),
    ...payments
      .filter((p) => p.shopId === shopId)
      .map((p) => ({
        id: p.id,
        kind: 'payment' as const,
        date: p.date,
        code: p.receiptNo,
        details: `বাকি আদায় · ${p.method}${p.note ? ` (${p.note})` : ''}`,
        boxes: 0,
        billed: 0,
        paid: p.amount,
      })),
  ].sort((a, b) => {
    const timeA = Date.parse(a.date);
    const timeB = Date.parse(b.date);
    if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    if (a.kind !== b.kind) return a.kind === 'sale' ? -1 : 1;
    return a.code.localeCompare(b.code);
  });

  let running = 0;
  const chronologicalRows = combined.map((entry) => {
    running = Math.round((running + entry.billed - entry.paid) * 100) / 100;
    return {
      ...entry,
      runningDue: running,
    };
  });

  return chronologicalRows.reverse();
}

export function buildShopStatementHtml(
  shop: Shopkeeper,
  sales: SaleRecord[],
  payments: PaymentRecord[],
): string {
  const summary = computeShopSummary(shop.id, sales, payments);
  const rows = buildShopLedgerRows(shop.id, sales, payments);
  const fontFamily = getActiveFontOption().fontFamily;

  const tableRows =
    rows.length === 0
      ? `<tr><td colspan="6" style="padding:18px;text-align:center;color:#64748b;">এই দোকানদারের কোনো লেনদেন পাওয়া যায়নি।</td></tr>`
      : rows
          .map(
            (row, idx) => `
      <tr style="background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${escapeHtml(formatDateTimeBn(row.date))}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;white-space:nowrap;">${escapeHtml(row.code)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(row.details)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;">${row.billed > 0 ? escapeHtml(formatBDT(row.billed)) : '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#047857;font-weight:600;white-space:nowrap;">${row.paid > 0 ? escapeHtml(formatBDT(row.paid)) : '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:${row.runningDue > 0 ? '#dc2626' : '#047857'};white-space:nowrap;">${escapeHtml(formatBDT(row.runningDue))}</td>
      </tr>`,
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <title>লেনদেন রিপোর্ট — ${escapeHtml(shop.shopName)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: ${fontFamily}; color: #0f172a; margin: 0; padding: 18px; }
    .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .brand { font-size: 12px; font-weight: 700; color: #047857; }
    .shop { font-size: 20px; font-weight: 700; margin: 4px 0 2px; }
    .meta { font-size: 12px; color: #475569; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 11px; color: #64748b; }
    .kpi-val { font-size: 15px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-size: 11px; color: #475569; }
    th.num { text-align: right; }
    .footer { margin-top: 18px; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">THE IBN SINA'S Production — সম্পূর্ণ লেনদেনের রিপোর্ট</div>
      <div class="shop">${escapeHtml(shop.shopName)}</div>
      <div class="meta">মালিক: ${escapeHtml(shop.ownerName || '—')} · এলাকা: ${escapeHtml(shop.area || '—')}${shop.phone ? ` · ফোন: ${escapeHtml(shop.phone)}` : ''}</div>
    </div>
    <div class="meta" style="text-align:right;">
      <div>রিপোর্ট তারিখ ও সময়</div>
      <div style="font-weight:600;color:#0f172a;">${escapeHtml(formatDateTimeBn(new Date().toISOString()))}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">মোট বক্স</div><div class="kpi-val">${formatCount(summary.totalBoxes)} বক্স</div></div>
    <div class="kpi"><div class="kpi-label">মোট বিল</div><div class="kpi-val">${escapeHtml(formatBDT(summary.totalBilled))}</div></div>
    <div class="kpi"><div class="kpi-label">মোট জমা / আদায়</div><div class="kpi-val" style="color:#047857;">${escapeHtml(formatBDT(summary.totalPaid))}</div></div>
    <div class="kpi"><div class="kpi-label">বর্তমান মোট বাকি</div><div class="kpi-val" style="color:${summary.totalDue > 0 ? '#dc2626' : '#047857'};">${escapeHtml(formatBDT(summary.totalDue))}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>তারিখ ও সময়</th>
        <th>নম্বর</th>
        <th>বিবরণ</th>
        <th class="num">বিল</th>
        <th class="num">জমা/আদায়</th>
        <th class="num">চলমান বাকি</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">ব্যক্তিগত টালিখাতা অ্যাপ থেকে তৈরি দোকানদারের সম্পূর্ণ হিসাব বিবরণী</div>
</body>
</html>`;
}

export function printHtmlInBrowser(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1200);
  };

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  }, 180);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function renderReceiptPng(
  sale: SaleRecord,
): Promise<{ blob: Blob; base64: string; fileName: string; dataUrl: string }> {
  const width = 920;
  const padding = 44;
  const headerHeight = 175;
  const rowHeight = 64;
  const tableHeaderHeight = 46;
  const summaryHeight = sale.note ? 260 : 210;
  const footerHeight = 64;
  const height =
    padding +
    headerHeight +
    tableHeaderHeight +
    sale.items.length * rowHeight +
    summaryHeight +
    footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const fontFamily = getActiveFontOption().canvasFont;

  // Top Emerald Accent Banner
  drawRoundedRect(ctx, padding, padding, width - padding * 2, 132, 16);
  ctx.fillStyle = '#059669';
  ctx.fill();

  ctx.fillStyle = '#D1FAE5';
  ctx.font = `600 18px ${fontFamily}`;
  ctx.fillText("ব্যক্তিগত টালিখাতা · বিক্রয় রসিদ", padding + 28, padding + 42);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 32px ${fontFamily}`;
  ctx.fillText(sale.shopName, padding + 28, padding + 84);

  ctx.fillStyle = '#ECFDF5';
  ctx.font = `500 18px ${fontFamily}`;
  ctx.fillText(
    `রসিদ নং: ${sale.invoiceNo}   |   তারিখ: ${formatDateTimeBn(sale.date)}   |   মোট: ${formatCount(sale.totalBoxes)} বক্স`,
    padding + 28,
    padding + 114,
  );

  // Table Header
  let cursorY = padding + headerHeight;
  drawRoundedRect(ctx, padding, cursorY, width - padding * 2, tableHeaderHeight, 8);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '700 17px "Hind Siliguri", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('প্রোডাক্টের নাম', padding + 16, cursorY + 29);
  ctx.textAlign = 'right';
  ctx.fillText('বক্স', padding + 395, cursorY + 29);
  ctx.fillText('দাম', padding + 490, cursorY + 29);
  ctx.fillText('ছাড়', padding + 580, cursorY + 29);
  ctx.fillText('নিট/বক্স', padding + 695, cursorY + 29);
  ctx.fillText('মোট', width - padding - 16, cursorY + 29);

  cursorY += tableHeaderHeight;

  // Table Rows
  for (let i = 0; i < sale.items.length; i += 1) {
    const item = sale.items[i];
    if (i % 2 === 1) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(padding, cursorY, width - padding * 2, rowHeight);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 19px "Hind Siliguri", system-ui, sans-serif';
    const maxName = item.productName.length > 25 ? `${item.productName.slice(0, 23)}…` : item.productName;
    ctx.fillText(`${formatCount(i + 1)}. ${maxName}`, padding + 16, cursorY + 28);

    ctx.fillStyle = '#64748B';
    ctx.font = '500 14px "Hind Siliguri", system-ui, sans-serif';
    ctx.fillText(item.tier, padding + 16, cursorY + 50);

    ctx.textAlign = 'right';
    ctx.font = '600 18px "Hind Siliguri", system-ui, sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(formatCount(item.boxes), padding + 395, cursorY + 38);

    ctx.fillStyle = '#475569';
    ctx.fillText(formatBDT(item.boxPrice), padding + 490, cursorY + 38);

    ctx.fillStyle = '#B45309';
    ctx.fillText(`${formatCount(item.discountPercent)}%`, padding + 580, cursorY + 38);

    ctx.fillStyle = '#047857';
    ctx.fillText(formatBDT(item.effectiveBoxPrice), padding + 695, cursorY + 38);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px "Hind Siliguri", system-ui, sans-serif';
    ctx.fillText(formatBDT(item.netTotal), width - padding - 16, cursorY + 38);

    // Row divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, cursorY + rowHeight);
    ctx.lineTo(width - padding, cursorY + rowHeight);
    ctx.stroke();

    cursorY += rowHeight;
  }

  // Summary Box
  cursorY += 20;
  const summaryBoxW = 420;
  const summaryBoxX = width - padding - summaryBoxW;
  drawRoundedRect(ctx, summaryBoxX, cursorY, summaryBoxW, 178, 12);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  const drawSummaryRow = (label: string, val: string, yOffset: number, color: string, bold = false) => {
    ctx.font = `${bold ? '700' : '500'} ${bold ? '21px' : '18px'} "Hind Siliguri", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, summaryBoxX + 20, cursorY + yOffset);
    ctx.textAlign = 'right';
    ctx.fillText(val, summaryBoxX + summaryBoxW - 20, cursorY + yOffset);
  };

  drawSummaryRow('মোট আসল দাম', formatBDT(sale.grossTotal), 34, '#475569');
  drawSummaryRow('মোট ডিসকাউন্ট ছাড়', `-${formatBDT(sale.totalDiscount)}`, 66, '#B45309');

  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(summaryBoxX + 18, cursorY + 82);
  ctx.lineTo(summaryBoxX + summaryBoxW - 18, cursorY + 82);
  ctx.stroke();

  drawSummaryRow('সর্বমোট প্রদেয় বিল', formatBDT(sale.netTotal), 110, '#0F172A', true);
  drawSummaryRow('নগদ জমা', formatBDT(sale.paidAmount), 140, '#047857', true);
  drawSummaryRow(
    'বাকি আছে',
    formatBDT(sale.dueAmount),
    168,
    sale.dueAmount > 0 ? '#DC2626' : '#047857',
    true,
  );

  // Note on Left Side
  if (sale.note) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = '700 17px "Hind Siliguri", system-ui, sans-serif';
    ctx.fillText('মন্তব্য:', padding, cursorY + 34);
    ctx.fillStyle = '#475569';
    ctx.font = '500 16px "Hind Siliguri", system-ui, sans-serif';
    ctx.fillText(sale.note.slice(0, 48), padding, cursorY + 62);
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 15px "Hind Siliguri", system-ui, sans-serif';
  ctx.fillText(
    "ব্যক্তিগত টালিখাতা অ্যাপ থেকে তৈরি ডিজিটাল বিক্রয় রসিদ",
    width / 2,
    height - 26,
  );

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'image/png' });

  return {
    blob,
    base64,
    dataUrl,
    fileName: buildReceiptFileName(sale),
  };
}

export interface RenderedReceiptResult {
  blob: Blob;
  base64: string;
  fileName: string;
  dataUrl: string;
}

const receiptRenderCache = new Map<string, Promise<RenderedReceiptResult>>();

export function getCachedReceiptPng(sale: SaleRecord): Promise<RenderedReceiptResult> {
  const fontId = getActiveFontOption().id;
  const numeralMode = getActiveNumeralMode();
  const itemsSignature = sale.items
    .map((item) => `${item.productId}:${item.boxes}:${item.boxPrice}:${item.discountPercent}`)
    .join(',');
  const cacheKey = `${sale.id}:${sale.date}:${sale.shopName}:${sale.netTotal}:${sale.paidAmount}:${sale.dueAmount}:${sale.note ?? ''}:${itemsSignature}:${fontId}:${numeralMode}`;
  const cached = receiptRenderCache.get(cacheKey);
  if (cached) return cached;

  if (receiptRenderCache.size >= 12) {
    const firstKey = receiptRenderCache.keys().next().value;
    if (firstKey) receiptRenderCache.delete(firstKey);
  }

  const promise = renderReceiptPng(sale).catch((err) => {
    receiptRenderCache.delete(cacheKey);
    throw err;
  });
  receiptRenderCache.set(cacheKey, promise);
  return promise;
}
