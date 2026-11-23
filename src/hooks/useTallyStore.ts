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
  limit,
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
  SessionAccountProfile,
  Shopkeeper,
} from '../types/tally';
import {
  buildEditedPaymentRecord,
  buildEditedSaleRecord,
  calculateInvoiceTotals,
  findLegacyCloudDemoDocsToDelete,
  generateNextInvoiceNo,
  generateNextReceiptNo,
  mergeCatalogProducts,
  roundCurrency,
  stripLegacyDemoData,
} from '../utils/ledger';
import { computeSyncStatus } from '../utils/updater';

const STORAGE_KEY = 'ibn_sina_mr_tally_v1';
const AUTH_PROFILE_KEY = 'ibn_sina_auth_profile_v1';
const AUTH_SIGNED_OUT_KEY = 'ibn_sina_auth_signed_out_v1';
const FALLBACK_QUEUE_PREFIX = 'ibn_sina_fallback_queue_v1_';

type FallbackSyncOp =
  | { kind: 'upsert-shop'; shop: Shopkeeper }
  | { kind: 'upsert-sale'; sale: SaleRecord }
  | { kind: 'update-sale'; sale: SaleRecord }
  | { kind: 'delete-sale'; saleId: string }
  | { kind: 'upsert-payment'; payment: PaymentRecord }
  | { kind: 'update-payment'; payment: PaymentRecord }
  | { kind: 'delete-payment'; paymentId: string }
  | { kind: 'upsert-product'; product: Product }
  | { kind: 'update-product'; productId: string; boxPrice: number; packInfo: string };

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

function loadSavedAuthProfile(): SessionAccountProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage.getItem(AUTH_SIGNED_OUT_KEY) === 'true') {
      return null;
    }
    const raw = window.localStorage.getItem(AUTH_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionAccountProfile>;
    if (!parsed || typeof parsed.uid !== 'string' || !parsed.uid.trim()) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
      photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : null,
    };
  } catch {
    return null;
  }
}

function saveAuthProfile(profile: SessionAccountProfile | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      window.localStorage.removeItem(AUTH_SIGNED_OUT_KEY);
      window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
    } else {
      window.localStorage.setItem(AUTH_SIGNED_OUT_KEY, 'true');
      window.localStorage.removeItem(AUTH_PROFILE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function loadFallbackQueue(uid: string): FallbackSyncOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${FALLBACK_QUEUE_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FallbackSyncOp[]) : [];
  } catch {
    return [];
  }
}

function saveFallbackQueue(uid: string, ops: FallbackSyncOp[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (ops.length === 0) {
      window.localStorage.removeItem(`${FALLBACK_QUEUE_PREFIX}${uid}`);
    } else {
      window.localStorage.setItem(`${FALLBACK_QUEUE_PREFIX}${uid}`, JSON.stringify(ops));
    }
  } catch {
    // Ignore storage quota errors
  }
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
    const cleaned = stripLegacyDemoData({
      shops: Array.isArray(parsed.shops) ? parsed.shops : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    });
    return {
      products:
        Array.isArray(parsed.products) && parsed.products.length > 0
          ? parsed.products
          : INITIAL_IBN_SINA_PRODUCTS,
      shops: cleaned.shops,
      sales: cleaned.sales,
      payments: cleaned.payments,
    };
  } catch {
    return { products: INITIAL_IBN_SINA_PRODUCTS, shops: [], sales: [], payments: [] };
  }
}

function loadLocalState(): StoredTallyState {
  const emptyState: StoredTallyState = {
    products: INITIAL_IBN_SINA_PRODUCTS,
    shops: [],
    sales: [],
    payments: [],
  };

  if (typeof window === 'undefined') {
    return emptyState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }
    const parsed = JSON.parse(raw) as Partial<StoredTallyState>;
    const rawShops = Array.isArray(parsed.shops) ? parsed.shops : [];
    const rawSales = Array.isArray(parsed.sales) ? parsed.sales : [];
    const rawPayments = Array.isArray(parsed.payments) ? parsed.payments : [];
    const cleaned = stripLegacyDemoData({
      shops: rawShops,
      sales: rawSales,
      payments: rawPayments,
    });

    return {
      products: mergeCatalogProducts(parsed.products, INITIAL_IBN_SINA_PRODUCTS),
      shops: cleaned.shops,
      sales: cleaned.sales,
      payments: cleaned.payments,
    };
  } catch {
    return emptyState;
  }
}

