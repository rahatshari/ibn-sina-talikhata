import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import type { PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { formatBDT, formatCount, formatDateTimeBn, getDueShopSummaries, roundCurrency } from '../utils/ledger';
import { useNumeralMode } from '../utils/NumeralContext';

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
  const { numeralMode } = useNumeralMode();
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#171D19]">
          বাকি পাওনা তালিকা
        </h1>
        <p className="mt-1 text-sm sm:text-[15px] text-[#404943]">
          কার কার কাছে কত টাকা বাকি আছে তা একসাথে দেখুন ও আদায় করুন
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5">
        <div className="rounded-[28px] bg-[#FFDAD6]/80 p-4 sm:p-6">
          <div className="text-[13px] sm:text-[15px] font-semibold text-[#410002]">মোট বাকি পাওনা</div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold font-mono-num text-[#BA1A1A]"
            data-testid="due-view-total"
          >
            {formatBDT(totalDueSum, numeralMode)}
          </div>
        </div>
        <div className="rounded-[28px] bg-[#E2EDE5] p-4 sm:p-6">
          <div className="text-[13px] sm:text-[15px] font-semibold text-[#404943]">বাকি আছে</div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold font-mono-num text-[#002114]"
            data-testid="due-view-count"
          >
            {formatCount(dueRows.length, numeralMode)} টি দোকান
          </div>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col gap-3.5 rounded-[24px] bg-[#FFFFFF] p-4 sm:p-5 shadow-xs ring-1 ring-[#DCE7DF]/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
          <input
            type="text"
            aria-label="বাকি দোকান খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, এলাকা বা ফোন দিয়ে খুঁজুন..."
            className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:inline-flex items-center gap-1 rounded-full bg-[#E2EDE5] p-1">
          <button
            type="button"
            onClick={() => setSortBy('due')}
            className={`min-h-[38px] rounded-full px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
              sortBy === 'due' ? 'bg-white text-[#002114] shadow-xs' : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            সর্বোচ্চ বাকি আগে
          </button>
          <button
            type="button"
            onClick={() => setSortBy('name')}
            className={`min-h-[38px] rounded-full px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap ${
              sortBy === 'name' ? 'bg-white text-[#002114] shadow-xs' : 'text-[#404943] hover:text-[#171D19]'
            }`}
          >
            নাম অনুযায়ী
          </button>
        </div>
      </div>

      {/* Due List */}
      <div className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
        {dueRows.length === 0 ? (
          <div className="p-8 sm:p-10 text-center space-y-2.5">
            <CheckCircle2 className="mx-auto h-9 w-9 text-[#006B47]" />
            <p className="text-base font-semibold text-[#171D19]">
              {search.trim()
                ? 'এই নামে কোনো বাকি থাকা দোকান পাওয়া যায়নি।'
                : 'সকল দোকানদারের হিসাব পরিশোধিত — কোনো বাকি নেই।'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#ECF3ED]">
            {dueRows.map(({ shop, summary }) => (
              <div
                key={shop.id}
                className="flex flex-col gap-3.5 p-4 sm:px-6 sm:py-5 transition-colors hover:bg-[#F5FAF6] sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => onOpenShopLedger(shop)}
                  className="min-w-0 flex-1 text-left group"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-base sm:text-[17px] font-bold text-[#171D19] group-hover:text-[#006B47] group-hover:underline">
                      {shop.shopName}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#707972] shrink-0 group-hover:text-[#006B47]" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] sm:text-sm text-[#404943]">
                    <span>{shop.ownerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{shop.area}</span>
                    {shop.phone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatCount(shop.phone, numeralMode)}</span>
                      </>
                    )}
                    {summary.lastActivityAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>সর্বশেষ: {formatDateTimeBn(summary.lastActivityAt, numeralMode)}</span>
                      </>
                    )}
                  </div>
                </button>

                <div className="flex items-center justify-between gap-3 border-t border-[#ECF3ED] pt-3 sm:border-t-0 sm:pt-0 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <div className="text-xs sm:text-[13px] text-[#404943]">
                      মোট বিল <span className="font-mono-num">{formatBDT(summary.totalBilled, numeralMode)}</span> · জমা{' '}
                      <span className="font-mono-num font-semibold text-[#006B47]">{formatBDT(summary.totalPaid, numeralMode)}</span>
                    </div>
                    <div className="text-base sm:text-lg font-bold font-mono-num text-[#BA1A1A]">
                      বাকি {formatBDT(summary.totalDue, numeralMode)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onCollectDue(shop, summary.totalDue)}
                    aria-label={`বাকি আদায়: ${shop.shopName}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#006B47] px-4 py-2 text-sm font-bold text-white hover:bg-[#005739] whitespace-nowrap shrink-0"
                  >
                    <Banknote className="h-4 w-4" />
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
