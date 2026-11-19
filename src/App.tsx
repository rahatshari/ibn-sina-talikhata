import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  FolderDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Store,
  UploadCloud,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import {
  AddShopModal,
  CollectPaymentModal,
  InvoiceDetailModal,
  ProductFormModal,
  ProductSheetImageModal,
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

type AppView = 'dashboard' | 'new-sale' | 'shops' | 'products' | 'reports';

export default function App() {
  const store = useTallyStore();
  const updater = useAppUpdater(store.isOnline);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [preselectedShopId, setPreselectedShopId] = useState<string | undefined>(undefined);
  const [selectedLedgerShop, setSelectedLedgerShop] = useState<Shopkeeper | null>(null);

  const [addShopOpen, setAddShopOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState<{ shop: Shopkeeper; due: number } | null>(null);
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null);
  const [sheetImageOpen, setSheetImageOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [dismissedUpdateTag, setDismissedUpdateTag] = useState<string | null>(null);
  const [productModalState, setProductModalState] = useState<{
    open: boolean;
    editing: Product | null;
  }>({ open: false, editing: null });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeView]);

  const metrics = useMemo(
    () => computeDashboardMetrics(store.shops, store.sales, store.payments),
    [store.shops, store.sales, store.payments],
  );

  const openNewSale = (shopId?: string) => {
    setPreselectedShopId(shopId);
    setActiveView('new-sale');
  };

  const navItems: Array<{ id: AppView; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'new-sale', label: 'নতুন বিক্রি', icon: Plus },
    { id: 'shops', label: 'দোকানদার', icon: Store },
    { id: 'products', label: 'প্রোডাক্ট', icon: Package },
    { id: 'reports', label: 'রিপোর্ট', icon: BarChart3 },
  ];

  const showUpdateBanner =
    updater.updateAvailable &&
    updater.latestRelease &&
    dismissedUpdateTag !== updater.latestRelease.tagName;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 pb-24 md:pb-10">
      {/* 3-Zone Top Bar Contract */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white pt-safe">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Single-line Brand Title */}
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            ইবনে সিনা টালিখাতা
          </button>

          {/* Zone 2: Clean Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="প্রধান নেভিগেশন">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id !== 'new-sale') setPreselectedShopId(undefined);
                    setActiveView(item.id);
                  }}
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

          {/* Zone 3: 1 Primary CTA Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openNewSale()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              নতুন বিক্রি
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {/* New APK Release Notification Banner */}
        {showUpdateBanner && updater.latestRelease && (
          <div
            role="status"
            className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Download className="h-4 w-4 text-emerald-700 shrink-0" />
              <div className="text-xs sm:text-sm text-emerald-950">
                <strong>নতুন অ্যাপ আপডেট v{updater.latestRelease.version} পাওয়া গেছে!</strong>{' '}
                <span className="text-emerald-800">
                  ডাউনলোড ম্যানেজার থেকে এক ক্লিকে আপডেট করুন।
                </span>
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
                আপডেট দেখুন
              </button>
            </div>
          </div>
        )}

        {/* Offline / Auto-Sync & Gmail Auth Toolbar */}
        <div className="no-print mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {store.user ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  {store.user.photoURL ? (
                    <img
                      src={store.user.photoURL}
                      alt={store.user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                  ) : (
                    <Cloud className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {store.user.displayName || 'MR অ্যাকাউন্ট'}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                      <span className="truncate max-w-[200px] sm:max-w-none">{store.user.email}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        data-testid="sync-status-text"
                        className={`inline-flex items-center gap-1 font-medium ${
                          store.syncStatus.state === 'offline'
                            ? 'text-amber-700'
                            : store.syncStatus.state === 'syncing'
                              ? 'text-blue-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {store.syncStatus.state === 'offline' ? (
                          <CloudOff className="h-3.5 w-3.5 shrink-0" />
                        ) : store.syncStatus.state === 'syncing' ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                        ) : (
                          <Cloud className="h-3.5 w-3.5 shrink-0" />
                        )}
                        {store.syncStatus.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <FolderDown className="h-3.5 w-3.5 text-emerald-600" />
                    ডাউনলোড ও আপডেট
                  </button>
                  {store.shops.length === 0 && !store.cloudLoading && (
                    <button
                      type="button"
                      onClick={() => store.syncLocalDemoToCloud()}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      লোকাল ডাটা ক্লাউডে আনুন
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => store.signOutUser()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    লগআউট
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  {store.isOnline ? (
                    <Cloud className="h-4 w-4 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <CloudOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div className="text-xs sm:text-sm text-slate-600">
                    <span
                      data-testid="sync-status-text"
                      className={`font-semibold ${
                        store.isOnline ? 'text-slate-800' : 'text-amber-700'
                      }`}
                    >
                      {store.syncStatus.label}:
                    </span>{' '}
                    <span>{store.syncStatus.detail}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <FolderDown className="h-3.5 w-3.5 text-emerald-600" />
                    ডাউনলোড ও আপডেট
                  </button>
                  <button
                    type="button"
                    onClick={() => store.signInWithGoogle()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                    জিমেইল দিয়ে লগইন
                  </button>
                </div>
              </>
            )}
          </div>

          {store.justSyncedNotice && (
            <div
              role="status"
              className="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              অফলাইনে করা সকল ডাটা স্বয়ংক্রিয়ভাবে ক্লাউডে আপলোড ও সিঙ্ক হয়েছে।
            </div>
          )}

          {store.authError && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700" role="alert">
              {store.authError}
            </p>
          )}
        </div>

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
            onOpenProductSheet={() => setSheetImageOpen(true)}
          />
        )}

        {activeView === 'new-sale' && (
          <NewSaleView
            products={store.products}
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            preselectedShopId={preselectedShopId}
            onRequestAddShop={() => setAddShopOpen(true)}
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
            onRequestAddShop={() => setAddShopOpen(true)}
            onStartNewSale={openNewSale}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
          />
        )}

        {activeView === 'products' && (
          <ProductsView
            products={store.products}
            onEditProduct={(product) => setProductModalState({ open: true, editing: product })}
            onAddProduct={() => setProductModalState({ open: true, editing: null })}
            onOpenProductSheet={() => setSheetImageOpen(true)}
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

      {/* Mobile Bottom Navigation (44px+ Android touch targets, under 15% height cap) */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex min-h-[60px] pb-safe items-center justify-around border-t border-slate-200 bg-white md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id !== 'new-sale') setPreselectedShopId(undefined);
                setActiveView(item.id);
              }}
              className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${
                active ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <AddShopModal
        open={addShopOpen}
        onClose={() => setAddShopOpen(false)}
        onSave={(data) => {
          const created = store.addShopkeeper(data);
          setPreselectedShopId(created.id);
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

      <ProductSheetImageModal open={sheetImageOpen} onClose={() => setSheetImageOpen(false)} />

      <ProductFormModal
        open={productModalState.open}
        editingProduct={productModalState.editing}
        onClose={() => setProductModalState({ open: false, editing: null })}
        onSaveNew={(data) => store.addProduct(data)}
        onUpdatePrice={(id, price, packInfo) => store.updateProductPrice(id, price, packInfo)}
      />

      <UpdateCenterModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        installedVersion={updater.installedVersion}
        installedCode={updater.installedCode}
        packageName={updater.packageName}
        githubRepo={updater.githubRepo}
        onChangeGithubRepo={updater.setGithubRepo}
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
