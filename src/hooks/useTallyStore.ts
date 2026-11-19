import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_IBN_SINA_PRODUCTS } from '../data/ibnSinaProducts';
import { SEED_PAYMENTS, SEED_SALES, SEED_SHOPS } from '../data/seedData';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isOfflineFirestoreError,
  OperationType,
} from '../firebase';
import { GoogleAuthBridge, isNativeAndroid } from '../plugins/nativeBridge';
import type {
  PaymentRecord,
  Product,
  ProductTier,
  SaleLineItem,
  SaleRecord,
  Shopkeeper,
} from '../types/tally';
import {
  calculateInvoiceTotals,
  generateNextInvoiceNo,
  generateNextReceiptNo,
  mergeCatalogProducts,
  roundCurrency,
} from '../utils/ledger';
import { computeSyncStatus } from '../utils/updater';

const STORAGE_KEY = 'ibn_sina_mr_tally_v1';

interface StoredTallyState {
  products: Product[];
  shops: Shopkeeper[];
  sales: SaleRecord[];
  payments: PaymentRecord[];
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function clampStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function getCloudMirrorKey(uid: string): string {
  return `${STORAGE_KEY}_cloud_${uid}`;
}

function loadCloudMirror(uid: string): StoredTallyState {
  if (typeof window === 'undefined') {
    return { products: INITIAL_IBN_SINA_PRODUCTS, shops: [], sales: [], payments: [] };
  }
  try {
    const raw = window.localStorage.getItem(getCloudMirrorKey(uid));
    if (!raw) {
      return { products: INITIAL_IBN_SINA_PRODUCTS, shops: [], sales: [], payments: [] };
    }
    const parsed = JSON.parse(raw) as Partial<StoredTallyState>;
    return {
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : INITIAL_IBN_SINA_PRODUCTS,
      shops: Array.isArray(parsed.shops) ? parsed.shops : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    };
  } catch {
    return { products: INITIAL_IBN_SINA_PRODUCTS, shops: [], sales: [], payments: [] };
  }
}

function loadLocalState(): StoredTallyState {
  if (typeof window === 'undefined') {
    return {
      products: INITIAL_IBN_SINA_PRODUCTS,
      shops: SEED_SHOPS,
      sales: SEED_SALES,
      payments: SEED_PAYMENTS,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        products: INITIAL_IBN_SINA_PRODUCTS,
        shops: SEED_SHOPS,
        sales: SEED_SALES,
        payments: SEED_PAYMENTS,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredTallyState>;
    return {
      products: mergeCatalogProducts(parsed.products, INITIAL_IBN_SINA_PRODUCTS),
      shops: Array.isArray(parsed.shops) ? parsed.shops : SEED_SHOPS,
      sales: Array.isArray(parsed.sales) ? parsed.sales : SEED_SALES,
      payments: Array.isArray(parsed.payments) ? parsed.payments : SEED_PAYMENTS,
    };
  } catch {
    return {
      products: INITIAL_IBN_SINA_PRODUCTS,
      shops: SEED_SHOPS,
      sales: SEED_SALES,
      payments: SEED_PAYMENTS,
    };
  }
}

export function useTallyStore() {
  const [localState, setLocalState] = useState<StoredTallyState>(() => loadLocalState());
  const [cloudState, setCloudState] = useState<StoredTallyState>({
    products: INITIAL_IBN_SINA_PRODUCTS,
    shops: [],
    sales: [],
    payments: [],
  });

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [asyncError, setAsyncError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingMap, setPendingMap] = useState({
    products: false,
    shops: false,
    sales: false,
    payments: false,
  });
  const [justSyncedNotice, setJustSyncedNotice] = useState(false);

  const needsBootstrapRef = useRef<User | null>(null);
  const prevPendingRef = useRef(false);

  if (asyncError) {
    throw asyncError;
  }

  const hasPendingWrites =
    pendingMap.products || pendingMap.shops || pendingMap.sales || pendingMap.payments;

  // Track online/offline connectivity and trigger pending write flush notification on reconnect
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (auth.currentUser) {
        waitForPendingWrites(db)
          .then(() => {
            setJustSyncedNotice(true);
          })
          .catch(() => {
            // Firestore keeps retrying automatically in the background
          });
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setJustSyncedNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show brief confirmation when queued offline writes finish uploading
  useEffect(() => {
    if (prevPendingRef.current && !hasPendingWrites && isOnline && user) {
      setJustSyncedNotice(true);
    }
    prevPendingRef.current = hasPendingWrites;
  }, [hasPendingWrites, isOnline, user]);

  useEffect(() => {
    if (!justSyncedNotice) return;
    const timer = window.setTimeout(() => setJustSyncedNotice(false), 4500);
    return () => window.clearTimeout(timer);
  }, [justSyncedNotice]);

  // Persist local guest state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
    } catch {
      // Ignore storage quota errors
    }
  }, [localState]);

