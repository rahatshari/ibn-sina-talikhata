import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  FolderDown,
  Hash,
  LayoutDashboard,
  LogIn,
  LogOut,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Smartphone,
  Store,
  Type,
  UserCircle2,
} from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { DashboardView } from './components/DashboardView';
import { DueCustomersView } from './components/DueCustomersView';
import { EditPaymentModal, EditSaleModal } from './components/EditTransactionModals';
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
import type { PaymentRecord, Product, SaleRecord, Shopkeeper } from './types/tally';
import {
  computeDashboardMetrics,
  formatCount,
  loadKpiPeriodMode,
  saveKpiPeriodMode,
  type KpiPeriodMode,
} from './utils/ledger';
import { NumeralProvider, useNumeralMode } from './utils/NumeralContext';
import type { NumeralMode } from './utils/numberFormat';
import {
  resolveBackNavigation,
  type AppView,
  type LedgerOrigin,
} from './utils/navigation';
import {
  APP_FONT_OPTIONS,
  applyAppFont,
  loadSavedFontId,
  saveAndApplyAppFont,
  type AppFontId,
} from './utils/fontPreferences';
import { parseReleaseChangelog } from './utils/updater';

declare global {
  interface Window {
    __handleAndroidBack?: () => 'handled' | 'exit';
  }
}

export default function App() {
  return (
    <NumeralProvider>
      <AppContent />
    </NumeralProvider>
  );
}

