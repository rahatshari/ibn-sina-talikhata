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
        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#CBEAD6] px-4 py-2 text-sm font-bold text-[#002114] transition-colors hover:bg-[#B4DFC4] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" />
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
          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#ECF3ED] px-4 py-2 text-sm font-semibold text-[#171D19] hover:bg-[#D7E7DC] whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          আইফোনে সেভ করুন
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#171D19]/50 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label="আইফোনে অ্যাপ ইনস্টল"
          >
            <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-[#171D19]">iPhone / iPad-এ ইনস্টল</h3>
              <p className="mt-2.5 text-[15px] text-[#404943] leading-relaxed">
                ১. Safari-এর নিচে থাকা <strong>Share</strong> বাটনে ট্যাপ করুন।
                <br />
                ২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[46px] rounded-full bg-[#006B47] py-2.5 text-[15px] font-bold text-white hover:bg-[#005739]"
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
