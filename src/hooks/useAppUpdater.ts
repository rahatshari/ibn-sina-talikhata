import { useCallback, useEffect, useRef, useState } from 'react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import {
  APP_PACKAGE_ID,
  APP_VERSION,
  APP_VERSION_CODE,
  DEFAULT_GITHUB_REPO,
} from '../version';
import {
  extractVersionCodeFromBody,
  isNewerReleaseAvailable,
  normalizeVersionString,
  pickBestApkAsset,
  type GitHubReleaseAsset,
  type GitHubReleasePayload,
} from '../utils/updater';

const GITHUB_REPO_STORAGE_KEY = 'ibn_sina_github_repo_v1';
const LAST_NOTIFIED_TAG_KEY = 'ibn_sina_notified_tag_v1';
const DOWNLOAD_HISTORY_KEY = 'ibn_sina_download_history_v1';

export interface ReleaseInfo {
  version: string;
  tagName: string;
  versionCode: number | null;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  apkAsset: GitHubReleaseAsset | null;
}

export type DownloadStatus =
  | 'idle'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'permission-required';

export interface DownloadTask {
  id: string;
  fileName: string;
  version: string;
  url: string;
  totalBytes: number;
  downloadedBytes: number;
  progress: number;
  status: DownloadStatus;
  nativeDownloadId?: number;
  errorMessage?: string;
  updatedAt: string;
}

function loadSavedRepo(): string {
  if (typeof window === 'undefined') return DEFAULT_GITHUB_REPO;
  try {
    const saved = window.localStorage.getItem(GITHUB_REPO_STORAGE_KEY)?.trim();
    return saved || DEFAULT_GITHUB_REPO;
  } catch {
    return DEFAULT_GITHUB_REPO;
  }
}

function loadDownloadHistory(): DownloadTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DOWNLOAD_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DownloadTask[]) : [];
  } catch {
    return [];
  }
}

