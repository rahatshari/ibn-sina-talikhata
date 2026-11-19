import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import App from './App.tsx';
import './index.css';

if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
