import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BarChart3,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  FolderDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Store,
  Type,
  UserCircle2,
} from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { DashboardView } from './components/DashboardView';
import { DueCustomersView } from './components/DueCustomersView';
import {
  AddShopModal,
  CollectPaymentModal,
  InvoiceDetailModal,
  ProductFormModal,
} from './components/Modals';
import { NewSaleView } from './components/NewSaleView';
import { ProductsView } from './components/ProductsView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReportsView } from './components/ReportsView';
import { ShopkeepersView } from './components/ShopkeepersView';
import { UpdateCenterModal } from './components/UpdateCenterModal';
import { useAppUpdater } from './hooks/useAppUpdater';
import { useTallyStore } from './hooks/useTallyStore';
import type { Product, SaleRecord, Shopkeeper } from './types/tally';
import { computeDashboardMetrics } from './utils/ledger';
import {
  APP_FONT_OPTIONS,
  applyAppFont,
  loadSavedFontId,
  saveAndApplyAppFont,
  type AppFontId,
} from './utils/fontPreferences';
import { parseReleaseChangelog } from './utils/updater';

type AppView = 'dashboard' | 'new-sale' | 'shops' | 'due' | 'products' | 'reports';

export default function App() {
  const store = useTallyStore();
  const updater = useAppUpdater(store.isOnline);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [preselectedShopId, setPreselectedShopId] = useState<string | undefined>(undefined);
  const [selectedLedgerShop, setSelectedLedgerShop] = useState<Shopkeeper | null>(null);

  const [shopModalState, setShopModalState] = useState<{
    open: boolean;
    editing: Shopkeeper | null;
  }>({ open: false, editing: null });
  const [collectTarget, setCollectTarget] = useState<{ shop: Shopkeeper; due: number } | null>(null);
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissedUpdateTag, setDismissedUpdateTag] = useState<string | null>(null);
  const [productModalState, setProductModalState] = useState<{
    open: boolean;
    editing: Product | null;
  }>({ open: false, editing: null });
  const [selectedFontId, setSelectedFontId] = useState<AppFontId>(() => loadSavedFontId());

  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyAppFont(selectedFontId);
  }, [selectedFontId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeView]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const metrics = useMemo(
    () => computeDashboardMetrics(store.shops, store.sales, store.payments),
    [store.shops, store.sales, store.payments],
  );

  const openNewSale = (shopId?: string) => {
    setPreselectedShopId(shopId);
    setActiveView('new-sale');
  };

  const navItems: Array<{
    id: AppView;
    label: string;
    mobileLabel: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', mobileLabel: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'new-sale', label: 'নতুন বিক্রি', mobileLabel: 'বিক্রি', icon: Plus },
    { id: 'shops', label: 'দোকানদার', mobileLabel: 'দোকানদার', icon: Store },
    { id: 'due', label: 'বাকি', mobileLabel: 'বাকি', icon: Banknote },
    { id: 'products', label: 'প্রোডাক্ট', mobileLabel: 'প্রোডাক্ট', icon: Package },
    { id: 'reports', label: 'রিপোর্ট', mobileLabel: 'রিপোর্ট', icon: BarChart3 },
  ];

  const handleSelectNav = (id: AppView) => {
    if (id !== 'new-sale') setPreselectedShopId(undefined);
    if (id === 'shops') setSelectedLedgerShop(null);
    setActiveView(id);
  };

  const showUpdateBanner =
    updater.updateAvailable &&
    updater.latestRelease &&
    dismissedUpdateTag !== updater.latestRelease.tagName;

  const userInitial = (store.user?.displayName || store.user?.email || 'M')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* 3-Zone Top App Bar */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white pt-safe">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-6 px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Zone 1: Brand Emblem + Title + Compact Sync Status */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="flex items-center gap-2 text-left min-w-0"
            >
              <img
                src="/icon.svg"
                alt=""
                className="h-8 w-8 rounded-lg border border-emerald-100 shrink-0"
              />
              <span className="font-display text-[15px] sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                ইবনে সিনা টালিখাতা
              </span>
            </button>
            <span
              data-testid="sync-status-text"
              title={store.syncStatus.detail}
              className={`hidden lg:inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                store.syncStatus.state === 'offline'
                  ? 'bg-amber-50 text-amber-700'
                  : store.syncStatus.state === 'syncing'
                    ? 'bg-blue-50 text-blue-700'
                    : store.user
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
              }`}
            >
              {store.syncStatus.state === 'offline' ? (
                <CloudOff className="h-3 w-3" />
              ) : store.syncStatus.state === 'syncing' ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              {store.syncStatus.label}
            </span>
          </div>

          {/* Zone 2: Clean Single-line Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-5" aria-label="প্রধান নেভিগেশন">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary CTA + Modern Account Chip + 3-Dot Overflow Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openNewSale()}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-emerald-600 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>নতুন বিক্রি</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              aria-label={store.user ? 'অ্যাকাউন্ট প্রোফাইল ও লগআউট' : 'জিমেইল দিয়ে লগইন'}
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 sm:px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 shrink-0"
            >
              {store.user ? (
                <>
                  {store.user.photoURL ? (
                    <img
                      src={store.user.photoURL}
                      alt={store.user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {userInitial}
                    </span>
                  )}
                  <span className="hidden sm:inline max-w-[90px] truncate">
                    {store.user.displayName?.split(' ')[0] || 'অ্যাকাউন্ট'}
                  </span>
                </>
              ) : (
                <>
                  <UserCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">লগইন</span>
                </>
              )}
            </button>

            {/* 3-Dot Overflow Menu */}
            <div className="relative" ref={menuContainerRef}>
              <button
                type="button"
                aria-label="আরও অপশন"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 shrink-0"
              >
                <MoreVertical className="h-5 w-5" />
                {updater.updateAvailable && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-white"
                  />
                )}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="অতিরিক্ত অপশন মেনু"
                  className="absolute right-0 mt-2 w-72 max-h-[82vh] overflow-y-auto origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setUpdateModalOpen(true);
                    }}
                    className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <FolderDown className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>ডাউনলোড ও আপডেট</span>
                    </span>
                    {updater.updateAvailable ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 whitespace-nowrap shrink-0">
                        নতুন আপডেট
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono-num text-slate-400 whitespace-nowrap shrink-0">
                        v{updater.installedVersion}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setAccountModalOpen(true);
                    }}
                    className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {store.user ? (
                        <Cloud className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <LogIn className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <span className="truncate">
                        {store.user ? 'অ্যাকাউন্ট ও ক্লাউড সিঙ্ক' : 'জিমেইল লগইন করুন'}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setActiveView('reports');
                    }}
                    className="flex w-full min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <BarChart3 className="h-4 w-4 text-slate-600 shrink-0" />
                    <span>ডাটা ব্যাকআপ ও রিপোর্ট</span>
                  </button>

                  <div className="my-1.5 border-t border-slate-100" />
                  <div className="px-3 py-1.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <Type className="h-3.5 w-3.5 text-emerald-600" />
                      <span>লেখার ফন্ট পরিবর্তন</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {APP_FONT_OPTIONS.map((font) => {
                        const active = selectedFontId === font.id;
                        return (
                          <button
                            key={font.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => {
                              setSelectedFontId(font.id);
                              saveAndApplyAppFont(font.id);
                            }}
                            style={{ fontFamily: font.fontFamily }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                              active
                                ? 'bg-emerald-50 font-semibold text-emerald-800'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{font.label}</span>
                              <span className="text-[11px] text-slate-400">({font.sample})</span>
                            </span>
                            {active && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {store.user && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setAccountModalOpen(true);
                        }}
                        className="flex w-full min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span>লগআউট</span>
                      </button>
                    </>
                  )}

                  <div className="px-2 pt-1">
                    <PWAInstallButton />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* New APK Release Notification Banner with What's Changed */}
        {showUpdateBanner && updater.latestRelease && (() => {
          const changelogItems = parseReleaseChangelog(updater.latestRelease.releaseNotes);
          const visibleChanges = changelogItems.slice(0, 3);
          return (
            <div
              role="status"
              className="no-print mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <Download className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0 space-y-1 text-xs sm:text-sm text-emerald-950">
                    <div className="font-bold">
                      নতুন আপডেট v{updater.latestRelease.version} এসেছে
                    </div>
                    {visibleChanges.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-emerald-900">
                        {visibleChanges.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                        {changelogItems.length > visibleChanges.length && (
                          <li className="text-[11px] font-medium text-emerald-700">
                            + আরও {changelogItems.length - visibleChanges.length}টি পরিবর্তন
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDismissedUpdateTag(updater.latestRelease?.tagName ?? null)}
                    className="min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    পরে
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(true)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    আপডেট করুন
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Contextual Offline / Sync / Auth Notice (Only shown when needed, no bulky legacy bar) */}
        {(store.syncStatus.state === 'offline' ||
          store.syncStatus.state === 'syncing' ||
          store.justSyncedNotice ||
          store.authError) && (
          <div className="no-print mb-5 space-y-2">
            {(store.syncStatus.state === 'offline' || store.syncStatus.state === 'syncing') && (
              <div
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs ${
                  store.syncStatus.state === 'offline'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {store.syncStatus.state === 'offline' ? (
                    <CloudOff className="h-4 w-4 text-amber-600 shrink-0" />
                  ) : (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  )}
                  <span>
                    <strong>{store.syncStatus.label}:</strong> {store.syncStatus.detail}
                  </span>
                </div>
              </div>
            )}

            {store.justSyncedNotice && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                অফলাইনে করা সকল ডাটা স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড ও সিঙ্ক হয়েছে।
              </div>
            )}

            {store.authError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700" role="alert">
                {store.authError}
              </p>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            onStartNewSale={openNewSale}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
            onOpenShopLedger={(shop) => {
              setSelectedLedgerShop(shop);
              setActiveView('shops');
            }}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
            onOpenAllReports={() => setActiveView('reports')}
          />
        )}

        {activeView === 'new-sale' && (
          <NewSaleView
            products={store.products}
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            preselectedShopId={preselectedShopId}
            onRequestAddShop={() => setShopModalState({ open: true, editing: null })}
            onSaveSale={store.recordSale}
            onSaleCreated={(sale) => {
              setDetailSale(sale);
              setActiveView('dashboard');
            }}
          />
        )}

        {activeView === 'shops' && (
          <ShopkeepersView
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            selectedLedgerShop={selectedLedgerShop}
            onSelectLedgerShop={setSelectedLedgerShop}
            onRequestAddShop={() => setShopModalState({ open: true, editing: null })}
            onRequestEditShop={(shop) => setShopModalState({ open: true, editing: shop })}
            onStartNewSale={openNewSale}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
          />
        )}

        {activeView === 'due' && (
          <DueCustomersView
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            onOpenShopLedger={(shop) => {
              setSelectedLedgerShop(shop);
              setActiveView('shops');
            }}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
          />
        )}

        {activeView === 'products' && (
          <ProductsView
            products={store.products}
            onEditProduct={(product) => setProductModalState({ open: true, editing: product })}
            onAddProduct={() => setProductModalState({ open: true, editing: null })}
          />
        )}

        {activeView === 'reports' && (
          <ReportsView
            products={store.products}
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            appVersion={updater.installedVersion}
            appVersionCode={updater.installedCode}
            onOpenUpdateManager={() => setUpdateModalOpen(true)}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
            onDeleteSale={store.deleteSale}
            onDeletePayment={store.deletePayment}
            onImportBackup={store.importBackupData}
            onResetDemoData={store.resetToDemoData}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation (44px+ Android touch targets, fits single screen width) */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 min-h-[60px] pb-safe items-center border-t border-slate-200 bg-white md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium ${
                active ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="max-w-full truncate whitespace-nowrap">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <AddShopModal
        open={shopModalState.open}
        editingShop={shopModalState.editing}
        onClose={() => setShopModalState({ open: false, editing: null })}
        onSave={(data) => {
          if (shopModalState.editing) {
            store.updateShopkeeper(shopModalState.editing.id, data);
          } else {
            const created = store.addShopkeeper(data);
            setPreselectedShopId(created.id);
          }
        }}
      />

      <CollectPaymentModal
        open={Boolean(collectTarget)}
        shop={collectTarget?.shop ?? null}
        currentDue={collectTarget?.due ?? 0}
        onClose={() => setCollectTarget(null)}
        onCollect={(data) => store.recordPayment(data)}
      />

      <InvoiceDetailModal sale={detailSale} onClose={() => setDetailSale(null)} />

      <ProductFormModal
        open={productModalState.open}
        editingProduct={productModalState.editing}
        onClose={() => setProductModalState({ open: false, editing: null })}
        onSaveNew={(data) => store.addProduct(data)}
        onUpdatePrice={(id, price, packInfo) => store.updateProductPrice(id, price, packInfo)}
      />

      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        user={store.user}
        isOnline={store.isOnline}
        syncStatus={store.syncStatus}
        authError={store.authError}
        cloudLoading={store.cloudLoading}
        shopCount={store.shops.length}
        onSignInWithGoogle={store.signInWithGoogle}
        onSignOut={store.signOutUser}
        onSyncLocalToCloud={store.syncLocalDemoToCloud}
      />

      <UpdateCenterModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        installedVersion={updater.installedVersion}
        installedCode={updater.installedCode}
        packageName={updater.packageName}
        isNativeApp={updater.isNativeApp}
        isOnline={store.isOnline}
        checking={updater.checking}
        checkError={updater.checkError}
        lastCheckedAt={updater.lastCheckedAt}
        latestRelease={updater.latestRelease}
        updateAvailable={updater.updateAvailable}
        downloads={updater.downloads}
        onCheckNow={() => void updater.checkForUpdates()}
        onStartDownload={(release) => void updater.startApkDownload(release)}
        onInstallTask={(task) => void updater.installDownloadedTask(task)}
        onOpenInstallPermission={() => void updater.openInstallPermissionSettings()}
        onClearHistory={updater.clearDownloadHistory}
      />
    </div>
  );
}
