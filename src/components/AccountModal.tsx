import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UploadCloud,
} from 'lucide-react';
import type { SyncStatusDescriptor } from '../utils/updater';
import { ModalShell } from './Modals';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  isOnline: boolean;
  syncStatus: SyncStatusDescriptor;
  authError: string | null;
  cloudLoading: boolean;
  shopCount: number;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncLocalToCloud: () => Promise<void>;
}

function GoogleLogoIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3.01h3.87c2.26-2.08 3.56-5.15 3.56-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3.01c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function AccountModal({
  open,
  onClose,
  user,
  isOnline,
  syncStatus,
  authError,
  cloudLoading,
  shopCount,
  onSignInWithGoogle,
  onSignOut,
  onSyncLocalToCloud,
}: AccountModalProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      await onSignInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      setConfirmLogout(false);
      onClose();
    } finally {
      setSigningOut(false);
    }
  };

  const handleClose = () => {
    setConfirmLogout(false);
    onClose();
  };

  const initialLetter = (user?.displayName || user?.email || 'M').trim().charAt(0).toUpperCase();

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={user ? 'আপনার অ্যাকাউন্ট' : 'ইবনে সিনা টালিখাতা — লগইন'}
      maxWidthClass="max-w-md"
    >
      {user ? (
        <div className="space-y-5">
          {/* Modern User Profile Card */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-sm shrink-0"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white shadow-sm shrink-0">
                {initialLetter}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold text-slate-900">
                {user.displayName || 'MR অ্যাকাউন্ট'}
              </div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold border border-slate-200">
                {syncStatus.state === 'offline' ? (
                  <CloudOff className="h-3 w-3 text-amber-600" />
                ) : syncStatus.state === 'syncing' ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
                ) : (
                  <Cloud className="h-3 w-3 text-emerald-600" />
                )}
                <span
                  className={
                    syncStatus.state === 'offline'
                      ? 'text-amber-700'
                      : syncStatus.state === 'syncing'
                        ? 'text-blue-700'
                        : 'text-emerald-700'
                  }
                >
                  {syncStatus.label}
                </span>
              </div>
            </div>
          </div>

          {/* Sync Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>অটোমেটিক ক্লাউড ব্যাকআপ ও অফলাইন সিঙ্ক</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {syncStatus.detail} — আপনি ইন্টারনেট ছাড়াই যেকোনো হিসাব লিখতে পারবেন; নেট পেলেই সব তথ্য এই জিমেইলে স্বয়ংক্রিয়ভাবে জমা হবে।
            </p>
          </div>

          {shopCount === 0 && !cloudLoading && (
            <button
              type="button"
              onClick={() => void onSyncLocalToCloud()}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <UploadCloud className="h-4 w-4" />
              লোকাল হিসাবগুলো ক্লাউডে আনুন
            </button>
          )}

          {authError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700" role="alert">
              {authError}
            </p>
          )}

          {/* Modern Logout Section with Confirmation */}
          <div className="border-t border-slate-200 pt-4">
            {!confirmLogout ? (
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <LogOut className="h-4 w-4" />
                অ্যাকাউন্ট থেকে লগআউট করুন
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-3">
                <p className="text-xs font-medium text-red-900">
                  আপনি কি নিশ্চিতভাবে লগআউট করতে চান? আপনার সকল হিসাব আপনার জিমেইল ক্লাউডে নিরাপদ থাকবে।
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    থাক, বাতিল করুন
                  </button>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={() => void handleLogout()}
                    className="flex-1 min-h-[42px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {signingOut ? 'লগআউট হচ্ছে...' : 'হ্যাঁ, লগআউট'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Modern App Login Hero Card */}
          <div className="flex flex-col items-center text-center pt-1 pb-2">
            <img
              src="/icon.svg"
              alt="ইবনে সিনা টালিখাতা"
              className="h-16 w-16 rounded-2xl shadow-sm border border-emerald-100"
            />
            <h3 className="mt-3 text-lg font-bold text-slate-900">
              জিমেইল দিয়ে নিরাপদ লগইন
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 max-w-xs">
              একবার লগইন করলে আপনার দোকানদার, বিক্রি ও বাকি হিসাব স্বয়ংক্রিয়ভাবে ক্লাউডে সুরক্ষিত থাকবে।
            </p>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>ইন্টারনেট না থাকলেও অফলাইনে সব এন্ট্রি চালু থাকবে</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Cloud className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>নেট সংযোগ পেলেই অটোমেটিক ডাটা আপলোড ও সিঙ্ক</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>নতুন ফোনে অ্যাপ নামিয়ে একই জিমেইলে সব হিসাব ফিরে পাবেন</span>
            </div>
          </div>

          {!isOnline && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              এখন ডিভাইসটি অফলাইনে আছে। আপনি অফলাইনেই কাজ চালিয়ে যেতে পারেন; নেট পেলেই লগইন করুন।
            </div>
          )}

          {authError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700" role="alert">
              {authError}
            </p>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleLogin()}
            className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-xs transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
          >
            <GoogleLogoIcon />
            <span>{signingIn ? 'লগইন হচ্ছে...' : 'Google (Gmail) দিয়ে এগিয়ে যান'}</span>
          </button>
        </div>
      )}
    </ModalShell>
  );
}
