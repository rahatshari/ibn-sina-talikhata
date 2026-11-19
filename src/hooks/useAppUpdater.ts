import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppUpdater, isNativeAndroid } from '../plugins/nativeBridge';
import {
  APP_PACKAGE_ID,
  APP_VERSION,
  APP_VERSION_CODE,
  DEFAULT_GITHUB_REPO,
} from '../version';
import {
  AUTO_CHECK_COOLDOWN_MS,
  canDownloadRelease,
  compareVersions,
  extractVersionCodeFromBody,
  formatUpdateNotificationBody,
  isNewerReleaseAvailable,
  loadAutoUpdateEnabled,
  normalizeVersionString,
  parseExpandedAssetsApk,
  parseReleaseAtomLatest,
  pickBestApkAsset,
  saveAutoUpdateEnabled,
  shouldRunAutoCheck,
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

  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState<boolean>(() =>
    loadAutoUpdateEnabled(),
  );
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);

  const [downloads, setDownloads] = useState<DownloadTask[]>(() => loadDownloadHistory());
  const [canInstallPackages, setCanInstallPackages] = useState<boolean>(true);
  const downloadsRef = useRef<DownloadTask[]>(downloads);
  const activeTaskIdRef = useRef<string | null>(null);
  const nativePollRef = useRef<number | null>(null);
  const autoInstalledIdsRef = useRef<Set<number>>(new Set());
  const lastSuccessfulCheckMsRef = useRef<number>(0);
  const inFlightCheckRef = useRef<boolean>(false);
  const installedVersionRef = useRef<string>(installedVersion);
  const installedCodeRef = useRef<number>(installedCode);

  useEffect(() => {
    installedVersionRef.current = installedVersion;
    installedCodeRef.current = installedCode;
  }, [installedVersion, installedCode]);

  const updateAvailable = useMemo(() => {
    if (!latestRelease) return false;
    return isNewerReleaseAvailable(
      installedVersion,
      installedCode,
      latestRelease.tagName,
      latestRelease.releaseNotes,
    );
  }, [latestRelease, installedVersion, installedCode]);

  // Keep downloadsRef synced & persist download manager history
  useEffect(() => {
    downloadsRef.current = downloads;
    try {
      window.localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(downloads.slice(0, 10)));
    } catch {
      // Ignore storage errors
    }
  }, [downloads]);

  // Read native Android BuildConfig version, repo & install permission when running inside APK
  useEffect(() => {
    if (!isNativeAndroid()) return;
    const refreshAppInfo = () => {
      AppUpdater.getAppInfo()
        .then((info) => {
          if (info.versionName) setInstalledVersion(info.versionName);
          if (info.versionCode) setInstalledCode(info.versionCode);
          if (info.packageName) setPackageName(info.packageName);
          if (info.githubRepo && info.githubRepo.includes('/')) {
            setGithubRepoState(info.githubRepo);
            try {
              window.localStorage.setItem(GITHUB_REPO_STORAGE_KEY, info.githubRepo);
            } catch {
              // Ignore storage errors
            }
          }
          if (typeof info.canInstallPackages === 'boolean') {
            setCanInstallPackages(info.canInstallPackages);
          }
        })
        .catch(() => {
          // Fallback to Vite env constants
        });
    };
    refreshAppInfo();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAppInfo();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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

  const setAutoUpdateEnabled = useCallback((enabled: boolean) => {
    setAutoUpdateEnabledState(enabled);
    saveAutoUpdateEnabled(enabled);
    if (enabled) {
      lastSuccessfulCheckMsRef.current = 0;
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
    async (options?: { silent?: boolean; force?: boolean }) => {
      const repo = githubRepo.trim();
      if (!repo) {
        if (!options?.silent) {
          setCheckError(
            'গিটহাব রিপোজিটরি (যেমন: username/ibn-sina-talikhata) সেট করা নেই। রিলিজ চেক করতে রিপোর নাম লিখুন।',
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
      if (inFlightCheckRef.current && !options?.force) {
        return;
      }

      inFlightCheckRef.current = true;
      setChecking(true);
      setCheckError(null);
      try {
        let payload: GitHubReleasePayload | null = null;
        let notFound = false;

        if (isNativeAndroid()) {
          try {
            const nativeRes = await AppUpdater.fetchLatestRelease({ repo });
            if (nativeRes.status === 404) {
              notFound = true;
            } else if (nativeRes.source === 'api' && nativeRes.jsonBody) {
              payload = JSON.parse(nativeRes.jsonBody) as GitHubReleasePayload;
            } else if (nativeRes.source === 'web') {
              const atomParsed = nativeRes.atomXml
                ? parseReleaseAtomLatest(nativeRes.atomXml, nativeRes.tagName || undefined)
                : null;
              const resolvedTag = nativeRes.tagName || atomParsed?.tag_name || '';
              if (resolvedTag) {
                const apk = parseExpandedAssetsApk(
                  nativeRes.assetsHtml || '',
                  resolvedTag,
                  repo,
                );
                payload = {
                  tag_name: resolvedTag,
                  name: atomParsed?.name || resolvedTag,
                  body: atomParsed?.body || '',
                  published_at: atomParsed?.published_at,
                  html_url:
                    atomParsed?.html_url || `https://github.com/${repo}/releases/tag/${resolvedTag}`,
                  assets: apk ? [apk] : [],
                };
              }
            }
          } catch {
            // Fall through to standard uncached WebView fetch below
          }
        }

        if (!payload && !notFound) {
          const response = await fetch(
            `https://api.github.com/repos/${repo}/releases/latest`,
            {
              cache: 'no-store',
              headers: { Accept: 'application/vnd.github+json' },
            },
          );
          if (response.status === 404) {
            notFound = true;
          } else if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          } else {
            payload = (await response.json()) as GitHubReleasePayload;
          }
        }

        if (notFound) {
          setLatestRelease(null);
          lastSuccessfulCheckMsRef.current = Date.now();
          if (!options?.silent) {
            setCheckError('এই রিপোজিটরিতে এখনো কোনো GitHub Release তৈরি হয়নি।');
          }
          return;
        }

        if (!payload) {
          throw new Error('Empty release payload');
        }

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

        lastSuccessfulCheckMsRef.current = Date.now();
        setLatestRelease(releaseInfo);
        setLastCheckedAt(new Date().toISOString());

        const hasUpdate = isNewerReleaseAvailable(
          installedVersionRef.current,
          installedCodeRef.current,
          payload.tag_name,
          payload.body,
        );

        if (hasUpdate && isNativeAndroid()) {
          try {
            const lastNotified = window.localStorage.getItem(LAST_NOTIFIED_TAG_KEY);
            if (lastNotified !== payload.tag_name) {
              await AppUpdater.showUpdateNotification({
                title: `নতুন আপডেট v${releaseInfo.version}`,
                body: formatUpdateNotificationBody(releaseInfo.version, payload.body),
                version: releaseInfo.version,
              });
              window.localStorage.setItem(LAST_NOTIFIED_TAG_KEY, payload.tag_name);
            }
          } catch {
            // Notification permission may not be granted yet
          }
        }
      } catch (err) {
        if (!options?.silent) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('403') || msg.includes('429')) {
            setCheckError(
              'গিটহাব সার্ভার সাময়িকভাবে সীমা পূর্ণ করেছে। কয়েক মিনিট পর আবার চেষ্টা করুন।',
            );
          } else {
            setCheckError('গিটহাব থেকে আপডেট তথ্য আনা যায়নি। একটু পর আবার চেষ্টা করুন।');
          }
        }
      } finally {
        inFlightCheckRef.current = false;
        setChecking(false);
      }
    },
    [githubRepo],
  );

  // Automatically check for updates on startup, Android resume, window focus, and every 10m
  useEffect(() => {
    if (!autoUpdateEnabled || !isOnline || !githubRepo) return;

    const triggerAutoCheck = () => {
      const now = Date.now();
      if (!shouldRunAutoCheck(lastSuccessfulCheckMsRef.current, now, AUTO_CHECK_COOLDOWN_MS)) {
        return;
      }
      void checkForUpdates({ silent: true });
    };

    const startupTimer = window.setTimeout(triggerAutoCheck, 900);
    const intervalId = window.setInterval(triggerAutoCheck, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoCheck();
      }
    };
    const onFocus = () => {
      triggerAutoCheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    let removeResumeListener: (() => void) | null = null;
    if (isNativeAndroid()) {
      AppUpdater.addListener('appResumed', () => {
        triggerAutoCheck();
      })
        .then((handle) => {
          removeResumeListener = () => {
            void handle.remove();
          };
        })
        .catch(() => {
          // Ignore if native listener unavailable
        });
    }

    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      removeResumeListener?.();
    };
  }, [autoUpdateEnabled, isOnline, githubRepo, checkForUpdates]);

  const stopNativePolling = useCallback(() => {
    if (nativePollRef.current !== null) {
      window.clearInterval(nativePollRef.current);
      nativePollRef.current = null;
    }
  }, []);

  const installDownloadedTask = useCallback(
    async (task: DownloadTask, options?: { openSettingsOnDeny?: boolean }) => {
      if (!isNativeAndroid()) return;
      if (compareVersions(task.version, installedVersion) <= 0) return;
      if (task.nativeDownloadId === undefined && !task.fileName) return;
      try {
        const res = await AppUpdater.installApk({
          downloadId: task.nativeDownloadId,
          fileName: task.fileName,
          openSettingsOnDeny: options?.openSettingsOnDeny ?? false,
        });
        if (res.needsPermission) {
          setCanInstallPackages(false);
          updateTask(task.id, {
            status: 'permission-required',
            errorMessage:
              'অটো ইনস্টলের জন্য সেটিংস থেকে "Allow from this source" চালু করে ফিরে এলেই সাথে সাথে ইনস্টলার খুলবে।',
          });
        } else if (res.started) {
          setCanInstallPackages(true);
          updateTask(task.id, {
            status: 'completed',
            errorMessage: undefined,
          });
        }
      } catch {
        updateTask(task.id, {
          status: 'failed',
          errorMessage: 'APK ইনস্টলার চালু করা যায়নি। নিচে থেকে আবার চেষ্টা করুন অথবা নতুন করে ডাউনলোড দিন।',
        });
      }
    },
    [updateTask],
  );

  const triggerAutoInstallOnce = useCallback(
    (task: DownloadTask, downloadId: number) => {
      if (autoInstalledIdsRef.current.has(downloadId)) return;
      autoInstalledIdsRef.current.add(downloadId);
      void installDownloadedTask(
        { ...task, nativeDownloadId: downloadId },
        { openSettingsOnDeny: true },
      );
    },
    [installDownloadedTask],
  );

  // Listen to native DownloadManager progress & resume auto-install events
  useEffect(() => {
    if (!isNativeAndroid()) return;
    let removeProgress: (() => void) | null = null;
    let removeInstallState: (() => void) | null = null;

    AppUpdater.addListener('downloadProgress', (data) => {
      const matched =
        downloadsRef.current.find((d) => d.nativeDownloadId === data.downloadId) ||
        downloadsRef.current.find((d) => d.id === activeTaskIdRef.current);
      const taskId = matched?.id || activeTaskIdRef.current;
      if (!taskId) return;

      if (data.status === 'successful') {
        stopNativePolling();
        const completedPatch: Partial<DownloadTask> = {
          status: 'completed',
          progress: 100,
          downloadedBytes: data.totalBytes || data.downloadedBytes,
          totalBytes: data.totalBytes,
          nativeDownloadId: data.downloadId,
        };
        updateTask(taskId, completedPatch);
        if (matched) {
          triggerAutoInstallOnce(
            { ...matched, ...completedPatch },
            data.downloadId,
          );
        }
      } else if (data.status === 'failed') {
        stopNativePolling();
        updateTask(taskId, {
          status: 'failed',
          errorMessage: data.reason || 'APK ডাউনলোড ব্যর্থ হয়েছে।',
        });
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
        removeProgress = () => {
          void handle.remove();
        };
      })
      .catch(() => {
        // Ignore if native listener unavailable
      });

    AppUpdater.addListener('installStateChanged', (data) => {
      if (data.started) {
        setCanInstallPackages(true);
        setDownloads((prev) =>
          prev.map((item) =>
            item.nativeDownloadId === data.downloadId || item.status === 'permission-required'
              ? { ...item, status: 'completed', errorMessage: undefined }
              : item,
          ),
        );
      }
    })
      .then((handle) => {
        removeInstallState = () => {
          void handle.remove();
        };
      })
      .catch(() => {
        // Ignore if native listener unavailable
      });

    return () => {
      stopNativePolling();
      removeProgress?.();
      removeInstallState?.();
    };
  }, [updateTask, stopNativePolling, triggerAutoInstallOnce]);

  const startApkDownload = useCallback(
    async (release: ReleaseInfo) => {
      const asset = release.apkAsset;
      if (!asset) return;

      const allowed = canDownloadRelease({
        currentVersion: installedVersion,
        currentCode: installedCode,
        latestTag: release.tagName,
        latestBody: release.releaseNotes,
        hasApkAsset: Boolean(asset),
      });
      if (!allowed) {
        setCheckError(
          `এই ভার্সনটি (v${release.version}) ইতোমধ্যে ইনস্টল করা আছে — পুনরায় ডাউনলোড করা হবে না।`,
        );
        return;
      }

      const alreadyActive = downloadsRef.current.some(
        (d) => d.status === 'downloading' && d.version === release.version,
      );
      if (alreadyActive) return;

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
          const result = await AppUpdater.startApkDownload({
            url: asset.browser_download_url,
            fileName: asset.name,
            title: `ইবনে সিনা টালিখাতা v${release.version}`,
            version: release.version,
            versionCode: release.versionCode ?? undefined,
          });
          if (result.alreadyInstalled || result.downloadId <= 0) {
            setDownloads((prev) => prev.filter((item) => item.id !== taskId));
            setCheckError(
              `এই ভার্সনটি (v${release.version}) ইতোমধ্যে ইনস্টল করা আছে — পুনরায় ডাউনলোড করা হবে না।`,
            );
            return;
          }
          const downloadId = result.downloadId;
          const trackedTask: DownloadTask = { ...newTask, nativeDownloadId: downloadId };
          updateTask(taskId, { nativeDownloadId: downloadId });

          stopNativePolling();
          nativePollRef.current = window.setInterval(async () => {
            try {
              const st = await AppUpdater.getDownloadStatus({ downloadId });
              if (st.status === 'successful') {
                stopNativePolling();
                const completedTask: DownloadTask = {
                  ...trackedTask,
                  status: 'completed',
                  progress: 100,
                  downloadedBytes: st.totalBytes || asset.size,
                  totalBytes: st.totalBytes || asset.size,
                };
                updateTask(taskId, completedTask);
                triggerAutoInstallOnce(completedTask, downloadId);
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
          }, 700);
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
    [installedVersion, installedCode, updateTask, stopNativePolling, triggerAutoInstallOnce],
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
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    isNativeApp: isNativeAndroid(),
    canInstallPackages,
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
