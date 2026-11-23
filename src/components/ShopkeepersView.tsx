import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Printer,
  Search,
  UserPlus,
} from 'lucide-react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { computeShopSummary, formatBDT, formatDateTimeBn } from '../utils/ledger';
import {
  buildShopLedgerRows,
  buildShopStatementHtml,
  printHtmlInBrowser,
} from '../utils/receiptGenerator';

interface ShopkeepersViewProps {
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  selectedLedgerShop: Shopkeeper | null;
  onSelectLedgerShop: (shop: Shopkeeper | null) => void;
  onRequestAddShop: () => void;
  onRequestEditShop: (shop: Shopkeeper) => void;
  onStartNewSale: (shopId: string) => void;
  onCollectDue: (shop: Shopkeeper, currentDue: number) => void;
  onOpenSaleDetail: (sale: SaleRecord) => void;
  onEditSale: (sale: SaleRecord) => void;
  onEditPayment: (payment: PaymentRecord) => void;
}

export function ShopkeepersView({
  shops,
  sales,
  payments,
  selectedLedgerShop,
  onSelectLedgerShop,
  onRequestAddShop,
  onRequestEditShop,
  onStartNewSale,
  onCollectDue,
  onOpenSaleDetail,
  onEditSale,
  onEditPayment,
}: ShopkeepersViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [ledgerTab, setLedgerTab] = useState<'statement' | 'timeline'>('statement');
  const [printNotice, setPrintNotice] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shops
      .map((shop) => ({
        shop,
        summary: computeShopSummary(shop.id, sales, payments),
      }))
      .filter(({ shop, summary }) => {
        if (filter === 'due' && summary.totalDue <= 0) return false;
        if (filter === 'paid' && summary.totalDue > 0) return false;
        if (!q) return true;
        return (
          shop.shopName.toLowerCase().includes(q) ||
          shop.ownerName.toLowerCase().includes(q) ||
          shop.area.toLowerCase().includes(q) ||
          shop.phone.includes(q)
        );
      })
      .sort((a, b) => b.summary.totalDue - a.summary.totalDue);
  }, [shops, sales, payments, search, filter]);

  const liveLedgerShop = useMemo(() => {
    if (!selectedLedgerShop) return null;
    return shops.find((s) => s.id === selectedLedgerShop.id) ?? selectedLedgerShop;
  }, [selectedLedgerShop, shops]);

  useEffect(() => {
    if (liveLedgerShop) {
      setPrintNotice(null);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [liveLedgerShop?.id]);

  const activeShopSummary = liveLedgerShop
    ? computeShopSummary(liveLedgerShop.id, sales, payments)
    : null;

  const activeShopTimeline = useMemo(() => {
    if (!liveLedgerShop) return [];
    const shopSales = sales
      .filter((s) => s.shopId === liveLedgerShop.id)
      .map((s) => ({
        kind: 'sale' as const,
        id: s.id,
        date: s.date,
        code: s.invoiceNo,
        sale: s,
        payment: null,
      }));
    const shopPayments = payments
      .filter((p) => p.shopId === liveLedgerShop.id)
      .map((p) => ({
        kind: 'payment' as const,
        id: p.id,
        date: p.date,
        code: p.receiptNo,
        sale: null,
        payment: p,
      }));
    return [...shopSales, ...shopPayments].sort((a, b) => b.date.localeCompare(a.date));
  }, [liveLedgerShop, sales, payments]);

  const activeShopStatementRows = useMemo(() => {
    if (!liveLedgerShop) return [];
    return buildShopLedgerRows(liveLedgerShop.id, sales, payments);
  }, [liveLedgerShop, sales, payments]);

  const handlePrintShopStatement = async (shop: Shopkeeper) => {
    setPrintNotice(null);
    const html = buildShopStatementHtml(shop, sales, payments);
    try {
      if (isNativeAndroid()) {
        await AppUpdater.printHtml({
          html,
          jobName: `IbnSina-Report-${shop.shopName.replace(/\s+/g, '-')}`,
        });
        setPrintNotice('রিপোর্ট PDF / প্রিন্ট ডায়ালগ খোলা হয়েছে।');
      } else {
        printHtmlInBrowser(html);
      }
    } catch {
      setPrintNotice('রিপোর্ট প্রিন্ট করা যায়নি। আবার চেষ্টা করুন।');
    }
  };

  // Dedicated Full-Page Shopkeeper Detail View (No Popup Modal)
  if (liveLedgerShop && activeShopSummary) {
    return (
      <div className="space-y-5" data-testid="shop-detail-fullpage">
        {/* Back Button + Shop Identity */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <button
              type="button"
              onClick={() => onSelectLedgerShop(null)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              সকল দোকানদার
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words">
              {liveLedgerShop.shopName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-slate-600">
              <span>{liveLedgerShop.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span>{liveLedgerShop.area}</span>
              {liveLedgerShop.phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{liveLedgerShop.phone}</span>
                </>
              )}
            </div>
          </div>

          {/* All Actions Inside the Dedicated Page */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center shrink-0">
            {activeShopSummary.totalDue > 0 && (
              <button
                type="button"
                onClick={() => onCollectDue(liveLedgerShop, activeShopSummary.totalDue)}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <Banknote className="h-3.5 w-3.5 shrink-0" />
                বাকি আদায়
              </button>
            )}
            <button
              type="button"
              onClick={() => onStartNewSale(liveLedgerShop.id)}
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
                activeShopSummary.totalDue > 0
                  ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              নতুন বিক্রি
            </button>
            <button
              type="button"
              onClick={() => void handlePrintShopStatement(liveLedgerShop)}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              রিপোর্ট PDF
            </button>
            <button
              type="button"
              onClick={() => onRequestEditShop(liveLedgerShop)}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              এডিট করুন
            </button>
          </div>
        </div>

        {printNotice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800"
          >
            {printNotice}
          </div>
        )}

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-500 truncate">মোট বিল</div>
            <div className="mt-1 text-sm sm:text-xl font-bold font-mono-num text-slate-900 truncate">
              {formatBDT(activeShopSummary.totalBilled)}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-xs text-slate-400 font-mono-num">
              {activeShopSummary.totalBoxes} বক্স
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-500 truncate">মোট জমা</div>
            <div className="mt-1 text-sm sm:text-xl font-bold font-mono-num text-emerald-700 truncate">
              {formatBDT(activeShopSummary.totalPaid)}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-xs text-slate-400 font-mono-num">
              {activeShopSummary.paymentCount} আদায়
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-500 truncate">বর্তমান বাকি</div>
            <div
              className={`mt-1 text-sm sm:text-xl font-bold font-mono-num truncate ${
                activeShopSummary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatBDT(activeShopSummary.totalDue)}
            </div>
            <div className="mt-0.5 text-[10px] sm:text-xs text-slate-400 font-mono-num">
              {activeShopSummary.invoiceCount} চালান
            </div>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setLedgerTab('statement')}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              ledgerTab === 'statement'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            সম্পূর্ণ রিপোর্ট ({activeShopStatementRows.length})
          </button>
          <button
            type="button"
            onClick={() => setLedgerTab('timeline')}
            className={`inline-flex min-h-[38px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              ledgerTab === 'timeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পণ্যভিত্তিক তালিকা
          </button>
        </div>

        {/* Ledger Content */}
        {activeShopTimeline.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">এই দোকানে এখনও কোনো বিক্রি বা আদায়ের হিসাব নেই।</p>
            <button
              type="button"
              onClick={() => onStartNewSale(liveLedgerShop.id)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              প্রথম বিক্রি যোগ করুন
            </button>
          </div>
        ) : ledgerTab === 'statement' ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* Mobile Single-Screen Cards (No Horizontal Swipe) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {activeShopStatementRows.map((row) => {
                const matchingSale =
                  row.kind === 'sale' ? sales.find((s) => s.id === row.id) ?? null : null;
                const matchingPayment =
                  row.kind === 'payment' ? payments.find((p) => p.id === row.id) ?? null : null;
                return (
                  <div key={row.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {matchingSale ? (
                          <button
                            type="button"
                            onClick={() => onOpenSaleDetail(matchingSale)}
                            className="text-sm font-bold font-mono-num text-emerald-700 hover:underline"
                          >
                            {row.code}
                          </button>
                        ) : (
                          <span className="text-sm font-bold font-mono-num text-slate-900">
                            {row.code}
                          </span>
                        )}
                        <div className="text-[11px] text-slate-500">{formatDateTimeBn(row.date)}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(matchingSale || matchingPayment) && (
                          <button
                            type="button"
                            onClick={() =>
                              matchingSale
                                ? onEditSale(matchingSale)
                                : matchingPayment && onEditPayment(matchingPayment)
                            }
                            aria-label={`এডিট করুন: ${row.code}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Pencil className="h-3 w-3" />
                            এডিট
                          </button>
                        )}
                        {matchingSale && (
                          <button
                            type="button"
                            onClick={() => onOpenSaleDetail(matchingSale)}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                          >
                            রসিদ দেখুন
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 break-words">{row.details}</p>
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500">বিল</div>
                        <div className="font-semibold font-mono-num text-slate-900">
                          {row.billed > 0 ? formatBDT(row.billed) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">জমা/আদায়</div>
                        <div className="font-semibold font-mono-num text-emerald-700">
                          {row.paid > 0 ? formatBDT(row.paid) : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500">চলমান বাকি</div>
                        <div
                          className={`font-bold font-mono-num ${
                            row.runningDue > 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatBDT(row.runningDue)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Full Statement Table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">তারিখ ও নম্বর</th>
                    <th className="px-4 py-3 font-semibold">বিবরণ</th>
                    <th className="px-4 py-3 text-right font-semibold">বিল</th>
                    <th className="px-4 py-3 text-right font-semibold">জমা/আদায়</th>
                    <th className="px-4 py-3 text-right font-semibold">চলমান বাকি</th>
                    <th className="px-4 py-3 text-right font-semibold">এডিট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeShopStatementRows.map((row) => {
                    const matchingSale =
                      row.kind === 'sale' ? sales.find((s) => s.id === row.id) ?? null : null;
                    const matchingPayment =
                      row.kind === 'payment' ? payments.find((p) => p.id === row.id) ?? null : null;
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {matchingSale ? (
                            <button
                              type="button"
                              onClick={() => onOpenSaleDetail(matchingSale)}
                              className="font-semibold font-mono-num text-emerald-700 hover:underline"
                            >
                              {row.code}
                            </button>
                          ) : (
                            <span className="font-semibold font-mono-num text-slate-800">
                              {row.code}
                            </span>
                          )}
                          <div className="text-xs text-slate-500">{formatDateTimeBn(row.date)}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.details}</td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-900 whitespace-nowrap">
                          {row.billed > 0 ? formatBDT(row.billed) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold font-mono-num text-emerald-700 whitespace-nowrap">
                          {row.paid > 0 ? formatBDT(row.paid) : '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold font-mono-num whitespace-nowrap ${
                            row.runningDue > 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatBDT(row.runningDue)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {(matchingSale || matchingPayment) && (
                            <button
                              type="button"
                              onClick={() =>
                                matchingSale
                                  ? onEditSale(matchingSale)
                                  : matchingPayment && onEditPayment(matchingPayment)
                              }
                              aria-label={`এডিট করুন: ${row.code}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3 w-3" />
                              এডিট
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {activeShopTimeline.map((entry) =>
              entry.kind === 'sale' && entry.sale ? (
                <div key={entry.id} className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSaleDetail(entry.sale!)}
                        className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline font-mono-num"
                      >
                        {entry.sale.invoiceNo}
                      </button>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-500">
                        {formatDateTimeBn(entry.sale.date)} · {entry.sale.totalBoxes} বক্স
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditSale(entry.sale!)}
                        aria-label={`এডিট করুন: ${entry.sale.invoiceNo}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="h-3 w-3" />
                        এডিট
                      </button>
                    </div>
                    <div className="text-xs font-mono-num">
                      <span className="font-semibold text-slate-900">
                        বিল {formatBDT(entry.sale.netTotal)}
                      </span>
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className="text-emerald-700">জমা {formatBDT(entry.sale.paidAmount)}</span>
                      <span className="mx-1.5 text-slate-300">|</span>
                      <span className={entry.sale.dueAmount > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>
                        বাকি {formatBDT(entry.sale.dueAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    {entry.sale.items.map((item, i) => (
                      <div key={`${item.productId}-${i}`} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words">
                          {item.productName} ({item.boxes} বক্স · {item.discountPercent}% ছাড়)
                        </span>
                        <span className="font-mono-num text-slate-800 shrink-0 text-right">
                          {formatBDT(item.netTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                entry.payment && (
                  <div key={entry.id} className="flex items-center justify-between gap-3 bg-emerald-50/40 p-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-emerald-800">
                        বাকি আদায় · <span className="font-mono-num">{entry.payment.receiptNo}</span>
                      </div>
                      <div className="text-xs text-slate-600 break-words">
                        {formatDateTimeBn(entry.payment.date)} · {entry.payment.method}
                        {entry.payment.note ? ` · ${entry.payment.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-sm font-bold font-mono-num text-emerald-700">
                        +{formatBDT(entry.payment.amount)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditPayment(entry.payment!)}
                        aria-label={`এডিট করুন: ${entry.payment.receiptNo}`}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
                      >
                        <Pencil className="h-3 w-3" />
                        এডিট
                      </button>
                    </div>
                  </div>
                )
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  // Clean Outside Shopkeepers List (No External Action Buttons; Tap Any Shop to Open Full Page)
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">দোকানদার ও খাতা</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
            দোকানদারের নামের ওপর ক্লিক করলে তার সম্পূর্ণ খাতা, রিপোর্ট, বিক্রি ও এডিট পেজ খুলবে
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestAddShop}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          নতুন দোকানদার
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="দোকান খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, এলাকা বা ফোন দিয়ে খুঁজুন..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব ({shops.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('due')}
            className={`rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'due' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাকি আছে
          </button>
          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`rounded-md px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'paid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পরিশোধিত
          </button>
        </div>
      </div>

      {/* Clean Tappable Shopkeepers List (Zero External Action Buttons, Zero Horizontal Overflow) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              {shops.length === 0
                ? 'এখনও কোনো দোকানদার যোগ করা হয়নি। উপরে "নতুন দোকানদার" বাটনে ক্লিক করে শুরু করুন।'
                : 'এই ফিল্টারে কোনো দোকান পাওয়া যায়নি।'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Clean Card Rows */}
            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map(({ shop, summary }) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => onSelectLedgerShop(shop)}
                  aria-label={`খাতা দেখুন: ${shop.shopName}`}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {shop.shopName}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {shop.ownerName} · {shop.area}
                    </div>
                    <div className="mt-1 text-[11px] font-mono-num text-slate-500">
                      মোট বিল {formatBDT(summary.totalBilled)} · জমা {formatBDT(summary.totalPaid)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">
                        {summary.totalDue > 0 ? 'বাকি' : 'পরিশোধিত'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono-num ${
                          summary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatBDT(summary.totalDue)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop Clean Clickable Table (No Extra Action Columns) */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">দোকান ও ঠিকানা</th>
                    <th className="px-4 py-3 text-right font-medium">মোট বক্স</th>
                    <th className="px-4 py-3 text-right font-medium">মোট বিল</th>
                    <th className="px-4 py-3 text-right font-medium">মোট জমা</th>
                    <th className="px-5 py-3 text-right font-medium">বাকি পাওনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ shop, summary }) => (
                    <tr
                      key={shop.id}
                      onClick={() => onSelectLedgerShop(shop)}
                      className="cursor-pointer transition-colors hover:bg-emerald-50/40"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLedgerShop(shop);
                            }}
                            className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left"
                          >
                            {shop.shopName}
                          </button>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          <span>{shop.ownerName}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{shop.area}</span>
                          {shop.phone && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono-num">{shop.phone}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-num text-slate-700">
                        {summary.totalBoxes}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-num text-slate-900">
                        {formatBDT(summary.totalBilled)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-num text-emerald-700">
                        {formatBDT(summary.totalPaid)}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-bold font-mono-num ${
                          summary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatBDT(summary.totalDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
