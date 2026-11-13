import { getMeta } from '@/lib/data';
import { pct } from '@/lib/format';
import { ogImage, OG_SIZE } from '@/lib/og';

export const alt = 'StockScore: a stock score that tells you how much to trust it';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const t = (await getMeta()).trackRecord;
  return ogImage({
    eyebrow: 'Scores from SEC filings, with their track record attached',
    title: 'A stock score that tells you how much to trust it.',
    detail: `Top-fifth scores beat the S&P 500 ${pct(t.quintiles.at(-1)!.beat, 0)} of the time since ${t.start.slice(0, 4)}. A coin flip is 50%.`,
  });
}
