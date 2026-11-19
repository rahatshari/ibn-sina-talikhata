import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import type {
  PaymentRecord,
  Product,
  ProductTier,
  SaleLineItem,
  SaleRecord,
} from '../types/tally';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  formatBDT,
  formatDateTimeBn,
} from '../utils/ledger';
import { ModalShell } from './Modals';

interface DraftEditRow {
  productId: string;
  productName: string;
  tier: ProductTier;
  boxesInput: string;
  boxPriceInput: string;
  discountInput: string;
}

interface EditSaleModalProps {
  sale: SaleRecord | null;
  products: Product[];
  onClose: () => void;
  onSave: (
    saleId: string,
    data: { items: SaleLineItem[]; paidAmount: number; note?: string },
  ) => { ok: true; sale: SaleRecord } | { ok: false; error: string };
}

export function EditSaleModal({ sale, products, onClose, onSave }: EditSaleModalProps) {
  const [rows, setRows] = useState<DraftEditRow[]>([]);
  const [paidInput, setPaidInput] = useState('');
  const [note, setNote] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sale) return;
    setRows(
      sale.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        tier: item.tier,
        boxesInput: String(item.boxes),
        boxPriceInput: String(item.boxPrice),
        discountInput: String(item.discountPercent),
      })),
    );
    setPaidInput(sale.paidAmount > 0 ? String(sale.paidAmount) : '');
    setNote(sale.note ?? '');
    setProductSearch('');
    setError('');
  }, [sale]);

  const computedItems = useMemo(
    () =>
      rows.map((row) =>
        calculateLineItem({
          productId: row.productId,
          productName: row.productName,
          tier: row.tier,
          boxes: Math.max(0, Number.parseInt(row.boxesInput, 10) || 0),
          boxPrice: Math.max(0, Number(row.boxPriceInput) || 0),
          discountPercent: Math.max(0, Math.min(100, Number(row.discountInput) || 0)),
        }),
      ),
    [rows],
  );

  const numericPaid = paidInput.trim() === '' ? 0 : Number(paidInput);
  const totals = useMemo(
    () => calculateInvoiceTotals(computedItems, Number.isFinite(numericPaid) ? numericPaid : 0),
    [computedItems, numericPaid],
  );

  const matchingProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.tier.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productSearch]);

  if (!sale) return null;

  const updateRow = (productId: string, patch: Partial<DraftEditRow>) => {
    setError('');
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));
  };

  const removeRow = (productId: string) => {
    setError('');
    setRows((prev) => prev.filter((r) => r.productId !== productId));
  };

  const handleAddProduct = (product: Product) => {
    setError('');
    setRows((prev) => {
      const existing = prev.find((r) => r.productId === product.id);
      if (existing) {
        const cur = Number.parseInt(existing.boxesInput, 10) || 0;
        return prev.map((r) =>
          r.productId === product.id ? { ...r, boxesInput: String(cur + 1) } : r,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          tier: product.tier,
          boxesInput: '1',
          boxPriceInput: product.boxPrice > 0 ? String(product.boxPrice) : '',
          discountInput: '0',
        },
      ];
    });
    setProductSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = computedItems.filter((item) => item.boxes > 0);
    if (validItems.length === 0) {
      setError('কমপক্ষে ১টি প্রোডাক্টে ১ বা তার বেশি বক্স সংখ্যা রাখুন।');
      return;
    }
    const rawPaid = paidInput.trim() === '' ? 0 : Number(paidInput);
    if (!Number.isFinite(rawPaid) || rawPaid < 0) {
      setError('জমা টাকার পরিমাণ ০ বা তার বেশি হতে হবে।');
      return;
    }
    if (rawPaid > totals.netTotal) {
      setError(`জমা টাকা সর্বমোট বিল (${formatBDT(totals.netTotal)}) এর চেয়ে বেশি হতে পারবে না।`);
      return;
    }

    const res = onSave(sale.id, {
      items: validItems,
      paidAmount: rawPaid,
      note,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      open={Boolean(sale)}
      onClose={onClose}
      title={`বিক্রি এডিট — ${sale.invoiceNo}`}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="edit-sale-form">
        {/* Sale Identity Banner */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
          <div className="font-bold text-slate-900 text-sm">{sale.shopName}</div>
          <div className="mt-0.5 text-slate-500">
            <span className="font-mono-num">{sale.invoiceNo}</span> · {formatDateTimeBn(sale.date)}
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Quick Search & Add Medicine */}
        <div className="space-y-2">
          <label htmlFor="edit-sale-add-search" className="block text-xs font-semibold text-slate-700">
            আরও ওষুধ যোগ করতে চাইলে খুঁজুন
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="edit-sale-add-search"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ওষুধের নাম লিখুন (যেমন: Dexlan)..."
              className="w-full min-h-[40px] rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          {matchingProducts.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
              {matchingProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleAddProduct(product)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{product.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {product.tier} · {formatBDT(product.boxPrice)}/বক্স
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                    <Plus className="h-3 w-3" />
                    যোগ করুন
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editable Items List */}
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {computedItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              সব ওষুধ মুছে ফেলা হয়েছে। উপরের সার্চ থেকে কমপক্ষে ১টি ওষুধ যোগ করুন।
            </div>
          ) : (
            computedItems.map((item, idx) => {
              const rawRow = rows[idx];
              return (
                <div key={item.productId} className="space-y-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.tier} · আসল মোট {formatBDT(item.grossTotal)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(item.productId)}
                      aria-label={`আইটেম বাদ দিন: ${item.productName}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="min-w-0">
                      <label
                        htmlFor={`edit-boxes-${item.productId}`}
                        className="mb-1 block text-[11px] font-medium text-slate-600"
                      >
                        বক্স সংখ্যা
                      </label>
                      <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number.parseInt(rawRow.boxesInput, 10) || 1;
                            updateRow(item.productId, {
                              boxesInput: String(Math.max(1, cur - 1)),
                            });
                          }}
                          aria-label={`বক্স কমান: ${item.productName}`}
                          className="px-2 py-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          id={`edit-boxes-${item.productId}`}
                          type="number"
                          min="1"
                          value={rawRow.boxesInput}
                          onChange={(e) =>
                            updateRow(item.productId, { boxesInput: e.target.value })
                          }
                          className="w-full text-center text-sm font-semibold font-mono-num text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number.parseInt(rawRow.boxesInput, 10) || 0;
                            updateRow(item.productId, { boxesInput: String(cur + 1) });
                          }}
                          aria-label={`বক্স বাড়ান: ${item.productName}`}
                          className="px-2 py-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-rate-${item.productId}`}
                        className="mb-1 block text-[11px] font-medium text-slate-600"
                      >
                        দাম / বক্স (৳)
                      </label>
                      <input
                        id={`edit-rate-${item.productId}`}
                        type="number"
                        min="0"
                        step="any"
                        value={rawRow.boxPriceInput}
                        onChange={(e) =>
                          updateRow(item.productId, { boxPriceInput: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono-num text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-disc-${item.productId}`}
                        className="mb-1 block text-[11px] font-medium text-slate-600"
                      >
                        ডিসকাউন্ট (%)
                      </label>
                      <input
                        id={`edit-disc-${item.productId}`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={rawRow.discountInput}
                        onChange={(e) =>
                          updateRow(item.productId, { discountInput: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-mono-num font-semibold text-amber-700 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right">
                      <div className="text-[10px] text-slate-500">ছাড়ের পর দাম</div>
                      <div className="text-sm font-bold font-mono-num text-emerald-700">
                        {formatBDT(item.netTotal)}
                      </div>
                      <div className="text-[10px] font-mono-num text-slate-500">
                        {formatBDT(item.effectiveBoxPrice)}/বক্স
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Payment & Summary */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-sale-paid-input" className="mb-1.5 block text-xs font-semibold text-slate-800">
              দোকানদার দিয়েছে / নগদ জমা (৳)
            </label>
            <input
              id="edit-sale-paid-input"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={paidInput}
              onChange={(e) => {
                setPaidInput(e.target.value);
                setError('');
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-bold font-mono-num text-emerald-700 focus:border-emerald-600 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPaidInput(String(totals.netTotal));
                  setError('');
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              >
                পুরো টাকা ({formatBDT(totals.netTotal)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaidInput('');
                  setError('');
                }}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
              >
                সব বাকি (০)
              </button>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>মোট বক্স / আসল দাম</span>
              <span className="font-mono-num">
                {totals.totalBoxes} বক্স · {formatBDT(totals.grossTotal)}
              </span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>মোট ছাড়</span>
              <span className="font-mono-num">-{formatBDT(totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
              <span>সর্বমোট প্রদেয় বিল</span>
              <span className="font-mono-num" data-testid="edit-sale-net-total">
                {formatBDT(totals.netTotal)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>জমা</span>
              <span className="font-semibold font-mono-num">{formatBDT(totals.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 text-sm font-bold text-red-600">
              <span>বাকি আছে</span>
              <span className="font-mono-num" data-testid="edit-sale-due-total">
                {formatBDT(totals.dueAmount)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="edit-sale-note-input" className="mb-1 block text-xs font-medium text-slate-700">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="edit-sale-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: পরিবর্তিত অর্ডার..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            বাতিল
          </button>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            পরিবর্তন সেভ করুন
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface EditPaymentModalProps {
  payment: PaymentRecord | null;
  onClose: () => void;
  onSave: (
    paymentId: string,
    data: { amount: number; method: PaymentRecord['method']; note?: string },
  ) => { ok: true; payment: PaymentRecord } | { ok: false; error: string };
}

export function EditPaymentModal({ payment, onClose, onSave }: EditPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentRecord['method']>('Cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amount));
    setMethod(payment.method);
    setNote(payment.note ?? '');
    setError('');
  }, [payment]);

  if (!payment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('সঠিক টাকার পরিমাণ লিখুন (০ এর বেশি)।');
      return;
    }
    const res = onSave(payment.id, {
      amount: numericAmount,
      method,
      note,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      open={Boolean(payment)}
      onClose={onClose}
      title={`আদায়ের হিসাব এডিট — ${payment.receiptNo}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="edit-payment-form">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
          <div className="font-bold text-slate-900 text-sm">{payment.shopName}</div>
          <div className="mt-0.5 text-slate-500">
            <span className="font-mono-num">{payment.receiptNo}</span> · {formatDateTimeBn(payment.date)}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-pay-amount-input" className="mb-1.5 block text-sm font-medium text-slate-700">
              আদায়কৃত টাকা (৳) *
            </label>
            <input
              id="edit-pay-amount-input"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="টাকার পরিমাণ"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 font-mono-num focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-pay-method-select" className="mb-1.5 block text-sm font-medium text-slate-700">
              পেমেন্ট মাধ্যম
            </label>
            <select
              id="edit-pay-method-select"
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
          <label htmlFor="edit-pay-note-input" className="mb-1.5 block text-sm font-medium text-slate-700">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="edit-pay-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: সংশোধিত নগদ জমা"
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
            className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            পরিবর্তন সেভ করুন
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
