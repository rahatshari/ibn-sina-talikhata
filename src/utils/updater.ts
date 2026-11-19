export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
}

export interface GitHubReleasePayload {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

export function normalizeVersionString(raw: string): string {
  return raw.trim().replace(/^v/i, '');
}

export function parseVersionParts(version: string): number[] {
  const clean = normalizeVersionString(version).split('-')[0] || '0';
  return clean.split('.').map((part) => {
    const num = Number.parseInt(part.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(num) ? num : 0;
  });
}

export function compareVersions(a: string, b: string): number {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i += 1) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function extractVersionCodeFromBody(body?: string): number | null {
  if (!body) return null;
  const match = body.match(/versionCode\s*[:=]\s*(\d+)/i);
  if (!match) return null;
  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

export function isNewerReleaseAvailable(
  currentVersion: string,
  currentCode: number,
  latestTag: string,
  latestBody?: string,
): boolean {
  const latestCode = extractVersionCodeFromBody(latestBody);
  if (latestCode !== null && currentCode > 0) {
    if (latestCode > currentCode) return true;
    if (latestCode < currentCode) return false;
  }
  return compareVersions(latestTag, currentVersion) > 0;
}

export function pickBestApkAsset(assets: GitHubReleaseAsset[] | undefined): GitHubReleaseAsset | null {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const apkAssets = assets.filter((a) => a.name.toLowerCase().endsWith('.apk'));
  if (apkAssets.length === 0) return null;
  return (
    apkAssets.find((a) => !a.name.toLowerCase().includes('unsigned')) ||
    apkAssets[0]
  );
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export interface SyncStatusDescriptor {
  state: 'offline' | 'syncing' | 'synced' | 'guest';
  label: string;
  detail: string;
}

export function computeSyncStatus(args: {
  isOnline: boolean;
  isCloudUser: boolean;
  hasPendingWrites: boolean;
  cloudLoading: boolean;
}): SyncStatusDescriptor {
  if (!args.isCloudUser) {
    return {
      state: args.isOnline ? 'guest' : 'offline',
      label: args.isOnline ? 'অফলাইন লোকাল মোড' : 'অফলাইন মোড (ইন্টারনেট নেই)',
      detail: args.isOnline
        ? 'সব ডাটা ফোনে সেভ হচ্ছে। জিমেইল লগইন করলে ক্লাউডে সিঙ্ক হবে।'
        : 'ইন্টারনেট ছাড়াই বিক্রি ও হিসাব সেভ হচ্ছে। পরে লগইন করে সিঙ্ক করতে পারবেন।',
    };
  }

  if (!args.isOnline) {
    return {
      state: 'offline',
      label: 'অফলাইন মোড · ডাটা কিউতে আছে',
      detail: 'ইন্টারনেট নেই। নতুন এন্ট্রি ফোনে সেভ হচ্ছে, নেট পেলেই অটো আপলোড হবে।',
    };
  }

  if (args.cloudLoading || args.hasPendingWrites) {
    return {
      state: 'syncing',
      label: 'ক্লাউডে সিঙ্ক হচ্ছে...',
      detail: 'অফলাইনে করা হিসাবগুলো ফায়ারবেস ক্লাউডে আপলোড হচ্ছে।',
    };
  }

  return {
    state: 'synced',
    label: 'অনলাইন · ফায়ারবেস ক্লাউড সিঙ্কড',
    detail: 'সব হিসাব ক্লাউড স্টোরেজে সুরক্ষিতভাবে সংরক্ষিত আছে।',
  };
}
