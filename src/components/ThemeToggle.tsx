'use client';

/**
 * Light / dark switch. The icon is chosen in CSS from the data-theme attribute the inline script
 * in the layout sets before first paint, so there is no state here and nothing to mismatch on hydration.
 */
export function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme"
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      onClick={(e) => {
        const root = document.documentElement;
        const next = root.dataset.theme === 'light' ? 'dark' : 'light';
        const apply = () => {
          root.dataset.theme = next;
          try { localStorage.setItem('theme', next); } catch { /* private mode: the choice lasts for this page only */ }
        };
        if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();
        // The new theme spreads out from the button in a circle.
        const r = e.currentTarget.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.dataset.switching = '';
        const t = document.startViewTransition(apply);
        t.ready
          .then(() =>
            root.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
              { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
            ),
          )
          .catch(() => {});
        t.finished.finally(() => { delete root.dataset.switching; });
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="theme__sun"><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" /></svg>
      <svg viewBox="0 0 20 20" aria-hidden="true" className="theme__moon"><path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" /></svg>
    </button>
  );
}

/**
 * Runs before first paint: a saved choice wins, otherwise follow the device setting.
 * It also marks the page as scripted, so entrances can wait until they scroll into view;
 * the mark is dropped again if the page never finishes loading its scripts.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}var d=document.documentElement;d.classList.add("js");setTimeout(function(){if(!window.__m)d.classList.remove("js")},4000)})()`;
