import React, { useMemo, useRef, useState } from 'react';
import { Download, FolderDown, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import type { PaymentRecord, Product, SaleRecord, Shopkeeper } from '../types/tally';
import { formatBDT, formatDateTimeBn } from '../utils/ledger';

interface ReportsViewProps {
  products: Product[];
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  appVersion: string;
  appVersionCode: number;
  onOpenUpdateManager: () => void;
  onOpenSaleDetail: (sale: SaleRecord) => void;
  onDeleteSale: (saleId: string) => void;
  onDeletePayment: (paymentId: string) => void;
  onImportBackup: (jsonText: string) => { ok: boolean; error?: string };
  onResetDemoData: () => void;
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
  onDeleteSale,
  onDeletePayment,
  onImportBackup,
  onResetDemoData,
}: ReportsViewProps) {
  const [tab, setTab] = useState<'all' | 'sales' | 'payments'>('all');
  const [search, setSearch] = useState('');
  const [backupNotice, setBackupNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!q) return true;
        return (
          entry.shopName.toLowerCase().includes(q) ||
          entry.code.toLowerCase().includes(q) ||
          entry.details.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, payments, tab, search]);

  const handleDownloadBackup = () => {
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
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ibn-sina-tally-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupNotice({ type: 'ok', text: 'টালিখাতা ব্যাকআপ ফাইল ডাউনলোড হয়েছে।' });
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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              tab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব লেনদেন ({sales.length + payments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('sales')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              tab === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বিক্রয় বিল ({sales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('payments')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              tab === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাকি আদায় ({payments.length})
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">কোনো লেনদেন পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
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
                      <div className="inline-flex items-center justify-end gap-2">
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
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              ব্যাকআপ রিস্টোর
            </button>
            <button
              type="button"
              onClick={onResetDemoData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              ডেমো রিসেট
            </button>
          </div>
        </div>
        {backupNotice && (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              backupNotice.type === 'ok'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {backupNotice.text}
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
