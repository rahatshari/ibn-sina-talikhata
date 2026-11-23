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
        <div className="rounded-2xl bg-[#ECF3ED] px-4 py-3 text-sm">
          <div className="font-bold text-[#171D19] text-base">{sale.shopName}</div>
          <div className="mt-0.5 text-[13px] text-[#404943]">
            <span className="font-mono-num font-semibold">{sale.invoiceNo}</span> · {formatDateTimeBn(sale.date)}
          </div>
        </div>

        {error && (
          <div
            className="rounded-2xl bg-[#FFDAD6] px-4 py-3 text-sm font-medium text-[#410002]"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Quick Search & Add Medicine */}
        <div className="space-y-2">
          <label htmlFor="edit-sale-add-search" className="block text-sm font-bold text-[#171D19]">
            আরও ওষুধ যোগ করতে চাইলে খুঁজুন
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
            <input
              id="edit-sale-add-search"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ওষুধের নাম লিখুন (যেমন: Dexlan)..."
              className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
          {matchingProducts.length > 0 && (
            <div className="divide-y divide-[#ECF3ED] overflow-hidden rounded-2xl bg-[#FFFFFF] shadow-sm ring-1 ring-[#DCE7DF]">
              {matchingProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleAddProduct(product)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#ECF3ED]"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#171D19] truncate">{product.name}</div>
                    <div className="text-xs text-[#404943]">
                      {product.tier} · {formatBDT(product.boxPrice)}/বক্স
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#CBEAD6] px-3 py-1 text-xs font-bold text-[#002114] shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                    যোগ করুন
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Editable Items List */}
        <div className="divide-y divide-[#ECF3ED] overflow-hidden rounded-2xl bg-[#FFFFFF] ring-1 ring-[#DCE7DF]">
          {computedItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#404943]">
              সব ওষুধ মুছে ফেলা হয়েছে। উপরের সার্চ থেকে কমপক্ষে ১টি ওষুধ যোগ করুন।
            </div>
          ) : (
            computedItems.map((item, idx) => {
              const rawRow = rows[idx];
              return (
                <div key={item.productId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-base font-bold text-[#171D19] truncate">
                        {item.productName}
                      </div>
                      <div className="text-xs text-[#404943]">
                        {item.tier} · আসল মোট {formatBDT(item.grossTotal)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(item.productId)}
                      aria-label={`আইটেম বাদ দিন: ${item.productName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#707972] hover:bg-[#FFDAD6] hover:text-[#BA1A1A] shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="min-w-0">
                      <label
                        htmlFor={`edit-boxes-${item.productId}`}
                        className="mb-1 block text-xs font-semibold text-[#404943]"
                      >
                        বক্স সংখ্যা
                      </label>
                      <div className="flex min-h-[44px] items-center rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6]">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number.parseInt(rawRow.boxesInput, 10) || 1;
                            updateRow(item.productId, {
                              boxesInput: String(Math.max(1, cur - 1)),
                            });
                          }}
                          aria-label={`বক্স কমান: ${item.productName}`}
                          className="px-2.5 py-2 text-[#171D19] hover:bg-[#E2EDE5] rounded-l-2xl"
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
                          className="w-full bg-transparent text-center text-base font-bold font-mono-num text-[#171D19] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number.parseInt(rawRow.boxesInput, 10) || 0;
                            updateRow(item.productId, { boxesInput: String(cur + 1) });
                          }}
                          aria-label={`বক্স বাড়ান: ${item.productName}`}
                          className="px-2.5 py-2 text-[#171D19] hover:bg-[#E2EDE5] rounded-r-2xl"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-rate-${item.productId}`}
                        className="mb-1 block text-xs font-semibold text-[#404943]"
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
                        className="w-full min-h-[44px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-3 py-2 text-base font-mono-num text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-disc-${item.productId}`}
                        className="mb-1 block text-xs font-semibold text-[#404943]"
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
                        className="w-full min-h-[44px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-3 py-2 text-base font-mono-num font-bold text-[#9A5B00] focus:border-[#006B47] focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="rounded-2xl bg-[#ECF3ED] px-3 py-2 text-right">
                      <div className="text-[11px] font-medium text-[#404943]">ছাড়ের পর দাম</div>
                      <div className="text-base font-bold font-mono-num text-[#006B47]">
                        {formatBDT(item.netTotal)}
                      </div>
                      <div className="text-[11px] font-mono-num text-[#404943]">
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
        <div className="grid grid-cols-1 gap-4 rounded-2xl bg-[#ECF3ED] p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-sale-paid-input" className="mb-1.5 block text-sm font-bold text-[#171D19]">
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
              className="w-full min-h-[48px] rounded-2xl border border-[#C3D2C8] bg-white px-3.5 py-2 text-lg font-bold font-mono-num text-[#006B47] focus:border-[#006B47] focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPaidInput(String(totals.netTotal));
                  setError('');
                }}
                className="min-h-[34px] rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#171D19] hover:bg-[#CBEAD6]"
              >
                পুরো টাকা ({formatBDT(totals.netTotal)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaidInput('');
                  setError('');
                }}
                className="min-h-[34px] rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#171D19] hover:bg-[#CBEAD6]"
              >
                সব বাকি (০)
              </button>
            </div>
          </div>

          <div className="space-y-1.5 rounded-2xl bg-white p-3.5 text-sm">
            <div className="flex justify-between text-[#404943]">
              <span>মোট বক্স / আসল দাম</span>
              <span className="font-mono-num">
                {totals.totalBoxes} বক্স · {formatBDT(totals.grossTotal)}
              </span>
            </div>
            <div className="flex justify-between text-[#9A5B00]">
              <span>মোট ছাড়</span>
              <span className="font-mono-num">-{formatBDT(totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-[#ECF3ED] pt-1.5 font-bold text-[#171D19]">
              <span>সর্বমোট প্রদেয় বিল</span>
              <span className="font-mono-num" data-testid="edit-sale-net-total">
                {formatBDT(totals.netTotal)}
              </span>
            </div>
            <div className="flex justify-between text-[#006B47]">
              <span>জমা</span>
              <span className="font-bold font-mono-num">{formatBDT(totals.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-[#ECF3ED] pt-1.5 text-base font-bold text-[#BA1A1A]">
              <span>বাকি আছে</span>
              <span className="font-mono-num" data-testid="edit-sale-due-total">
                {formatBDT(totals.dueAmount)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="edit-sale-note-input" className="mb-1.5 block text-sm font-semibold text-[#171D19]">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="edit-sale-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: পরিবর্তিত অর্ডার..."
            className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
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
        <div className="rounded-2xl bg-[#ECF3ED] px-4 py-3 text-sm">
          <div className="font-bold text-[#171D19] text-base">{payment.shopName}</div>
          <div className="mt-0.5 text-[13px] text-[#404943]">
            <span className="font-mono-num font-semibold">{payment.receiptNo}</span> · {formatDateTimeBn(payment.date)}
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-[#FFDAD6] px-4 py-2.5 text-[15px] font-medium text-[#410002]" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-pay-amount-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
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
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base font-bold text-[#171D19] font-mono-num focus:border-[#006B47] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="edit-pay-method-select" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
              পেমেন্ট মাধ্যম
            </label>
            <select
              id="edit-pay-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
              className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
            >
              <option value="Cash">নগদ (Cash)</option>
              <option value="bKash">বিকাশ (bKash)</option>
              <option value="Nagad">নগদ (Nagad)</option>
              <option value="Bank">ব্যাংক (Bank)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="edit-pay-note-input" className="mb-1.5 block text-[15px] font-semibold text-[#171D19]">
            মন্তব্য (ঐচ্ছিক)
          </label>
          <input
            id="edit-pay-note-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: সংশোধিত নগদ জমা"
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
            পরিবর্তন সেভ করুন
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
