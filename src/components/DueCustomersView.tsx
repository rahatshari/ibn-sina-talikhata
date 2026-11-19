import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { formatBDT, formatDateTimeBn, getDueShopSummaries, roundCurrency } from '../utils/ledger';

interface DueCustomersViewProps {
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  onOpenShopLedger: (shop: Shopkeeper) => void;
  onCollectDue: (shop: Shopkeeper, currentDue: number) => void;
}

export function DueCustomersView({
  shops,
  sales,
  payments,
  onOpenShopLedger,
  onCollectDue,
}: DueCustomersViewProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'due' | 'name'>('due');

  const dueRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allDue = getDueShopSummaries(shops, sales, payments);
    const filtered = !q
      ? allDue
      : allDue.filter(
          ({ shop }) =>
            shop.shopName.toLowerCase().includes(q) ||
            shop.ownerName.toLowerCase().includes(q) ||
            shop.area.toLowerCase().includes(q) ||
            shop.phone.includes(q),
        );

    if (sortBy === 'name') {
      return [...filtered].sort((a, b) => a.shop.shopName.localeCompare(b.shop.shopName, 'bn'));
    }
    return filtered;
  }, [shops, sales, payments, search, sortBy]);

  const totalDueSum = useMemo(
    () =>
      roundCurrency(
        dueRows.reduce((acc, row) => acc + row.summary.totalDue, 0),
      ),
    [dueRows],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          বাকি পাওনা তালিকা
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          কার কার কাছে কত টাকা বাকি আছে তা একসাথে দেখুন ও আদায় করুন
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="text-xs sm:text-sm font-medium text-red-800">মোট বাকি পাওনা</div>
          <div
            className="mt-1 text-lg sm:text-2xl font-bold font-mono-num text-red-700"
            data-testid="due-view-total"
          >
            {formatBDT(totalDueSum)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs sm:text-sm font-medium text-slate-600">বাকি আছে</div>
          <div
            className="mt-1 text-lg sm:text-2xl font-bold font-mono-num text-slate-900"
            data-testid="due-view-count"
          >
            {dueRows.length} টি দোকান
          </div>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="বাকি দোকান খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, এলাকা বা ফোন দিয়ে খুঁজুন..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSortBy('due')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              sortBy === 'due' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সর্বোচ্চ বাকি আগে
          </button>
          <button
            type="button"
            onClick={() => setSortBy('name')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              sortBy === 'name' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            নাম অনুযায়ী
          </button>
        </div>
      </div>

      {/* Due List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {dueRows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-slate-800">
              {search.trim()
                ? 'এই নামে কোনো বাকি থাকা দোকান পাওয়া যায়নি।'
                : 'সকল দোকানদারের হিসাব পরিশোধিত — কোনো বাকি নেই।'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dueRows.map(({ shop, summary }) => (
              <div
                key={shop.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <button
                  type="button"
                  onClick={() => onOpenShopLedger(shop)}
                  className="min-w-0 flex-1 text-left group"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm sm:text-base font-semibold text-slate-900 group-hover:text-emerald-700 group-hover:underline">
                      {shop.shopName}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-emerald-600" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span>{shop.ownerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{shop.area}</span>
                    {shop.phone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{shop.phone}</span>
                      </>
                    )}
                    {summary.lastActivityAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>সর্বশেষ: {formatDateTimeBn(summary.lastActivityAt)}</span>
                      </>
                    )}
                  </div>
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-slate-500">
                      মোট বিল <span className="font-mono-num">{formatBDT(summary.totalBilled)}</span> · জমা{' '}
                      <span className="font-mono-num text-emerald-700">{formatBDT(summary.totalPaid)}</span>
                    </div>
                    <div className="text-base font-bold font-mono-num text-red-600">
                      বাকি {formatBDT(summary.totalDue)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onCollectDue(shop, summary.totalDue)}
                    aria-label={`বাকি আদায়: ${shop.shopName}`}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    বাকি আদায়
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
