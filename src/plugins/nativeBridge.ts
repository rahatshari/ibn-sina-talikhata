import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface GoogleAuthResult {
  idToken: string;
  email?: string;
  displayName?: string;
}

export interface GoogleAuthBridgePlugin {
  signIn(): Promise<GoogleAuthResult>;
  signOut(): Promise<void>;
}

export interface NativeAppInfo {
  versionName: string;
  versionCode: number;
  packageName: string;
  githubRepo: string;
  canInstallPackages?: boolean;
}

export interface StartDownloadResult {
  downloadId: number;
  alreadyInstalled?: boolean;
}

export interface NativeDownloadStatus {
  status: 'pending' | 'running' | 'paused' | 'successful' | 'failed' | 'unknown';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  reason?: string;
}

export interface InstallApkResult {
  started: boolean;
  needsPermission?: boolean;
}

export interface AppUpdaterPlugin {
  getAppInfo(): Promise<NativeAppInfo>;
  showUpdateNotification(options: {
    title: string;
    body: string;
    version: string;
  }): Promise<void>;
  startApkDownload(options: {
    url: string;
    fileName: string;
    title: string;
    version: string;
    versionCode?: number;
  }): Promise<StartDownloadResult>;
  getDownloadStatus(options: { downloadId: number }): Promise<NativeDownloadStatus>;
  installApk(options: {
    downloadId?: number;
    fileName?: string;
    openSettingsOnDeny?: boolean;
  }): Promise<InstallApkResult>;
  openUnknownSourcesSettings(): Promise<void>;
  saveFileToDownloads(options: {
    base64Data: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ saved: boolean; fileName: string }>;
  shareFile(options: {
    base64Data: string;
    fileName: string;
    mimeType: string;
    title: string;
    text?: string;
  }): Promise<{ shared: boolean }>;
  printHtml(options: { html: string; jobName: string }): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (data: NativeDownloadStatus & { downloadId: number }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'installStateChanged',
    listenerFunc: (data: InstallApkResult & { downloadId: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const GoogleAuthBridge = registerPlugin<GoogleAuthBridgePlugin>('GoogleAuthBridge');
export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
