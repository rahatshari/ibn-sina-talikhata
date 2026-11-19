import { useMemo, useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import type { Product, ProductTier } from '../types/tally';
import { formatBDT } from '../utils/ledger';

interface ProductsViewProps {
  products: Product[];
  onEditProduct: (product: Product) => void;
  onAddProduct: () => void;
}

const TIERS: Array<'All' | ProductTier> = [
  'All',
  'Super Star',
  'Priority Star',
  'Promising Star',
  'Star Line (Group B)',
  'Priority Line (Group B)',
  'Promising Line (Group B)',
  'Custom',
];

export function ProductsView({
  products,
  onEditProduct,
  onAddProduct,
}: ProductsViewProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | ProductTier>('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tierFilter !== 'All' && p.tier !== tierFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.tier.toLowerCase().includes(q);
    });
  }, [products, search, tierFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            প্রোডাক্ট তালিকা ({products.length})
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            THE IBN SINA&apos;S Production — সকল প্রোডাক্টের তালিকা ও প্রতি বক্সের নির্ধারিত দাম
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.97] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            নতুন প্রোডাক্ট
          </button>
        </div>
      </div>

      {/* Search & Tier Tabs */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="প্রোডাক্ট খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রোডাক্টের নাম লিখুন (যেমন: Dexlan, Esolok MUPS, Glipatab)..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TIERS.map((tier) => {
            const count =
              tier === 'All'
                ? products.length
                : products.filter((p) => p.tier === tier).length;
            if (tier === 'Custom' && count === 0) return null;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter(tier)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  tierFilter === tier
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tier === 'All' ? 'সব প্রোডাক্ট' : tier} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid / Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি।
          </div>
        ) : (
          <>
            {/* Mobile Single-Screen Cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {product.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {product.tier} · {product.packInfo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right font-bold font-mono-num text-sm text-slate-900">
                      {formatBDT(product.boxPrice)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditProduct(product)}
                      aria-label={`দাম পরিবর্তন: ${product.name}`}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      এডিট
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">প্রোডাক্টের নাম</th>
                    <th className="px-4 py-3 font-medium">ক্যাটাগরি / গ্রুপ</th>
                    <th className="px-4 py-3 font-medium">প্যাক সাইজ</th>
                    <th className="px-4 py-3 text-right font-medium">দাম / বক্স</th>
                    <th className="px-5 py-3 text-right font-medium">সম্পাদনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-semibold text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{product.tier}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{product.packInfo}</td>
                      <td className="px-4 py-3 text-right font-bold font-mono-num text-slate-900">
                        {formatBDT(product.boxPrice)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          aria-label={`দাম পরিবর্তন: ${product.name}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          দাম পরিবর্তন
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
