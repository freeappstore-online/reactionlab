/**
 * Registers the generated service worker so the app installs and runs offline.
 *
 * Dev builds are skipped deliberately: a cached shell during development hides
 * source changes behind stale assets.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Registering after `load` keeps the worker off the critical path for the
  // very first paint.
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // An unavailable worker only costs offline support; the app still runs.
    });
  });
}
