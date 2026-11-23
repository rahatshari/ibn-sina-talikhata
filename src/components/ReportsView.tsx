import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Download, FolderDown, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import type { PaymentRecord, Product, SaleRecord, Shopkeeper } from '../types/tally';
import {
  computeMonthlySalesAndCollection,
  formatBDT,
  formatDateTimeBn,
  formatMonthYearBn,
  getAvailableMonthKeys,
  getMonthKeyFromIso,
} from '../utils/ledger';
import { textToBase64 } from '../utils/receiptGenerator';

interface ReportsViewProps {
  products: Product[];
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  appVersion: string;
  appVersionCode: number;
  onOpenUpdateManager: () => void;
  onOpenSaleDetail: (sale: SaleRecord) => void;
  onEditSale: (sale: SaleRecord) => void;
  onEditPayment: (payment: PaymentRecord) => void;
  onDeleteSale: (saleId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onImportBackup: (jsonText: string) => { ok: boolean; error?: string };
}

export function ReportsView({
  products,
  shops,
  sales,
  payments,
  appVersion,
  appVersionCode,
  onOpenUpdateManager,
  onOpenSaleDetail,
  onEditSale,
  onEditPayment,
  onDeleteSale,
  onDeletePayment,
  onImportBackup,
}: ReportsViewProps) {
  const [tab, setTab] = useState<'all' | 'sales' | 'payments'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [backupNotice, setBackupNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableMonths = useMemo(
    () => getAvailableMonthKeys(sales, payments),
    [sales, payments],
  );

  const selectedMonthMetrics = useMemo(() => {
    if (monthFilter === 'all') return null;
    return computeMonthlySalesAndCollection(sales, payments, monthFilter);
  }, [sales, payments, monthFilter]);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const saleEntries = sales.map((s) => ({
      kind: 'sale' as const,
      id: s.id,
      code: s.invoiceNo,
      shopName: s.shopName,
      date: s.date,
      details: `${s.totalBoxes} বক্স (${s.items.length} আইটেম) · ছাড় ${formatBDT(s.totalDiscount)}`,
      total: s.netTotal,
      paid: s.paidAmount,
      due: s.dueAmount,
      sale: s,
      payment: null,
    }));

    const paymentEntries = payments.map((p) => ({
      kind: 'payment' as const,
      id: p.id,
      code: p.receiptNo,
      shopName: p.shopName,
      date: p.date,
      details: `বাকি আদায় · ${p.method}${p.note ? ` · ${p.note}` : ''}`,
      total: p.amount,
      paid: p.amount,
      due: 0,
      sale: null,
      payment: p,
    }));

    return [...saleEntries, ...paymentEntries]
      .filter((entry) => {
        if (tab === 'sales' && entry.kind !== 'sale') return false;
        if (tab === 'payments' && entry.kind !== 'payment') return false;
        if (monthFilter !== 'all' && getMonthKeyFromIso(entry.date) !== monthFilter) return false;
        if (!q) return true;
        return (
          entry.shopName.toLowerCase().includes(q) ||
          entry.code.toLowerCase().includes(q) ||
          entry.details.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, payments, tab, monthFilter, search]);

  const handleDownloadBackup = async () => {
    const fileName = `ibn-sina-tally-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        products,
        shops,
        sales,
        payments,
      },
      null,
      2,
    );
    try {
      if (isNativeAndroid()) {
        await AppUpdater.saveFileToDownloads({
          base64Data: textToBase64(payload),
          fileName,
          mimeType: 'application/json',
        });
      } else {
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      setBackupNotice({
        type: 'ok',
        text: 'ব্যাকআপ কমপ্লিট — আপনার সকল দোকানদার, বিক্রয় ও আদায়ের ডাটা সফলভাবে সংরক্ষিত হয়েছে।',
      });
    } catch {
      setBackupNotice({
        type: 'err',
        text: 'ব্যাকআপ ফাইল সেভ করা যায়নি। আবার চেষ্টা করুন।',
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = onImportBackup(text);
    if (res.ok) {
      setBackupNotice({ type: 'ok', text: 'ব্যাকআপ সফলভাবে রিস্টোর করা হয়েছে।' });
    } else {
      setBackupNotice({ type: 'err', text: res.error || 'রিস্টোর ব্যর্থ হয়েছে।' });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">বিক্রয় ও আদায় রিপোর্ট</h1>
          <p className="mt-1 text-sm text-slate-600">
            সকল বিক্রয় ইনভয়েস, ডিসকাউন্ট, নগদ জমা ও বাকি আদায়ের পূর্ণাঙ্গ তালিকা ও ব্যাকআপ
          </p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label="লেনদেন খুঁজুন"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ইনভয়েস নম্বর বা দোকানের নাম লিখে খুঁজুন..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="মাস অনুযায়ী রিপোর্ট দেখুন"
              data-testid="reports-month-select"
              className="min-h-[38px] w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">সকল মাস</option>
              {availableMonths.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthYearBn(monthKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:inline-flex sm:self-start items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-md px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap ${
              tab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('sales')}
            className={`rounded-md px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap ${
              tab === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বিক্রয়
          </button>
          <button
            type="button"
            onClick={() => setTab('payments')}
            className={`rounded-md px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap ${
              tab === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            আদায়
          </button>
        </div>

        {selectedMonthMetrics && (
          <div
            data-testid="reports-month-summary"
            className="grid grid-cols-3 gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs"
          >
            <div>
              <div className="text-[11px] text-slate-500">মাসের বিক্রি</div>
              <div className="font-bold font-mono-num text-slate-900">
                {formatBDT(selectedMonthMetrics.totalSales)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">মাসের আদায়</div>
              <div className="font-bold font-mono-num text-emerald-700">
                {formatBDT(selectedMonthMetrics.totalCollected)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">চালান ও বক্স</div>
              <div className="font-bold font-mono-num text-slate-800">
                {selectedMonthMetrics.invoiceCount}টি · {selectedMonthMetrics.totalBoxesSold} বক্স
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table / Mobile Cards */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">কোনো লেনদেন পাওয়া যায়নি।</div>
        ) : (
          <>
            {/* Mobile Single-Screen Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono-num text-slate-900">
                          {entry.code}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {formatDateTimeBn(entry.date)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                        {entry.shopName}
                      </div>
                      <div className="text-xs text-slate-500 break-words">{entry.details}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          entry.sale
                            ? onEditSale(entry.sale)
                            : entry.payment && onEditPayment(entry.payment)
                        }
                        aria-label={`এডিট করুন: ${entry.code}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          entry.kind === 'sale'
                            ? onDeleteSale(entry.id)
                            : onDeletePayment(entry.id)
                        }
                        aria-label={`মুছে ফেলুন: ${entry.code}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-num">
                      {entry.kind === 'sale' && (
                        <span className="text-slate-700">বিল {formatBDT(entry.total)}</span>
                      )}
                      <span className="font-semibold text-emerald-700">
                        জমা {formatBDT(entry.paid)}
                      </span>
                      {entry.kind === 'sale' && (
                        <span className={entry.due > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>
                          বাকি {formatBDT(entry.due)}
                        </span>
                      )}
                    </div>
                    {entry.sale && (
                      <button
                        type="button"
                        onClick={() => onOpenSaleDetail(entry.sale!)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        রসিদ দেখুন
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">রসিদ ও তারিখ</th>
                    <th className="px-4 py-3 font-medium">দোকান ও বিবরণ</th>
                    <th className="px-4 py-3 text-right font-medium">নিট বিল</th>
                    <th className="px-4 py-3 text-right font-medium">জমা</th>
                    <th className="px-4 py-3 text-right font-medium">বাকি</th>
                    <th className="px-5 py-3 text-right font-medium">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold font-mono-num text-slate-900">{entry.code}</div>
                        <div className="text-xs text-slate-500">{formatDateTimeBn(entry.date)}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">{entry.shopName}</div>
                        <div className="text-xs text-slate-500">{entry.details}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-num text-slate-900">
                        {entry.kind === 'sale' ? formatBDT(entry.total) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold font-mono-num text-emerald-700">
                        {formatBDT(entry.paid)}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-semibold font-mono-num ${
                          entry.due > 0 ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {entry.kind === 'sale' ? formatBDT(entry.due) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {entry.sale && (
                            <button
                              type="button"
                              onClick={() => onOpenSaleDetail(entry.sale!)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              রসিদ দেখুন
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              entry.sale
                                ? onEditSale(entry.sale)
                                : entry.payment && onEditPayment(entry.payment)
                            }
                            aria-label={`এডিট করুন: ${entry.code}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              entry.kind === 'sale'
                                ? onDeleteSale(entry.id)
                                : onDeletePayment(entry.id)
                            }
                            aria-label={`মুছে ফেলুন: ${entry.code}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Backup & Restore Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">ডাটা ব্যাকআপ ও রিস্টোর</h2>
            <p className="text-xs text-slate-500">
              আপনার সকল হিসাব ব্রাউজারে সংরক্ষিত থাকে। নিরাপদ রাখতে JSON ব্যাকআপ ডাউনলোড করে রাখতে পারেন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadBackup()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              ব্যাকআপ ডাউনলোড
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              ব্যাকআপ রিস্টোর
            </button>
          </div>
        </div>
        {backupNotice && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold ${
              backupNotice.type === 'ok'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {backupNotice.type === 'ok' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            <span>{backupNotice.text}</span>
          </div>
        )}
      </div>

      {/* Android App Version & Download Manager */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            অ্যান্ড্রয়েড অ্যাপ ভার্সন ও ডাউনলোড ম্যানেজার
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            বর্তমান ভার্সন: <span className="font-mono-num font-semibold">v{appVersion}</span> (Build{' '}
            <span className="font-mono-num">{appVersionCode}</span>) · নতুন GitHub Release এলে অটো নোটিফিকেশন ও ইন-অ্যাপ আপডেট পাবেন
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenUpdateManager}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
        >
          <FolderDown className="h-4 w-4" />
          ডাউনলোড ম্যানেজার খুলুন
        </button>
      </div>
    </div>
  );
}