  // Persist cloud state mirror for instant offline cold-start
  useEffect(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(getCloudMirrorKey(user.uid), JSON.stringify(cloudState));
    } catch {
      // Ignore storage quota errors
    }
  }, [user, cloudState]);

  const bootstrapUserProfileAndCatalog = useCallback(async (targetUser: User) => {
    const userPath = `users/${targetUser.uid}`;
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const snap = await getDoc(userRef);
      const profilePayload = {
        displayName: clampStr(targetUser.displayName || 'MR User', 100),
        email: clampStr(targetUser.email || '', 160),
        ...(targetUser.photoURL ? { photoURL: clampStr(targetUser.photoURL, 500) } : {}),
        updatedAt: serverTimestamp(),
      };

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: targetUser.uid,
          ...profilePayload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, profilePayload);
      }

      // Seed initial 55 Ibn Sina products for new cloud account if empty
      const productsRef = collection(db, 'users', targetUser.uid, 'products');
      const existingProductsSnap = await getDocs(
        query(productsRef, where('ownerId', '==', targetUser.uid)),
      );
      if (existingProductsSnap.empty) {
        const batch = writeBatch(db);
        for (const prod of INITIAL_IBN_SINA_PRODUCTS) {
          const prodId = sanitizeId(prod.id);
          batch.set(doc(db, 'users', targetUser.uid, 'products', prodId), {
            id: prodId,
            ownerId: targetUser.uid,
            name: clampStr(prod.name, 100),
            tier: prod.tier,
            boxPrice: roundCurrency(prod.boxPrice),
            packInfo: clampStr(prod.packInfo, 60),
            active: prod.active,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
      needsBootstrapRef.current = null;
    } catch (err) {
      if (isOfflineFirestoreError(err) || !navigator.onLine) {
        // Defer profile/catalog bootstrap until device reconnects
        needsBootstrapRef.current = targetUser;
        return;
      }
      try {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  }, []);

  // Retry deferred bootstrap once online
  useEffect(() => {
    if (isOnline && needsBootstrapRef.current) {
      bootstrapUserProfileAndCatalog(needsBootstrapRef.current);
    }
  }, [isOnline, bootstrapUserProfileAndCatalog]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setCloudState(loadCloudMirror(nextUser.uid));
        await bootstrapUserProfileAndCatalog(nextUser);
      } else {
        setPendingMap({ products: false, shops: false, sales: false, payments: false });
      }
    });

    return () => unsub();
  }, [bootstrapUserProfileAndCatalog]);

  // Attach real-time Firestore listeners (serves IndexedDB cache immediately offline + syncs online)
  useEffect(() => {
    if (!authReady || !user) {
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    const uid = user.uid;

    const productsPath = `users/${uid}/products`;
    const shopsPath = `users/${uid}/shops`;
    const salesPath = `users/${uid}/sales`;
    const paymentsPath = `users/${uid}/payments`;

    const unsubProducts = onSnapshot(
      query(collection(db, productsPath), where('ownerId', '==', uid)),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            name: String(data.name || ''),
            tier: data.tier as ProductTier,
            boxPrice: Number(data.boxPrice || 0),
            packInfo: String(data.packInfo || '1 Box'),
            active: Boolean(data.active ?? true),
          } satisfies Product;
        });
        setCloudState((prev) => ({
          ...prev,
          products: list.length > 0 ? list : INITIAL_IBN_SINA_PRODUCTS,
        }));
        setPendingMap((prev) => ({ ...prev, products: snap.metadata.hasPendingWrites }));
        setCloudLoading(false);
      },
      (err) => {
        if (isOfflineFirestoreError(err)) {
          setCloudLoading(false);
          return;
        }
        try {
          handleFirestoreError(err, OperationType.LIST, productsPath);
        } catch (wrapped) {
          setAsyncError(wrapped as Error);
        }
      },
    );

    const unsubShops = onSnapshot(
      query(collection(db, shopsPath), where('ownerId', '==', uid)),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            shopName: String(data.shopName || ''),
            ownerName: String(data.ownerName || ''),
            phone: String(data.phone || ''),
            area: String(data.area || ''),
            createdAt: String(data.createdAt || new Date().toISOString()),
          } satisfies Shopkeeper;
        });
        setCloudState((prev) => ({ ...prev, shops: list }));
        setPendingMap((prev) => ({ ...prev, shops: snap.metadata.hasPendingWrites }));
      },
      (err) => {
        if (isOfflineFirestoreError(err)) return;
        try {
          handleFirestoreError(err, OperationType.LIST, shopsPath);
        } catch (wrapped) {
          setAsyncError(wrapped as Error);
        }
      },
    );

    const unsubSales = onSnapshot(
      query(collection(db, salesPath), where('ownerId', '==', uid)),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              invoiceNo: String(data.invoiceNo || ''),
              shopId: String(data.shopId || ''),
              shopName: String(data.shopName || ''),
              date: String(data.date || ''),
              items: Array.isArray(data.items) ? (data.items as SaleLineItem[]) : [],
              totalBoxes: Number(data.totalBoxes || 0),
              grossTotal: Number(data.grossTotal || 0),
              totalDiscount: Number(data.totalDiscount || 0),
              netTotal: Number(data.netTotal || 0),
              paidAmount: Number(data.paidAmount || 0),
              dueAmount: Number(data.dueAmount || 0),
              note: typeof data.note === 'string' ? data.note : undefined,
            } satisfies SaleRecord;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        setCloudState((prev) => ({ ...prev, sales: list }));
        setPendingMap((prev) => ({ ...prev, sales: snap.metadata.hasPendingWrites }));
      },
      (err) => {
        if (isOfflineFirestoreError(err)) return;
        try {
          handleFirestoreError(err, OperationType.LIST, salesPath);
        } catch (wrapped) {
          setAsyncError(wrapped as Error);
        }
      },
    );

    const unsubPayments = onSnapshot(
      query(collection(db, paymentsPath), where('ownerId', '==', uid)),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              receiptNo: String(data.receiptNo || ''),
              shopId: String(data.shopId || ''),
              shopName: String(data.shopName || ''),
              date: String(data.date || ''),
              amount: Number(data.amount || 0),
              method: (data.method as PaymentRecord['method']) || 'Cash',
              note: typeof data.note === 'string' ? data.note : undefined,
            } satisfies PaymentRecord;
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        setCloudState((prev) => ({ ...prev, payments: list }));
        setPendingMap((prev) => ({ ...prev, payments: snap.metadata.hasPendingWrites }));
      },
      (err) => {
        if (isOfflineFirestoreError(err)) return;
        try {
          handleFirestoreError(err, OperationType.LIST, paymentsPath);
        } catch (wrapped) {
          setAsyncError(wrapped as Error);
        }
      },
    );

    return () => {
      unsubProducts();
      unsubShops();
      unsubSales();
      unsubPayments();
    };
  }, [authReady, user]);

  const activeState = user ? cloudState : localState;

  const syncStatus = useMemo(
    () =>
      computeSyncStatus({
        isOnline,
        isCloudUser: Boolean(user),
        hasPendingWrites,
        cloudLoading,
      }),
    [isOnline, user, hasPendingWrites, cloudLoading],
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!navigator.onLine) {
      setAuthError(
        'এখন ইন্টারনেট নেই। আপনি অফলাইনেই সব বিক্রি ও হিসাব এন্ট্রি করতে পারবেন—পরে নেট পেলে জিমেইল লগইন করে সিঙ্ক করুন।',
      );
      return;
    }
    try {
      if (isNativeAndroid()) {
        const nativeRes = await GoogleAuthBridge.signIn();
        const credential = GoogleAuthProvider.credential(nativeRes.idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'লগইন করা যায়নি।';
      if (msg.includes('popup-closed-by-user') || msg.toLowerCase().includes('cancel')) {
        setAuthError('লগইন বাতিল করা হয়েছে। আবার চেষ্টা করুন।');
      } else {
        setAuthError('গুগল লগইন ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ বা অ্যাকাউন্ট সেটিংস দেখুন।');
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    if (isNativeAndroid()) {
      await GoogleAuthBridge.signOut().catch(() => {
        // Continue Firebase sign-out
      });
    }
    await signOut(auth);
  }, []);

  const addShopkeeper = useCallback(
    (input: { shopName: string; ownerName: string; phone: string; area: string }): Shopkeeper => {
      const id = sanitizeId(`shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const newShop: Shopkeeper = {
        id,
        shopName: clampStr(input.shopName, 120),
        ownerName: clampStr(input.ownerName || 'প্রোপ্রাইটর', 100),
        phone: clampStr(input.phone || '', 30),
        area: clampStr(input.area || 'লোকাল মার্কেট', 100),
        createdAt: new Date().toISOString().slice(0, 40),
      };

      if (user) {
        const path = `users/${user.uid}/shops/${id}`;
        setDoc(doc(db, 'users', user.uid, 'shops', id), {
          ...newShop,
          ownerId: user.uid,
          serverCreatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          shops: [newShop, ...prev.shops],
        }));
      }

      return newShop;
    },
    [user],
  );

  const recordSale = useCallback(
    (input: {
      shopId: string;
      items: SaleLineItem[];
      paidAmount: number;
      note?: string;
      date?: string;
    }): SaleRecord | null => {
      const shop = activeState.shops.find((s) => s.id === input.shopId);
      if (!shop || input.items.length === 0) return null;

      const boundedItems = input.items.slice(0, 60);
      const totals = calculateInvoiceTotals(boundedItems, input.paidAmount);
      const id = sanitizeId(`sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const trimmedNote = input.note ? clampStr(input.note, 300) : '';

      const sale: SaleRecord = {
        id,
        invoiceNo: clampStr(generateNextInvoiceNo(activeState.sales), 40),
        shopId: sanitizeId(shop.id),
        shopName: clampStr(shop.shopName, 120),
        date: clampStr(input.date || new Date().toISOString(), 40),
        items: boundedItems,
        totalBoxes: totals.totalBoxes,
        grossTotal: totals.grossTotal,
        totalDiscount: totals.totalDiscount,
        netTotal: totals.netTotal,
        paidAmount: totals.paidAmount,
        dueAmount: totals.dueAmount,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      };

      if (user) {
        const path = `users/${user.uid}/sales/${id}`;
        setDoc(doc(db, 'users', user.uid, 'sales', id), {
          id: sale.id,
          ownerId: user.uid,
          invoiceNo: sale.invoiceNo,
          shopId: sale.shopId,
          shopName: sale.shopName,
          date: sale.date,
          items: sale.items,
          totalBoxes: sale.totalBoxes,
          grossTotal: sale.grossTotal,
          totalDiscount: sale.totalDiscount,
          netTotal: sale.netTotal,
          paidAmount: sale.paidAmount,
          dueAmount: sale.dueAmount,
          ...(trimmedNote ? { note: trimmedNote } : {}),
          createdAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          sales: [sale, ...prev.sales],
        }));
      }

      return sale;
    },
    [user, activeState.shops, activeState.sales],
  );

  const recordPayment = useCallback(
    (input: {
      shopId: string;
      amount: number;
      method: PaymentRecord['method'];
      note?: string;
      date?: string;
    }) => {
      const safeAmount = roundCurrency(Math.max(0, Math.min(10000000, input.amount)));
      if (safeAmount <= 0) return;

      const shop = activeState.shops.find((s) => s.id === input.shopId);
      if (!shop) return;

      const id = sanitizeId(`pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const trimmedNote = input.note ? clampStr(input.note, 300) : '';

      const payment: PaymentRecord = {
        id,
        receiptNo: clampStr(generateNextReceiptNo(activeState.payments), 40),
        shopId: sanitizeId(shop.id),
        shopName: clampStr(shop.shopName, 120),
        date: clampStr(input.date || new Date().toISOString(), 40),
        amount: safeAmount,
        method: input.method,
        ...(trimmedNote ? { note: trimmedNote } : {}),
      };

      if (user) {
        const path = `users/${user.uid}/payments/${id}`;
        setDoc(doc(db, 'users', user.uid, 'payments', id), {
          id: payment.id,
          ownerId: user.uid,
          receiptNo: payment.receiptNo,
          shopId: payment.shopId,
          shopName: payment.shopName,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          ...(trimmedNote ? { note: trimmedNote } : {}),
          createdAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          payments: [payment, ...prev.payments],
        }));
      }
    },
    [user, activeState.shops, activeState.payments],
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      if (user) {
        const path = `users/${user.uid}/sales/${saleId}`;
        deleteDoc(doc(db, 'users', user.uid, 'sales', saleId)).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.DELETE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          sales: prev.sales.filter((s) => s.id !== saleId),
        }));
      }
    },
    [user],
  );

  const deletePayment = useCallback(
    (paymentId: string) => {
      if (user) {
        const path = `users/${user.uid}/payments/${paymentId}`;
        deleteDoc(doc(db, 'users', user.uid, 'payments', paymentId)).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.DELETE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          payments: prev.payments.filter((p) => p.id !== paymentId),
        }));
      }
    },
    [user],
  );

  const updateProductPrice = useCallback(
    (productId: string, boxPrice: number, packInfo?: string) => {
      const safePrice = roundCurrency(Math.max(0, Math.min(1000000, boxPrice)));
      if (user) {
        const existing = cloudState.products.find((p) => p.id === productId);
        const path = `users/${user.uid}/products/${productId}`;
        updateDoc(doc(db, 'users', user.uid, 'products', productId), {
          boxPrice: safePrice,
          packInfo: clampStr(
            packInfo !== undefined ? packInfo || existing?.packInfo || '1 Box' : existing?.packInfo || '1 Box',
            60,
          ),
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.UPDATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  boxPrice: safePrice,
                  packInfo: packInfo !== undefined ? packInfo.trim() || p.packInfo : p.packInfo,
                }
              : p,
          ),
        }));
      }
    },
    [user, cloudState.products],
  );

  const addProduct = useCallback(
    (input: { name: string; tier: ProductTier; boxPrice: number; packInfo: string }) => {
      const id = sanitizeId(`custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const newProduct: Product = {
        id,
        name: clampStr(input.name, 100),
        tier: input.tier,
        boxPrice: roundCurrency(Math.max(0, Math.min(1000000, input.boxPrice))),
        packInfo: clampStr(input.packInfo || '1 Box', 60),
        active: true,
      };

      if (user) {
        const path = `users/${user.uid}/products/${id}`;
        setDoc(doc(db, 'users', user.uid, 'products', id), {
          ...newProduct,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: [newProduct, ...prev.products],
        }));
      }

      return newProduct;
    },
    [user],
  );

  const syncLocalDemoToCloud = useCallback(async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      const batch = writeBatch(db);
      for (const shop of localState.shops) {
        const shopId = sanitizeId(shop.id);
        batch.set(doc(db, 'users', uid, 'shops', shopId), {
          id: shopId,
          ownerId: uid,
          shopName: clampStr(shop.shopName, 120),
          ownerName: clampStr(shop.ownerName, 100),
          phone: clampStr(shop.phone, 30),
          area: clampStr(shop.area, 100),
          createdAt: clampStr(shop.createdAt, 40),
          serverCreatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const sale of localState.sales) {
        const saleId = sanitizeId(sale.id);
        batch.set(doc(db, 'users', uid, 'sales', saleId), {
          id: saleId,
          ownerId: uid,
          invoiceNo: clampStr(sale.invoiceNo, 40),
          shopId: sanitizeId(sale.shopId),
          shopName: clampStr(sale.shopName, 120),
          date: clampStr(sale.date, 40),
          items: sale.items.slice(0, 60),
          totalBoxes: sale.totalBoxes,
          grossTotal: sale.grossTotal,
          totalDiscount: sale.totalDiscount,
          netTotal: sale.netTotal,
          paidAmount: sale.paidAmount,
          dueAmount: sale.dueAmount,
          ...(sale.note ? { note: clampStr(sale.note, 300) } : {}),
          createdAt: serverTimestamp(),
        });
      }
      for (const pay of localState.payments) {
        const payId = sanitizeId(pay.id);
        batch.set(doc(db, 'users', uid, 'payments', payId), {
          id: payId,
          ownerId: uid,
          receiptNo: clampStr(pay.receiptNo, 40),
          shopId: sanitizeId(pay.shopId),
          shopName: clampStr(pay.shopName, 120),
          date: clampStr(pay.date, 40),
          amount: pay.amount,
          method: pay.method,
          ...(pay.note ? { note: clampStr(pay.note, 300) } : {}),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      if (isOfflineFirestoreError(err)) return;
      try {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      } catch (wrapped) {
        setAsyncError(wrapped as Error);
      }
    }
  }, [user, localState]);

  const importBackupData = useCallback((jsonText: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<StoredTallyState>;
      if (!Array.isArray(parsed.shops) || !Array.isArray(parsed.sales)) {
        return { ok: false, error: 'ফাইলটি সঠিক টালিখাতা ব্যাকআপ ফরম্যাটে নেই।' };
      }
      setLocalState({
        products: mergeCatalogProducts(parsed.products, INITIAL_IBN_SINA_PRODUCTS),
        shops: parsed.shops,
        sales: parsed.sales,
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'JSON ফাইল পড়া যায়নি। অনুগ্রহ করে সঠিক ব্যাকআপ ফাইল দিন।' };
    }
  }, []);

  const resetToDemoData = useCallback(() => {
    setLocalState({
      products: INITIAL_IBN_SINA_PRODUCTS,
      shops: SEED_SHOPS,
      sales: SEED_SALES,
      payments: SEED_PAYMENTS,
    });
  }, []);

  return {
    user,
    authReady,
    cloudLoading,
    authError,
    isCloudMode: Boolean(user),
    isOnline,
    hasPendingWrites,
    justSyncedNotice,
    syncStatus,
    signInWithGoogle,
    signOutUser,
    syncLocalDemoToCloud,
    products: activeState.products,
    shops: activeState.shops,
    sales: activeState.sales,
    payments: activeState.payments,
    addShopkeeper,
    recordSale,
    recordPayment,
    deleteSale,
    deletePayment,
    updateProductPrice,
    addProduct,
    importBackupData,
    resetToDemoData,
  };
}
