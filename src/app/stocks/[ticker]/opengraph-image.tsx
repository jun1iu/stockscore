import { findCompany, UNIVERSE } from '@/data/universe';
import { stockReport } from '@/lib/data';
import { pct } from '@/lib/format';
import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'A company’s StockScore and the track record for scores like it';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return UNIVERSE.map((u) => ({ ticker: u.ticker }));
}

export default async function Image({ params }: { params: Promise<{ ticker: string }> }) {
  const company = findCompany((await params).ticker);
  const r = company && (await stockReport(company.ticker));
  if (!r) return ogImage({ eyebrow: 'StockScore', title: 'Not covered', detail: 'StockScore covers 70 large US companies.' });
  const o = r.trust?.outcome;
  return ogImage({
    eyebrow: r.sector,
    title: `${r.ticker} ${r.name}`,
    score: r.evaluation?.score,
    detail: o && r.trust
      ? `Scores of ${r.trust.band.lo}–${r.trust.band.hi} beat the S&P 500 ${pct(o.beat, 0)} of the time. A coin flip is 50%. Not investment advice.`
      : 'Scores from SEC filings, with their track record attached.',
  });
}
