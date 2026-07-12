import './app.js';

window.__IRG_BOOTSTRAP_ACTIVE__ = true;

document.addEventListener('irg:browser-shell-ready', async () => {
  window.__IRG_BOOT_STATUS__ = 'browser-shell-ready';

  try {
    const mod = await import('./legacy-shell.js');
    if (mod && typeof mod.initLegacyShell === 'function') {
      mod.initLegacyShell();
      window.__IRG_BOOT_STATUS__ = 'legacy-shell-ready';
    }
  } catch (error) {
    console.error('[bootstrap] legacy shell boot failed:', error);
    window.__IRG_BOOT_STATUS__ = 'legacy-shell-failed';
  }
}, { once: true });
