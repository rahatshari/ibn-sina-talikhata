import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_CHECK_COOLDOWN_MS,
  AUTO_UPDATE_ENABLED_KEY,
  canDownloadRelease,
  compareVersions,
  computeSyncStatus,
  extractVersionCodeFromBody,
  formatBytes,
  formatUpdateNotificationBody,
  isNewerReleaseAvailable,
  loadAutoUpdateEnabled,
  parseExpandedAssetsApk,
  parseReleaseAtomLatest,
  parseReleaseChangelog,
  pickBestApkAsset,
  saveAutoUpdateEnabled,
  shouldRunAutoCheck,
} from './updater.ts';

describe('updater & sync utilities', () => {
  it('compares semantic versions with optional v prefix', () => {
    assert.equal(compareVersions('v1.0.12', '1.0.9'), 1);
    assert.equal(compareVersions('1.0.9', 'v1.0.12'), -1);
    assert.equal(compareVersions('v1.0.5', '1.0.5'), 0);
    assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  });

  it('detects newer release using versionCode in body first, then tag', () => {
    assert.equal(
      isNewerReleaseAvailable('1.0.5', 105, 'v1.0.6', 'Auto build\nversionCode: 106'),
      true,
    );
    assert.equal(
      isNewerReleaseAvailable('1.0.6', 106, 'v1.0.6', 'versionCode: 106'),
      false,
    );
    assert.equal(
      isNewerReleaseAvailable('1.0.8', 108, 'v1.0.9', 'versionCode: 108'),
      false,
    );
    assert.equal(
      isNewerReleaseAvailable('1.0.8', 108, 'v1.0.7', 'versionCode: 107'),
      false,
    );
    assert.equal(
      isNewerReleaseAvailable('1.0.5', 105, 'v1.0.8'),
      true,
    );
  });

  it('prevents downloading already-installed or older APK versions and honors missing APK', () => {
    assert.equal(
      canDownloadRelease({
        currentVersion: '1.0.12',
        currentCode: 112,
        latestTag: 'v1.0.12',
        latestBody: 'versionCode: 112',
        hasApkAsset: true,
      }),
      false,
    );
    assert.equal(
      canDownloadRelease({
        currentVersion: '1.0.12',
        currentCode: 112,
        latestTag: 'v1.0.11',
        latestBody: 'versionCode: 111',
        hasApkAsset: true,
      }),
      false,
    );
    assert.equal(
      canDownloadRelease({
        currentVersion: '1.0.12',
        currentCode: 112,
        latestTag: 'v1.0.13',
        latestBody: 'versionCode: 113',
        hasApkAsset: false,
      }),
      false,
    );
    assert.equal(
      canDownloadRelease({
        currentVersion: '1.0.12',
        currentCode: 112,
        latestTag: 'v1.0.13',
        latestBody: 'versionCode: 113',
        hasApkAsset: true,
      }),
      true,
    );
  });

  it('defaults auto-update to enabled and persists ON/OFF toggle in storage', () => {
    const mockMap = new Map<string, string>();
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mockMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mockMap.set(k, v);
        },
      },
    };
    assert.equal(loadAutoUpdateEnabled(), true);
    saveAutoUpdateEnabled(false);
    assert.equal(mockMap.get(AUTO_UPDATE_ENABLED_KEY), 'false');
    assert.equal(loadAutoUpdateEnabled(), false);
    saveAutoUpdateEnabled(true);
    assert.equal(loadAutoUpdateEnabled(), true);
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('extracts versionCode from release body and picks signed APK asset', () => {
    assert.equal(extractVersionCodeFromBody('Release notes\nversionCode: 142'), 142);
    assert.equal(extractVersionCodeFromBody('No code here'), null);

    const picked = pickBestApkAsset([
      { name: 'checksums.txt', browser_download_url: 'https://example.com/c.txt', size: 100 },
      {
        name: 'app-release-unsigned.apk',
        browser_download_url: 'https://example.com/u.apk',
        size: 5000,
      },
      {
        name: 'IbnSina-TallyKhata-v1.0.12.apk',
        browser_download_url: 'https://example.com/signed.apk',
        size: 8400000,
      },
    ]);
    assert.equal(picked?.name, 'IbnSina-TallyKhata-v1.0.12.apk');
  });

  it('parses release changelog bullets while filtering metadata lines', () => {
    const rawBody = `
অটোমেটিক বিল্ড ও রিলিজ (v1.0.14)
versionCode: 114

## পরিবর্তনসমূহ
- রসিদ ডাউনলোড ও শেয়ার বাগ ফিক্স করা হয়েছে
* দোকানদারের তথ্য এডিট ফিচার যুক্ত হয়েছে
1. অ্যাপের ডিজাইন আরও সহজ করা হয়েছে
`;
    const items = parseReleaseChangelog(rawBody);
    assert.deepEqual(items, [
      'রসিদ ডাউনলোড ও শেয়ার বাগ ফিক্স করা হয়েছে',
      'দোকানদারের তথ্য এডিট ফিচার যুক্ত হয়েছে',
      'অ্যাপের ডিজাইন আরও সহজ করা হয়েছে',
    ]);

    const notif = formatUpdateNotificationBody('1.0.14', rawBody);
    assert.ok(notif.includes('• রসিদ ডাউনলোড ও শেয়ার বাগ ফিক্স করা হয়েছে'));
    assert.ok(!notif.includes('versionCode'));
  });

  it('formats byte sizes and computes offline/sync statuses accurately', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(5 * 1024 * 1024), '5.00 MB');

    assert.equal(
      computeSyncStatus({
        isOnline: false,
        isCloudUser: true,
        hasPendingWrites: true,
        cloudLoading: false,
      }).state,
      'offline',
    );
    assert.equal(
      computeSyncStatus({
        isOnline: true,
        isCloudUser: true,
        hasPendingWrites: true,
        cloudLoading: false,
      }).state,
      'syncing',
    );
    assert.equal(
      computeSyncStatus({
        isOnline: true,
        isCloudUser: true,
        hasPendingWrites: false,
        cloudLoading: false,
      }).state,
      'synced',
    );
  });

  it('throttles auto-checks for 60s only after a successful check', () => {
    assert.equal(shouldRunAutoCheck(0, 10_000), true);
    assert.equal(shouldRunAutoCheck(10_000, 10_000 + AUTO_CHECK_COOLDOWN_MS - 1), false);
    assert.equal(shouldRunAutoCheck(10_000, 10_000 + AUTO_CHECK_COOLDOWN_MS), true);
  });

  it('parses latest GitHub Atom release entry and expanded assets APK fallback', () => {
    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>tag:github.com,2008:Repository/1/v1.0.9</id>
    <updated>2026-11-19T08:32:51Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/rahatshari/ibn-sina-talikhata/releases/tag/v1.0.9"/>
    <title>ইবনে সিনা টালিখাতা v1.0.9</title>
    <content type="html">&lt;p&gt;versionCode: 109&lt;/p&gt;&lt;ul&gt;&lt;li&gt;&lt;p&gt;সময় যুক্ত করা হয়েছে&lt;/p&gt;&lt;/li&gt;&lt;/ul&gt;</content>
  </entry>
</feed>`;
    const parsed = parseReleaseAtomLatest(atom, 'v1.0.9');
    assert.ok(parsed);
    assert.equal(parsed.tag_name, 'v1.0.9');
    assert.equal(extractVersionCodeFromBody(parsed.body), 109);
    assert.deepEqual(parseReleaseChangelog(parsed.body), ['সময় যুক্ত করা হয়েছে']);

    const apk = parseExpandedAssetsApk(
      '<a href="/rahatshari/ibn-sina-talikhata/releases/download/v1.0.9/IbnSina-TallyKhata-v1.0.9.apk">APK</a>',
      'v1.0.9',
      'rahatshari/ibn-sina-talikhata',
    );
    assert.equal(apk?.name, 'IbnSina-TallyKhata-v1.0.9.apk');
    assert.equal(
      apk?.browser_download_url,
      'https://github.com/rahatshari/ibn-sina-talikhata/releases/download/v1.0.9/IbnSina-TallyKhata-v1.0.9.apk',
    );
  });
});
