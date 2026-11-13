/**
 * Turns the SEC's XBRL "company facts" into the annual figures the engine uses.
 * Shared by the snapshot build script and the live refresh job.
 */
import type { Fact, FactKey, Facts } from '../engine/types';

/** XBRL tags for each figure, in order of preference. Companies switch tags over the years. */
const TAGS: Record<FactKey, string[]> = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueGoodsNet',
  ],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
};
const FLOWS = new Set<FactKey>(['revenue', 'netIncome', 'operatingCashFlow', 'capex', 'dilutedShares']);
const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '10-KT', '20-F']);

export interface RawRow { start?: string; end: string; val: number; accn: string; form: string; filed: string; frame?: string }
export type RawFacts = { cik: number; entityName: string; facts: { 'us-gaap'?: Record<string, { units: Record<string, RawRow[]> }> } };

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/**
 * For each period, keep the figure from the first annual report that published it.
 * Later reports restate earlier years; using the first version keeps the backtest honest.
 */
export function extractFacts(raw: RawFacts): Facts {
  const gaap = raw.facts['us-gaap'] ?? {};
  const out = {} as Facts;
  for (const [key, tags] of Object.entries(TAGS) as [FactKey, string[]][]) {
    // Rank candidates for each period: earliest filing first; within one filing, the value the SEC
    // marks as the standard figure for the period (it carries a `frame`); then the preferred tag.
    const best = new Map<string, { fact: Fact; rank: [string, number, number] }>();
    tags.forEach((tag, priority) => {
      for (const rows of Object.values(gaap[tag]?.units ?? {})) {
        for (const r of rows) {
          if (!ANNUAL_FORMS.has(r.form)) continue;
          if (FLOWS.has(key)) {
            if (!r.start || days(r.start, r.end) < 330 || days(r.start, r.end) > 400) continue;
          } else if (r.start) continue;
          const rank: [string, number, number] = [r.filed, r.frame ? 0 : 1, priority];
          const prev = best.get(r.end);
          if (!prev || compare(rank, prev.rank) < 0) best.set(r.end, { fact: { end: r.end, filed: r.filed, val: r.val, accn: r.accn, form: r.form }, rank });
        }
      }
    });
    out[key] = [...best.values()].map((b) => b.fact).sort((a, b) => a.end.localeCompare(b.end));
  }

  // Every annual report states diluted earnings per share, so net income ÷ EPS implies a share count.
  // It fills gaps (Alphabet only tagged counts from 2022) and catches counts filed in the wrong
  // units (Nvidia's 2011 report gives thousands, Merck's 2012 report millions).
  const eps = new Map<string, RawRow>();
  for (const tag of ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted']) {
    for (const rows of Object.values(gaap[tag]?.units ?? {})) {
      for (const r of rows) {
        if (!ANNUAL_FORMS.has(r.form) || !r.start || days(r.start, r.end) < 330 || days(r.start, r.end) > 400) continue;
        const prev = eps.get(r.end);
        if (!prev || r.filed < prev.filed || (r.filed === prev.filed && r.frame && !prev.frame)) eps.set(r.end, r);
      }
    }
  }
  // Real changes in a company's share count stay well within 100x (Nvidia's splits and buybacks
  // since 2009 come to about 40x), so a count under 1% of its largest was filed in thousands or millions.
  // ConocoPhillips reported in thousands from 2012 to 2021.
  const largest = Math.max(0, ...out.dilutedShares.map((f) => f.val));
  out.dilutedShares = out.dilutedShares.map((f) => {
    let val = f.val;
    while (val > 0 && val < largest / 100) val *= 1000;
    return val === f.val ? f : { ...f, val };
  });

  const byEnd = new Map(out.dilutedShares.map((f) => [f.end, f]));
  for (const ni of out.netIncome) {
    const e = eps.get(ni.end);
    // EPS is rounded to the cent, so it only implies a precise count when it's at least 10 cents.
    if (!e || Math.abs(e.val) < 0.1 || ni.val === 0 || Math.sign(e.val) !== Math.sign(ni.val)) continue;
    const implied: Fact = { end: ni.end, filed: e.filed > ni.filed ? e.filed : ni.filed, val: Math.round(ni.val / e.val), accn: e.accn, form: e.form };
    const tagged = byEnd.get(ni.end);
    if (tagged) {
      const ratio = tagged.val / implied.val;
      // Only override a reported count that is off by a units mistake, not by a judgement call.
      if (ratio > 0.01 && ratio < 100) continue;
    }
    byEnd.set(ni.end, implied);
  }
  out.dilutedShares = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
  return out;
}


function compare(a: [string, number, number], b: [string, number, number]): number {
  return a[0].localeCompare(b[0]) || a[1] - b[1] || a[2] - b[2];
}
