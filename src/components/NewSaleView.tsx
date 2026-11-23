import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Minus, Plus, Search, Store, Trash2, UserPlus, X } from 'lucide-react';
import type { PaymentRecord, Product, ProductTier, SaleRecord, Shopkeeper } from '../types/tally';
import {
  calculateInvoiceTotals,
  calculateLineItem,
  computeShopSummary,
  formatBDT,
} from '../utils/ledger';

interface DraftRow {
  productId: string;
  productName: string;
  tier: ProductTier;
  boxesInput: string;
  boxPriceInput: string;
  discountInput: string;
}

interface NewSaleViewProps {
  products: Product[];
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
  preselectedShopId?: string;
  onRequestAddShop: () => void;
  onSaveSale: (data: {
    shopId: string;
    items: ReturnType<typeof calculateLineItem>[];
    paidAmount: number;
    note?: string;
  }) => SaleRecord | null;
  onSaleCreated: (sale: SaleRecord) => void;
}

const FILTER_TIERS: Array<'All' | ProductTier> = [
  'All',
  'Super Star',
  'Priority Star',
  'Promising Star',
  'Star Line (Group B)',
  'Priority Line (Group B)',
  'Promising Line (Group B)',
];

export function NewSaleView({
  products,
  shops,
  sales,
  payments,
  preselectedShopId,
  onRequestAddShop,
  onSaveSale,
  onSaleCreated,
}: NewSaleViewProps) {
  const [selectedShopId, setSelectedShopId] = useState<string>(
    preselectedShopId || shops[0]?.id || '',
  );
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | ProductTier>('All');
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [bulkDiscount, setBulkDiscount] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (preselectedShopId) {
      setSelectedShopId(preselectedShopId);
    } else if (!selectedShopId && shops.length > 0) {
      setSelectedShopId(shops[0].id);
    }
  }, [preselectedShopId, shops, selectedShopId]);

  useEffect(() => {
    if (!shopPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShopPickerOpen(false);
    };
    const onBack = (e: Event) => {
      e.preventDefault();
      setShopPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('talikhata:back', onBack);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('talikhata:back', onBack);
    };
  }, [shopPickerOpen]);

  const selectedShop = useMemo(
    () => shops.find((s) => s.id === selectedShopId) ?? null,
    [shops, selectedShopId],
  );

  const shopSummariesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeShopSummary>>();
    for (const s of shops) {
      map.set(s.id, computeShopSummary(s.id, sales, payments));
    }
    return map;
  }, [shops, sales, payments]);

  const filteredShopsForPicker = useMemo(() => {
    const q = shopSearch.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.shopName.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.phone.includes(q),
    );
  }, [shops, shopSearch]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (tierFilter !== 'All' && p.tier !== tierFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.tier.toLowerCase().includes(q);
    });
  }, [products, searchQuery, tierFilter]);

  const computedItems = useMemo(
    () =>
      draftRows.map((row) =>
        calculateLineItem({
          productId: row.productId,
          productName: row.productName,
          tier: row.tier,
          boxes: Math.max(0, Number.parseInt(row.boxesInput, 10) || 0),
          boxPrice: Math.max(0, Number(row.boxPriceInput) || 0),
          discountPercent: Math.max(0, Math.min(100, Number(row.discountInput) || 0)),
        }),
      ),
    [draftRows],
  );

  const numericPaid = paidInput.trim() === '' ? 0 : Number(paidInput);
  const totals = useMemo(
    () => calculateInvoiceTotals(computedItems, Number.isFinite(numericPaid) ? numericPaid : 0),
    [computedItems, numericPaid],
  );

  const selectedShopSummary = useMemo(() => {
    if (!selectedShopId) return null;
    return computeShopSummary(selectedShopId, sales, payments);
  }, [selectedShopId, sales, payments]);

  const addProductToCart = (product: Product) => {
    setFormError('');
    setDraftRows((prev) => {
      const existing = prev.find((r) => r.productId === product.id);
      if (existing) {
        const currentBoxes = Number.parseInt(existing.boxesInput, 10) || 0;
        return prev.map((r) =>
          r.productId === product.id ? { ...r, boxesInput: String(currentBoxes + 1) } : r,
        );
      }
      const trimmedBulk = bulkDiscount.trim();
      const defaultDisc = Number(trimmedBulk);
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          tier: product.tier,
          boxesInput: '1',
          boxPriceInput: product.boxPrice > 0 ? String(product.boxPrice) : '',
          discountInput:
            trimmedBulk !== '' && Number.isFinite(defaultDisc) ? trimmedBulk : '',
        },
      ];
    });
  };

  const updateRow = (productId: string, patch: Partial<DraftRow>) => {
    setDraftRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (productId: string) => {
    setDraftRows((prev) => prev.filter((r) => r.productId !== productId));
  };

  const applyDiscountToAll = () => {
    const trimmed = bulkDiscount.trim();
    if (trimmed === '') {
      setDraftRows((prev) => prev.map((r) => ({ ...r, discountInput: '' })));
      return;
    }
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 0 || val > 100) return;
    setDraftRows((prev) => prev.map((r) => ({ ...r, discountInput: trimmed })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) {
      setFormError('অনুগ্রহ করে একটি দোকানদার সিলেক্ট করুন বা নতুন দোকান যোগ করুন।');
      return;
    }
    const validItems = computedItems.filter((item) => item.boxes > 0);
    if (validItems.length === 0) {
      setFormError('বিক্রয়ের জন্য অন্তত একটি প্রোডাক্ট ও তার বক্স সংখ্যা যোগ করুন।');
      return;
    }
    const rawPaid = paidInput.trim() === '' ? 0 : Number(paidInput);
    if (!Number.isFinite(rawPaid) || rawPaid < 0) {
      setFormError('জমা টাকার পরিমাণ ০ বা তার বেশি হতে হবে।');
      return;
    }
    if (rawPaid > totals.netTotal) {
      setFormError(`জমা টাকা সর্বমোট বিল (${formatBDT(totals.netTotal)}) এর চেয়ে বেশি হতে পারবে না।`);
      return;
    }

    const created = onSaveSale({
      shopId: selectedShopId,
      items: validItems,
      paidAmount: rawPaid,
      note,
    });

    if (created) {
      setDraftRows([]);
      setPaidInput('');
      setNote('');
      setFormError('');
      onSaleCreated(created);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#171D19]">নতুন বিক্রি ও বিল তৈরি</h1>
          <p className="mt-1 text-sm sm:text-[15px] text-[#404943]">
            দোকানদার ও প্রোডাক্ট বেছে নিন, বক্স সংখ্যা ও পার্সেন্ট (%) ডিসকাউন্ট বসিয়ে সাথে সাথে ডিসকাউন্টের পর দাম ও বাকি দেখুন
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Shop Picker & Product Selector */}
        <div className="space-y-5 xl:col-span-5">
          {/* Material 3 Shopkeeper Selector */}
          <div className="rounded-[28px] bg-[#FFFFFF] p-4 sm:p-6 shadow-xs ring-1 ring-[#DCE7DF]/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base sm:text-lg font-bold text-[#171D19]">
                ১. দোকানদার নির্বাচন করুন
              </span>
              <button
                type="button"
                onClick={onRequestAddShop}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#CBEAD6] px-3.5 py-1.5 text-sm font-bold text-[#002114] transition-colors hover:bg-[#B4DFC4] whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                নতুন দোকান
              </button>
            </div>

            <button
              type="button"
              id="sale-shop-select"
              data-testid="shop-picker-trigger"
              aria-haspopup="listbox"
              aria-expanded={shopPickerOpen}
              onClick={() => {
                setShopSearch('');
                setShopPickerOpen(true);
              }}
              className="mt-3.5 flex w-full min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-[#ECF3ED] px-4 py-3 text-left transition-all hover:bg-[#E2EDE5] focus:outline-2 focus:outline-[#006B47]"
            >
              {selectedShop ? (
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#006B47] text-base font-bold text-white shrink-0">
                    {selectedShop.shopName.trim().charAt(0) || <Store className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base sm:text-[17px] font-bold text-[#171D19]">
                      {selectedShop.shopName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] sm:text-sm text-[#404943]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#006B47]" />
                      <span className="truncate">{selectedShop.area}</span>
                      {selectedShop.phone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num shrink-0">{selectedShop.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3.5 text-[#404943]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D7E7DC] text-[#404943] shrink-0">
                    <Store className="h-5 w-5" />
                  </div>
                  <span className="text-base font-semibold">দোকানদার বেছে নিন...</span>
                </div>
              )}
              <ChevronDown className="h-5 w-5 text-[#404943] shrink-0" />
            </button>

            {selectedShopSummary && (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#ECF3ED] pt-3 text-sm text-[#404943]">
                <span>
                  পূর্বের মোট বিল:{' '}
                  <strong className="font-mono-num text-[#171D19]">
                    {formatBDT(selectedShopSummary.totalBilled)}
                  </strong>
                </span>
                <span>
                  পূর্বের বাকি:{' '}
                  <strong
                    className={`font-mono-num ${
                      selectedShopSummary.totalDue > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                    }`}
                  >
                    {formatBDT(selectedShopSummary.totalDue)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Product Catalog Selector */}
          <div className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
            <div className="border-b border-[#ECF3ED] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-[#171D19]">
                  ২. প্রোডাক্ট যোগ করুন ({filteredProducts.length})
                </h2>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
                <input
                  type="text"
                  aria-label="প্রোডাক্ট খুঁজুন"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ওষুধের নাম লিখে খুঁজুন (যেমন: Dexlan)..."
                  className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTierFilter(tier)}
                    className={`min-h-[38px] rounded-full px-3.5 py-1.5 text-[13px] sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                      tierFilter === tier
                        ? 'bg-[#006B47] text-white'
                        : 'bg-[#ECF3ED] text-[#171D19] hover:bg-[#D7E7DC]'
                    }`}
                  >
                    {tier === 'All' ? 'সব প্রোডাক্ট' : tier.replace(' (Group B)', ' B')}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[460px] divide-y divide-[#ECF3ED] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-base text-[#404943]">
                  কোনো প্রোডাক্ট পাওয়া যায়নি।
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const inCart = draftRows.find((r) => r.productId === product.id);
                  const cartBoxes = inCart ? Number.parseInt(inCart.boxesInput, 10) || 0 : 0;
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-colors hover:bg-[#F5FAF6]"
                    >
                      <div className="min-w-0">
                        <div className="text-base font-bold text-[#171D19] truncate">
                          {product.name}
                        </div>
                        <div className="mt-0.5 text-[13px] sm:text-sm text-[#404943]">
                          <span>{product.tier}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono-num font-semibold text-[#171D19]">
                            {formatBDT(product.boxPrice)}/বক্স
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProductToCart(product)}
                        aria-label={`যোগ করুন: ${product.name}`}
                        className={`group inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-transform duration-100 active:scale-[0.97] whitespace-nowrap shrink-0 ${
                          inCart
                            ? 'bg-[#006B47] text-white shadow-xs hover:bg-[#005739]'
                            : 'bg-[#CBEAD6] text-[#002114] hover:bg-[#006B47] hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                            inCart
                              ? 'bg-white/20 text-white'
                              : 'bg-[#006B47]/15 text-[#006B47] group-hover:bg-white/20 group-hover:text-white'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                        {inCart ? (
                          <span className="flex items-center gap-1.5">
                            <span>আরও</span>
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold font-mono-num">
                              {cartBoxes}
                            </span>
                          </span>
                        ) : (
                          <span>যোগ করুন</span>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Invoice Line Items & Calculation */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80 xl:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECF3ED] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#171D19]">
                ৩. নির্বাচিত প্রোডাক্ট ও ডিসকাউন্ট হিসাব
              </h2>
              <p className="text-[13px] sm:text-sm text-[#404943]">
                প্রতিটি প্রোডাক্টের বক্স, ডিসকাউন্ট (%) এবং ছাড়ের পর দাম এখানে দেখাবে
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                aria-label="সব প্রোডাক্টে ডিসকাউন্ট %"
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(e.target.value)}
                placeholder="সব % (10)"
                className="w-28 min-h-[42px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-3.5 py-2 text-sm text-[#171D19] font-mono-num focus:border-[#006B47] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={applyDiscountToAll}
                className="min-h-[42px] rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap shrink-0"
              >
                সবগুলোতে দিন
              </button>
            </div>
          </div>

          {formError && (
            <div className="mx-4 sm:mx-6 mt-4 rounded-2xl bg-[#FFDAD6] px-4 py-3 text-[15px] font-medium text-[#410002]" role="alert">
              {formError}
            </div>
          )}

          {computedItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 sm:p-12 text-center">
              <p className="text-base font-bold text-[#171D19]">এখনও কোনো প্রোডাক্ট যোগ করা হয়নি</p>
              <p className="mt-1.5 text-sm text-[#404943]">
                ওপরের তালিকা থেকে প্রয়োজনীয় ওষুধগুলো &ldquo;যোগ করুন&rdquo; বাটনে ক্লিক করে ইনভয়েসে যুক্ত করুন।
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#ECF3ED]">
              {computedItems.map((item, idx) => {
                const rawRow = draftRows[idx];
                return (
                  <div
                    key={item.productId}
                    data-testid={`line-item-${item.productId}`}
                    className="space-y-3.5 px-4 sm:px-6 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-bold text-[#171D19] truncate">{item.productName}</div>
                        <div className="text-[13px] sm:text-sm text-[#404943]">
                          {item.tier} · আসল মোট {formatBDT(item.grossTotal)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(item.productId)}
                        aria-label={`মুছে ফেলুন: ${item.productName}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#404943] hover:bg-[#FFDAD6] hover:text-[#BA1A1A] shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="min-w-0">
                        <label
                          htmlFor={`boxes-${item.productId}`}
                          className="mb-1.5 block text-[13px] font-semibold text-[#404943]"
                        >
                          বক্স সংখ্যা
                        </label>
                        <div className="flex min-h-[46px] items-center rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6]">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = Number.parseInt(rawRow.boxesInput, 10) || 1;
                              updateRow(item.productId, {
                                boxesInput: String(Math.max(1, cur - 1)),
                              });
                            }}
                            aria-label={`বক্স কমান: ${item.productName}`}
                            className="px-2.5 py-2.5 text-[#171D19] hover:bg-[#E2EDE5] rounded-l-2xl"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            id={`boxes-${item.productId}`}
                            type="number"
                            min="1"
                            placeholder="1"
                            value={rawRow.boxesInput}
                            onChange={(e) =>
                              updateRow(item.productId, {
                                boxesInput: e.target.value,
                              })
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
                            className="px-2.5 py-2.5 text-[#171D19] hover:bg-[#E2EDE5] rounded-r-2xl"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`rate-${item.productId}`}
                          className="mb-1.5 block text-[13px] font-semibold text-[#404943]"
                        >
                          দাম / বক্স (৳)
                        </label>
                        <input
                          id={`rate-${item.productId}`}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="দাম লিখুন"
                          value={rawRow.boxPriceInput}
                          onChange={(e) =>
                            updateRow(item.productId, {
                              boxPriceInput: e.target.value,
                            })
                          }
                          className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-3.5 py-2 text-base font-semibold font-mono-num text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`disc-${item.productId}`}
                          className="mb-1.5 block text-[13px] font-semibold text-[#404943]"
                        >
                          ডিসকাউন্ট (%)
                        </label>
                        <input
                          id={`disc-${item.productId}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="%"
                          value={rawRow.discountInput}
                          onChange={(e) =>
                            updateRow(item.productId, {
                              discountInput: e.target.value,
                            })
                          }
                          className="w-full min-h-[46px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] px-3.5 py-2 text-base font-mono-num text-[#9A5B00] font-bold focus:border-[#006B47] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div className="rounded-2xl bg-[#ECF3ED] px-3.5 py-2 text-right">
                        <div className="text-xs font-medium text-[#404943]">ডিসকাউন্টের পর দাম</div>
                        <div
                          className="text-base font-bold font-mono-num text-[#006B47]"
                          data-testid={`line-net-${item.productId}`}
                        >
                          {formatBDT(item.netTotal)}
                        </div>
                        <div className="text-xs font-mono-num text-[#404943]">
                          {formatBDT(item.effectiveBoxPrice)}/বক্স · ছাড় {formatBDT(item.discountAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Invoice Summary & Payment Input */}
          <div className="mt-auto border-t border-[#DCE7DF] bg-[#ECF3ED]/75 p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sale-paid-input" className="mb-2 block text-[15px] font-bold text-[#171D19]">
                  দোকানদার কত টাকা দিয়েছে? (৳)
                </label>
                <input
                  id="sale-paid-input"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="টাকার পরিমাণ লিখুন"
                  value={paidInput}
                  onChange={(e) => {
                    setPaidInput(e.target.value);
                    setFormError('');
                  }}
                  className="w-full min-h-[50px] rounded-2xl border border-[#C3D2C8] bg-white px-4 py-2.5 text-lg font-bold font-mono-num text-[#006B47] focus:border-[#006B47] focus:outline-none"
                />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidInput(String(totals.netTotal))}
                    className="min-h-[36px] rounded-full bg-white px-3.5 py-1 text-[13px] font-semibold text-[#171D19] ring-1 ring-[#DCE7DF] hover:bg-[#CBEAD6]"
                  >
                    পুরো টাকা ({formatBDT(totals.netTotal)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidInput(String(Math.round(totals.netTotal / 2)))}
                    className="min-h-[36px] rounded-full bg-white px-3.5 py-1 text-[13px] font-semibold text-[#171D19] ring-1 ring-[#DCE7DF] hover:bg-[#CBEAD6]"
                  >
                    অর্ধেক
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidInput('')}
                    className="min-h-[36px] rounded-full bg-white px-3.5 py-1 text-[13px] font-semibold text-[#171D19] ring-1 ring-[#DCE7DF] hover:bg-[#CBEAD6]"
                  >
                    সব বাকি (ফাঁকা)
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-white p-4 text-[15px]">
                <div className="flex justify-between text-[#404943]">
                  <span>মোট বক্স / আসল দাম</span>
                  <span className="font-mono-num">
                    {totals.totalBoxes} বক্স · {formatBDT(totals.grossTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#9A5B00]">
                  <span>মোট ডিসকাউন্ট ছাড়</span>
                  <span className="font-mono-num">-{formatBDT(totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between border-t border-[#ECF3ED] pt-2 font-bold text-[#171D19]">
                  <span>ডিসকাউন্টের পর মোট বিল</span>
                  <span className="font-mono-num" data-testid="invoice-net-total">
                    {formatBDT(totals.netTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#006B47]">
                  <span>দিয়েছে (জমা)</span>
                  <span className="font-bold font-mono-num">{formatBDT(totals.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-[#ECF3ED] pt-2 text-lg font-bold text-[#BA1A1A]">
                  <span>বাকি আছে</span>
                  <span className="font-mono-num" data-testid="invoice-due-total">
                    {formatBDT(totals.dueAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                aria-label="বিক্রয় মন্তব্য"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="মন্তব্য লিখুন (ঐচ্ছিক, যেমন: আগামী মঙ্গলবার বাকি দিবে)..."
                className="flex-1 min-h-[48px] rounded-2xl border border-[#C3D2C8] bg-white px-4 py-2.5 text-base text-[#171D19] focus:border-[#006B47] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[50px] rounded-full bg-[#006B47] px-7 py-3 text-base font-bold text-white shadow-xs transition-colors hover:bg-[#005739] whitespace-nowrap shrink-0"
              >
                বিক্রি সেভ করুন
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Material 3 Shopkeeper Selection Sheet / Modal */}
      {shopPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#171D19]/50 backdrop-blur-[2px] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="দোকানদার নির্বাচন করুন"
          data-testid="shop-picker-sheet"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShopPickerOpen(false);
          }}
        >
          <div className="flex max-h-[85dvh] w-full sm:max-w-lg flex-col rounded-t-[28px] sm:rounded-[28px] bg-[#FFFFFF] shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[#C3D2C8] sm:hidden" />
            <div className="flex items-center justify-between border-b border-[#ECF3ED] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#171D19]">
                  দোকানদার নির্বাচন করুন
                </h2>
                <p className="text-xs sm:text-sm text-[#404943]">
                  তালিকা থেকে ফার্মেসি বেছে নিন ({shops.length} টি)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShopPickerOpen(false)}
                aria-label="দোকানদার তালিকা বন্ধ করুন"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ECF3ED] text-[#171D19] hover:bg-[#D7E7DC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-[#ECF3ED] px-5 py-3.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
                <input
                  type="text"
                  autoFocus
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  placeholder="দোকানের নাম, এলাকা বা ফোন দিয়ে খুঁজুন..."
                  aria-label="দোকানদার খুঁজুন"
                  className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div
              role="listbox"
              aria-label="দোকানদারের তালিকা"
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4"
            >
              {filteredShopsForPicker.length === 0 ? (
                <div className="py-10 text-center text-base text-[#404943]">
                  কোনো দোকানদার পাওয়া যায়নি।
                </div>
              ) : (
                filteredShopsForPicker.map((shop) => {
                  const summary = shopSummariesById.get(shop.id);
                  const isSelected = shop.id === selectedShopId;
                  const due = summary?.totalDue ?? 0;
                  return (
                    <button
                      key={shop.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedShopId(shop.id);
                        setFormError('');
                        setShopPickerOpen(false);
                      }}
                      className={`flex w-full min-h-[68px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                        isSelected
                          ? 'bg-[#CBEAD6] text-[#002114]'
                          : 'bg-[#F5FAF6] text-[#171D19] hover:bg-[#ECF3ED]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold shrink-0 ${
                            isSelected
                              ? 'bg-[#006B47] text-white'
                              : 'bg-[#D7E7DC] text-[#002114]'
                          }`}
                        >
                          {shop.shopName.trim().charAt(0) || <Store className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-bold text-[#171D19]">
                            {shop.shopName}
                          </div>
                          <div className="mt-0.5 truncate text-[13px] text-[#404943]">
                            {shop.area} · {shop.ownerName}
                            {shop.phone ? ` · ${shop.phone}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-[#404943]">
                            {due > 0 ? 'বাকি' : 'হিসাব'}
                          </div>
                          <div
                            className={`text-[15px] font-bold font-mono-num ${
                              due > 0 ? 'text-[#BA1A1A]' : 'text-[#006B47]'
                            }`}
                          >
                            {due > 0 ? formatBDT(due) : 'পরিশোধিত'}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#006B47] text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#ECF3ED] bg-[#F5FAF6] p-4 pb-safe rounded-b-[28px]">
              <button
                type="button"
                onClick={() => {
                  setShopPickerOpen(false);
                  onRequestAddShop();
                }}
                className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#CBEAD6] px-5 py-2.5 text-[15px] font-bold text-[#002114] hover:bg-[#B4DFC4]"
              >
                <UserPlus className="h-4 w-4" />
                তালিকায় না থাকলে নতুন দোকান যোগ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
