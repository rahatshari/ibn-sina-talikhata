export const APP_VERSION = (import.meta.env?.VITE_APP_VERSION as string | undefined) || '1.0.0';
export const APP_VERSION_CODE = Number(import.meta.env?.VITE_APP_VERSION_CODE || 100);
export const DEFAULT_GITHUB_REPO =
  (import.meta.env?.VITE_GITHUB_REPO as string | undefined) || 'rahatshari/ibn-sina-talikhata';
export const APP_PACKAGE_ID = 'com.rahat.talikhata';
export const APP_DISPLAY_NAME = 'ব্যক্তিগত টালিখাতা';
