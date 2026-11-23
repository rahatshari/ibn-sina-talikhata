import { useState } from 'react';
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
import type { SessionAccountProfile } from '../types/tally';
import type { SyncStatusDescriptor } from '../utils/updater';
import { ModalShell } from './Modals';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  user: SessionAccountProfile | null;
  isOnline: boolean;
  syncStatus: SyncStatusDescriptor;
  authError: string | null;
  cloudLoading: boolean;
  shopCount: number;
  hasLocalData: boolean;
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
  hasLocalData,
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
      title={user ? 'আপনার অ্যাকাউন্ট' : 'ব্যক্তিগত টালিখাতা — লগইন'}
      maxWidthClass="max-w-md"
    >
      {user ? (
        <div className="space-y-5">
          {/* Material 3 User Profile Card */}
          <div className="flex items-center gap-4 rounded-3xl bg-[#ECF3ED] p-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                referrerPolicy="no-referrer"
                className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-xs shrink-0"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#006B47] text-xl font-bold text-white shadow-xs shrink-0">
                {initialLetter}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold text-[#171D19]">
                {user.displayName || 'MR অ্যাকাউন্ট'}
              </div>
              <div className="truncate text-sm text-[#404943]">{user.email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold">
                {syncStatus.state === 'offline' ? (
                  <CloudOff className="h-3.5 w-3.5 text-[#9A5B00]" />
                ) : syncStatus.state === 'syncing' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0D47A1]" />
                ) : (
                  <Cloud className="h-3.5 w-3.5 text-[#006B47]" />
                )}
                <span
                  className={
                    syncStatus.state === 'offline'
                      ? 'text-[#9A5B00]'
                      : syncStatus.state === 'syncing'
                        ? 'text-[#0D47A1]'
                        : 'text-[#006B47]'
                  }
                >
                  {syncStatus.label}
                </span>
              </div>
            </div>
          </div>

          {/* Sync Information */}
          <div className="rounded-3xl bg-[#F5FAF6] p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#171D19]">
              <ShieldCheck className="h-5 w-5 text-[#006B47]" />
              <span>অটোমেটিক ক্লাউড ব্যাকআপ ও অফলাইন সিঙ্ক</span>
            </div>
            <p className="text-sm leading-relaxed text-[#404943]">
              {syncStatus.detail} — আপনি ইন্টারনেট ছাড়াই যেকোনো হিসাব লিখতে পারবেন; নেট পেলেই সব তথ্য এই জিমেইলে স্বয়ংক্রিয়ভাবে জমা হবে।
            </p>
          </div>

          {shopCount === 0 && !cloudLoading && hasLocalData && (
            <button
              type="button"
              onClick={() => void onSyncLocalToCloud()}
              className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#CBEAD6] px-5 py-3 text-[15px] font-bold text-[#002114] hover:bg-[#B4DFC4]"
            >
              <UploadCloud className="h-4 w-4" />
              লোকাল হিসাবগুলো ক্লাউডে আনুন
            </button>
          )}

          {authError && (
            <p className="rounded-2xl bg-[#FFDAD6] px-4 py-3 text-sm font-medium text-[#410002]" role="alert">
              {authError}
            </p>
          )}

          {/* Logout Section with Confirmation */}
          <div className="border-t border-[#ECF3ED] pt-4">
            {!confirmLogout ? (
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#FFDAD6]/80 px-5 py-3 text-[15px] font-bold text-[#BA1A1A] transition-colors hover:bg-[#FFDAD6]"
              >
                <LogOut className="h-4 w-4" />
                অ্যাকাউন্ট থেকে লগআউট করুন
              </button>
            ) : (
              <div className="rounded-3xl bg-[#FFDAD6]/75 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#410002]">
                  আপনি কি নিশ্চিতভাবে লগআউট করতে চান? আপনার সকল হিসাব আপনার জিমেইল ক্লাউডে নিরাপদ থাকবে।
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 min-h-[44px] rounded-full bg-white px-4 py-2 text-sm font-bold text-[#171D19] hover:bg-[#ECF3ED]"
                  >
                    থাক, বাতিল করুন
                  </button>
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={() => void handleLogout()}
                    className="flex-1 min-h-[44px] rounded-full bg-[#BA1A1A] px-4 py-2 text-sm font-bold text-white hover:bg-[#93000A] disabled:opacity-60"
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
          {/* App Login Hero Card */}
          <div className="flex flex-col items-center text-center pt-1 pb-2">
            <img
              src="/icon.svg"
              alt="ব্যক্তিগত টালিখাতা"
              className="h-16 w-16 rounded-3xl border border-[#CBEAD6] bg-white p-1 shadow-xs"
            />
            <h3 className="mt-3 text-xl font-bold text-[#171D19]">
              জিমেইল দিয়ে নিরাপদ লগইন
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#404943] max-w-xs">
              একবার লগইন করলে আপনার দোকানদার, বিক্রি ও বাকি হিসাব স্বয়ংক্রিয়ভাবে ক্লাউডে সুরক্ষিত থাকবে।
            </p>
          </div>

          <div className="space-y-3 rounded-3xl bg-[#ECF3ED] p-4 sm:p-5 text-sm text-[#171D19]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#006B47] shrink-0" />
              <span>ইন্টারনেট না থাকলেও অফলাইনে সব এন্ট্রি চালু থাকবে</span>
            </div>
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-[#006B47] shrink-0" />
              <span>নেট সংযোগ পেলেই অটোমেটিক ডাটা আপলোড ও সিঙ্ক</span>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-[#006B47] shrink-0" />
              <span>নতুন ফোনে অ্যাপ নামিয়ে একই জিমেইলে সব হিসাব ফিরে পাবেন</span>
            </div>
          </div>

          {!isOnline && (
            <div className="rounded-2xl bg-[#FFF3E0] px-4 py-3 text-sm font-medium text-[#7A4100]">
              এখন ডিভাইসটি অফলাইনে আছে। আপনি অফলাইনেই কাজ চালিয়ে যেতে পারেন; নেট পেলেই লগইন করুন।
            </div>
          )}

          {authError && (
            <p className="rounded-2xl bg-[#FFDAD6] px-4 py-3 text-sm font-medium text-[#410002]" role="alert">
              {authError}
            </p>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleLogin()}
            className="flex w-full min-h-[52px] items-center justify-center gap-3 rounded-full border border-[#C3D2C8] bg-white px-5 py-3 text-base font-bold text-[#171D19] shadow-xs transition-all hover:bg-[#ECF3ED] active:scale-[0.99] disabled:opacity-70"
          >
            {signingIn ? (
              <RefreshCw className="h-5 w-5 animate-spin text-[#006B47] shrink-0" />
            ) : (
              <GoogleLogoIcon />
            )}
            <span>{signingIn ? 'গুগল অ্যাকাউন্ট লোড হচ্ছে...' : 'Google (Gmail) দিয়ে এগিয়ে যান'}</span>
          </button>
          {signingIn && (
            <p className="text-center text-xs text-[#404943]">
              ফোনের Google Play Services থেকে জিমেইল তালিকা আনতে ২–৪ সেকেন্ড সময় লাগতে পারে।
            </p>
          )}
        </div>
      )}
    </ModalShell>
  );
}
