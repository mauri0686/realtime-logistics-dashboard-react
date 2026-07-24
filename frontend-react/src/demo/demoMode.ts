/**
 * Demo mode = the app runs without the .NET backend, driving the exact same UI from an
 * in-browser simulation. It turns on automatically on GitHub Pages (github.io) or with ?demo=1.
 * Locally (dev server + API) it stays off and the real REST + SignalR path is used.
 */
const DEMO_FLAG = 'shiptrack.demo';

// Captured at module load — BEFORE the router's first redirect can strip the query param.
if (new URLSearchParams(location.search).has('demo')) {
  sessionStorage.setItem(DEMO_FLAG, '1');
}

export function isDemoMode(): boolean {
  return (
    location.hostname.endsWith('github.io') ||
    new URLSearchParams(location.search).has('demo') ||
    sessionStorage.getItem(DEMO_FLAG) === '1'
  );
}