export function useAppUpdater(isOnline: boolean) {
  const [installedVersion, setInstalledVersion] = useState(APP_VERSION);
  const [installedCode, setInstalledCode] = useState(APP_VERSION_CODE);
  const [packageName, setPackageName] = useState(APP_PACKAGE_ID);
  const [githubRepo, setGithubRepoState] = useState<string>(() => loadSavedRepo());

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [downloads, setDownloads] = useState<DownloadTask[]>(() => loadDownloadHistory());
  const activeTaskIdRef = useRef<string | null>(null);
  const nativePollRef = useRef<number | null>(null);

  // Persist download manager history
  useEffect(() => {
    try {
      window.localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(downloads.slice(0, 10)));
    } catch {
      // Ignore storage errors
    }
  }, [downloads]);

  // Read native Android BuildConfig version & repo when running inside APK
  useEffect(() => {
    if (!isNativeAndroid()) return;
    AppUpdater.getAppInfo()
      .then((info) => {
        if (info.versionName) setInstalledVersion(info.versionName);
        if (info.versionCode) setInstalledCode(info.versionCode);
        if (info.packageName) setPackageName(info.packageName);
        if (info.githubRepo) {
          setGithubRepoState((prev) => prev || info.githubRepo);
        }
      })
      .catch(() => {
        // Fallback to Vite env constants
      });
  }, []);

  const setGithubRepo = useCallback((nextRepo: string) => {
    const cleaned = nextRepo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
    setGithubRepoState(cleaned);
    try {
      window.localStorage.setItem(GITHUB_REPO_STORAGE_KEY, cleaned);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const updateTask = useCallback((taskId: string, patch: Partial<DownloadTask>) => {
    setDownloads((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
  }, []);

  const checkForUpdates = useCallback(
    async (options?: { silent?: boolean }) => {
      const repo = githubRepo.trim();
      if (!repo) {
        if (!options?.silent) {
          setCheckError(
            'গিটহাব রিপোজিটরি (যেমন: username/ibn-sina-tally) সেট করা নেই। রিলিজ চেক করতে রিপোর নাম লিখুন।',
          );
        }
        return;
      }
      if (!navigator.onLine) {
        if (!options?.silent) {
          setCheckError('আপডেট চেক করার জন্য ইন্টারনেট সংযোগ প্রয়োজন।');
        }
        return;
      }

      setChecking(true);
      setCheckError(null);
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (response.status === 404) {
          setLatestRelease(null);
          setUpdateAvailable(false);
          if (!options?.silent) {
            setCheckError('এই রিপোজিটরিতে এখনো কোনো GitHub Release তৈরি হয়নি।');
          }
          return;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as GitHubReleasePayload;
        const apkAsset = pickBestApkAsset(payload.assets);
        const releaseInfo: ReleaseInfo = {
          version: normalizeVersionString(payload.tag_name),
          tagName: payload.tag_name,
          versionCode: extractVersionCodeFromBody(payload.body),
          releaseNotes: payload.body || 'নতুন বাগ ফিক্স এবং পারফরম্যান্স উন্নতি।',
          publishedAt: payload.published_at || new Date().toISOString(),
          htmlUrl: payload.html_url || `https://github.com/${repo}/releases`,
          apkAsset,
        };

        setLatestRelease(releaseInfo);
        setLastCheckedAt(new Date().toISOString());

        const hasUpdate = isNewerReleaseAvailable(
          installedVersion,
          installedCode,
          payload.tag_name,
          payload.body,
        );
        setUpdateAvailable(hasUpdate);

        if (hasUpdate && isNativeAndroid()) {
          try {
            const lastNotified = window.localStorage.getItem(LAST_NOTIFIED_TAG_KEY);
            if (lastNotified !== payload.tag_name) {
              await AppUpdater.showUpdateNotification({
                title: `নতুন আপডেট v${releaseInfo.version} পাওয়া গেছে`,
                body: 'ইবনে সিনা টালিখাতা অ্যাপের নতুন ভার্সন ডাউনলোড ও আপডেট করতে ট্যাপ করুন।',
                version: releaseInfo.version,
              });
              window.localStorage.setItem(LAST_NOTIFIED_TAG_KEY, payload.tag_name);
            }
          } catch {
            // Notification permission may not be granted yet
          }
        }
      } catch {
        if (!options?.silent) {
          setCheckError('গিটহাব থেকে আপডেট তথ্য আনা যায়নি। একটু পর আবার চেষ্টা করুন।');
        }
      } finally {
        setChecking(false);
      }
    },
    [githubRepo, installedVersion, installedCode],
  );

  // Automatically check for updates once on startup when online and repo is configured
  useEffect(() => {
    if (!isOnline || !githubRepo) return;
    const timer = window.setTimeout(() => {
      void checkForUpdates({ silent: true });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [isOnline, githubRepo, checkForUpdates]);

  const stopNativePolling = useCallback(() => {
    if (nativePollRef.current !== null) {
      window.clearInterval(nativePollRef.current);
      nativePollRef.current = null;
    }
  }, []);

  // Listen to native DownloadManager progress events
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let removeListener: (() => void) | null = null;

    AppUpdater.addListener('downloadProgress', (data) => {
      const taskId = activeTaskIdRef.current;
      if (!taskId) return;
      if (data.status === 'successful') {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          downloadedBytes: data.totalBytes || data.downloadedBytes,
          totalBytes: data.totalBytes,
        });
        stopNativePolling();
      } else if (data.status === 'failed') {
        updateTask(taskId, {
          status: 'failed',
          errorMessage: data.reason || 'APK ডাউনলোড ব্যর্থ হয়েছে।',
        });
        stopNativePolling();
      } else {
        updateTask(taskId, {
          status: 'downloading',
          progress: data.progress,
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes,
        });
      }
    })
      .then((handle) => {
        removeListener = () => {
          void handle.remove();
        };
      })
      .catch(() => {
        // Ignore if native listener unavailable
      });

    return () => {
      stopNativePolling();
      removeListener?.();
    };
  }, [updateTask, stopNativePolling]);

  const installDownloadedTask = useCallback(
    async (task: DownloadTask) => {
      if (!isNativeAndroid() || task.nativeDownloadId === undefined) return;
      try {
        const res = await AppUpdater.installApk({ downloadId: task.nativeDownloadId });
        if (res.needsPermission) {
          updateTask(task.id, {
            status: 'permission-required',
            errorMessage:
              'অ্যাপ আপডেট ইনস্টল করতে Android সেটিংস থেকে "Install unknown apps" অনুমতি দিন।',
          });
        }
      } catch {
        updateTask(task.id, {
          status: 'failed',
          errorMessage: 'APK ইনস্টলার চালু করা যায়নি। ডাউনলোড ফোল্ডার থেকে ইনস্টল করুন।',
        });
      }
    },
    [updateTask],
  );

  const startApkDownload = useCallback(
    async (release: ReleaseInfo) => {
      const asset = release.apkAsset;
      if (!asset) return;

      const taskId = `dl-${Date.now()}`;
      const newTask: DownloadTask = {
        id: taskId,
        fileName: asset.name,
        version: release.version,
        url: asset.browser_download_url,
        totalBytes: asset.size,
        downloadedBytes: 0,
        progress: 0,
        status: 'downloading',
        updatedAt: new Date().toISOString(),
      };

      activeTaskIdRef.current = taskId;
      setDownloads((prev) => [newTask, ...prev.slice(0, 9)]);

      if (isNativeAndroid()) {
        try {
          const { downloadId } = await AppUpdater.startApkDownload({
            url: asset.browser_download_url,
            fileName: asset.name,
            title: `ইবনে সিনা টালিখাতা v${release.version}`,
            version: release.version,
          });
          updateTask(taskId, { nativeDownloadId: downloadId });

          stopNativePolling();
          nativePollRef.current = window.setInterval(async () => {
            try {
              const st = await AppUpdater.getDownloadStatus({ downloadId });
              if (st.status === 'successful') {
                stopNativePolling();
                const completedTask: DownloadTask = {
                  ...newTask,
                  nativeDownloadId: downloadId,
                  status: 'completed',
                  progress: 100,
                  downloadedBytes: st.totalBytes || asset.size,
                  totalBytes: st.totalBytes || asset.size,
                };
                updateTask(taskId, completedTask);
                await installDownloadedTask(completedTask);
              } else if (st.status === 'failed') {
                stopNativePolling();
                updateTask(taskId, {
                  status: 'failed',
                  errorMessage: st.reason || 'ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
                });
              } else {
                updateTask(taskId, {
                  status: 'downloading',
                  progress: st.progress,
                  downloadedBytes: st.downloadedBytes,
                  totalBytes: st.totalBytes || asset.size,
                });
              }
            } catch {
              stopNativePolling();
            }
          }, 900);
        } catch {
          updateTask(taskId, {
            status: 'failed',
            errorMessage: 'Android DownloadManager শুরু করা যায়নি।',
          });
        }
      } else {
        // Browser preview fallback: trigger browser file download cleanly
        const anchor = document.createElement('a');
        anchor.href = asset.browser_download_url;
        anchor.download = asset.name;
        anchor.rel = 'noopener noreferrer';
        anchor.click();
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          downloadedBytes: asset.size,
        });
      }
    },
    [updateTask, stopNativePolling, installDownloadedTask],
  );

  const openInstallPermissionSettings = useCallback(async () => {
    if (!isNativeAndroid()) return;
    await AppUpdater.openUnknownSourcesSettings().catch(() => {
      // Ignore on unsupported OS
    });
  }, []);

  const clearDownloadHistory = useCallback(() => {
    setDownloads([]);
  }, []);

  return {
    installedVersion,
    installedCode,
    packageName,
    githubRepo,
    setGithubRepo,
    isNativeApp: isNativeAndroid(),
    checking,
    checkError,
    lastCheckedAt,
    latestRelease,
    updateAvailable,
    downloads,
    checkForUpdates,
    startApkDownload,
    installDownloadedTask,
    openInstallPermissionSettings,
    clearDownloadHistory,
  };
}
