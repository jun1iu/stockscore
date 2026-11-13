/** Where the site is served from: used for canonical links, the sitemap, share images and API examples. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stockscore.jun-liu.net').replace(/\/+$/, '');

export const SITE_DESCRIPTION =
  'Transparent scores for 70 large US companies from their SEC filings, shown next to the engine’s own track record. Not investment advice.';
