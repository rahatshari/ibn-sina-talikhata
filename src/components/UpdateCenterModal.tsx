import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderDown,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { DownloadTask, ReleaseInfo } from '../hooks/useAppUpdater';
import { formatDateTimeBn } from '../utils/ledger';
import { formatBytes } from '../utils/updater';
import { ModalShell } from './Modals';

interface UpdateCenterModalProps {
  open: boolean;
  onClose: () => void;
  installedVersion: string;
  installedCode: number;
  packageName: string;
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
              {latestRelease.htmlUrl && (
                <a
                  href={latestRelease.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Release নোট <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {latestRelease.releaseNotes && (
              <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 whitespace-pre-line">
                {latestRelease.releaseNotes}
              </div>
            )}

            {latestRelease.apkAsset && (
              <button
                type="button"
                disabled={Boolean(activeDownload)}
                onClick={() => onStartDownload(latestRelease)}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {activeDownload
                  ? `ডাউনলোড চলছে (${activeDownload.progress}%)...`
                  : updateAvailable
                    ? `ডাউনলোড ও আপডেট করুন (v${latestRelease.version})`
                    : `পুনরায় APK ডাউনলোড করুন (v${latestRelease.version})`}
              </button>
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
              এখনও কোনো APK ডাউনলোড করা হয়নি। GitHub Release থেকে নতুন আপডেট এলে এখানে ডাউনলোডের অগ্রগতি ও ইনস্টল বাটন দেখাবে।
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {downloads.map((task) => (
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
                        ? 'সম্পন্ন (100%)'
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

                  {task.errorMessage && (
                    <p className="text-xs text-red-600">{task.errorMessage}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {task.status === 'permission-required' && isNativeApp && (
                      <button
                        type="button"
                        onClick={onOpenInstallPermission}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ইনস্টল অনুমতি দিন
                      </button>
                    )}

                    {(task.status === 'completed' || task.status === 'permission-required') &&
                      isNativeApp && (
                        <button
                          type="button"
                          onClick={() => void onInstallTask(task)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          APK ইনস্টল করুন
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          নিরাপদ আপডেট: প্রতিটি GitHub Release APK একই রিলিজ সিগনেচারে (keystore) তৈরি হয়, তাই আগের ডাটা ও লগইন ঠিক রেখেই সরাসরি অ্যাপের ভেতর থেকে আপডেট ইনস্টল হবে।
        </p>
      </div>
    </ModalShell>
  );
}