function AppContent() {
  const store = useTallyStore();
  const updater = useAppUpdater(store.isOnline);
  const { numeralMode, setNumeralMode } = useNumeralMode();

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [preselectedShopId, setPreselectedShopId] = useState<string | undefined>(undefined);
  const [selectedLedgerShop, setSelectedLedgerShop] = useState<Shopkeeper | null>(null);
  const [ledgerOrigin, setLedgerOrigin] = useState<LedgerOrigin>('shops');
  const [periodMode, setPeriodMode] = useState<KpiPeriodMode>(() => loadKpiPeriodMode());

  const [shopModalState, setShopModalState] = useState<{
    open: boolean;
    editing: Shopkeeper | null;
  }>({ open: false, editing: null });
  const [collectTarget, setCollectTarget] = useState<{ shop: Shopkeeper; due: number } | null>(null);
  const [detailSale, setDetailSale] = useState<SaleRecord | null>(null);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
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

  const pushViewHistory = (view: AppView, shopId?: string) => {
    if (view === 'dashboard') return;
    if (activeView === 'dashboard') {
      window.history.pushState({ appView: view, shopId: shopId ?? null }, '');
    } else if (shopId && !window.history.state?.shopId) {
      window.history.pushState({ appView: view, shopId }, '');
    } else {
      window.history.replaceState({ appView: view, shopId: shopId ?? null }, '');
    }
  };

  const openNewSale = (shopId?: string) => {
    setPreselectedShopId(shopId);
    pushViewHistory('new-sale');
    setActiveView('new-sale');
  };

  const navItems: Array<{
    id: AppView;
    label: string;
    mobileLabel: string;
    icon: typeof Plus;
  }> = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', mobileLabel: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'new-sale', label: 'নতুন বিক্রি', mobileLabel: 'বিক্রি', icon: Plus },
    { id: 'shops', label: 'দোকানদার', mobileLabel: 'দোকানদার', icon: Store },
    { id: 'products', label: 'প্রোডাক্ট', mobileLabel: 'প্রোডাক্ট', icon: Package },
    { id: 'reports', label: 'রিপোর্ট', mobileLabel: 'রিপোর্ট', icon: BarChart3 },
  ];

  const handleSelectNav = (id: AppView) => {
    if (id === 'dashboard') {
      handleBackToDashboard();
      return;
    }
    if (id !== 'new-sale') setPreselectedShopId(undefined);
    if (id === 'shops') {
      setSelectedLedgerShop(null);
      setLedgerOrigin('shops');
    }
    pushViewHistory(id);
    setActiveView(id);
  };

  const handleOpenShopLedger = (shop: Shopkeeper, origin: LedgerOrigin) => {
    setLedgerOrigin(origin);
    setSelectedLedgerShop(shop);
    pushViewHistory('shops', shop.id);
    setActiveView('shops');
  };

  const handleBackToDashboard = () => {
    setPreselectedShopId(undefined);
    setSelectedLedgerShop(null);
    setLedgerOrigin('shops');
    setActiveView('dashboard');
    if (window.history.state?.appView) {
      window.history.replaceState(null, '');
    }
  };

  const handleSelectPeriodMode = (nextMode: KpiPeriodMode) => {
    setPeriodMode(nextMode);
    saveKpiPeriodMode(nextMode);
  };

  const closeTopMostModal = () => {
    if (editingSale) {
      setEditingSale(null);
    } else if (editingPayment) {
      setEditingPayment(null);
    } else if (detailSale) {
      setDetailSale(null);
    } else if (collectTarget) {
      setCollectTarget(null);
    } else if (shopModalState.open) {
      setShopModalState({ open: false, editing: null });
    } else if (productModalState.open) {
      setProductModalState({ open: false, editing: null });
    } else if (updateModalOpen) {
      setUpdateModalOpen(false);
    } else if (accountModalOpen) {
      setAccountModalOpen(false);
    }
  };

  const backHandlerRef = useRef<() => 'handled' | 'exit'>(() => 'exit');
  backHandlerRef.current = () => {
    // Allow inner overlays (such as searchable Shopkeeper Picker in NewSaleView) to intercept first
    const innerBackEvent = new CustomEvent('talikhata:back', { cancelable: true });
    if (!window.dispatchEvent(innerBackEvent)) {
      return 'handled';
    }

    const hasOpenModal = Boolean(
      editingSale ||
        editingPayment ||
        detailSale ||
        collectTarget ||
        shopModalState.open ||
        productModalState.open ||
        updateModalOpen ||
        accountModalOpen,
    );

    const action = resolveBackNavigation({
      activeView,
      hasLedgerShop: selectedLedgerShop !== null,
      ledgerOrigin,
      hasOpenMenu: menuOpen,
      hasOpenModal,
    });

    switch (action.type) {
      case 'close-menu':
        setMenuOpen(false);
        return 'handled';
      case 'close-modal':
        closeTopMostModal();
        return 'handled';
      case 'close-ledger-to-origin':
        setSelectedLedgerShop(null);
        setActiveView(action.targetView);
        if (action.targetView === 'dashboard') {
          setPreselectedShopId(undefined);
          window.history.replaceState(null, '');
        } else {
          window.history.replaceState({ appView: action.targetView, shopId: null }, '');
        }
        return 'handled';
      case 'back-to-dashboard':
        handleBackToDashboard();
        return 'handled';
      case 'exit':
        return 'exit';
    }
  };

  useEffect(() => {
    window.__handleAndroidBack = () => backHandlerRef.current();
    return () => {
      delete window.__handleAndroidBack;
    };
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const targetView = e.state?.appView as AppView | undefined;
      const targetShopId = e.state?.shopId as string | null | undefined;
      if (!targetView || targetView === 'dashboard') {
        setPreselectedShopId(undefined);
        setSelectedLedgerShop(null);
        setLedgerOrigin('shops');
        setActiveView('dashboard');
      } else {
        if (targetView !== 'shops' || !targetShopId) {
          setSelectedLedgerShop(null);
        }
        setActiveView(targetView);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showUpdateBanner =
    updater.updateAvailable &&
    updater.latestRelease &&
    dismissedUpdateTag !== updater.latestRelease.tagName;

  const userInitial = (store.user?.displayName || store.user?.email || 'M')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F5FAF6] text-[#171D19] pb-24 md:pb-12">
      {/* Material You 3 Top App Bar */}
      <header className="no-print sticky top-0 z-30 border-b border-[#DCE7DF] bg-[#F5FAF6]/95 backdrop-blur-md pt-safe">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Zone 1: Brand Emblem + Title */}
          <div className="flex items-center min-w-0">
            <button
              type="button"
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 sm:gap-2.5 text-left min-w-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-[#006B47]"
            >
              <img
                src="/icon.svg"
                alt=""
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl border border-[#CBEAD6] bg-white p-0.5 shrink-0"
              />
              <span className="font-display text-[15.5px] sm:text-[21px] font-bold tracking-tight text-[#171D19] whitespace-nowrap">
                ব্যক্তিগত টালিখাতা
              </span>
            </button>
          </div>

          {/* Zone 2: Material 3 Desktop Navigation Chips */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="প্রধান নেভিগেশন">
            {navItems.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`rounded-full px-4 py-2 text-[15px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#CBEAD6] text-[#002114]'
                      : 'text-[#404943] hover:bg-[#E2EDE5] hover:text-[#171D19]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary M3 Pill CTA + Compact Backup/Offline Chip + Tonal Account Chip + 3-Dot Overflow Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openNewSale()}
              className="hidden sm:inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#006B47] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#005739] active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>নতুন বিক্রি</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              data-testid="sync-status-text"
              data-sync-state={store.syncStatus.state}
              title={store.syncStatus.detail}
              aria-label={`ব্যাকআপ ও নেটওয়ার্ক অবস্থা: ${store.syncStatus.label}`}
              className={`inline-flex min-h-[36px] sm:min-h-[38px] items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                store.syncStatus.state === 'offline'
                  ? 'bg-[#FFF3E0] text-[#7A4100] ring-1 ring-[#7A4100]/20 hover:bg-[#FFE6BF]'
                  : store.syncStatus.state === 'syncing'
                    ? 'bg-[#E3EEFF] text-[#0D47A1] ring-1 ring-[#0D47A1]/20 hover:bg-[#D2E4FF]'
                    : store.syncStatus.state === 'synced'
                      ? store.justSyncedNotice
                        ? 'bg-[#CBEAD6] text-[#002114] ring-1 ring-[#006B47]/35 shadow-xs hover:bg-[#BAE2C8]'
                        : 'bg-[#E2EDE5] text-[#006B47] hover:bg-[#D4E7DA]'
                      : 'bg-[#ECF3ED] text-[#404943] hover:bg-[#DCE7DF]'
              }`}
            >
              {store.syncStatus.state === 'offline' ? (
                <CloudOff className="h-3.5 w-3.5 shrink-0" />
              ) : store.syncStatus.state === 'syncing' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : store.syncStatus.state === 'synced' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#006B47] shrink-0" />
              ) : (
                <Smartphone className="h-3.5 w-3.5 text-[#404943] shrink-0" />
              )}
              <span>{store.syncStatus.shortLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              aria-label={store.user ? 'অ্যাকাউন্ট প্রোফাইল ও লগআউট' : 'জিমেইল দিয়ে লগইন'}
              className="inline-flex min-h-[38px] min-w-[38px] sm:min-h-[42px] sm:min-w-[42px] items-center justify-center gap-2 rounded-full bg-[#E2EDE5] px-2 sm:px-3 text-sm font-semibold text-[#171D19] transition-colors hover:bg-[#D7E7DC] shrink-0"
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
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#006B47] text-xs font-bold text-white">
                      {userInitial}
                    </span>
                  )}
                  <span className="hidden sm:inline max-w-[96px] truncate">
                    {store.user.displayName?.split(' ')[0] || 'অ্যাকাউন্ট'}
                  </span>
                </>
              ) : (
                <>
                  <UserCircle2 className="h-5 w-5 text-[#006B47] shrink-0" />
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
                className="relative inline-flex h-[38px] w-[38px] sm:h-[42px] sm:w-[42px] items-center justify-center rounded-full bg-[#ECF3ED] text-[#171D19] transition-colors hover:bg-[#D7E7DC] shrink-0"
              >
                <MoreVertical className="h-5 w-5" />
                {updater.updateAvailable && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2 h-2.5 w-2.5 rounded-full bg-[#006B47] ring-2 ring-[#ECF3ED]"
                  />
                )}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="অতিরিক্ত অপশন মেনু"
                  className="absolute right-0 mt-2.5 w-[min(92vw,350px)] max-h-[82vh] overflow-y-auto origin-top-right rounded-[28px] border border-[#DCE7DF] bg-[#FFFFFF] p-2.5 shadow-2xl z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setUpdateModalOpen(true);
                    }}
                    className="flex w-full min-h-[50px] items-center justify-between gap-2.5 rounded-2xl px-4 py-3 text-left text-base font-semibold text-[#171D19] transition-colors hover:bg-[#ECF3ED]"
                  >
                    <span className="flex items-center gap-3 whitespace-nowrap">
                      <FolderDown className="h-5 w-5 text-[#006B47] shrink-0" />
                      <span>ডাউনলোড ও আপডেট</span>
                    </span>
                    {updater.updateAvailable ? (
                      <span className="rounded-full bg-[#CBEAD6] px-2.5 py-0.5 text-xs font-bold text-[#002114] whitespace-nowrap shrink-0">
                        নতুন আপডেট
                      </span>
                    ) : (
                      <span className="text-xs font-mono-num font-medium text-[#404943] whitespace-nowrap shrink-0">
                        v{formatCount(updater.installedVersion, numeralMode)}
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
                    className="flex w-full min-h-[50px] items-center justify-between gap-2.5 rounded-2xl px-4 py-3 text-left text-base font-semibold text-[#171D19] transition-colors hover:bg-[#ECF3ED]"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {store.user ? (
                        <Cloud className="h-5 w-5 text-[#006B47] shrink-0" />
                      ) : (
                        <LogIn className="h-5 w-5 text-[#006B47] shrink-0" />
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
                      handleSelectNav('reports');
                    }}
                    className="flex w-full min-h-[50px] items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-[#171D19] transition-colors hover:bg-[#ECF3ED]"
                  >
                    <BarChart3 className="h-5 w-5 text-[#404943] shrink-0" />
                    <span>ডাটা ব্যাকআপ ও রিপোর্ট</span>
                  </button>

                  <div className="my-2 border-t border-[#DCE7DF]" />
                  <div className="px-3 py-2" data-testid="menu-kpi-period-section">
                    <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[#404943]">
                      <CalendarDays className="h-4 w-4 text-[#006B47]" />
                      <span>ড্যাশবোর্ড হিসাবের ধরন</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        [
                          {
                            id: 'all' as const,
                            label: 'সর্বমোট হিসাব',
                            desc: 'শুরু থেকে মোট বিক্রি ও আদায়',
                          },
                          {
                            id: 'monthly' as const,
                            label: 'মাসিক হিসাব',
                            desc: 'নির্বাচিত মাসের বিক্রি ও আদায়',
                          },
                        ] as const
                      ).map((option) => {
                        const active = periodMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            data-testid={`menu-kpi-mode-${option.id}`}
                            onClick={() => {
                              handleSelectPeriodMode(option.id);
                              setMenuOpen(false);
                            }}
                            className={`flex w-full min-h-[52px] items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-colors ${
                              active
                                ? 'bg-[#CBEAD6] font-bold text-[#002114]'
                                : 'bg-[#F5FAF6] text-[#171D19] hover:bg-[#ECF3ED]'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-[15px] leading-snug">{option.label}</span>
                              <span className="block text-xs font-normal text-[#404943]">
                                {option.desc}
                              </span>
                            </span>
                            {active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#006B47] px-2.5 py-0.5 text-xs font-bold text-white shrink-0">
                                <Check className="h-3.5 w-3.5" />
                                চালু
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-[#707972] shrink-0">
                                বন্ধ
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="my-2 border-t border-[#DCE7DF]" />
                  <div className="px-3 py-2" data-testid="menu-numeral-mode-section">
                    <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[#404943]">
                      <Hash className="h-4 w-4 text-[#006B47]" />
                      <span>সংখ্যার ভাষা</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(
                        [
                          {
                            id: 'en' as NumeralMode,
                            label: 'ইংরেজি সংখ্যা (0, 1, 2)',
                            sample: '৳1,250 · 24 বক্স',
                          },
                          {
                            id: 'bn' as NumeralMode,
                            label: 'বাংলা সংখ্যা (০, ১, ২)',
                            sample: '৳১,২৫০ · ২৪ বক্স',
                          },
                        ] as const
                      ).map((option) => {
                        const active = numeralMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            data-testid={`menu-numeral-mode-${option.id}`}
                            onClick={() => {
                              setNumeralMode(option.id);
                              setMenuOpen(false);
                            }}
                            className={`flex w-full min-h-[48px] items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left transition-colors ${
                              active
                                ? 'bg-[#CBEAD6] font-bold text-[#002114]'
                                : 'bg-[#F5FAF6] text-[#171D19] hover:bg-[#ECF3ED]'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-[15px] leading-snug">{option.label}</span>
                              <span className="block text-xs font-normal font-mono-num text-[#404943]">
                                {option.sample}
                              </span>
                            </span>
                            {active && <Check className="h-4 w-4 text-[#006B47] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="my-2 border-t border-[#DCE7DF]" />
                  <div className="px-3 py-2">
                    <div className="mb-2.5 flex items-center gap-2 text-sm font-bold text-[#404943]">
                      <Type className="h-4 w-4 text-[#006B47]" />
                      <span>লেখার ফন্ট পরিবর্তন</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
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
                            className={`flex w-full min-h-[46px] items-center justify-between rounded-2xl px-3.5 py-2.5 text-[15px] transition-colors ${
                              active
                                ? 'bg-[#CBEAD6] font-bold text-[#002114]'
                                : 'text-[#171D19] hover:bg-[#ECF3ED]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{font.label}</span>
                              <span className="text-xs text-[#404943]">({font.sample})</span>
                            </span>
                            {active && <Check className="h-4 w-4 text-[#006B47] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {store.user && (
                    <>
                      <div className="my-2 border-t border-[#DCE7DF]" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setAccountModalOpen(true);
                        }}
                        className="flex w-full min-h-[50px] items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-[#BA1A1A] transition-colors hover:bg-[#FFDAD6]/60"
                      >
                        <LogOut className="h-5 w-5 shrink-0" />
                        <span>লগআউট</span>
                      </button>
                    </>
                  )}

                  <div className="px-2 pt-1.5">
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
              className="no-print mb-5 rounded-[24px] bg-[#CBEAD6] px-4 py-3.5 text-[#002114]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#006B47] text-white shrink-0">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm sm:text-[15px]">
                    <div className="font-bold">
                      নতুন আপডেট v{formatCount(updater.latestRelease.version, numeralMode)} এসেছে
                    </div>
                    {visibleChanges.length > 0 && (
                      <ul className="space-y-1 text-[13px] sm:text-sm leading-relaxed text-[#002114]/90">
                        {visibleChanges.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#006B47] shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                        {changelogItems.length > visibleChanges.length && (
                          <li className="text-xs font-semibold text-[#006B47]">
                            + আরও {formatCount(changelogItems.length - visibleChanges.length, numeralMode)}টি পরিবর্তন
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setDismissedUpdateTag(updater.latestRelease?.tagName ?? null)}
                    className="min-h-[42px] rounded-full px-4 py-2 text-sm font-semibold text-[#002114] hover:bg-white/50"
                  >
                    পরে
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(true)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#006B47] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005739] whitespace-nowrap"
                  >
                    <Download className="h-4 w-4" />
                    আপডেট করুন
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Auth Error Notice (Offline & Backup statuses are shown compactly beside Account in Header) */}
        {store.authError && (
          <div className="no-print mb-5">
            <p className="rounded-2xl bg-[#FFDAD6] px-4 py-3 text-sm font-medium text-[#410002]" role="alert">
              {store.authError}
            </p>
          </div>
        )}

        {activeView === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            periodMode={periodMode}
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            onStartNewSale={openNewSale}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
            onOpenShopLedger={(shop) => handleOpenShopLedger(shop, 'dashboard')}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
            onOpenAllReports={() => handleSelectNav('reports')}
            onOpenDueList={() => handleSelectNav('due')}
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
              window.history.replaceState(null, '');
            }}
          />
        )}

        {activeView === 'shops' && (
          <ShopkeepersView
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            selectedLedgerShop={selectedLedgerShop}
            onSelectLedgerShop={(shop) => {
              if (shop) {
                handleOpenShopLedger(shop, 'shops');
              } else {
                setSelectedLedgerShop(null);
                setLedgerOrigin('shops');
                window.history.replaceState({ appView: 'shops', shopId: null }, '');
              }
            }}
            onRequestAddShop={() => setShopModalState({ open: true, editing: null })}
            onRequestEditShop={(shop) => setShopModalState({ open: true, editing: shop })}
            onStartNewSale={openNewSale}
            onCollectDue={(shop, due) => setCollectTarget({ shop, due })}
            onOpenSaleDetail={(sale) => setDetailSale(sale)}
            onEditSale={(sale) => setEditingSale(sale)}
            onEditPayment={(payment) => setEditingPayment(payment)}
          />
        )}

        {activeView === 'due' && (
          <DueCustomersView
            shops={store.shops}
            sales={store.sales}
            payments={store.payments}
            onOpenShopLedger={(shop) => handleOpenShopLedger(shop, 'due')}
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
            onEditSale={(sale) => setEditingSale(sale)}
            onEditPayment={(payment) => setEditingPayment(payment)}
            onDeleteSale={store.deleteSale}
            onDeletePayment={store.deletePayment}
            onImportBackup={store.importBackupData}
          />
        )}
      </main>

      {/* Material You 3 Mobile Bottom Navigation Bar with Pill Indicator */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 min-h-[72px] pb-safe items-center border-t border-[#DCE7DF] bg-[#ECF3ED] md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-nav-${item.id}`}
              onClick={() => handleSelectNav(item.id)}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-xs transition-colors ${
                active ? 'font-bold text-[#002114]' : 'font-semibold text-[#404943]'
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-[#CBEAD6] text-[#002114]' : 'bg-transparent text-[#404943]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
              </span>
              <span className="whitespace-nowrap leading-[1.4] py-0.5 text-[11px] sm:text-xs overflow-visible">
                {item.mobileLabel}
              </span>
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

      <InvoiceDetailModal
        sale={detailSale}
        onClose={() => setDetailSale(null)}
        onEditSale={(sale) => setEditingSale(sale)}
      />

      <EditSaleModal
        sale={editingSale}
        products={store.products}
        onClose={() => setEditingSale(null)}
        onSave={(saleId, data) => {
          const res = store.updateSale(saleId, data);
          if (res.ok && detailSale?.id === res.sale.id) {
            setDetailSale(res.sale);
          }
          return res;
        }}
      />

      <EditPaymentModal
        payment={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSave={(paymentId, data) => store.updatePayment(paymentId, data)}
      />

      <ProductFormModal
        open={productModalState.open}
        editingProduct={productModalState.editing}
        onClose={() => setProductModalState({ open: false, editing: null })}
        onSaveNew={(data) => store.addProduct(data)}
        onUpdateProduct={(id, data) => store.updateProduct(id, data)}
        onDeleteProduct={(id) => store.deleteProduct(id)}
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
        hasLocalData={store.hasLocalData}
        onSignInWithGoogle={store.signInWithGoogle}
        onSignOut={store.signOutUser}
        onSyncLocalToCloud={store.syncLocalToCloud}
      />

      <UpdateCenterModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        installedVersion={updater.installedVersion}
        installedCode={updater.installedCode}
        packageName={updater.packageName}
        autoUpdateEnabled={updater.autoUpdateEnabled}
        onToggleAutoUpdate={updater.setAutoUpdateEnabled}
        isNativeApp={updater.isNativeApp}
        isOnline={store.isOnline}
        checking={updater.checking}
        checkError={updater.checkError}
        lastCheckedAt={updater.lastCheckedAt}
        latestRelease={updater.latestRelease}
        updateAvailable={updater.updateAvailable}
        downloads={updater.downloads}
        onCheckNow={() => void updater.checkForUpdates({ force: true })}
        onStartDownload={(release) => void updater.startApkDownload(release)}
        onInstallTask={(task) => void updater.installDownloadedTask(task)}
        onOpenInstallPermission={() => void updater.openInstallPermissionSettings()}
        onClearHistory={updater.clearDownloadHistory}
      />
    </div>
  );
}
