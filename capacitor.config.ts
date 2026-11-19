import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rahat.talikhata',
  appName: 'ইবনে সিনা টালিখাতা',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f8fafc',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
