// Player settings, persisted per browser.
const KEY = 'undercroft9.settings';
const DEFAULTS = { quality: 'high', sens: 1, invertY: false, music: 0.8, sfx: 0.7 };

export const settings = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
})();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
