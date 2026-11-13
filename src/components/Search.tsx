'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { markNav } from './Motion';

interface Option { ticker: string; name: string }

/** Ticker or company search with a keyboard-friendly list (ARIA combobox pattern). */
export function Search({ options, large = false }: { options: Option[]; large?: boolean }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // "/" jumps to the header search from anywhere, unless the reader is already typing somewhere.
  useEffect(() => {
    if (large) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [large]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const starts = options.filter((o) => o.ticker.toLowerCase().startsWith(s) || o.name.toLowerCase().startsWith(s));
    const contains = options.filter((o) => !starts.includes(o) && o.name.toLowerCase().includes(s));
    return [...starts, ...contains].slice(0, 7);
  }, [q, options]);

  const go = (o: Option | undefined) => {
    if (!o) return;
    setQ('');
    setOpen(false);
    input.current?.blur();
    markNav(`/stocks/${o.ticker}`);
    router.push(`/stocks/${o.ticker}`);
  };

  return (
    <form
      role="search"
      className={large ? 'search search--large' : 'search'}
      onSubmit={(e) => {
        e.preventDefault();
        go(matches[active] ?? options.find((o) => o.ticker === q.trim().toUpperCase()));
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="search__icon"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" /></svg>
      <input
        ref={input}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={large ? 'Search 70 companies, e.g. AAPL, Nvidia, Costco' : 'Search, e.g. AAPL'}
        aria-label="Ticker or company"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && matches[active] ? `${id}-${matches[active].ticker}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
      />
      {!large && !q && <kbd className="search__key" aria-hidden="true">/</kbd>}
      {open && matches.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="search__list">
          {matches.map((o, i) => (
            <li
              key={o.ticker}
              id={`${id}-${o.ticker}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(o); }}
              onMouseEnter={() => setActive(i)}
            >
              <b>{o.ticker}</b> <span>{o.name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && matches.length === 0 && (
        <p className="search__empty" role="status">Not in the 70 companies StockScore covers.</p>
      )}
    </form>
  );
}
