import { createApp } from './components/App';
import { store } from './stores/appStore';
import { initPwa } from './services/pwa';
import { startReminderService } from './services/reminders';
import './styles/main.css';

async function main() {
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