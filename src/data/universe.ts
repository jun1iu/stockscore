/**
 * The group the engine ranks: 70 of the largest US-listed companies outside banking,
 * insurance and property, whose accounts don't fit these measures.
 * Chosen in 2026, so the backtest only includes companies that are large today
 * (survivorship bias). The track record page says so.
 */
export const UNIVERSE: { ticker: string; cik: number; name: string; sector: string }[] = [
  { ticker: 'AAPL', cik: 320193, name: 'Apple', sector: 'Technology' },
  { ticker: 'MSFT', cik: 789019, name: 'Microsoft', sector: 'Technology' },
  { ticker: 'NVDA', cik: 1045810, name: 'Nvidia', sector: 'Technology' },
  { ticker: 'GOOGL', cik: 1652044, name: 'Alphabet', sector: 'Communication' },
  { ticker: 'META', cik: 1326801, name: 'Meta Platforms', sector: 'Communication' },
  { ticker: 'AMZN', cik: 1018724, name: 'Amazon', sector: 'Consumer' },
  { ticker: 'ORCL', cik: 1341439, name: 'Oracle', sector: 'Technology' },
  { ticker: 'CSCO', cik: 858877, name: 'Cisco', sector: 'Technology' },
  { ticker: 'ADBE', cik: 796343, name: 'Adobe', sector: 'Technology' },
  { ticker: 'CRM', cik: 1108524, name: 'Salesforce', sector: 'Technology' },
  { ticker: 'INTC', cik: 50863, name: 'Intel', sector: 'Technology' },
  { ticker: 'AMD', cik: 2488, name: 'AMD', sector: 'Technology' },
  { ticker: 'QCOM', cik: 804328, name: 'Qualcomm', sector: 'Technology' },
  { ticker: 'TXN', cik: 97476, name: 'Texas Instruments', sector: 'Technology' },
  { ticker: 'IBM', cik: 51143, name: 'IBM', sector: 'Technology' },
  { ticker: 'AVGO', cik: 1730168, name: 'Broadcom', sector: 'Technology' },
  { ticker: 'ACN', cik: 1467373, name: 'Accenture', sector: 'Technology' },
  { ticker: 'INTU', cik: 896878, name: 'Intuit', sector: 'Technology' },
  { ticker: 'NFLX', cik: 1065280, name: 'Netflix', sector: 'Communication' },
  { ticker: 'WMT', cik: 104169, name: 'Walmart', sector: 'Consumer staples' },
  { ticker: 'COST', cik: 909832, name: 'Costco', sector: 'Consumer staples' },
  { ticker: 'HD', cik: 354950, name: 'Home Depot', sector: 'Consumer' },
  { ticker: 'LOW', cik: 60667, name: 'Lowe’s', sector: 'Consumer' },
  { ticker: 'MCD', cik: 63908, name: 'McDonald’s', sector: 'Consumer' },
  { ticker: 'NKE', cik: 320187, name: 'Nike', sector: 'Consumer' },
  { ticker: 'SBUX', cik: 829224, name: 'Starbucks', sector: 'Consumer' },
  { ticker: 'KO', cik: 21344, name: 'Coca-Cola', sector: 'Consumer staples' },
  { ticker: 'PEP', cik: 77476, name: 'PepsiCo', sector: 'Consumer staples' },
  { ticker: 'PG', cik: 80424, name: 'Procter & Gamble', sector: 'Consumer staples' },
  { ticker: 'CL', cik: 21665, name: 'Colgate-Palmolive', sector: 'Consumer staples' },
  { ticker: 'TGT', cik: 27419, name: 'Target', sector: 'Consumer staples' },
  { ticker: 'MDLZ', cik: 1103982, name: 'Mondelez', sector: 'Consumer staples' },
  { ticker: 'PM', cik: 1413329, name: 'Philip Morris International', sector: 'Consumer staples' },
  { ticker: 'MO', cik: 764180, name: 'Altria', sector: 'Consumer staples' },
  { ticker: 'JNJ', cik: 200406, name: 'Johnson & Johnson', sector: 'Health care' },
  { ticker: 'PFE', cik: 78003, name: 'Pfizer', sector: 'Health care' },
  { ticker: 'MRK', cik: 310158, name: 'Merck', sector: 'Health care' },
  { ticker: 'ABBV', cik: 1551152, name: 'AbbVie', sector: 'Health care' },
  { ticker: 'LLY', cik: 59478, name: 'Eli Lilly', sector: 'Health care' },
  { ticker: 'UNH', cik: 731766, name: 'UnitedHealth', sector: 'Health care' },
  { ticker: 'TMO', cik: 97745, name: 'Thermo Fisher Scientific', sector: 'Health care' },
  { ticker: 'ABT', cik: 1800, name: 'Abbott Laboratories', sector: 'Health care' },
  { ticker: 'AMGN', cik: 318154, name: 'Amgen', sector: 'Health care' },
  { ticker: 'GILD', cik: 882095, name: 'Gilead Sciences', sector: 'Health care' },
  { ticker: 'BMY', cik: 14272, name: 'Bristol-Myers Squibb', sector: 'Health care' },
  { ticker: 'MDT', cik: 1613103, name: 'Medtronic', sector: 'Health care' },
  { ticker: 'DHR', cik: 313616, name: 'Danaher', sector: 'Health care' },
  { ticker: 'CVS', cik: 64803, name: 'CVS Health', sector: 'Health care' },
  { ticker: 'CAT', cik: 18230, name: 'Caterpillar', sector: 'Industrials' },
  { ticker: 'DE', cik: 315189, name: 'Deere', sector: 'Industrials' },
  { ticker: 'HON', cik: 773840, name: 'Honeywell', sector: 'Industrials' },
  { ticker: 'GE', cik: 40545, name: 'GE Aerospace', sector: 'Industrials' },
  { ticker: 'MMM', cik: 66740, name: '3M', sector: 'Industrials' },
  { ticker: 'UPS', cik: 1090727, name: 'UPS', sector: 'Industrials' },
  { ticker: 'UNP', cik: 100885, name: 'Union Pacific', sector: 'Industrials' },
  { ticker: 'LMT', cik: 936468, name: 'Lockheed Martin', sector: 'Industrials' },
  { ticker: 'RTX', cik: 101829, name: 'RTX', sector: 'Industrials' },
  { ticker: 'BA', cik: 12927, name: 'Boeing', sector: 'Industrials' },
  { ticker: 'XOM', cik: 34088, name: 'Exxon Mobil', sector: 'Energy' },
  { ticker: 'CVX', cik: 93410, name: 'Chevron', sector: 'Energy' },
  { ticker: 'COP', cik: 1163165, name: 'ConocoPhillips', sector: 'Energy' },
  { ticker: 'VZ', cik: 732712, name: 'Verizon', sector: 'Communication' },
  { ticker: 'T', cik: 732717, name: 'AT&T', sector: 'Communication' },
  { ticker: 'DIS', cik: 1744489, name: 'Disney', sector: 'Communication' },
  { ticker: 'CMCSA', cik: 1166691, name: 'Comcast', sector: 'Communication' },
  { ticker: 'TSLA', cik: 1318605, name: 'Tesla', sector: 'Consumer' },
  { ticker: 'LIN', cik: 1707925, name: 'Linde', sector: 'Materials' },
  { ticker: 'NEE', cik: 753308, name: 'NextEra Energy', sector: 'Utilities' },
  { ticker: 'DUK', cik: 1326160, name: 'Duke Energy', sector: 'Utilities' },
  { ticker: 'SO', cik: 92122, name: 'Southern Company', sector: 'Utilities' },
];

export const BENCHMARK = { ticker: 'SPY', name: 'S&P 500 (SPY fund)' };

const BY_TICKER = new Map(UNIVERSE.map((u) => [u.ticker, u]));

/**
 * The covered company for a ticker typed in a URL, in any case, or null.
 * Callers check this before touching cached data, so made-up tickers can't fill the cache.
 */
export function findCompany(raw: string): (typeof UNIVERSE)[number] | null {
  return BY_TICKER.get(raw.trim().toUpperCase()) ?? null;
}
