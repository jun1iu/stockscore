'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/rankings', label: 'Rankings', icon: 'M3 17h4V9H3v8Zm5 0h4V3H8v14Zm5 0h4v-6h-4v6Z' },
  { href: '/track-record', label: 'Track record', icon: 'M3 15l4-5 3 3 6-8M13 5h3v3' },
  { href: '/method', label: 'Method', icon: 'M5 3h10v14H5zM8 7h4M8 10h4M8 13h2' },
];

/** Header links on wide screens, a bottom tab bar on phones. */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="nav__home" aria-current={path === '/' ? 'page' : undefined}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9l7-6 7 6v8H3z" /></svg>
        <span>Home</span>
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? 'page' : undefined}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d={l.icon} /></svg>
          <span>{l.label}</span>
        </Link>
      ))}
    </nav>
  );
}
