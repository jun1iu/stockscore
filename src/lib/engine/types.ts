/** One annual figure as it was first published in a filing. */
export interface Fact {
  /** Last day of the fiscal period (or the balance-sheet date). */
  end: string;
  /** Day the filing that first reported this figure was published. */
  filed: string;
  val: number;
  /** SEC accession number of that filing. */
  accn: string;
  form: string;
}

export type FactKey =
  | 'revenue'
  | 'netIncome'
  | 'operatingCashFlow'
  | 'capex'
  | 'equity'
  | 'assets'
  | 'liabilities'
  | 'currentAssets'
  | 'currentLiabilities'
  | 'dilutedShares';

export type Facts = Record<FactKey, Fact[]>;

export interface Company {
  ticker: string;
  name: string;
  cik: number;
  sector: string;
  facts: Facts;
}

/** A month-end price. `close` is split-adjusted; `adjClose` also adds back dividends. */
export interface PricePoint {
  date: string;
  close: number;
  adjClose: number;
}

export interface Split {
  date: string;
  /** New shares per old share, e.g. 4 for a 4-for-1 split. */
  ratio: number;
}

export interface PriceHistory {
  ticker: string;
  points: PricePoint[];
  splits: Split[];
}

export type MetricKey =
  | 'returnOnAssets'
  | 'netMargin'
  | 'revenueGrowth3y'
  | 'epsGrowth3y'
  | 'peRatio'
  | 'fcfYield'
  | 'liabilitiesToAssets'
  | 'currentRatio'
  | 'return6m'
  | 'return12m';

export type FactorKey = 'profitability' | 'growth' | 'value' | 'balanceSheet' | 'momentum';

export interface Metrics {
  values: Record<MetricKey, number | null>;
  /** Shown for reference only: meaningless when equity is negative. */
  returnOnEquity: number | null;
  price: number;
  marketCap: number;
  /** The annual report the figures come from. */
  source: { accn: string; filed: string; periodEnd: string; form: string };
}

export interface Evaluation {
  ticker: string;
  date: string;
  metrics: Metrics;
  /** Percentile of each metric in the group, 0-100, 100 = best. */
  metricScores: Record<MetricKey, number | null>;
  factors: Record<FactorKey, number | null>;
  /** Average of the factor scores. */
  composite: number;
  /** Rank of the composite in the group, 0-100, 100 = best. */
  score: number;
  rank: number;
  groupSize: number;
}