export function useTallyStore() {
  const [savedProfile, setSavedProfile] = useState<SessionAccountProfile | null>(() =>
    loadSavedAuthProfile(),
  );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [localState, setLocalState] = useState<StoredTallyState>(() => loadLocalState());
  const [cloudState, setCloudState] = useState<StoredTallyState>(() => {
    const initialProfile = loadSavedAuthProfile();
    return initialProfile
      ? loadCloudMirror(initialProfile.uid)
      : {
          products: INITIAL_IBN_SINA_PRODUCTS,
          shops: [],
          sales: [],
          payments: [],
        };
  });

  const user: SessionAccountProfile | null = useMemo(() => {
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      };
    }
    return savedProfile;
  }, [firebaseUser, savedProfile]);

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
  const explicitSignedOutRef = useRef<boolean>(
    typeof window !== 'undefined' &&
      window.localStorage.getItem(AUTH_SIGNED_OUT_KEY) === 'true',
  );
  const loadedUidRef = useRef<string | null>(savedProfile?.uid ?? null);
  const silentAuthTriedOnlineRef = useRef<boolean>(false);
  const cleaningCloudDemoRef = useRef<boolean>(false);

  if (asyncError) {
    throw asyncError;
  }

  const hasFallbackPending = Boolean(
    user && !firebaseUser && loadFallbackQueue(user.uid).length > 0,
  );
  const hasPendingWrites =
    pendingMap.products ||
    pendingMap.shops ||
    pendingMap.sales ||
    pendingMap.payments ||
    hasFallbackPending;

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

      // Seed initial 55 Ibn Sina products for new cloud account if empty (fetch only 1 doc to verify existence quickly)
      const productsRef = collection(db, 'users', targetUser.uid, 'products');
      const existingProductsSnap = await getDocs(
        query(productsRef, where('ownerId', '==', targetUser.uid), limit(1)),
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

  const flushFallbackQueue = useCallback(async (uid: string) => {
    const queue = loadFallbackQueue(uid);
    if (queue.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const op of queue) {
        if (op.kind === 'upsert-shop') {
          const shopId = sanitizeId(op.shop.id);
          batch.set(doc(db, 'users', uid, 'shops', shopId), {
            ...op.shop,
            id: shopId,
            ownerId: uid,
            serverCreatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'upsert-sale') {
          const saleId = sanitizeId(op.sale.id);
          batch.set(doc(db, 'users', uid, 'sales', saleId), {
            ...op.sale,
            id: saleId,
            ownerId: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'update-sale') {
          const saleId = sanitizeId(op.sale.id);
          batch.update(doc(db, 'users', uid, 'sales', saleId), {
            items: op.sale.items.slice(0, 60),
            totalBoxes: op.sale.totalBoxes,
            grossTotal: op.sale.grossTotal,
            totalDiscount: op.sale.totalDiscount,
            netTotal: op.sale.netTotal,
            paidAmount: op.sale.paidAmount,
            dueAmount: op.sale.dueAmount,
            note: op.sale.note ? clampStr(op.sale.note, 300) : '',
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'delete-sale') {
          batch.delete(doc(db, 'users', uid, 'sales', sanitizeId(op.saleId)));
        } else if (op.kind === 'upsert-payment') {
          const payId = sanitizeId(op.payment.id);
          batch.set(doc(db, 'users', uid, 'payments', payId), {
            ...op.payment,
            id: payId,
            ownerId: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'update-payment') {
          const payId = sanitizeId(op.payment.id);
          batch.update(doc(db, 'users', uid, 'payments', payId), {
            amount: op.payment.amount,
            method: op.payment.method,
            note: op.payment.note ? clampStr(op.payment.note, 300) : '',
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'delete-payment') {
          batch.delete(doc(db, 'users', uid, 'payments', sanitizeId(op.paymentId)));
        } else if (op.kind === 'upsert-product') {
          const prodId = sanitizeId(op.product.id);
          batch.set(doc(db, 'users', uid, 'products', prodId), {
            ...op.product,
            id: prodId,
            ownerId: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.kind === 'update-product') {
          batch.update(doc(db, 'users', uid, 'products', sanitizeId(op.productId)), {
            boxPrice: op.boxPrice,
            packInfo: op.packInfo,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
      saveFallbackQueue(uid, []);
      setJustSyncedNotice(true);
    } catch (err) {
      if (!isOfflineFirestoreError(err)) {
        // Keep queue intact so user never loses offline entries
      }
    }
  }, []);

  // Listen to Firebase Auth state (never drop preserved offline session unless user explicitly signed out)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setAuthReady(true);

      if (nextUser) {
        explicitSignedOutRef.current = false;
        silentAuthTriedOnlineRef.current = false;
        const profile: SessionAccountProfile = {
          uid: nextUser.uid,
          email: nextUser.email,
          displayName: nextUser.displayName,
          photoURL: nextUser.photoURL,
        };
        saveAuthProfile(profile);
        setSavedProfile(profile);
        setFirebaseUser(nextUser);

        if (loadedUidRef.current !== nextUser.uid) {
          loadedUidRef.current = nextUser.uid;
          setCloudState(loadCloudMirror(nextUser.uid));
        }

        // Run profile/catalog bootstrap and fallback flush asynchronously so UI responds immediately
        void bootstrapUserProfileAndCatalog(nextUser).then(() => flushFallbackQueue(nextUser.uid));
      } else {
        setFirebaseUser(null);
        if (explicitSignedOutRef.current) {
          loadedUidRef.current = null;
          setSavedProfile(null);
          setPendingMap({ products: false, shops: false, sales: false, payments: false });
        }
      }
    });

    return () => unsub();
  }, [bootstrapUserProfileAndCatalog, flushFallbackQueue]);

  // If Firebase Auth lost token while offline on Android, silently re-authenticate via Google Play Services once back online
  useEffect(() => {
    if (!isOnline) {
      silentAuthTriedOnlineRef.current = false;
      return;
    }
    if (
      !authReady ||
      firebaseUser ||
      !savedProfile ||
      explicitSignedOutRef.current ||
      silentAuthTriedOnlineRef.current ||
      !isNativeAndroid()
    ) {
      return;
    }

    silentAuthTriedOnlineRef.current = true;
    GoogleAuthBridge.silentSignIn()
      .then((res) => {
        const credential = GoogleAuthProvider.credential(res.idToken);
        return signInWithCredential(auth, credential);
      })
      .catch(() => {
        // User remains cleanly in preserved offline mirror mode without losing data
      });
  }, [authReady, firebaseUser, savedProfile, isOnline]);

  // Attach real-time Firestore listeners (serves IndexedDB cache immediately offline + syncs online)
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    const uid = firebaseUser.uid;

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
              note: typeof data.note === 'string' && data.note.trim() ? data.note : undefined,
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
              note: typeof data.note === 'string' && data.note.trim() ? data.note : undefined,
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
  }, [authReady, firebaseUser]);

  // Automatically remove any legacy pre-seeded demo docs that were previously synced to Firestore
  useEffect(() => {
    if (!firebaseUser || !isOnline || cleaningCloudDemoRef.current) return;
    const toDelete = findLegacyCloudDemoDocsToDelete(cloudState);
    if (
      toDelete.saleIds.length === 0 &&
      toDelete.paymentIds.length === 0 &&
      toDelete.shopIds.length === 0
    ) {
      return;
    }

    cleaningCloudDemoRef.current = true;
    const uid = firebaseUser.uid;
    const batch = writeBatch(db);
    for (const saleId of toDelete.saleIds) {
      batch.delete(doc(db, 'users', uid, 'sales', saleId));
    }
    for (const payId of toDelete.paymentIds) {
      batch.delete(doc(db, 'users', uid, 'payments', payId));
    }
    for (const shopId of toDelete.shopIds) {
      batch.delete(doc(db, 'users', uid, 'shops', shopId));
    }
    batch
      .commit()
      .catch(() => {
        // Ignore offline/transient errors; retry on next snapshot/reconnect
      })
      .finally(() => {
        cleaningCloudDemoRef.current = false;
      });
  }, [firebaseUser, isOnline, cloudState]);

  const activeState = useMemo(() => {
    const base = user ? cloudState : localState;
    const cleaned = stripLegacyDemoData(base);
    if (!cleaned.changed) return base;
    return {
      products: base.products,
      shops: cleaned.shops,
      sales: cleaned.sales,
      payments: cleaned.payments,
    };
  }, [user, cloudState, localState]);

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
      explicitSignedOutRef.current = false;
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
    explicitSignedOutRef.current = true;
    const activeUid = firebaseUser?.uid || savedProfile?.uid;
    if (activeUid) {
      saveFallbackQueue(activeUid, []);
    }
    saveAuthProfile(null);
    setSavedProfile(null);
    setFirebaseUser(null);
    loadedUidRef.current = null;
    if (isNativeAndroid()) {
      await GoogleAuthBridge.signOut().catch(() => {
        // Continue Firebase sign-out
      });
    }
    await signOut(auth).catch(() => {
      // Ignore if already signed out offline
    });
  }, [firebaseUser?.uid, savedProfile?.uid]);

  const appendFallbackOp = useCallback((uid: string, op: FallbackSyncOp) => {
    const existing = loadFallbackQueue(uid);
    if (op.kind === 'update-sale') {
      const upsertIdx = existing.findIndex(
        (item) => item.kind === 'upsert-sale' && item.sale.id === op.sale.id,
      );
      if (upsertIdx !== -1) {
        const next = existing.map((item, idx) =>
          idx === upsertIdx ? ({ kind: 'upsert-sale', sale: op.sale } satisfies FallbackSyncOp) : item,
        );
        saveFallbackQueue(uid, next);
        return;
      }
    }
    if (op.kind === 'update-payment') {
      const upsertIdx = existing.findIndex(
        (item) => item.kind === 'upsert-payment' && item.payment.id === op.payment.id,
      );
      if (upsertIdx !== -1) {
        const next = existing.map((item, idx) =>
          idx === upsertIdx
            ? ({ kind: 'upsert-payment', payment: op.payment } satisfies FallbackSyncOp)
            : item,
        );
        saveFallbackQueue(uid, next);
        return;
      }
    }
    saveFallbackQueue(uid, [...existing, op]);
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

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/shops/${id}`;
        setDoc(doc(db, 'users', firebaseUser.uid, 'shops', id), {
          ...newShop,
          ownerId: firebaseUser.uid,
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
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          shops: [newShop, ...prev.shops],
        }));
        appendFallbackOp(user.uid, { kind: 'upsert-shop', shop: newShop });
      } else {
        setLocalState((prev) => ({
          ...prev,
          shops: [newShop, ...prev.shops],
        }));
      }

      return newShop;
    },
    [firebaseUser, user, appendFallbackOp],
  );

  const updateShopkeeper = useCallback(
    (
      shopId: string,
      input: { shopName: string; ownerName: string; phone: string; area: string },
    ) => {
      const updatedFields = {
        shopName: clampStr(input.shopName, 120),
        ownerName: clampStr(input.ownerName || 'প্রোপ্রাইটর', 100),
        phone: clampStr(input.phone || '', 30),
        area: clampStr(input.area || 'লোকাল মার্কেট', 100),
      };
      if (!updatedFields.shopName) return;

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/shops/${shopId}`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'shops', shopId), {
          ...updatedFields,
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.UPDATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        const target = cloudState.shops.find((s) => s.id === shopId);
        const updatedShop: Shopkeeper | null = target ? { ...target, ...updatedFields } : null;
        setCloudState((prev) => ({
          ...prev,
          shops: prev.shops.map((s) => (s.id === shopId ? { ...s, ...updatedFields } : s)),
          sales: prev.sales.map((sale) =>
            sale.shopId === shopId ? { ...sale, shopName: updatedFields.shopName } : sale,
          ),
          payments: prev.payments.map((pay) =>
            pay.shopId === shopId ? { ...pay, shopName: updatedFields.shopName } : pay,
          ),
        }));
        if (updatedShop) {
          appendFallbackOp(user.uid, { kind: 'upsert-shop', shop: updatedShop });
        }
      } else {
        setLocalState((prev) => ({
          ...prev,
          shops: prev.shops.map((s) => (s.id === shopId ? { ...s, ...updatedFields } : s)),
          sales: prev.sales.map((sale) =>
            sale.shopId === shopId ? { ...sale, shopName: updatedFields.shopName } : sale,
          ),
          payments: prev.payments.map((pay) =>
            pay.shopId === shopId ? { ...pay, shopName: updatedFields.shopName } : pay,
          ),
        }));
      }
    },
    [firebaseUser, user, cloudState.shops, appendFallbackOp],
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

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/sales/${id}`;
        setDoc(doc(db, 'users', firebaseUser.uid, 'sales', id), {
          id: sale.id,
          ownerId: firebaseUser.uid,
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
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.CREATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          sales: [sale, ...prev.sales],
        }));
        appendFallbackOp(user.uid, { kind: 'upsert-sale', sale });
      } else {
        setLocalState((prev) => ({
          ...prev,
          sales: [sale, ...prev.sales],
        }));
      }

      return sale;
    },
    [firebaseUser, user, activeState.shops, activeState.sales, appendFallbackOp],
  );

  const updateSale = useCallback(
    (
      saleId: string,
      input: {
        items: SaleLineItem[];
        paidAmount: number;
        note?: string;
      },
    ): { ok: true; sale: SaleRecord } | { ok: false; error: string } => {
      const existing = activeState.sales.find((s) => s.id === saleId);
      if (!existing) {
        return { ok: false, error: 'বিক্রয়ের তথ্য খুঁজে পাওয়া যায়নি।' };
      }
      const res = buildEditedSaleRecord(existing, input.items, input.paidAmount, input.note);
      if (!res.ok) return res;
      const updated = res.sale;

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/sales/${saleId}`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'sales', saleId), {
          items: updated.items,
          totalBoxes: updated.totalBoxes,
          grossTotal: updated.grossTotal,
          totalDiscount: updated.totalDiscount,
          netTotal: updated.netTotal,
          paidAmount: updated.paidAmount,
          dueAmount: updated.dueAmount,
          note: updated.note ?? '',
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.UPDATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          sales: prev.sales.map((s) => (s.id === saleId ? updated : s)),
        }));
        appendFallbackOp(user.uid, { kind: 'update-sale', sale: updated });
      } else {
        setLocalState((prev) => ({
          ...prev,
          sales: prev.sales.map((s) => (s.id === saleId ? updated : s)),
        }));
      }

      return { ok: true, sale: updated };
    },
    [firebaseUser, user, activeState.sales, appendFallbackOp],
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

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/payments/${id}`;
        setDoc(doc(db, 'users', firebaseUser.uid, 'payments', id), {
          id: payment.id,
          ownerId: firebaseUser.uid,
          receiptNo: payment.receiptNo,
          shopId: payment.shopId,
          shopName: payment.shopName,
          date: payment.date,
          amount: payment.amount,
          method: payment.method,
          ...(trimmedNote ? { note: trimmedNote } : {}),
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
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          payments: [payment, ...prev.payments],
        }));
        appendFallbackOp(user.uid, { kind: 'upsert-payment', payment });
      } else {
        setLocalState((prev) => ({
          ...prev,
          payments: [payment, ...prev.payments],
        }));
      }
    },
    [firebaseUser, user, activeState.shops, activeState.payments, appendFallbackOp],
  );

  const updatePayment = useCallback(
    (
      paymentId: string,
      input: {
        amount: number;
        method: PaymentRecord['method'];
        note?: string;
      },
    ): { ok: true; payment: PaymentRecord } | { ok: false; error: string } => {
      const existing = activeState.payments.find((p) => p.id === paymentId);
      if (!existing) {
        return { ok: false, error: 'আদায়ের রসিদ খুঁজে পাওয়া যায়নি।' };
      }
      const res = buildEditedPaymentRecord(existing, input.amount, input.method, input.note);
      if (!res.ok) return res;
      const updated = res.payment;

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/payments/${paymentId}`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'payments', paymentId), {
          amount: updated.amount,
          method: updated.method,
          note: updated.note ?? '',
          updatedAt: serverTimestamp(),
        }).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.UPDATE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          payments: prev.payments.map((p) => (p.id === paymentId ? updated : p)),
        }));
        appendFallbackOp(user.uid, { kind: 'update-payment', payment: updated });
      } else {
        setLocalState((prev) => ({
          ...prev,
          payments: prev.payments.map((p) => (p.id === paymentId ? updated : p)),
        }));
      }

      return { ok: true, payment: updated };
    },
    [firebaseUser, user, activeState.payments, appendFallbackOp],
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/sales/${saleId}`;
        deleteDoc(doc(db, 'users', firebaseUser.uid, 'sales', saleId)).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.DELETE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          sales: prev.sales.filter((s) => s.id !== saleId),
        }));
        appendFallbackOp(user.uid, { kind: 'delete-sale', saleId });
      } else {
        setLocalState((prev) => ({
          ...prev,
          sales: prev.sales.filter((s) => s.id !== saleId),
        }));
      }
    },
    [firebaseUser, user, appendFallbackOp],
  );

  const deletePayment = useCallback(
    (paymentId: string) => {
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/payments/${paymentId}`;
        deleteDoc(doc(db, 'users', firebaseUser.uid, 'payments', paymentId)).catch((err) => {
          if (isOfflineFirestoreError(err)) return;
          try {
            handleFirestoreError(err, OperationType.DELETE, path);
          } catch (wrapped) {
            setAsyncError(wrapped as Error);
          }
        });
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          payments: prev.payments.filter((p) => p.id !== paymentId),
        }));
        appendFallbackOp(user.uid, { kind: 'delete-payment', paymentId });
      } else {
        setLocalState((prev) => ({
          ...prev,
          payments: prev.payments.filter((p) => p.id !== paymentId),
        }));
      }
    },
    [firebaseUser, user, appendFallbackOp],
  );

  const updateProductPrice = useCallback(
    (productId: string, boxPrice: number, packInfo?: string) => {
      const safePrice = roundCurrency(Math.max(0, Math.min(1000000, boxPrice)));
      if (firebaseUser) {
        const existing = cloudState.products.find((p) => p.id === productId);
        const path = `users/${firebaseUser.uid}/products/${productId}`;
        updateDoc(doc(db, 'users', firebaseUser.uid, 'products', productId), {
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
      } else if (user) {
        const existing = cloudState.products.find((p) => p.id === productId);
        const nextPack = clampStr(
          packInfo !== undefined ? packInfo || existing?.packInfo || '1 Box' : existing?.packInfo || '1 Box',
          60,
        );
        setCloudState((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId
              ? { ...p, boxPrice: safePrice, packInfo: nextPack }
              : p,
          ),
        }));
        appendFallbackOp(user.uid, {
          kind: 'update-product',
          productId,
          boxPrice: safePrice,
          packInfo: nextPack,
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
    [firebaseUser, user, cloudState.products, appendFallbackOp],
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

      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}/products/${id}`;
        setDoc(doc(db, 'users', firebaseUser.uid, 'products', id), {
          ...newProduct,
          ownerId: firebaseUser.uid,
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
      } else if (user) {
        setCloudState((prev) => ({
          ...prev,
          products: [newProduct, ...prev.products],
        }));
        appendFallbackOp(user.uid, { kind: 'upsert-product', product: newProduct });
      } else {
        setLocalState((prev) => ({
          ...prev,
          products: [newProduct, ...prev.products],
        }));
      }

      return newProduct;
    },
    [firebaseUser, user, appendFallbackOp],
  );

  const syncLocalToCloud = useCallback(async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
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
          updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
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
  }, [firebaseUser, localState]);

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

  const hasLocalData =
    localState.shops.length > 0 ||
    localState.sales.length > 0 ||
    localState.payments.length > 0;

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
    hasLocalData,
    signInWithGoogle,
    signOutUser,
    syncLocalToCloud,
    products: activeState.products,
    shops: activeState.shops,
    sales: activeState.sales,
    payments: activeState.payments,
    addShopkeeper,
    updateShopkeeper,
    recordSale,
    updateSale,
    recordPayment,
    updatePayment,
    deleteSale,
    deletePayment,
    updateProductPrice,
    addProduct,
    importBackupData,
  };
}
