import { useMemo } from 'react';
import { ArrowRight, Banknote, ChevronRight, Store } from 'lucide-react';
import type { DashboardMetrics, PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import {
  computeMonthlySalesAndCollection,
  computeShopSummary,
  formatBDT,
  formatCount,
  formatDateTimeBn,
  formatMonthYearBn,
  getMonthKeyFromDate,
  type KpiPeriodMode,
} from '../utils/ledger';
import { useNumeralMode } from '../utils/NumeralContext';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  periodMode: KpiPeriodMode;
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  onStartNewSale: (preselectedShopId?: string) => void;
  onCollectDue: (shop: Shopkeeper, currentDue: number) => void;
  onOpenShopLedger: (shop: Shopkeeper) => void;
  onOpenSaleDetail: (sale: SaleRecord) => void;
  onOpenAllReports: () => void;
  onOpenDueList: () => void;
}

export function DashboardView({
  metrics,
  periodMode,
  shops,
  sales,
  payments,
  onStartNewSale,
  onCollectDue,
  onOpenShopLedger,
  onOpenSaleDetail,
  onOpenAllReports,
  onOpenDueList,
}: DashboardViewProps) {
  const { numeralMode } = useNumeralMode();
  const currentMonthKey = getMonthKeyFromDate(new Date());

  const monthlyMetrics = useMemo(
    () => computeMonthlySalesAndCollection(sales, payments, currentMonthKey),
    [sales, payments, currentMonthKey],
  );

  const shopSummaries = shops
    .map((shop) => ({
      shop,
      summary: computeShopSummary(shop.id, sales, payments),
    }))
    .sort((a, b) => b.summary.totalDue - a.summary.totalDue);

  const recentFeed = [
    ...sales.map((s) => ({
      type: 'sale' as const,
      id: s.id,
      date: s.date,
      title: s.shopName,
      code: s.invoiceNo,
      subtitle: `${formatCount(s.totalBoxes, numeralMode)} বক্স · ছাড় ${formatBDT(s.totalDiscount, numeralMode)}`,
      amount: s.netTotal,
      paid: s.paidAmount,
      due: s.dueAmount,
      sale: s,
    })),
    ...payments.map((p) => ({
      type: 'payment' as const,
      id: p.id,
      date: p.date,
      title: p.shopName,
      code: p.receiptNo,
      subtitle: `বাকি আদায় · ${p.method}`,
      amount: p.amount,
      paid: p.amount,
      due: 0,
      sale: null,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const isMonthly = periodMode === 'monthly';
  const activeMonthLabel = formatMonthYearBn(currentMonthKey, numeralMode);

  return (
    <div className="space-y-6">
      {/* 4-Column Material You 3 Expressive KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
        <div className="rounded-[28px] bg-[#FFFFFF] p-4 sm:p-6 shadow-xs ring-1 ring-[#DCE7DF]/80">
          <div className="text-[13px] sm:text-[15px] font-semibold text-[#404943]">
            {isMonthly ? `মাসিক বিক্রি (${activeMonthLabel})` : 'মোট নিট বিক্রি'}
          </div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold tracking-tight text-[#171D19] font-mono-num"
            data-testid="kpi-total-sales"
          >
            {formatBDT(isMonthly ? monthlyMetrics.totalSales : metrics.totalSales, numeralMode)}
          </div>
          <div className="mt-2 text-xs sm:text-sm text-[#404943] font-mono-num">
            {isMonthly
              ? `${formatCount(monthlyMetrics.totalBoxesSold, numeralMode)} বক্স · ${formatCount(monthlyMetrics.invoiceCount, numeralMode)} চালান`
              : `${formatCount(metrics.totalBoxesSold, numeralMode)} বক্স · ছাড় ${formatBDT(metrics.totalDiscountGiven, numeralMode)}`}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#006B47] p-4 sm:p-6 text-white shadow-sm">
          <div className="text-[13px] sm:text-[15px] font-semibold text-[#CBEAD6]">
            {isMonthly ? `মাসিক নগদ আদায় (${activeMonthLabel})` : 'মোট নগদ আদায়'}
          </div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold tracking-tight text-white font-mono-num"
            data-testid="kpi-total-collected"
          >
            {formatBDT(isMonthly ? monthlyMetrics.totalCollected : metrics.totalCollected, numeralMode)}
          </div>
          <div className="mt-2 text-xs sm:text-sm text-[#CBEAD6]/95 font-mono-num">
            {isMonthly
              ? `জমা ${formatBDT(monthlyMetrics.paidAtSale, numeralMode)} · বাকি আদায় ${formatBDT(monthlyMetrics.dueCollections, numeralMode)}`
              : 'বিক্রয়কালীন জমা ও বাকি আদায়'}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDueList}
          data-testid="kpi-due-card-btn"
          aria-label="মোট বাকি পাওনা — বাকি থাকা দোকানদারের তালিকা দেখুন"
          className="group w-full rounded-[28px] bg-[#FFDAD6]/80 p-4 sm:p-6 text-left transition-all hover:bg-[#FFDAD6] active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-1 text-[13px] sm:text-[15px] font-semibold text-[#410002]">
            <span>মোট বাকি পাওনা</span>
            <ChevronRight className="h-5 w-5 text-[#BA1A1A] transition-transform group-hover:translate-x-0.5 shrink-0" />
          </div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold tracking-tight text-[#BA1A1A] font-mono-num"
            data-testid="kpi-total-due"
          >
            {formatBDT(metrics.totalDue, numeralMode)}
          </div>
          <div className="mt-2 text-xs sm:text-sm font-medium text-[#6E1A18]">
            {formatCount(metrics.dueShopCount, numeralMode)} টি দোকানে বাকি · তালিকা দেখুন
          </div>
        </button>

        <div className="rounded-[28px] bg-[#E2EDE5] p-4 sm:p-6">
          <div className="text-[13px] sm:text-[15px] font-semibold text-[#404943]">মোট দোকানদার</div>
          <div
            className="mt-2 text-2xl sm:text-[32px] leading-tight font-bold tracking-tight text-[#002114] font-mono-num"
            data-testid="kpi-shop-count"
          >
            {formatCount(metrics.activeShopCount, numeralMode)}
          </div>
          <div className="mt-2 text-xs sm:text-sm font-medium text-[#404943]">সক্রিয় ফার্মেসি খাতা</div>
        </div>
      </div>

      {/* Main Split: Shop Due Ledger & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#ECF3ED] px-5 py-4 sm:px-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#171D19]">দোকানদারের বাকি ও খাতা</h2>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ECF3ED] text-[#006B47]">
              <Store className="h-4 w-4" />
            </span>
          </div>

          {shopSummaries.length === 0 ? (
            <div className="p-8 sm:p-10 text-center">
              <p className="text-base text-[#404943]">এখনও কোনো দোকানদার যোগ করা হয়নি।</p>
              <button
                type="button"
                onClick={() => onStartNewSale()}
                className="mt-4 inline-flex min-h-[46px] items-center rounded-full bg-[#006B47] px-6 py-2.5 text-[15px] font-semibold text-white hover:bg-[#005739]"
              >
                প্রথম বিক্রি শুরু করুন
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#ECF3ED]">
              {shopSummaries.map(({ shop, summary }) => {
                const avatarLetter = shop.shopName.trim().charAt(0) || 'দ';
                return (
                  <div
                    key={shop.id}
                    className="flex flex-col gap-3.5 px-5 py-4 sm:px-6 transition-colors hover:bg-[#F5FAF6] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#CBEAD6] text-base font-bold text-[#002114] shrink-0">
                        {avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenShopLedger(shop)}
                          className="text-left text-base sm:text-[17px] font-bold text-[#171D19] hover:text-[#006B47] hover:underline break-words"
                        >
                          {shop.shopName}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] sm:text-sm text-[#404943]">
                          <span>{shop.area}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">
                            {shop.phone ? formatCount(shop.phone, numeralMode) : shop.ownerName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">মোট বিল {formatBDT(summary.totalBilled, numeralMode)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end pl-14 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-[13px] font-medium text-[#404943]">
                          {summary.totalDue > 0 ? 'বাকি আছে' : 'হিসাব পরিশোধিত'}
                        </div>
                        <div
                          className={`text-base sm:text-lg font-bold font-mono-num ${
                            summary.totalDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                          }`}
                        >
                          {formatBDT(summary.totalDue, numeralMode)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {summary.totalDue > 0 && (
                          <button
                            type="button"
                            onClick={() => onCollectDue(shop, summary.totalDue)}
                            aria-label={`বাকি আদায়: ${shop.shopName}`}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#CBEAD6] px-4 py-2 text-sm font-bold text-[#002114] transition-colors hover:bg-[#B4DFC4] whitespace-nowrap"
                          >
                            <Banknote className="h-4 w-4" />
                            বাকি আদায়
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onStartNewSale(shop.id)}
                          aria-label={`নতুন বিক্রি: ${shop.shopName}`}
                          className="min-h-[40px] rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] transition-colors hover:bg-[#D7E7DC] whitespace-nowrap"
                        >
                          বিক্রি
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#ECF3ED] px-5 py-4 sm:px-6">
            <h2 className="text-lg sm:text-xl font-bold text-[#171D19]">সাম্প্রতিক লেনদেন</h2>
            <button
              type="button"
              onClick={onOpenAllReports}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-[#ECF3ED] px-3.5 py-1.5 text-sm font-semibold text-[#006B47] hover:bg-[#CBEAD6] whitespace-nowrap shrink-0"
            >
              সব দেখুন
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {recentFeed.length === 0 ? (
            <div className="p-8 sm:p-10 text-center text-base text-[#404943]">এখনও কোনো লেনদেন হয়নি।</div>
          ) : (
            <div className="divide-y divide-[#ECF3ED]">
              {recentFeed.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 transition-colors hover:bg-[#F5FAF6]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.sale ? (
                        <button
                          type="button"
                          onClick={() => onOpenSaleDetail(entry.sale!)}
                          className="truncate text-base font-bold text-[#171D19] hover:text-[#006B47] hover:underline"
                        >
                          {entry.title}
                        </button>
                      ) : (
                        <span className="truncate text-base font-bold text-[#171D19]">{entry.title}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-[#404943]">
                      <span className="font-mono-num font-medium">{entry.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.subtitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTimeBn(entry.date, numeralMode)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {entry.type === 'sale' ? (
                      <>
                        <div className="text-base sm:text-[17px] font-bold text-[#171D19] font-mono-num">
                          {formatBDT(entry.amount, numeralMode)}
                        </div>
                        <div className="text-xs sm:text-[13px] font-mono-num text-[#404943]">
                          জমা {formatBDT(entry.paid, numeralMode)} ·{' '}
                          <span className={entry.due > 0 ? 'font-bold text-[#BA1A1A]' : 'font-semibold text-[#006B47]'}>
                            {entry.due > 0 ? `বাকি ${formatBDT(entry.due, numeralMode)}` : 'পরিশোধিত'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-base sm:text-[17px] font-bold text-[#006B47] font-mono-num">
                          +{formatBDT(entry.amount, numeralMode)}
                        </div>
                        <div className="text-xs sm:text-[13px] text-[#404943]">বাকি আদায়</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
