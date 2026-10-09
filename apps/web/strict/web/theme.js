// Light/dark theme for both pages. A plain script loaded in <head>, so a saved choice applies before the page
// paints (the CSP allows no inline script). With nothing saved, the page follows the system setting. Storage
// can be blocked or throw; the toggle still works, it just isn't remembered.
(() => {
  const KEY = 'theme', root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
  const apply = theme => {
    root.dataset.theme = theme;
    for (const button of document.querySelectorAll('[data-theme-toggle]')) button.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  const current = () => saved() ?? (media.matches ? 'dark' : 'light');
  apply(current());
  media.addEventListener('change', () => { if (!saved()) apply(current()); });
  document.addEventListener('DOMContentLoaded', () => {
    // The button only appears once this script runs; without it, the CSS still follows the system.
    for (const button of document.querySelectorAll('[data-theme-toggle]')) button.hidden = false;
    apply(current());
  });
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch {}
    apply(next);
  });
})();
