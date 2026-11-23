import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import App from './App.tsx';
import './index.css';

if (!Capacitor.isNativePlatform()) {
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const reg of regs) {
            void reg.unregister();
          }
        })
        .catch(() => {
          // Ignore service worker cleanup errors
        });
    }
  } else {
    registerSW({ immediate: true });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
