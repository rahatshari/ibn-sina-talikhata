import { ArrowRight, Banknote, Store } from 'lucide-react';
import type { DashboardMetrics, PaymentRecord, SaleRecord, Shopkeeper } from '../types/tally';
import { computeShopSummary, formatBDT, formatDateTimeBn } from '../utils/ledger';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  onStartNewSale: (preselectedShopId?: string) => void;
  onCollectDue: (shop: Shopkeeper, currentDue: number) => void;
  onOpenShopLedger: (shop: Shopkeeper) => void;
  onOpenSaleDetail: (sale: SaleRecord) => void;
  onOpenAllReports: () => void;
}

export function DashboardView({
  metrics,
  shops,
  sales,
  payments,
  onStartNewSale,
  onCollectDue,
  onOpenShopLedger,
  onOpenSaleDetail,
  onOpenAllReports,
}: DashboardViewProps) {
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
      subtitle: `${s.totalBoxes} বক্স · ছাড় ${formatBDT(s.totalDiscount)}`,
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

  return (
    <div className="space-y-5">

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-slate-500">মোট নিট বিক্রি</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-slate-900 font-mono-num" data-testid="kpi-total-sales">
            {formatBDT(metrics.totalSales)}
          </div>
          <div className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500 font-mono-num">
            {metrics.totalBoxesSold} বক্স · ছাড় {formatBDT(metrics.totalDiscountGiven)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-slate-500">মোট নগদ আদায়</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-emerald-700 font-mono-num" data-testid="kpi-total-collected">
            {formatBDT(metrics.totalCollected)}
          </div>
          <div className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500">বিক্রয়কালীন জমা ও বাকি আদায়</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-slate-500">মোট বাকি পাওনা</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-red-600 font-mono-num" data-testid="kpi-total-due">
            {formatBDT(metrics.totalDue)}
          </div>
          <div className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500">
            {metrics.dueShopCount} টি দোকানে বাকি রয়েছে
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="text-xs sm:text-sm font-medium text-slate-500">মোট দোকানদার</div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-slate-900 font-mono-num" data-testid="kpi-shop-count">
            {metrics.activeShopCount}
          </div>
          <div className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-slate-500">সক্রিয় ফার্মেসি খাতা</div>
        </div>
      </div>

      {/* Main Split: Shop Due Ledger & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">দোকানদারের বাকি ও খাতা</h2>
            <Store className="h-4 w-4 text-slate-400" />
          </div>

          {shopSummaries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">এখনও কোনো দোকানদার যোগ করা হয়নি।</p>
              <button
                type="button"
                onClick={() => onStartNewSale()}
                className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                প্রথম বিক্রি শুরু করুন
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shopSummaries.map(({ shop, summary }) => (
                <div
                  key={shop.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenShopLedger(shop)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {shop.shopName}
                    </button>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span>{shop.area}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{shop.phone || shop.ownerName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">মোট বিল {formatBDT(summary.totalBilled)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500">
                        {summary.totalDue > 0 ? 'বাকি আছে' : 'হিসাব পরিশোধিত'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono-num ${
                          summary.totalDue > 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatBDT(summary.totalDue)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {summary.totalDue > 0 && (
                        <button
                          type="button"
                          onClick={() => onCollectDue(shop, summary.totalDue)}
                          aria-label={`বাকি আদায়: ${shop.shopName}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          বাকি আদায়
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onStartNewSale(shop.id)}
                        aria-label={`নতুন বিক্রি: ${shop.shopName}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        বিক্রি
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">সাম্প্রতিক লেনদেন</h2>
            <button
              type="button"
              onClick={onOpenAllReports}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0"
            >
              সব দেখুন
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentFeed.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">এখনও কোনো লেনদেন হয়নি।</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentFeed.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.sale ? (
                        <button
                          type="button"
                          onClick={() => onOpenSaleDetail(entry.sale!)}
                          className="truncate text-sm font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {entry.title}
                        </button>
                      ) : (
                        <span className="truncate text-sm font-medium text-slate-900">{entry.title}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="font-mono-num">{entry.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{entry.subtitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTimeBn(entry.date)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {entry.type === 'sale' ? (
                      <>
                        <div className="text-sm font-semibold text-slate-900 font-mono-num">
                          {formatBDT(entry.amount)}
                        </div>
                        <div className="text-xs font-mono-num text-slate-500">
                          জমা {formatBDT(entry.paid)} ·{' '}
                          <span className={entry.due > 0 ? 'font-medium text-red-600' : 'text-emerald-700'}>
                            {entry.due > 0 ? `বাকি ${formatBDT(entry.due)}` : 'পরিশোধিত'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-emerald-700 font-mono-num">
                          +{formatBDT(entry.amount)}
                        </div>
                        <div className="text-xs text-slate-500">বাকি আদায়</div>
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
