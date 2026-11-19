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
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  ইবনে সিনা টালিখাতা · v{installedVersion}
                </div>
                <div className="text-xs font-mono-num text-slate-500">
                  Build {installedCode} · {packageName}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={checking || !isOnline}
              onClick={onCheckNow}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'চেক হচ্ছে...' : 'আপডেট চেক করুন'}
            </button>
          </div>
          {lastCheckedAt && (
            <div className="mt-2.5 text-[11px] text-slate-500">
              সর্বশেষ চেক: {formatDateTimeBn(lastCheckedAt)}
            </div>
          )}

          {/* Auto-Update Check Switch */}
          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900">
                অটোমেটিক আপডেট খোঁজ
              </div>
              <div className="text-[11px] text-slate-500">
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
                className={`text-[11px] font-semibold ${
                  autoUpdateEnabled ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {autoUpdateEnabled ? 'চালু' : 'বন্ধ'}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoUpdateEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoUpdateEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {checkError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            {checkError}
          </div>
        )}

        {/* Release Status Card */}
        {latestRelease && (
          <div
            className={`rounded-xl border p-4 space-y-3 ${
              updateAvailable
                ? 'border-emerald-300 bg-emerald-50/70'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  {updateAvailable ? (
                    <Download className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span>
                    {updateAvailable
                      ? `নতুন ভার্সন পাওয়া গেছে: v${latestRelease.version}`
                      : `আপনি সর্বশেষ ভার্সন ব্যবহার করছেন (v${latestRelease.version})`}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
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
                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-500">
                    এই আপডেটে পরিবর্তনসমূহ
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
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
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {activeDownload
                  ? `ডাউনলোড চলছে (${activeDownload.progress}%)...`
                  : `ডাউনলোড ও আপডেট করুন (v${latestRelease.version})`}
              </button>
            )}

            {!updateAvailable && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  এই ভার্সনটি (v{installedVersion}) ইতোমধ্যে আপনার ফোনে ইনস্টল করা আছে — পুনরায় ডাউনলোডের প্রয়োজন নেই।
                </span>
              </div>
            )}
          </div>
        )}

        {/* Download Manager Queue */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FolderDown className="h-4 w-4 text-emerald-600" />
              <span>ডাউনলোড ম্যানেজার ({downloads.length})</span>
            </div>
            {downloads.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                তালিকা মুছুন
              </button>
            )}
          </div>

          {downloads.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              এখনও কোনো APK ডাউনলোড করা হয়নি। ডাউনলোড শেষ হওয়ার সাথে সাথেই স্বয়ংক্রিয়ভাবে ইনস্টলার চালু হবে।
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {downloads.map((task) => {
                const isAlreadyInstalled = compareVersions(task.version, installedVersion) <= 0;
                return (
                <div key={task.id} className="p-4 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {task.fileName}
                      </div>
                      <div className="text-xs font-mono-num text-slate-500">
                        v{task.version} · {formatBytes(task.downloadedBytes)} /{' '}
                        {formatBytes(task.totalBytes)}
                      </div>
                    </div>
                    <span className="text-xs font-semibold font-mono-num text-slate-700">
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
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'failed'
                          ? 'bg-red-500'
                          : task.status === 'completed'
                            ? 'bg-emerald-600'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, task.progress))}%` }}
                    />
                  </div>

                  {task.status === 'downloading' && (
                    <p className="text-[11px] text-emerald-700">
                      ডাউনলোড শেষ হলেই অটোমেটিক ইনস্টল পপ-আপ চলে আসবে...
                    </p>
                  )}

                  {task.errorMessage && (
                    <p className="text-xs text-red-600">{task.errorMessage}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {!isAlreadyInstalled && task.status === 'permission-required' && isNativeApp && (
                      <button
                        type="button"
                        onClick={onOpenInstallPermission}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ইনস্টল অনুমতি দিন
                      </button>
                    )}

                    {!isAlreadyInstalled &&
                      (task.status === 'completed' || task.status === 'permission-required') &&
                      isNativeApp && (
                        <button
                          type="button"
                          onClick={() => void onInstallTask(task)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
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
