import { createApp } from './components/App';
import { store } from './stores/appStore';
import { initPwa } from './services/pwa';
import { startReminderService } from './services/reminders';
import { nativeHaptic } from './services/nativeBridge';
import './styles/main.css';
import './styles/animations.css';

// Expose for native bridge usage
(window as any).__habitctl_native_haptic = (style: string) => nativeHaptic(style as any);

// In dev there is no legitimate service worker; a stale one from a previous
// production build will keep serving an old cached bundle. Remove it and reload once.
async function clearStaleServiceWorker(): Promise<void> {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  const hadController = !!navigator.serviceWorker.controller;
  if (!hadController && regs.length === 0) return;
  await Promise.all(regs.map(r => r.unregister()));
  if (typeof caches !== 'undefined') { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
  // Reload once so the page is no longer controlled by the removed worker.
  if (hadController && !sessionStorage.getItem('sw-cleared')) {
    sessionStorage.setItem('sw-cleared', '1');
    location.reload();
  }
}

async function main() {
  await clearStaleServiceWorker();
  const root = document.getElementById('app');
  if (!root) throw new Error('Root element not found');
  
  createApp(root);
  await store.initialize();

  initPwa();
  startReminderService();
  
  console.log('%c habit_ctl ', 'background: #7aa2f7; color: #1a1b26; font-weight: bold; padding: 4px 8px; border-radius: 4px;', 'Web version initialized');
}

main().catch(err => {
  console.error('Failed to initialize app:', err);
  document.body.innerHTML = `<div style="padding: 2rem; text-align: center; font-family: monospace;"><h1>Error</h1><p>${err.message}</p></div>`;
});