import { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Download,
  FolderDown,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { DownloadTask, ReleaseInfo } from '../hooks/useAppUpdater';
import { formatDateTimeBn } from '../utils/ledger';
import { compareVersions, formatBytes, parseReleaseChangelog } from '../utils/updater';
import { ModalShell } from './Modals';

interface UpdateCenterModalProps {
  open: boolean;
  onClose: () => void;
  installedVersion: string;
  installedCode: number;
  packageName: string;
  autoUpdateEnabled: boolean;
  onToggleAutoUpdate: (enabled: boolean) => void;
  isNativeApp: boolean;
  isOnline: boolean;
  checking: boolean;
  checkError: string | null;
  lastCheckedAt: string | null;
  latestRelease: ReleaseInfo | null;
  updateAvailable: boolean;
  downloads: DownloadTask[];
  onCheckNow: () => void;
  onStartDownload: (release: ReleaseInfo) => void;
  onInstallTask: (task: DownloadTask) => void;
  onOpenInstallPermission: () => void;
  onClearHistory: () => void;
}

export function UpdateCenterModal({
  open,
  onClose,
  installedVersion,
  installedCode,
  packageName,
  autoUpdateEnabled,
  onToggleAutoUpdate,
  isNativeApp,
  isOnline,
  checking,
  checkError,
  lastCheckedAt,
  latestRelease,
  updateAvailable,
  downloads,
  onCheckNow,
  onStartDownload,
  onInstallTask,
  onOpenInstallPermission,
  onClearHistory,
}: UpdateCenterModalProps) {
  const activeDownload = downloads.find((d) => d.status === 'downloading');
  const checkNowRef = useRef(onCheckNow);
  checkNowRef.current = onCheckNow;

  useEffect(() => {
    if (open && isOnline) {
      checkNowRef.current();
    }
  }, [open, isOnline]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="ডাউনলোড ম্যানেজার ও অ্যাপ আপডেট"
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-5">
        {/* Current App Build Info */}
        <div className="rounded-3xl bg-[#ECF3ED] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#006B47] text-white shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold text-[#171D19]">
                  ব্যক্তিগত টালিখাতা · v{installedVersion}
                </div>
                <div className="text-xs sm:text-sm font-mono-num text-[#404943]">
                  Build {installedCode} · {packageName}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={checking || !isOnline}
              onClick={onCheckNow}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#171D19] ring-1 ring-[#DCE7DF] hover:bg-[#CBEAD6] disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'চেক হচ্ছে...' : 'আপডেট চেক করুন'}
            </button>
          </div>
          {lastCheckedAt && (
            <div className="mt-2.5 text-xs text-[#404943]">
              সর্বশেষ চেক: {formatDateTimeBn(lastCheckedAt)}
            </div>
          )}

          {/* Auto-Update Check Switch */}
          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#DCE7DF] pt-3.5">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#171D19]">
                অটোমেটিক আপডেট খোঁজ
              </div>
              <div className="text-xs text-[#404943]">
                {autoUpdateEnabled
                  ? 'চালু আছে — নতুন ভার্সন এলে নিজে থেকেই খুঁজবে ও জানাবে'
                  : 'বন্ধ আছে — শুধু "আপডেট চেক করুন" চাপলে খুঁজবে'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoUpdateEnabled}
              aria-label="অটোমেটিক আপডেট খোঁজ চালু বা বন্ধ করুন"
              onClick={() => onToggleAutoUpdate(!autoUpdateEnabled)}
              className="inline-flex min-h-[44px] items-center gap-2 shrink-0 px-1"
            >
              <span
                className={`text-xs font-bold ${
                  autoUpdateEnabled ? 'text-[#006B47]' : 'text-[#404943]'
                }`}
              >
                {autoUpdateEnabled ? 'চালু' : 'বন্ধ'}
              </span>
              <span
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  autoUpdateEnabled ? 'bg-[#006B47]' : 'bg-[#C3D2C8]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                    autoUpdateEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {checkError && (
          <div className="rounded-2xl bg-[#FFF3E0] px-4 py-3 text-sm font-medium text-[#7A4100]">
            {checkError}
          </div>
        )}

        {/* Release Status Card */}
        {latestRelease && (
          <div
            className={`rounded-3xl p-4 sm:p-5 space-y-3 ${
              updateAvailable
                ? 'bg-[#CBEAD6]/75'
                : 'bg-[#F5FAF6] ring-1 ring-[#DCE7DF]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-[#171D19]">
                  {updateAvailable ? (
                    <Download className="h-5 w-5 text-[#006B47]" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-[#006B47]" />
                  )}
                  <span>
                    {updateAvailable
                      ? `নতুন ভার্সন পাওয়া গেছে: v${latestRelease.version}`
                      : `আপনি সর্বশেষ ভার্সন ব্যবহার করছেন (v${latestRelease.version})`}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-[#404943]">
                  {latestRelease.apkAsset
                    ? `${latestRelease.apkAsset.name} · ${formatBytes(latestRelease.apkAsset.size)}`
                    : 'এই রিলিজে কোনো APK ফাইল পাওয়া যায়নি'}
                </div>
              </div>
            </div>

            {(() => {
              const items = parseReleaseChangelog(latestRelease.releaseNotes);
              if (items.length === 0) return null;
              return (
                <div className="max-h-40 overflow-y-auto rounded-2xl bg-white px-4 py-3">
                  <div className="mb-1.5 text-xs font-bold text-[#404943]">
                    এই আপডেটে পরিবর্তনসমূহ
                  </div>
                  <ul className="space-y-1.5 text-sm text-[#171D19]">
                    {items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#006B47] shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {latestRelease.apkAsset && updateAvailable && (
              <button
                type="button"
                disabled={Boolean(activeDownload)}
                onClick={() => onStartDownload(latestRelease)}
                className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#006B47] px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#005739] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {activeDownload
                  ? `ডাউনলোড চলছে (${activeDownload.progress}%)...`
                  : `ডাউনলোড ও আপডেট করুন (v${latestRelease.version})`}
              </button>
            )}

            {!updateAvailable && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#CBEAD6]/75 px-4 py-3 text-sm font-semibold text-[#002114]">
                <CheckCircle2 className="h-4 w-4 text-[#006B47] shrink-0" />
                <span>
                  এই ভার্সনটি (v{installedVersion}) ইতোমধ্যে আপনার ফোনে ইনস্টল করা আছে — পুনরায় ডাউনলোডের প্রয়োজন নেই।
                </span>
              </div>
            )}
          </div>
        )}

        {/* Download Manager Queue */}
        <div className="overflow-hidden rounded-3xl bg-[#FFFFFF] ring-1 ring-[#DCE7DF]">
          <div className="flex items-center justify-between border-b border-[#ECF3ED] px-5 py-3.5">
            <div className="flex items-center gap-2 text-base font-bold text-[#171D19]">
              <FolderDown className="h-5 w-5 text-[#006B47]" />
              <span>ডাউনলোড ম্যানেজার ({downloads.length})</span>
            </div>
            {downloads.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-[#404943] hover:bg-[#FFDAD6] hover:text-[#BA1A1A]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                তালিকা মুছুন
              </button>
            )}
          </div>

          {downloads.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#404943]">
              এখনও কোনো APK ডাউনলোড করা হয়নি। ডাউনলোড শেষ হওয়ার সাথে সাথেই স্বয়ংক্রিয়ভাবে ইনস্টলার চালু হবে।
            </div>
          ) : (
            <div className="divide-y divide-[#ECF3ED]">
              {downloads.map((task) => {
                const isAlreadyInstalled = compareVersions(task.version, installedVersion) <= 0;
                return (
                <div key={task.id} className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold text-[#171D19]">
                        {task.fileName}
                      </div>
                      <div className="text-xs font-mono-num text-[#404943]">
                        v{task.version} · {formatBytes(task.downloadedBytes)} /{' '}
                        {formatBytes(task.totalBytes)}
                      </div>
                    </div>
                    <span className="text-xs font-bold font-mono-num text-[#006B47]">
                      {task.status === 'completed'
                        ? isAlreadyInstalled
                          ? 'ইনস্টল করা আছে'
                          : 'সম্পন্ন (অটো ইনস্টলার চালু)'
                        : task.status === 'downloading'
                          ? `${task.progress}%`
                          : task.status === 'permission-required'
                            ? 'অনুমতি প্রয়োজন'
                            : 'ব্যর্থ'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#ECF3ED]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.status === 'failed'
                          ? 'bg-[#BA1A1A]'
                          : task.status === 'completed'
                            ? 'bg-[#006B47]'
                            : 'bg-[#00875A]'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, task.progress))}%` }}
                    />
                  </div>

                  {task.status === 'downloading' && (
                    <p className="text-xs font-medium text-[#006B47]">
                      ডাউনলোড শেষ হলেই অটোমেটিক ইনস্টল পপ-আপ চলে আসবে...
                    </p>
                  )}

                  {task.errorMessage && (
                    <p className="text-sm font-medium text-[#BA1A1A]">{task.errorMessage}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!isAlreadyInstalled && task.status === 'permission-required' && isNativeApp && (
                      <button
                        type="button"
                        onClick={onOpenInstallPermission}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#FFF3E0] px-4 py-1.5 text-sm font-bold text-[#7A4100] hover:bg-[#FFE4B5]"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        ইনস্টল অনুমতি দিন
                      </button>
                    )}

                    {!isAlreadyInstalled &&
                      (task.status === 'completed' || task.status === 'permission-required') &&
                      isNativeApp && (
                        <button
                          type="button"
                          onClick={() => void onInstallTask(task)}
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#006B47] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#005739]"
                        >
                          <Smartphone className="h-4 w-4" />
                          আবার ইনস্টল চালু করুন
                        </button>
                      )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
