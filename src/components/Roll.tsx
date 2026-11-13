import type { CSSProperties } from 'react';

/** A figure whose characters roll into place one after another. Screen readers get the plain text. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll" data-anim>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {[...children].map((ch, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties}>{ch}</span>
        ))}
      </span>
    </span>
  );
}
