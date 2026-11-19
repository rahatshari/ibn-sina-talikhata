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

export function parseReleaseChangelog(body?: string): string[] {
  if (!body) return [];
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^versionCode\s*[:=]\s*\d+/i.test(line)) return false;
      if (/^অটোমেটিক বিল্ড ও রিলিজ/i.test(line)) return false;
      if (/^#{1,6}\s*/.test(line)) return false;
      if (/^[-*_]{3,}$/.test(line)) return false;
      return true;
    })
    .map((line) =>
      line
        .replace(/^[-*•]+\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .trim(),
    )
    .filter((line) => line.length > 0);

  return Array.from(new Set(lines));
}

export function formatUpdateNotificationBody(version: string, body?: string): string {
  const items = parseReleaseChangelog(body).slice(0, 4);
  if (items.length === 0) {
    return `ইবনে সিনা টালিখাতা v${version} ডাউনলোড ও আপডেট করতে ট্যাপ করুন।`;
  }
  return items.map((item) => `• ${item}`).join('\n');
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
    if (latestCode <= currentCode) return false;
  }
  return compareVersions(latestTag, currentVersion) > 0;
}

export function canDownloadRelease(params: {
  currentVersion: string;
  currentCode: number;
  latestTag: string;
  latestBody?: string;
  hasApkAsset: boolean;
}): boolean {
  if (!params.hasApkAsset) return false;
  return isNewerReleaseAvailable(
    params.currentVersion,
    params.currentCode,
    params.latestTag,
    params.latestBody,
  );
}

export const AUTO_UPDATE_ENABLED_KEY = 'ibn_sina_auto_update_enabled_v1';
export const AUTO_CHECK_COOLDOWN_MS = 60 * 1000;

export function shouldRunAutoCheck(
  lastSuccessfulCheckMs: number,
  nowMs: number,
  cooldownMs: number = AUTO_CHECK_COOLDOWN_MS,
): boolean {
  if (lastSuccessfulCheckMs <= 0) return true;
  return nowMs - lastSuccessfulCheckMs >= cooldownMs;
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function htmlToPlainLines(html: string): string {
  const decoded = decodeXmlEntities(html);
  return decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function parseReleaseAtomLatest(
  xml: string,
  expectedTag?: string,
): GitHubReleasePayload | null {
  if (!xml) return null;
  const entryMatches = xml.match(/<entry\b[\s\S]*?<\/entry>/gi);
  if (!entryMatches || entryMatches.length === 0) return null;

  for (const entry of entryMatches) {
    const hrefMatch = entry.match(/<link[^>]*href="([^"]*\/releases\/tag\/([^"/]+))"/i);
    const idMatch = entry.match(/<id>[^<]*\/([^</]+)<\/id>/i);
    const tagName = hrefMatch?.[2] || idMatch?.[1] || '';
    if (!tagName) continue;
    if (expectedTag && normalizeVersionString(tagName) !== normalizeVersionString(expectedTag)) {
      continue;
    }
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const updatedMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/i);
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);

    const body = contentMatch ? htmlToPlainLines(contentMatch[1]) : '';
    return {
      tag_name: tagName,
      name: titleMatch ? decodeXmlEntities(titleMatch[1]).trim() : tagName,
      body,
      published_at: updatedMatch ? updatedMatch[1].trim() : undefined,
      html_url: hrefMatch ? hrefMatch[1] : undefined,
      assets: [],
    };
  }

  return null;
}

export function parseExpandedAssetsApk(
  html: string,
  tagName: string,
  repo: string,
): GitHubReleaseAsset | null {
  const cleanRepo = repo.trim().replace(/^\/+|\/+$/g, '');
  if (html) {
    const hrefRegex = /href="([^"]*\/releases\/download\/[^"]+\.apk)"/gi;
    const candidates: GitHubReleaseAsset[] = [];
    let match: RegExpExecArray | null;
    while ((match = hrefRegex.exec(html)) !== null) {
      const rawHref = match[1];
      const fullUrl = rawHref.startsWith('http') ? rawHref : `https://github.com${rawHref}`;
      const name = decodeURIComponent(fullUrl.split('/').pop() || `IbnSina-TallyKhata-${tagName}.apk`);
      candidates.push({
        name,
        browser_download_url: fullUrl,
        size: 0,
      });
    }
    const picked = pickBestApkAsset(candidates);
    if (picked) return picked;
  }

  if (cleanRepo && tagName) {
    const fallbackName = `IbnSina-TallyKhata-${tagName}.apk`;
    return {
      name: fallbackName,
      browser_download_url: `https://github.com/${cleanRepo}/releases/download/${tagName}/${fallbackName}`,
      size: 0,
    };
  }

  return null;
}

export function loadAutoUpdateEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(AUTO_UPDATE_ENABLED_KEY);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

export function saveAutoUpdateEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTO_UPDATE_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
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
