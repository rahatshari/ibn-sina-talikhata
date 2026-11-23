import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Layers, Pencil, Printer, Share2, Trash2, Wallet, X } from 'lucide-react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import type { PaymentRecord, Product, ProductTier, SaleRecord, Shopkeeper } from '../types/tally';
import { formatBDT, formatCount, formatDateTimeBn } from '../utils/ledger';
import { useNumeralMode } from '../utils/NumeralContext';
import {
  buildPrintableReceiptHtml,
  buildReceiptSummaryText,
  getCachedReceiptPng,
  printHtmlInBrowser,
} from '../utils/receiptGenerator';
import { M3SelectPopup } from './M3SelectPopup';

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentRecord['method']; label: string }> = [
  { value: 'Cash', label: 'নগদ (Cash)' },
  { value: 'bKash', label: 'বিকাশ (bKash)' },
  { value: 'Nagad', label: 'নগদ (Nagad)' },
  { value: 'Bank', label: 'ব্যাংক (Bank)' },
];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#171D19]/50 p-3 sm:p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90dvh] flex flex-col rounded-[28px] bg-[#FFFFFF] shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ECF3ED] px-5 py-4 sm:px-6">
          <h2 className="text-lg sm:text-xl font-bold text-[#171D19] pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`বন্ধ করুন: ${title}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF3ED] text-[#171D19] transition-colors hover:bg-[#D7E7DC] focus-visible:outline-2 focus-visible:outline-[#006B47] shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
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
          <p className="rounded-2xl bg-[#FFDAD6] px-4 py-2.5 text-[15px] font-medium text-[#410002]" role="alert">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="shop-name-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
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
            placeholder="দোকান বা ফার্মেসির নাম লিখুন"
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-name-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
              মালিকের নাম
            </label>
            <input
              id="owner-name-input"
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="মালিকের নাম লিখুন"
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="shop-phone-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
              মোবাইল নম্বর
            </label>
            <input
              id="shop-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="017XX-XXXXXX"
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] font-mono-num focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label htmlFor="shop-area-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
            এলাকা / বাজার
          </label>
          <input
            id="shop-area-input"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="এলাকা বা বাজারের নাম"
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-full bg-[#ECF3ED] px-5 py-2 text-[15px] font-semibold text-[#171D19] hover:bg-[#D7E7DC]"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="min-h-[46px] rounded-full bg-[#006B47] px-6 py-2 text-[15px] font-bold text-white hover:bg-[#005739]"
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
  const { numeralMode } = useNumeralMode();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentRecord['method']>('Cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setMethod('Cash');
      setNote('');
      setError('');
    }
  }, [open]);

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
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFDAD6]/75 px-4 py-3.5">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[#410002]">বর্তমান মোট বাকি</div>
            <div className="text-xl font-bold text-[#BA1A1A] font-mono-num">{formatBDT(currentDue, numeralMode)}</div>
          </div>
          {currentDue > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(currentDue))}
              className="min-h-[38px] rounded-full bg-white px-4 py-1.5 text-xs sm:text-sm font-bold text-[#410002] hover:bg-[#FFF8F7] whitespace-nowrap shrink-0"
            >
              সম্পূর্ণ বাকি লিখুন
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-2xl bg-[#FFDAD6] px-4 py-2.5 text-[15px] font-medium text-[#410002]" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="collect-amount-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
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
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base font-bold text-[#171D19] font-mono-num focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="collect-method-select" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
              পেমেন্ট মাধ্যম
            </label>
            <M3SelectPopup
              id="collect-method-select"
              testId="collect-method-select"
              variant="field"
              value={method}
              onChange={(next) => setMethod(next as PaymentRecord['method'])}
              options={PAYMENT_METHOD_OPTIONS}
              menuTitle="পেমেন্ট মাধ্যম নির্বাচন করুন"
              ariaLabel="পেমেন্ট মাধ্যম"
              icon={<Wallet className="h-4 w-4 text-[#006B47] shrink-0" />}
            />
          </div>
        </div>

        <div>
          <label htmlFor="collect-note-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="collect-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: নগদ পরিশোধ / রসিদ নম্বর"
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-full bg-[#ECF3ED] px-5 py-2 text-[15px] font-semibold text-[#171D19] hover:bg-[#D7E7DC]"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="min-h-[46px] rounded-full bg-[#006B47] px-6 py-2 text-[15px] font-bold text-white hover:bg-[#005739]"
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
  onEditSale?: (sale: SaleRecord) => void;
}

export function InvoiceDetailModal({ sale, onClose, onEditSale }: InvoiceDetailModalProps) {
  const { numeralMode } = useNumeralMode();
  const [actionBusy, setActionBusy] = useState<'download' | 'share' | 'print' | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setActionNotice(null);
    setActionBusy(null);
    if (sale) {
      void getCachedReceiptPng(sale).catch(() => {
        // Pre-warm cache in background so Share & Download feel instant
      });
    }
  }, [sale]);

  if (!sale) return null;

  const handleDownloadImage = async () => {
    setActionBusy('download');
    setActionNotice(null);
    try {
      const { blob, base64, fileName } = await getCachedReceiptPng(sale);
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
      const { blob, base64, fileName } = await getCachedReceiptPng(sale);
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
      const html = buildPrintableReceiptHtml(sale);
      if (isNativeAndroid()) {
        await AppUpdater.printHtml({
          html,
          jobName: `IbnSina-${sale.invoiceNo}`,
        });
        setActionNotice({ type: 'ok', text: 'প্রিন্ট / PDF ডায়ালগ খোলা হয়েছে।' });
      } else {
        printHtmlInBrowser(html);
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
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ECF3ED] pb-4">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[#404943]">THE IBN SINA&apos;S Production — MR Sales</div>
            <h3 className="mt-1 text-xl font-bold text-[#171D19]">{sale.shopName}</h3>
            <div className="mt-1 text-[13px] sm:text-sm text-[#404943]">
              <span className="font-mono-num font-semibold">{sale.invoiceNo}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{formatDateTimeBn(sale.date, numeralMode)}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>মোট {formatCount(sale.totalBoxes, numeralMode)} বক্স</span>
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2">
            {onEditSale && (
              <button
                type="button"
                disabled={actionBusy !== null}
                onClick={() => onEditSale(sale)}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-bold text-[#171D19] hover:bg-[#D7E7DC] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Pencil className="h-4 w-4" />
                এডিট করুন
              </button>
            )}
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handleDownloadImage()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#006B47] px-4 py-2 text-sm font-bold text-white hover:bg-[#005739] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              {actionBusy === 'download' ? 'তৈরি হচ্ছে...' : 'ছবি ডাউনলোড'}
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handleShareReceipt()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#CBEAD6] px-4 py-2 text-sm font-bold text-[#002114] hover:bg-[#B4DFC4] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Share2 className="h-4 w-4" />
              শেয়ার করুন
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() => void handlePrintReceipt()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] hover:bg-[#D7E7DC] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              প্রিন্ট করুন
            </button>
          </div>
        </div>

        {actionNotice && (
          <div
            role="status"
            className={`no-print flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
              actionNotice.type === 'ok'
                ? 'bg-[#CBEAD6] text-[#002114]'
                : 'bg-[#FFDAD6] text-[#410002]'
            }`}
          >
            {actionNotice.type === 'ok' && <CheckCircle2 className="h-4 w-4 text-[#006B47] shrink-0" />}
            <span>{actionNotice.text}</span>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-[#F5FAF6] ring-1 ring-[#DCE7DF]/80">
          {/* Mobile Line Item Cards */}
          <div className="divide-y divide-[#DCE7DF] sm:hidden">
            {sale.items.map((item, idx) => (
              <div key={`${item.productId}-${idx}`} className="p-3.5 space-y-1.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#171D19]">{item.productName}</div>
                    <div className="text-xs text-[#404943]">{item.tier}</div>
                  </div>
                  <div className="font-bold font-mono-num text-[#171D19] shrink-0">
                    {formatBDT(item.netTotal, numeralMode)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#404943] font-mono-num">
                  <span>
                    {formatCount(item.boxes, numeralMode)} বক্স × {formatBDT(item.boxPrice, numeralMode)}
                  </span>
                  <span className="text-[#9A5B00]">
                    ছাড় {formatCount(item.discountPercent, numeralMode)}% (-{formatBDT(item.discountAmount, numeralMode)})
                  </span>
                  <span className="font-semibold text-[#006B47]">
                    {formatBDT(item.effectiveBoxPrice, numeralMode)}/বক্স
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Line Item Table */}
          <div className="hidden sm:block">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b border-[#DCE7DF] bg-[#ECF3ED] text-xs sm:text-sm text-[#404943]">
                <tr>
                  <th className="px-4 py-3 font-bold">প্রোডাক্ট</th>
                  <th className="px-3 py-3 text-right font-bold">বক্স</th>
                  <th className="px-3 py-3 text-right font-bold">দাম/বক্স</th>
                  <th className="px-3 py-3 text-right font-bold">ডিসকাউন্ট</th>
                  <th className="px-3 py-3 text-right font-bold">ছাড়ের পর বক্স</th>
                  <th className="px-4 py-3 text-right font-bold">মোট দাম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE7DF] bg-white">
                {sale.items.map((item, idx) => (
                  <tr key={`${item.productId}-${idx}`} className="hover:bg-[#F5FAF6]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#171D19]">{item.productName}</div>
                      <div className="text-xs text-[#404943]">{item.tier}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num text-[#171D19]">
                      {formatCount(item.boxes, numeralMode)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num text-[#404943]">
                      {formatBDT(item.boxPrice, numeralMode)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num text-[#9A5B00]">
                      {formatCount(item.discountPercent, numeralMode)}% (-{formatBDT(item.discountAmount, numeralMode)})
                    </td>
                    <td className="px-3 py-3 text-right font-mono-num font-semibold text-[#006B47]">
                      {formatBDT(item.effectiveBoxPrice, numeralMode)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono-num text-[#171D19]">
                      {formatBDT(item.netTotal, numeralMode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-[#ECF3ED] pt-4 sm:grid-cols-2">
          <div className="text-[15px] text-[#404943]">
            {sale.note ? (
              <div>
                <span className="font-bold text-[#171D19]">মন্তব্য: </span>
                <span>{sale.note}</span>
              </div>
            ) : (
              <span className="text-[#707972]">কোনো অতিরিক্ত মন্তব্য নেই</span>
            )}
          </div>
          <div className="space-y-2 rounded-2xl bg-[#ECF3ED]/70 p-4 text-[15px]">
            <div className="flex justify-between text-[#404943]">
              <span>মোট আসল দাম</span>
              <span className="font-mono-num">{formatBDT(sale.grossTotal, numeralMode)}</span>
            </div>
            <div className="flex justify-between text-[#9A5B00]">
              <span>মোট ডিসকাউন্ট ছাড়</span>
              <span className="font-mono-num">-{formatBDT(sale.totalDiscount, numeralMode)}</span>
            </div>
            <div className="flex justify-between border-t border-[#DCE7DF] pt-2 font-bold text-[#171D19]">
              <span>সর্বমোট প্রদেয় বিল</span>
              <span className="font-mono-num">{formatBDT(sale.netTotal, numeralMode)}</span>
            </div>
            <div className="flex justify-between text-[#006B47]">
              <span>দোকানদার দিয়েছে (নগদ/জমা)</span>
              <span className="font-bold font-mono-num">{formatBDT(sale.paidAmount, numeralMode)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-[#BA1A1A]">
              <span>বাকি আছে</span>
              <span className="font-mono-num">{formatBDT(sale.dueAmount, numeralMode)}</span>
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
  onUpdateProduct: (
    productId: string,
    data: { name: string; tier: ProductTier; boxPrice: number; packInfo: string },
  ) => void;
  onDeleteProduct?: (productId: string) => void;
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
  onUpdateProduct,
  onDeleteProduct,
}: ProductFormModalProps) {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<ProductTier>('Super Star');
  const [boxPrice, setBoxPrice] = useState('');
  const [packInfo, setPackInfo] = useState('1 Box (30 Tabs)');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      setConfirmDelete(false);
    }
  }, [open, editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('প্রোডাক্টের নাম লিখুন।');
      return;
    }

    const numericPrice = Number(boxPrice);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('সঠিক বক্সের দাম লিখুন (০ এর বেশি)।');
      return;
    }

    const payload = {
      name: name.trim(),
      tier,
      boxPrice: numericPrice,
      packInfo: packInfo.trim() || '1 Box',
    };

    if (editingProduct) {
      onUpdateProduct(editingProduct.id, payload);
      onClose();
      return;
    }

    onSaveNew(payload);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editingProduct ? `প্রোডাক্ট এডিট — ${editingProduct.name}` : 'নতুন প্রোডাক্ট যোগ করুন'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-2xl bg-[#FFDAD6] px-4 py-2.5 text-[15px] font-medium text-[#410002]" role="alert">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="prod-name-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
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
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="prod-tier-select" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
            গ্রুপ / ক্যাটাগরি
          </label>
          <M3SelectPopup
            id="prod-tier-select"
            testId="prod-tier-select"
            variant="field"
            value={tier}
            onChange={(next) => setTier(next as ProductTier)}
            options={TIERS.map((t) => ({ value: t, label: t }))}
            menuTitle="ওষুধের গ্রুপ নির্বাচন করুন"
            ariaLabel="গ্রুপ বা ক্যাটাগরি"
            icon={<Layers className="h-4 w-4 text-[#006B47] shrink-0" />}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prod-price-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
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
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base font-bold text-[#171D19] font-mono-num focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="prod-pack-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
              প্যাক সাইজ
            </label>
            <input
              id="prod-pack-input"
              type="text"
              value={packInfo}
              onChange={(e) => setPackInfo(e.target.value)}
              placeholder="1 Box (30 Caps)"
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {editingProduct && onDeleteProduct && confirmDelete && (
          <div className="rounded-3xl bg-[#FFDAD6]/80 p-4 space-y-3">
            <p className="text-sm font-semibold text-[#410002]">
              আপনি কি নিশ্চিতভাবে &ldquo;{editingProduct.name}&rdquo; প্রোডাক্ট তালিকা থেকে ডিলিট করতে চান? (পুরানো চালানের হিসাব ঠিক থাকবে।)
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[42px] rounded-full bg-white px-4 py-2 text-sm font-bold text-[#171D19] hover:bg-[#ECF3ED]"
              >
                না, থাক
              </button>
              <button
                type="button"
                data-testid="modal-confirm-delete-product"
                onClick={() => {
                  onDeleteProduct(editingProduct.id);
                  onClose();
                }}
                className="min-h-[42px] rounded-full bg-[#BA1A1A] px-4 py-2 text-sm font-bold text-white hover:bg-[#93000A]"
              >
                হ্যাঁ, ডিলিট করুন
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            {editingProduct && onDeleteProduct && !confirmDelete && (
              <button
                type="button"
                data-testid="modal-delete-product-btn"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-[46px] items-center gap-1.5 rounded-full bg-[#FFDAD6]/80 px-4 py-2 text-sm font-bold text-[#BA1A1A] hover:bg-[#FFDAD6]"
              >
                <Trash2 className="h-4 w-4" />
                ডিলিট করুন
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] rounded-full bg-[#ECF3ED] px-5 py-2 text-[15px] font-semibold text-[#171D19] hover:bg-[#D7E7DC]"
            >
              বাতিল
            </button>
            <button
              type="submit"
              data-testid="modal-save-product-btn"
              className="min-h-[46px] rounded-full bg-[#006B47] px-6 py-2 text-[15px] font-bold text-white hover:bg-[#005739]"
            >
              সেভ করুন
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
