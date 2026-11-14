'use client';

import { useEffect } from 'react';

const REVEAL = '.screen > * > :not([data-in]), [data-anim]:not([data-in])';
const SPOT = '.panel, .stat, .toplist a, .movers a, .neighbours a';

const depth = (path: string) => path.split('/').filter(Boolean).length;
let navTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Says which way the next page change travels, so the CSS can slide it like a phone app:
 * a company page pushes in from the right, leaving it pops back, and the main sections cross-fade.
 * The browser's own back button is left alone: phones already animate that gesture themselves.
 */
export function markNav(to: string) {
  const root = document.documentElement;
  // The home page and the main sections sit side by side; a company page is one level in.
  const from = depth(location.pathname) > 1;
  const next = depth(to) > 1;
  root.setAttribute('data-nav', next ? 'forward' : from ? 'back' : 'tab');
  clearTimeout(navTimer);
  navTimer = setTimeout(() => {
    // Blocks that arrived with the screen are done; the rest go back to rising in on scroll.
    document.querySelectorAll('.screen > * > [data-in]').forEach((el) => el.setAttribute('data-skip', ''));
    root.removeAttribute('data-nav');
  }, 900);
}

/**
 * Page-wide motion. Marks blocks with data-in as they scroll into view (the CSS holds their
 * entrance until then), and tracks the pointer so cards can light up under it.
 * Without JavaScript, or with reduced motion, everything is simply visible.
 */
export function Motion() {
  useEffect(() => {
    (window as unknown as { __m?: boolean }).__m = true;
    document.documentElement.classList.add('js');

    const io = new IntersectionObserver(
      (entries) => {
        let i = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          if (el.matches('.screen > * > *')) el.style.setProperty('--stagger', String(Math.min(i++, 6)));
          el.dataset.in = '';
          io.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    let queued = false;
    const scan = () => {
      queued = false;
      document.querySelectorAll(REVEAL).forEach((el) => io.observe(el));
    };
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(scan);
    });
    scan();
    mo.observe(document.body, { childList: true, subtree: true });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !(e.target instanceof Element)) return;
      for (let el = e.target.closest<HTMLElement>(SPOT); el; el = el.parentElement?.closest<HTMLElement>(SPOT) ?? null) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };
    document.addEventListener('pointermove', onMove, { passive: true });

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;
      const a = e.target.closest<HTMLAnchorElement>('a[href]');
      if (!a || a.target || a.origin !== location.origin || a.pathname === location.pathname) return;
      markNav(a.pathname);
    };
    document.addEventListener('click', onClick, true);

    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
  return null;
}
