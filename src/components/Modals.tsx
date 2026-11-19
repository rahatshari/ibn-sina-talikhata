import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Printer, Share2, X } from 'lucide-react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import type { PaymentRecord, Product, ProductTier, SaleRecord, Shopkeeper } from '../types/tally';
import { formatBDT, formatDateTimeBn } from '../utils/ledger';
import {
  buildPrintableReceiptHtml,
  buildReceiptSummaryText,
  renderReceiptPng,
} from '../utils/receiptGenerator';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalShell({
  open,
  onClose,
  title,
  maxWidthClass = 'max-w-lg',
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`বন্ধ করুন: ${title}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

interface AddShopModalProps {
  open: boolean;
  editingShop?: Shopkeeper | null;
  onClose: () => void;
  onSave: (data: { shopName: string; ownerName: string; phone: string; area: string }) => void;
}

export function AddShopModal({ open, editingShop, onClose, onSave }: AddShopModalProps) {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingShop) {
        setShopName(editingShop.shopName);
        setOwnerName(editingShop.ownerName);
        setPhone(editingShop.phone);
        setArea(editingShop.area);
      } else {
        setShopName('');
        setOwnerName('');
        setPhone('');
        setArea('');
      }
      setError('');
    }
  }, [open, editingShop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('দোকানের নাম লিখুন।');
      return;
    }
    onSave({
      shopName: shopName.trim(),
      ownerName: ownerName.trim() || 'প্রোপ্রাইটর',
      phone: phone.trim(),
      area: area.trim() || 'লোকাল মার্কেট',
    });
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editingShop ? `দোকানদারের তথ্য এডিট — ${editingShop.shopName}` : 'নতুন দোকানদার যোগ করুন'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="shop-name-input" className="mb-1.5 block text-sm font-medium text-slate-700">
            দোকান / ফার্মেসির নাম *
          </label>
          <input
            id="shop-name-input"
            type="text"
            value={shopName}
            onChange={(e) => {
              setShopName(e.target.value);
              setError('');
            }}
            placeholder="যেমন: মা মেডিকেল হল"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-name-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              মালিকের নাম
            </label>
            <input
              id="owner-name-input"
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="যেমন: মোঃ করিম উদ্দিন"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="shop-phone-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              মোবাইল নম্বর
            </label>
            <input
              id="shop-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="017XX-XXXXXX"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 font-mono-num focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label htmlFor="shop-area-input" className="mb-1.5 block text-sm font-medium text-slate-700">
            এলাকা / বাজার
          </label>
          <input
            id="shop-area-input"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="যেমন: শাহবাগ বাজার"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {editingShop ? 'পরিবর্তন সেভ করুন' : 'দোকান সেভ করুন'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface CollectPaymentModalProps {
  open: boolean;
  shop: Shopkeeper | null;
  currentDue: number;
  onClose: () => void;
  onCollect: (data: {
    shopId: string;
    amount: number;
    method: PaymentRecord['method'];
    note?: string;
  }) => void;
}

export function CollectPaymentModal({
  open,
  shop,
  currentDue,
  onClose,
  onCollect,
}: CollectPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentRecord['method']>('Cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(currentDue > 0 ? String(currentDue) : '');
      setMethod('Cash');
      setNote('');
      setError('');
    }
  }, [open, currentDue]);

  if (!shop) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('সঠিক টাকার পরিমাণ লিখুন (০ এর বেশি)।');
      return;
    }
    onCollect({
      shopId: shop.id,
      amount: numericAmount,
      method,
      note,
    });
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={`বাকি টাকা আদায় — ${shop.shopName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-xs text-slate-500">বর্তমান মোট বাকি</div>
            <div className="text-lg font-bold text-red-600 font-mono-num">{formatBDT(currentDue)}</div>
          </div>
          {currentDue > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(currentDue))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              সম্পূর্ণ বাকি লিখুন
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="collect-amount-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              আদায়কৃত টাকা (৳) *
            </label>
            <input
              id="collect-amount-input"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="টাকার পরিমাণ"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 font-mono-num focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="collect-method-select" className="mb-1.5 block text-sm font-medium text-slate-700">
              পেমেন্ট মাধ্যম
            </label>
            <select
              id="collect-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value="Cash">নগদ (Cash)</option>
              <option value="bKash">বিকাশ (bKash)</option>
              <option value="Nagad">নগদ (Nagad)</option>
              <option value="Bank">ব্যাংক (Bank)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="collect-note-input" className="mb-1.5 block text-sm font-medium text-slate-700">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="collect-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: নগদ পরিশোধ / রসিদ নম্বর"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            আদায় সেভ করুন
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface InvoiceDetailModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
}

export function InvoiceDetailModal({ sale, onClose }: InvoiceDetailModalProps) {
  const [actionBusy, setActionBusy] = useState<'download' | 'share' | 'print' | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setActionNotice(null);
    setActionBusy(null);
  }, [sale?.id]);

  if (!sale) return null;

  const handleDownloadImage = async () => {
    setActionBusy('download');
    setActionNotice(null);
    try {
      const { blob, base64, fileName } = await renderReceiptPng(sale);
      if (isNativeAndroid()) {
        await AppUpdater.saveFileToDownloads({
          base64Data: base64,
          fileName,
          mimeType: 'image/png',
        });
        setActionNotice({
          type: 'ok',
          text: `রসিদের ছবি ফোনের Downloads/IbnSinaTallyKhata ফোল্ডারে সেভ হয়েছে।`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        setActionNotice({ type: 'ok', text: 'রসিদের ছবি (PNG) ডাউনলোড হয়েছে।' });
      }
    } catch {
      setActionNotice({ type: 'err', text: 'রসিদের ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।' });
    } finally {
      setActionBusy(null);
    }
  };

  const handleShareReceipt = async () => {
    setActionBusy('share');
    setActionNotice(null);
    try {
      const { blob, base64, fileName } = await renderReceiptPng(sale);
      const summaryText = buildReceiptSummaryText(sale);

      if (isNativeAndroid()) {
        await AppUpdater.shareFile({
          base64Data: base64,
          fileName,
          mimeType: 'image/png',
          title: `রসিদ শেয়ার — ${sale.invoiceNo}`,
          text: summaryText,
        });
        setActionNotice({ type: 'ok', text: 'শেয়ার অপশন খোলা হয়েছে।' });
        return;
      }

      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `বিক্রয় রসিদ — ${sale.invoiceNo}`,
            text: summaryText,
          });
          setActionNotice({ type: 'ok', text: 'রসিদ শেয়ার করা হয়েছে।' });
          return;
        }
        await navigator.share({
          title: `বিক্রয় রসিদ — ${sale.invoiceNo}`,
          text: summaryText,
        });
        setActionNotice({ type: 'ok', text: 'রসিদের তথ্য শেয়ার করা হয়েছে।' });
        return;
      }

      // Desktop browser fallback: download PNG & copy text summary
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText).catch(() => {});
      }
      setActionNotice({
        type: 'ok',
        text: 'রসিদের ছবি ডাউনলোড হয়েছে এবং হিসাব কপি হয়েছে—এখন যেকোনো অ্যাপে পাঠাতে পারবেন।',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.toLowerCase().includes('abort')) {
        setActionNotice({ type: 'err', text: 'রসিদ শেয়ার করা যায়নি। আবার চেষ্টা করুন।' });
      }
    } finally {
      setActionBusy(null);
    }
  };

  const handlePrintReceipt = async () => {
    setActionBusy('print');
    setActionNotice(null);
    try {
      if (isNativeAndroid()) {
        const html = buildPrintableReceiptHtml(sale);
        await AppUpdater.printHtml({
          html,
          jobName: `IbnSina-${sale.invoiceNo}`,
        });
        setActionNotice({ type: 'ok', text: 'প্রিন্ট / PDF ডায়ালগ খোলা হয়েছে।' });
      } else {
        window.print();
      }
    } catch {
      setActionNotice({ type: 'err', text: 'প্রিন্ট শুরু করা যায়নি। ছবি ডাউনলোড করে প্রিন্ট করুন।' });
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <ModalShell
      open={Boolean(sale)}
      onClose={onClose}
      title={`বিক্রয় রসিদ — ${sale.invoiceNo}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-medium text-slate-500">THE IBN SINA&apos;S Production — MR Sales</div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{sale.shopName}</h3>
            <div className="mt-0.5 text-xs text-slate-500">
              <span>{sale.invoiceNo}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{formatDateTimeBn(sale.date)}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>মোট {sale.totalBoxes} বক্স</span>
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handleDownloadImage()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              {actionBusy === 'download' ? 'তৈরি হচ্ছে...' : 'ছবি ডাউনলোড'}
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handleShareReceipt()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Share2 className="h-3.5 w-3.5" />
              শেয়ার করুন
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handlePrintReceipt()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              প্রিন্ট করুন
            </button>
          </div>
        </div>

        {actionNotice && (
          <div
            role="status"
            className={`no-print flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium ${
              actionNotice.type === 'ok'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {actionNotice.type === 'ok' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            <span>{actionNotice.text}</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2.5 font-medium">প্রোডাক্ট</th>
                <th className="px-3 py-2.5 text-right font-medium">বক্স</th>
                <th className="px-3 py-2.5 text-right font-medium">দাম/বক্স</th>
                <th className="px-3 py-2.5 text-right font-medium">ডিসকাউন্ট</th>
                <th className="px-3 py-2.5 text-right font-medium">ছাড়ের পর বক্স</th>
                <th className="px-3 py-2.5 text-right font-medium">মোট দাম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((item, idx) => (
                <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{item.productName}</div>
                    <div className="text-xs text-slate-500">{item.tier}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-num text-slate-800">{item.boxes}</td>
                  <td className="px-3 py-2.5 text-right font-mono-num text-slate-600">
                    {formatBDT(item.boxPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-num text-amber-700">
                    {item.discountPercent}% (-{formatBDT(item.discountAmount)})
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-num text-emerald-700">
                    {formatBDT(item.effectiveBoxPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold font-mono-num text-slate-900">
                    {formatBDT(item.netTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <div className="text-sm text-slate-600">
            {sale.note ? (
              <div>
                <span className="font-medium text-slate-800">মন্তব্য: </span>
                <span>{sale.note}</span>
              </div>
            ) : (
              <span className="text-slate-400">কোনো অতিরিক্ত মন্তব্য নেই</span>
            )}
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>মোট আসল দাম</span>
              <span className="font-mono-num">{formatBDT(sale.grossTotal)}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>মোট ডিসকাউন্ট ছাড়</span>
              <span className="font-mono-num">-{formatBDT(sale.totalDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
              <span>সর্বমোট প্রদেয় বিল</span>
              <span className="font-mono-num">{formatBDT(sale.netTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>দোকানদার দিয়েছে (নগদ/জমা)</span>
              <span className="font-semibold font-mono-num">{formatBDT(sale.paidAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-red-600">
              <span>বাকি আছে</span>
              <span className="font-mono-num">{formatBDT(sale.dueAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

interface ProductFormModalProps {
  open: boolean;
  editingProduct: Product | null;
  onClose: () => void;
  onSaveNew: (data: { name: string; tier: ProductTier; boxPrice: number; packInfo: string }) => void;
  onUpdatePrice: (productId: string, boxPrice: number, packInfo: string) => void;
}

const TIERS: ProductTier[] = [
  'Super Star',
  'Priority Star',
  'Promising Star',
  'Star Line (Group B)',
  'Priority Line (Group B)',
  'Promising Line (Group B)',
  'Custom',
];

export function ProductFormModal({
  open,
  editingProduct,
  onClose,
  onSaveNew,
  onUpdatePrice,
}: ProductFormModalProps) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<ProductTier>('Super Star');
  const [boxPrice, setBoxPrice] = useState('');
  const [packInfo, setPackInfo] = useState('1 Box (30 Tabs)');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingProduct) {
        setName(editingProduct.name);
        setTier(editingProduct.tier);
        setBoxPrice(String(editingProduct.boxPrice));
        setPackInfo(editingProduct.packInfo);
      } else {
        setName('');
        setTier('Super Star');
        setBoxPrice('');
        setPackInfo('1 Box (30 Tabs)');
      }
      setError('');
    }
  }, [open, editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(boxPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('সঠিক বক্সের দাম লিখুন (০ এর বেশি)।');
      return;
    }

    if (editingProduct) {
      onUpdatePrice(editingProduct.id, numericPrice, packInfo);
      onClose();
      return;
    }

    if (!name.trim()) {
      setError('প্রোডাক্টের নাম লিখুন।');
      return;
    }
    onSaveNew({
      name: name.trim(),
      tier,
      boxPrice: numericPrice,
      packInfo: packInfo.trim() || '1 Box',
    });
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editingProduct ? `দাম পরিবর্তন — ${editingProduct.name}` : 'নতুন প্রোডাক্ট যোগ করুন'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        {!editingProduct && (
          <>
            <div>
              <label htmlFor="prod-name-input" className="mb-1.5 block text-sm font-medium text-slate-700">
                প্রোডাক্টের নাম *
              </label>
              <input
                id="prod-name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="যেমন: Dexlan"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prod-tier-select" className="mb-1.5 block text-sm font-medium text-slate-700">
                গ্রুপ / ক্যাটাগরি
              </label>
              <select
                id="prod-tier-select"
                value={tier}
                onChange={(e) => setTier(e.target.value as ProductTier)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prod-price-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              প্রতি বক্সের দাম (৳) *
            </label>
            <input
              id="prod-price-input"
              type="number"
              min="1"
              step="any"
              value={boxPrice}
              onChange={(e) => {
                setBoxPrice(e.target.value);
                setError('');
              }}
              placeholder="480"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 font-mono-num focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prod-pack-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              প্যাক সাইজ
            </label>
            <input
              id="prod-pack-input"
              type="text"
              value={packInfo}
              onChange={(e) => setPackInfo(e.target.value)}
              placeholder="1 Box (30 Caps)"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            সেভ করুন
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
