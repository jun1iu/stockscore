import type { MetadataRoute } from 'next';
import { UNIVERSE } from '@/data/universe';
import { getMeta } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Scores change when the snapshot does, so that is every page's last-modified time.
  const lastModified = (await getMeta()).builtAt;
  const page = (path: string, priority: number, changeFrequency: 'daily' | 'monthly' = 'daily') => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });
  return [
    page('/', 1),
    page('/rankings', 0.9),
    page('/track-record', 0.8),
    page('/method', 0.6, 'monthly'),
    page('/developers', 0.4, 'monthly'),
    page('/status', 0.3),
    ...UNIVERSE.map((u) => page(`/stocks/${u.ticker}`, 0.7)),
  ];
}
