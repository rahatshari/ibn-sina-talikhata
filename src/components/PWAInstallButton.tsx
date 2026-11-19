import { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        হোম স্ক্রিনে যোগ করুন
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          আইফোনে সেভ করুন
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="আইফোনে অ্যাপ ইনস্টল"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="text-base font-semibold text-slate-900">iPhone / iPad-এ ইনস্টল</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                ১. Safari-এর নিচে থাকা <strong>Share</strong> বাটনে ট্যাপ করুন।
                <br />
                ২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[44px] rounded-lg bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
