import { describe, expect, it } from 'vitest';
import { compareVariants, uncertainty, type BacktestMonth } from './rigour';

/** Ten years of 30 companies where `signal` decides how much the growth factor predicts results. */
function months(signal: (year: number) => number, years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021]): BacktestMonth[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: BacktestMonth[] = [];
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const rows = Array.from({ length: 30 }, (_, i) => {
        const growth = rand() * 100;
        const noise = rand() - 0.5;
        return {
          ticker: `T${i}`,
          sector: i % 3 === 0 ? 'A' : 'B',
          score: rand() * 100,
          factors: { profitability: rand() * 100, growth, value: rand() * 100, balanceSheet: rand() * 100, momentum: rand() * 100 },
          excess: (signal(y) * (growth - 50)) / 100 + noise,
        };
      });
      out.push({ date: `${y}-${String(m).padStart(2, '0')}-28`, rows });
    }
  }
  return out;
}

describe('uncertainty', () => {
  it('gives the same ranges every run and brackets the estimate', () => {
    const data = months(() => 0);
    const a = uncertainty(data);
    expect(uncertainty(data)).toEqual(a);
    expect(a.ic[0]).toBeLessThan(0.05);
    expect(a.ic[1]).toBeGreaterThan(-0.05);
    for (const [lo, hi] of a.quintiles) {
      expect(lo).toBeLessThan(hi);
      expect(lo).toBeLessThan(0.55);
      expect(hi).toBeGreaterThan(0.45);
    }
  });
});

describe('variant comparison', () => {
  it('learns to lean on a factor that keeps working', () => {
    const c = compareVariants(months(() => 1.5))!;
    const learned = c.variants.find((v) => v.key === 'learned')!;
    expect(learned.weights!.growth).toBeGreaterThan(0.6);
    expect(learned.ic).toBeGreaterThan(c.variants.find((v) => v.key === 'equal')!.ic);
  });

  it('never trains on the year it is tested on, or the year before', () => {
    // Two histories identical until 2020, then wildly different. Weights for 2020 and 2021
    // (trained on 2019 and earlier) must come out exactly the same.
    const weights = (signal: (y: number) => number) =>
      compareVariants(months(signal))!.variants.find((v) => v.key === 'learned')!.weightsByYear!;
    const calm = weights(() => 0);
    const changed = weights((y) => (y >= 2020 ? 5 : 0));
    expect(changed.filter((w) => w.year <= 2021)).toEqual(calm.filter((w) => w.year <= 2021));
  });

  it('tests every variant on the same years', () => {
    const c = compareVariants(months(() => 0))!;
    expect(c.years).toEqual([2016, 2021]);
    expect(c.variants.map((v) => v.key)).toEqual(['equal', 'sector', 'learned']);
  });
});
