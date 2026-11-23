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
import { computeShopSummary, formatBDT, formatCount, formatDateTimeBn } from '../utils/ledger';
import { useNumeralMode } from '../utils/NumeralContext';
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
  const { numeralMode } = useNumeralMode();
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
      <div className="space-y-6" data-testid="shop-detail-fullpage">
        {/* Back Button + Shop Identity */}
        <div className="flex flex-col gap-4 rounded-[28px] bg-[#FFFFFF] p-5 sm:p-6 shadow-xs ring-1 ring-[#DCE7DF]/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <button
              type="button"
              onClick={() => onSelectLedgerShop(null)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#ECF3ED] px-4 py-1.5 text-sm font-bold text-[#171D19] hover:bg-[#D7E7DC]"
            >
              <ArrowLeft className="h-4 w-4" />
              সকল দোকানদার
            </button>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#171D19] break-words">
              {liveLedgerShop.shopName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 text-sm sm:text-[15px] text-[#404943]">
              <span>{liveLedgerShop.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span>{liveLedgerShop.area}</span>
              {liveLedgerShop.phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{formatCount(liveLedgerShop.phone, numeralMode)}</span>
                </>
              )}
            </div>
          </div>

          {/* All Actions Inside the Dedicated Page */}
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center shrink-0">
            {activeShopSummary.totalDue > 0 && (
              <button
                type="button"
                onClick={() => onCollectDue(liveLedgerShop, activeShopSummary.totalDue)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#006B47] px-4 py-2 text-sm font-bold text-white hover:bg-[#005739] whitespace-nowrap"
              >
                <Banknote className="h-4 w-4 shrink-0" />
                বাকি আদায়
              </button>
            )}
            <button
              type="button"
              onClick={() => onStartNewSale(liveLedgerShop.id)}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ${
                activeShopSummary.totalDue > 0
                  ? 'bg-[#CBEAD6] text-[#002114] hover:bg-[#B4DFC4]'
                  : 'bg-[#006B47] text-white hover:bg-[#005739]'
              }`}
            >
              <Plus className="h-4 w-4 shrink-0" />
              নতুন বিক্রি
            </button>
            <button
              type="button"
              onClick={() => void handlePrintShopStatement(liveLedgerShop)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap"
            >
              <Printer className="h-4 w-4 shrink-0" />
              রিপোর্ট PDF
            </button>
            <button
              type="button"
              onClick={() => onRequestEditShop(liveLedgerShop)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap"
            >
              <Pencil className="h-4 w-4 shrink-0" />
              এডিট করুন
            </button>
          </div>
        </div>

        {printNotice && (
          <div
            role="status"
            className="rounded-2xl bg-[#CBEAD6] px-4 py-3 text-sm font-semibold text-[#002114]"
          >
            {printNotice}
          </div>
        )}

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-[24px] bg-[#FFFFFF] p-4 sm:p-5 shadow-xs ring-1 ring-[#DCE7DF]/80 min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-[#404943] truncate">মোট বিল</div>
            <div className="mt-1.5 text-base sm:text-2xl font-bold font-mono-num text-[#171D19] truncate">
              {formatBDT(activeShopSummary.totalBilled, numeralMode)}
            </div>
            <div className="mt-1 text-xs sm:text-[13px] text-[#404943] font-mono-num">
              {formatCount(activeShopSummary.totalBoxes, numeralMode)} বক্স
            </div>
          </div>
          <div className="rounded-[24px] bg-[#CBEAD6]/70 p-4 sm:p-5 min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-[#002114] truncate">মোট জমা</div>
            <div className="mt-1.5 text-base sm:text-2xl font-bold font-mono-num text-[#006B47] truncate">
              {formatBDT(activeShopSummary.totalPaid, numeralMode)}
            </div>
            <div className="mt-1 text-xs sm:text-[13px] text-[#002114]/80 font-mono-num">
              {formatCount(activeShopSummary.paymentCount, numeralMode)} আদায়
            </div>
          </div>
          <div
            className={`rounded-[24px] p-4 sm:p-5 min-w-0 ${
              activeShopSummary.totalDue > 0 ? 'bg-[#FFDAD6]/80' : 'bg-[#E2EDE5]'
            }`}
          >
            <div className="text-xs sm:text-sm font-semibold text-[#404943] truncate">বর্তমান বাকি</div>
            <div
              className={`mt-1.5 text-base sm:text-2xl font-bold font-mono-num truncate ${
                activeShopSummary.totalDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
              }`}
            >
              {formatBDT(activeShopSummary.totalDue, numeralMode)}
            </div>
            <div className="mt-1 text-xs sm:text-[13px] text-[#404943] font-mono-num">
              {formatCount(activeShopSummary.invoiceCount, numeralMode)} চালান
            </div>
          </div>
        </div>

        {/* Material 3 Segmented Report Tabs */}
        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-full bg-[#E2EDE5] p-1">
          <button
            type="button"
            onClick={() => setLedgerTab('statement')}
            className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
              ledgerTab === 'statement'
                ? 'bg-white text-[#002114] shadow-xs'
                : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            সম্পূর্ণ রিপোর্ট ({formatCount(activeShopStatementRows.length, numeralMode)})
          </button>
          <button
            type="button"
            onClick={() => setLedgerTab('timeline')}
            className={`inline-flex min-h-[42px] items-center justify-center rounded-full px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${
              ledgerTab === 'timeline'
                ? 'bg-white text-[#002114] shadow-xs'
                : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            পণ্যভিত্তিক তালিকা
          </button>
        </div>

        {/* Ledger Content */}
        {activeShopTimeline.length === 0 ? (
          <div className="rounded-[28px] bg-[#FFFFFF] p-8 sm:p-10 text-center shadow-xs ring-1 ring-[#DCE7DF]/80">
            <p className="text-base text-[#404943]">এই দোকানে এখনও কোনো বিক্রি বা আদায়ের হিসাব নেই।</p>
            <button
              type="button"
              onClick={() => onStartNewSale(liveLedgerShop.id)}
              className="mt-4 inline-flex min-h-[46px] items-center gap-1.5 rounded-full bg-[#006B47] px-5 py-2.5 text-[15px] font-bold text-white hover:bg-[#005739]"
            >
              <Plus className="h-4 w-4" />
              প্রথম বিক্রি যোগ করুন
            </button>
          </div>
        ) : ledgerTab === 'statement' ? (
          <div className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
            {/* Mobile Single-Screen Cards */}
            <div className="divide-y divide-[#ECF3ED] md:hidden">
              {activeShopStatementRows.map((row) => {
                const matchingSale =
                  row.kind === 'sale' ? sales.find((s) => s.id === row.id) ?? null : null;
                const matchingPayment =
                  row.kind === 'payment' ? payments.find((p) => p.id === row.id) ?? null : null;
                return (
                  <div key={row.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {matchingSale ? (
                          <button
                            type="button"
                            onClick={() => onOpenSaleDetail(matchingSale)}
                            className="text-base font-bold font-mono-num text-[#006B47] hover:underline"
                          >
                            {row.code}
                          </button>
                        ) : (
                          <span className="text-base font-bold font-mono-num text-[#171D19]">
                            {row.code}
                          </span>
                        )}
                        <div className="text-xs text-[#404943]">{formatDateTimeBn(row.date, numeralMode)}</div>
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
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#ECF3ED] px-3 py-1 text-xs font-bold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            এডিট
                          </button>
                        )}
                        {matchingSale && (
                          <button
                            type="button"
                            onClick={() => onOpenSaleDetail(matchingSale)}
                            className="min-h-[36px] rounded-full bg-[#CBEAD6] px-3 py-1 text-xs font-bold text-[#002114] hover:bg-[#B4DFC4] whitespace-nowrap"
                          >
                            রসিদ দেখুন
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[#404943] break-words">{formatCount(row.details, numeralMode)}</p>
                    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F5FAF6] p-3 text-sm">
                      <div>
                        <div className="text-xs text-[#404943]">বিল</div>
                        <div className="font-bold font-mono-num text-[#171D19]">
                          {row.billed > 0 ? formatBDT(row.billed, numeralMode) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#404943]">জমা/আদায়</div>
                        <div className="font-bold font-mono-num text-[#006B47]">
                          {row.paid > 0 ? formatBDT(row.paid, numeralMode) : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#404943]">চলমান বাকি</div>
                        <div
                          className={`font-bold font-mono-num ${
                            row.runningDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                          }`}
                        >
                          {formatBDT(row.runningDue, numeralMode)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Full Statement Table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-[#DCE7DF] bg-[#ECF3ED] text-sm text-[#404943]">
                  <tr>
                    <th className="px-5 py-3.5 font-bold">তারিখ ও নম্বর</th>
                    <th className="px-4 py-3.5 font-bold">বিবরণ</th>
                    <th className="px-4 py-3.5 text-right font-bold">বিল</th>
                    <th className="px-4 py-3.5 text-right font-bold">জমা/আদায়</th>
                    <th className="px-4 py-3.5 text-right font-bold">চলমান বাকি</th>
                    <th className="px-5 py-3.5 text-right font-bold">এডিট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECF3ED]">
                  {activeShopStatementRows.map((row) => {
                    const matchingSale =
                      row.kind === 'sale' ? sales.find((s) => s.id === row.id) ?? null : null;
                    const matchingPayment =
                      row.kind === 'payment' ? payments.find((p) => p.id === row.id) ?? null : null;
                    return (
                      <tr key={row.id} className="hover:bg-[#F5FAF6]">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {matchingSale ? (
                            <button
                              type="button"
                              onClick={() => onOpenSaleDetail(matchingSale)}
                              className="font-bold font-mono-num text-[#006B47] hover:underline"
                            >
                              {row.code}
                            </button>
                          ) : (
                            <span className="font-bold font-mono-num text-[#171D19]">
                              {row.code}
                            </span>
                          )}
                          <div className="text-xs text-[#404943]">{formatDateTimeBn(row.date, numeralMode)}</div>
                        </td>
                        <td className="px-4 py-3.5 text-[#404943]">{formatCount(row.details, numeralMode)}</td>
                        <td className="px-4 py-3.5 text-right font-mono-num text-[#171D19] whitespace-nowrap">
                          {row.billed > 0 ? formatBDT(row.billed, numeralMode) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold font-mono-num text-[#006B47] whitespace-nowrap">
                          {row.paid > 0 ? formatBDT(row.paid, numeralMode) : '—'}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-right font-bold font-mono-num whitespace-nowrap ${
                            row.runningDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                          }`}
                        >
                          {formatBDT(row.runningDue, numeralMode)}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {(matchingSale || matchingPayment) && (
                            <button
                              type="button"
                              onClick={() =>
                                matchingSale
                                  ? onEditSale(matchingSale)
                                  : matchingPayment && onEditPayment(matchingPayment)
                              }
                              aria-label={`এডিট করুন: ${row.code}`}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#ECF3ED] px-3 py-1 text-xs font-bold text-[#171D19] hover:bg-[#D7E7DC]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
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
          <div className="divide-y divide-[#ECF3ED] overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
            {activeShopTimeline.map((entry) =>
              entry.kind === 'sale' && entry.sale ? (
                <div key={entry.id} className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSaleDetail(entry.sale!)}
                        className="text-base font-bold text-[#171D19] hover:text-[#006B47] hover:underline font-mono-num"
                      >
                        {entry.sale.invoiceNo}
                      </button>
                      <span className="text-[#C3D2C8]" aria-hidden="true">·</span>
                      <span className="text-[13px] text-[#404943]">
                        {formatDateTimeBn(entry.sale.date, numeralMode)} · {formatCount(entry.sale.totalBoxes, numeralMode)} বক্স
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditSale(entry.sale!)}
                        aria-label={`এডিট করুন: ${entry.sale.invoiceNo}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#ECF3ED] px-3 py-1 text-xs font-bold text-[#171D19] hover:bg-[#D7E7DC]"
                      >
                        <Pencil className="h-3 w-3" />
                        এডিট
                      </button>
                    </div>
                    <div className="text-sm font-mono-num">
                      <span className="font-bold text-[#171D19]">
                        বিল {formatBDT(entry.sale.netTotal, numeralMode)}
                      </span>
                      <span className="mx-1.5 text-[#C3D2C8]">|</span>
                      <span className="text-[#006B47] font-semibold">জমা {formatBDT(entry.sale.paidAmount, numeralMode)}</span>
                      <span className="mx-1.5 text-[#C3D2C8]">|</span>
                      <span className={entry.sale.dueAmount > 0 ? 'font-bold text-[#BA1A1A]' : 'text-[#404943]'}>
                        বাকি {formatBDT(entry.sale.dueAmount, numeralMode)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-[#404943]">
                    {entry.sale.items.map((item, i) => (
                      <div key={`${item.productId}-${i}`} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words">
                          {item.productName} ({formatCount(item.boxes, numeralMode)} বক্স · {formatCount(item.discountPercent, numeralMode)}% ছাড়)
                        </span>
                        <span className="font-mono-num font-semibold text-[#171D19] shrink-0 text-right">
                          {formatBDT(item.netTotal, numeralMode)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                entry.payment && (
                  <div key={entry.id} className="flex items-center justify-between gap-3 bg-[#ECF3ED]/60 p-4 sm:p-5">
                    <div className="min-w-0">
                      <div className="text-base font-bold text-[#002114]">
                        বাকি আদায় · <span className="font-mono-num">{entry.payment.receiptNo}</span>
                      </div>
                      <div className="text-[13px] sm:text-sm text-[#404943] break-words">
                        {formatDateTimeBn(entry.payment.date, numeralMode)} · {entry.payment.method}
                        {entry.payment.note ? ` · ${entry.payment.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-base font-bold font-mono-num text-[#006B47]">
                        +{formatBDT(entry.payment.amount, numeralMode)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditPayment(entry.payment!)}
                        aria-label={`এডিট করুন: ${entry.payment.receiptNo}`}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#002114] ring-1 ring-[#CBEAD6] hover:bg-[#CBEAD6]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
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

  // Clean Outside Shopkeepers List
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#171D19]">দোকানদার ও খাতা</h1>
          <p className="mt-1 text-sm sm:text-[15px] text-[#404943]">
            দোকানদারের নামের ওপর ক্লিক করলে তার সম্পূর্ণ খাতা, রিপোর্ট, বিক্রি ও এডিট পেজ খুলবে
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestAddShop}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#006B47] px-4 sm:px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-[#005739] whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          নতুন দোকানদার
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3.5 rounded-[24px] bg-[#FFFFFF] p-4 sm:p-5 shadow-xs ring-1 ring-[#DCE7DF]/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
          <input
            type="text"
            aria-label="দোকান খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, এলাকা বা ফোন দিয়ে খুঁজুন..."
            className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-full bg-[#E2EDE5] p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[38px] rounded-full px-3 sm:px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
              filter === 'all' ? 'bg-white text-[#002114] shadow-xs' : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            সব ({formatCount(shops.length, numeralMode)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('due')}
            className={`min-h-[38px] rounded-full px-3 sm:px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
              filter === 'due' ? 'bg-white text-[#002114] shadow-xs' : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            বাকি আছে
          </button>
          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`min-h-[38px] rounded-full px-3 sm:px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
              filter === 'paid' ? 'bg-white text-[#002114] shadow-xs' : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            পরিশোধিত
          </button>
        </div>
      </div>

      {/* Clean Tappable Shopkeepers List */}
      <div className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
        {rows.length === 0 ? (
          <div className="p-8 sm:p-10 text-center">
            <p className="text-base text-[#404943]">
              {shops.length === 0
                ? 'এখনও কোনো দোকানদার যোগ করা হয়নি। উপরে "নতুন দোকানদার" বাটনে ক্লিক করে শুরু করুন।'
                : 'এই ফিল্টারে কোনো দোকান পাওয়া যায়নি।'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Clean Card Rows */}
            <div className="divide-y divide-[#ECF3ED] md:hidden">
              {rows.map(({ shop, summary }) => (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => onSelectLedgerShop(shop)}
                  aria-label={`খাতা দেখুন: ${shop.shopName}`}
                  className="flex w-full items-center justify-between gap-3 p-4 sm:p-5 text-left transition-colors hover:bg-[#F5FAF6] active:bg-[#ECF3ED]"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#CBEAD6] text-base font-bold text-[#002114] shrink-0">
                      {shop.shopName.trim().charAt(0) || 'দ'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-[#171D19]">
                        {shop.shopName}
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-[#404943]">
                        {shop.ownerName} · {shop.area}
                      </div>
                      <div className="mt-0.5 text-xs font-mono-num text-[#404943]">
                        মোট বিল {formatBDT(summary.totalBilled, numeralMode)} · জমা {formatBDT(summary.totalPaid, numeralMode)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-[#404943]">
                        {summary.totalDue > 0 ? 'বাকি' : 'পরিশোধিত'}
                      </div>
                      <div
                        className={`text-base font-bold font-mono-num ${
                          summary.totalDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                        }`}
                      >
                        {formatBDT(summary.totalDue, numeralMode)}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[#707972]" />
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop Clean Clickable Table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-[#DCE7DF] bg-[#ECF3ED] text-sm text-[#404943]">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">দোকান ও ঠিকানা</th>
                    <th className="px-4 py-3.5 text-right font-bold">মোট বক্স</th>
                    <th className="px-4 py-3.5 text-right font-bold">মোট বিল</th>
                    <th className="px-4 py-3.5 text-right font-bold">মোট জমা</th>
                    <th className="px-6 py-3.5 text-right font-bold">বাকি পাওনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECF3ED]">
                  {rows.map(({ shop, summary }) => (
                    <tr
                      key={shop.id}
                      onClick={() => onSelectLedgerShop(shop)}
                      className="cursor-pointer transition-colors hover:bg-[#F5FAF6]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLedgerShop(shop);
                            }}
                            className="text-base font-bold text-[#171D19] hover:text-[#006B47] hover:underline text-left"
                          >
                            {shop.shopName}
                          </button>
                          <ChevronRight className="h-4 w-4 text-[#707972]" />
                        </div>
                        <div className="mt-0.5 text-[13px] text-[#404943]">
                          <span>{shop.ownerName}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{shop.area}</span>
                          {shop.phone && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono-num">{formatCount(shop.phone, numeralMode)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono-num text-[#404943]">
                        {formatCount(summary.totalBoxes, numeralMode)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-num text-[#171D19]">
                        {formatBDT(summary.totalBilled, numeralMode)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold font-mono-num text-[#006B47]">
                        {formatBDT(summary.totalPaid, numeralMode)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right text-base font-bold font-mono-num ${
                          summary.totalDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                        }`}
                      >
                        {formatBDT(summary.totalDue, numeralMode)}
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
