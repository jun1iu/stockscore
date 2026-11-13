'use client';

import { useEffect } from 'react';

const REVEAL = '.main > * > :not([data-in]), [data-anim]:not([data-in])';
const SPOT = '.panel, .stat, .toplist a, .movers a, .neighbours a';

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
          if (el.matches('.main > * > *')) el.style.setProperty('--stagger', String(Math.min(i++, 6)));
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

    return () => {
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('pointermove', onMove);
    };
  }, []);
  return null;
}
