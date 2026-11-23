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
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#171D19]">
            প্রোডাক্ট তালিকা ({products.length})
          </h1>
          <p className="mt-1 text-sm sm:text-[15px] text-[#404943]">
            THE IBN SINA&apos;S Production — সকল প্রোডাক্টের তালিকা ও প্রতি বক্সের নির্ধারিত দাম
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#006B47] px-5 py-2.5 text-[15px] font-bold text-white shadow-xs transition-all hover:bg-[#005739] active:scale-[0.97] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            নতুন প্রোডাক্ট
          </button>
        </div>
      </div>

      {/* Search & Tier Tabs */}
      <div className="space-y-3.5 rounded-[28px] bg-[#FFFFFF] p-4 sm:p-5 shadow-xs ring-1 ring-[#DCE7DF]/80">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#404943]" />
          <input
            type="text"
            aria-label="প্রোডাক্ট খুঁজুন"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রোডাক্টের নাম লিখুন (যেমন: Dexlan, Esolok MUPS, Glipatab)..."
            className="w-full min-h-[48px] rounded-2xl border border-[#DCE7DF] bg-[#F5FAF6] py-2.5 pl-10 pr-4 text-base text-[#171D19] focus:border-[#006B47] focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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
                className={`min-h-[38px] rounded-full px-3.5 py-1.5 text-[13px] sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  tierFilter === tier
                    ? 'bg-[#006B47] text-white'
                    : 'bg-[#ECF3ED] text-[#171D19] hover:bg-[#D7E7DC]'
                }`}
              >
                {tier === 'All' ? 'সব প্রোডাক্ট' : tier} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid / Table */}
      <div className="overflow-hidden rounded-[28px] bg-[#FFFFFF] shadow-xs ring-1 ring-[#DCE7DF]/80">
        {filtered.length === 0 ? (
          <div className="p-8 sm:p-10 text-center text-base text-[#404943]">
            কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি।
          </div>
        ) : (
          <>
            {/* Mobile Single-Screen Cards */}
            <div className="divide-y divide-[#ECF3ED] md:hidden">
              {filtered.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-[#171D19]">
                      {product.name}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[#404943]">
                      {product.tier} · {product.packInfo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right font-bold font-mono-num text-base text-[#006B47]">
                      {formatBDT(product.boxPrice)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditProduct(product)}
                      aria-label={`দাম পরিবর্তন: ${product.name}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#ECF3ED] px-3.5 py-1.5 text-xs font-bold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap"
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
              <table className="w-full text-left text-[15px]">
                <thead className="border-b border-[#DCE7DF] bg-[#ECF3ED] text-sm text-[#404943]">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">প্রোডাক্টের নাম</th>
                    <th className="px-4 py-3.5 font-bold">ক্যাটাগরি / গ্রুপ</th>
                    <th className="px-4 py-3.5 font-bold">প্যাক সাইজ</th>
                    <th className="px-4 py-3.5 text-right font-bold">দাম / বক্স</th>
                    <th className="px-6 py-3.5 text-right font-bold">সম্পাদনা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECF3ED]">
                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-[#F5FAF6]">
                      <td className="px-6 py-3.5 text-base font-bold text-[#171D19]">{product.name}</td>
                      <td className="px-4 py-3.5 text-sm text-[#404943]">{product.tier}</td>
                      <td className="px-4 py-3.5 text-sm text-[#404943]">{product.packInfo}</td>
                      <td className="px-4 py-3.5 text-right text-base font-bold font-mono-num text-[#006B47]">
                        {formatBDT(product.boxPrice)}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          aria-label={`দাম পরিবর্তন: ${product.name}`}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#ECF3ED] px-3.5 py-1.5 text-xs font-bold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap"
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
