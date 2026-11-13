/**
 * Why a score moved between two dates: which factors changed most, the figures behind them, and
 * whether a new annual report arrived. Scores are ranks, so a company can also move because other
 * companies' figures changed; the explanation says so when its own figures barely moved.
 */
import { FACTORS, type MetricDef } from './score';
import type { Evaluation, FactorKey, MetricKey } from './types';

export interface MetricChange {
  key: MetricKey;
  label: string;
  format: MetricDef['format'];
  from: number | null;
  to: number | null;
  rankFrom: number | null;
  rankTo: number | null;
}

export interface FactorChange {
  key: FactorKey;
  label: string;
  from: number | null;
  to: number | null;
  delta: number;
  metrics: MetricChange[];
}

export interface ScoreChange {
  since: string;
  scoreFrom: number;
  scoreTo: number;
  delta: number;
  rankFrom: number;
  rankTo: number;
  /** Set when the figures now come from a newer annual report. */
  newReport: { filed: string; periodEnd: string } | null;
  /** Factors sorted by how much they moved, largest first. */
  factors: FactorChange[];
  /** True when the company's own figures hardly changed and the move came from the rest of the group. */
  drivenByPeers: boolean;
}

export function explainChange(prev: Evaluation | undefined, curr: Evaluation, since: string): ScoreChange | null {
  if (!prev) return null;
  const factors: FactorChange[] = FACTORS.map((f) => {
    const from = prev.factors[f.key];
    const to = curr.factors[f.key];
    return {
      key: f.key,
      label: f.label,
      from,
      to,
      delta: from !== null && to !== null ? to - from : 0,
      metrics: f.metrics.map((m) => ({
        key: m.key,
        label: m.label,
        format: m.format,
        from: prev.metrics.values[m.key],
        to: curr.metrics.values[m.key],
        rankFrom: prev.metricScores[m.key],
        rankTo: curr.metricScores[m.key],
      })),
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const newReport =
    prev.metrics.source.accn !== curr.metrics.source.accn ? { filed: curr.metrics.source.filed, periodEnd: curr.metrics.source.periodEnd } : null;

  // Own figures: price-based measures move every month, so compare the relative change of each value.
  const ownMove = factors
    .flatMap((f) => f.metrics)
    .filter((m) => m.from !== null && m.to !== null)
    .some((m) => Math.abs(m.to! - m.from!) > Math.max(0.02, Math.abs(m.from!) * 0.1));

  return {
    since,
    scoreFrom: prev.score,
    scoreTo: curr.score,
    delta: curr.score - prev.score,
    rankFrom: prev.rank,
    rankTo: curr.rank,
    newReport,
    factors,
    drivenByPeers: !newReport && !ownMove && Math.abs(curr.score - prev.score) >= 5,
  };
}

/** A one-line summary, e.g. "Up 18 points since 31 Oct: momentum improved most." */
export function summarize(c: ScoreChange): string {
  const d = Math.round(c.delta);
  if (Math.abs(d) < 3) return 'Little changed';
  const top = c.factors.filter((f) => Math.abs(f.delta) >= 5).slice(0, 2);
  const how = top.map((f) => `${f.label.toLowerCase()} ${f.delta > 0 ? 'up' : 'down'} ${Math.abs(Math.round(f.delta))}`).join(', ');
  const cause = c.newReport ? 'a new annual report' : c.drivenByPeers ? 'other companies’ figures changing' : 'price moves';
  return `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} points, mainly from ${cause}${how ? ` (${how})` : ''}`;
}
