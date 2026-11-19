import { useMemo, useState } from 'react';
import { Banknote, ChevronRight, Pencil, Plus, Search, UserPlus } from 'lucide-react';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { computeShopSummary, formatBDT, formatDateTimeBn } from '../utils/ledger';
import { ModalShell } from './Modals';

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
}: ShopkeepersViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'due' | 'paid'>('all');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">দোকানদার ও খাতা</h1>
          <p className="mt-1 text-sm text-slate-600">
            প্রতিটি ফার্মেসির মোট বিক্রি, জমা, বাকি এবং প্রোডাক্ট অনুযায়ী লেনদেনের খাতা
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestAddShop}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          নতুন দোকানদার
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="দোকান খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, এলাকা বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব দোকান ({shops.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('due')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'due' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাকি আছে
          </button>
          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === 'paid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পরিশোধিত
          </button>
        </div>
      </div>

      {/* Shopkeepers Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">এই ফিল্টারে কোনো দোকান পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">দোকান ও ঠিকানা</th>
                  <th className="px-4 py-3 text-right font-medium">মোট বক্স</th>
                  <th className="px-4 py-3 text-right font-medium">মোট বিল</th>
                  <th className="px-4 py-3 text-right font-medium">মোট জমা</th>
                  <th className="px-4 py-3 text-right font-medium">বাকি পাওনা</th>
                  <th className="px-5 py-3 text-right font-medium">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ shop, summary }) => (
                  <tr key={shop.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectLedgerShop(shop)}
                        className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {shop.shopName}
                      </button>
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
                      className={`px-4 py-3.5 text-right font-bold font-mono-num ${
                        summary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatBDT(summary.totalDue)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {summary.totalDue > 0 && (
                          <button
                            type="button"
                            onClick={() => onCollectDue(shop, summary.totalDue)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            বাকি আদায়
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onStartNewSale(shop.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          বিক্রি
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestEditShop(shop)}
                          aria-label={`তথ্য এডিট: ${shop.shopName}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectLedgerShop(shop)}
                          aria-label={`খাতা দেখুন: ${shop.shopName}`}
                          className="inline-flex min-h-[36px] items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
                        >
                          খাতা
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Shop TallyKhata Ledger Modal */}
      <ModalShell
        open={Boolean(liveLedgerShop)}
        onClose={() => onSelectLedgerShop(null)}
        title={liveLedgerShop ? `দোকানের খাতা — ${liveLedgerShop.shopName}` : ''}
        maxWidthClass="max-w-3xl"
      >
        {liveLedgerShop && activeShopSummary && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="text-xs text-slate-600 space-y-0.5">
                <div className="text-sm font-semibold text-slate-900">{liveLedgerShop.ownerName}</div>
                <div>
                  {liveLedgerShop.area}
                  {liveLedgerShop.phone ? ` · ${liveLedgerShop.phone}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRequestEditShop(liveLedgerShop)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  তথ্য এডিট করুন
                </button>
                {activeShopSummary.totalDue > 0 && (
                  <button
                    type="button"
                    onClick={() => onCollectDue(liveLedgerShop, activeShopSummary.totalDue)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    বাকি আদায় করুন
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectLedgerShop(null);
                    onStartNewSale(liveLedgerShop.id);
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  নতুন বিক্রি
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">মোট বিল</div>
                <div className="mt-1 text-base font-bold font-mono-num text-slate-900">
                  {formatBDT(activeShopSummary.totalBilled)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">মোট জমা</div>
                <div className="mt-1 text-base font-bold font-mono-num text-emerald-700">
                  {formatBDT(activeShopSummary.totalPaid)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">বর্তমান বাকি</div>
                <div
                  className={`mt-1 text-base font-bold font-mono-num ${
                    activeShopSummary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {formatBDT(activeShopSummary.totalDue)}
                </div>
              </div>
            </div>

            {activeShopTimeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                এই দোকানে এখনও কোনো বিক্রি বা আদায়ের হিসাব নেই।
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {activeShopTimeline.map((entry) =>
                  entry.kind === 'sale' && entry.sale ? (
                    <div key={entry.id} className="p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenSaleDetail(entry.sale!)}
                            className="text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline font-mono-num"
                          >
                            {entry.sale.invoiceNo}
                          </button>
                          <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
                          <span className="text-xs text-slate-500">
                            {formatDateTimeBn(entry.sale.date)} · {entry.sale.totalBoxes} বক্স
                          </span>
                        </div>
                        <div className="text-right text-xs font-mono-num">
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
                          <div key={`${item.productId}-${i}`} className="flex justify-between">
                            <span>
                              {item.productName} ({item.boxes} বক্স · {item.discountPercent}% ছাড়)
                            </span>
                            <span className="font-mono-num text-slate-800">
                              {formatBDT(item.netTotal)} ({formatBDT(item.effectiveBoxPrice)}/বক্স)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    entry.payment && (
                      <div key={entry.id} className="flex items-center justify-between bg-emerald-50/40 p-4">
                        <div>
                          <div className="text-sm font-semibold text-emerald-800">
                            বাকি আদায় · <span className="font-mono-num">{entry.payment.receiptNo}</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            {formatDateTimeBn(entry.payment.date)} · {entry.payment.method}
                            {entry.payment.note ? ` · ${entry.payment.note}` : ''}
                          </div>
                        </div>
                        <div className="text-sm font-bold font-mono-num text-emerald-700">
                          +{formatBDT(entry.payment.amount)}
                        </div>
                      </div>
                    )
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
