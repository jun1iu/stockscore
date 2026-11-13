import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Search } from '@/components/Search';
import { NavLinks } from '@/components/NavLinks';
import { THEME_SCRIPT, ThemeToggle } from '@/components/ThemeToggle';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';
import { UNIVERSE } from '@/data/universe';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'StockScore: a stock score that tells you how much to trust it', template: '%s · StockScore' },
  description: SITE_DESCRIPTION,
  applicationName: 'StockScore',
  openGraph: { type: 'website', siteName: 'StockScore', locale: 'en_GB' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07100c' },
    { media: '(prefers-color-scheme: light)', color: '#f5f8f6' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const options = UNIVERSE.map((u) => ({ ticker: u.ticker, name: u.name }));
  return (
    <html lang="en" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="topbar">
          <Link href="/" className="brand" aria-label="StockScore home">
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <rect x="1" y="11" width="4" height="8" rx="1" />
              <rect x="8" y="6" width="4" height="13" rx="1" />
              <rect x="15" y="1" width="4" height="18" rx="1" />
            </svg>
            StockScore
          </Link>
          <Search options={options} />
          <NavLinks />
          <ThemeToggle />
        </header>
        <main id="main" className="main">{children}</main>
        <footer className="footer">
          <p>
            StockScore summarises public filings and prices. It is not investment advice and does not recommend buying or
            selling anything. Built by <a href="https://jun-liu.net">Jun Liu</a>.
          </p>
          <p>Data: SEC EDGAR filings; prices from Massive, with history before November 2026 from Yahoo Finance. <Link href="/status">Data status</Link> · <Link href="/developers">API</Link>.</p>
        </footer>
      </body>
    </html>
  );
}
