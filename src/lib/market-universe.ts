export interface MarketUniverseEntry {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  indices: Array<"SP500" | "NASDAQ" | "DOW">;
}

export const MARKET_UNIVERSE: MarketUniverseEntry[] = [
  { ticker: "AAPL", company_name: "Apple", sector: "Technology", market_cap: 2900000000000, indices: ["SP500", "NASDAQ", "DOW"] },
  { ticker: "MSFT", company_name: "Microsoft", sector: "Technology", market_cap: 3300000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "NVDA", company_name: "NVIDIA", sector: "Artificial Intelligence", market_cap: 3100000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "AMD", company_name: "AMD", sector: "Artificial Intelligence", market_cap: 300000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "AVGO", company_name: "Broadcom", sector: "Artificial Intelligence", market_cap: 900000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "META", company_name: "Meta Platforms", sector: "Technology", market_cap: 1200000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "GOOGL", company_name: "Alphabet", sector: "Technology", market_cap: 2200000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "AMZN", company_name: "Amazon", sector: "Consumer", market_cap: 1900000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "TSLA", company_name: "Tesla", sector: "Consumer", market_cap: 600000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "NFLX", company_name: "Netflix", sector: "Technology", market_cap: 300000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "ADBE", company_name: "Adobe", sector: "Technology", market_cap: 200000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "QCOM", company_name: "Qualcomm", sector: "Technology", market_cap: 180000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "CSCO", company_name: "Cisco", sector: "Technology", market_cap: 190000000000, indices: ["SP500", "NASDAQ", "DOW"] },
  { ticker: "ORCL", company_name: "Oracle", sector: "Technology", market_cap: 450000000000, indices: ["SP500", "NYSE"] as Array<"SP500" | "NASDAQ" | "DOW"> },
  { ticker: "IBM", company_name: "IBM", sector: "Technology", market_cap: 220000000000, indices: ["SP500", "DOW"] },
  { ticker: "PLTR", company_name: "Palantir", sector: "Artificial Intelligence", market_cap: 300000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "JNJ", company_name: "Johnson & Johnson", sector: "Healthcare", market_cap: 360000000000, indices: ["SP500", "DOW"] },
  { ticker: "UNH", company_name: "UnitedHealth", sector: "Healthcare", market_cap: 460000000000, indices: ["SP500", "DOW"] },
  { ticker: "PFE", company_name: "Pfizer", sector: "Healthcare", market_cap: 170000000000, indices: ["SP500"] },
  { ticker: "MRK", company_name: "Merck", sector: "Healthcare", market_cap: 330000000000, indices: ["SP500", "DOW"] },
  { ticker: "XOM", company_name: "Exxon Mobil", sector: "Energy", market_cap: 520000000000, indices: ["SP500", "DOW"] },
  { ticker: "CVX", company_name: "Chevron", sector: "Energy", market_cap: 280000000000, indices: ["SP500", "DOW"] },
  { ticker: "SLB", company_name: "Schlumberger", sector: "Energy", market_cap: 65000000000, indices: ["SP500"] },
  { ticker: "JPM", company_name: "JPMorgan", sector: "Finance", market_cap: 600000000000, indices: ["SP500", "DOW"] },
  { ticker: "GS", company_name: "Goldman Sachs", sector: "Finance", market_cap: 170000000000, indices: ["SP500", "DOW"] },
  { ticker: "BAC", company_name: "Bank of America", sector: "Finance", market_cap: 320000000000, indices: ["SP500"] },
  { ticker: "MS", company_name: "Morgan Stanley", sector: "Finance", market_cap: 220000000000, indices: ["SP500"] },
  { ticker: "WMT", company_name: "Walmart", sector: "Consumer", market_cap: 550000000000, indices: ["SP500", "DOW"] },
  { ticker: "COST", company_name: "Costco", sector: "Consumer", market_cap: 390000000000, indices: ["SP500", "NASDAQ"] },
  { ticker: "PG", company_name: "Procter & Gamble", sector: "Consumer", market_cap: 420000000000, indices: ["SP500", "DOW"] },
  { ticker: "KO", company_name: "Coca-Cola", sector: "Consumer", market_cap: 310000000000, indices: ["SP500", "DOW"] },
  { ticker: "CAT", company_name: "Caterpillar", sector: "Industrial", market_cap: 170000000000, indices: ["SP500", "DOW"] },
  { ticker: "GE", company_name: "GE Aerospace", sector: "Industrial", market_cap: 230000000000, indices: ["SP500"] },
  { ticker: "BA", company_name: "Boeing", sector: "Industrial", market_cap: 120000000000, indices: ["SP500", "DOW"] },
  { ticker: "NEE", company_name: "NextEra Energy", sector: "Utilities", market_cap: 160000000000, indices: ["SP500"] },
  { ticker: "DUK", company_name: "Duke Energy", sector: "Utilities", market_cap: 90000000000, indices: ["SP500"] },
  { ticker: "SO", company_name: "Southern Company", sector: "Utilities", market_cap: 100000000000, indices: ["SP500"] },
  { ticker: "PLD", company_name: "Prologis", sector: "Real Estate", market_cap: 100000000000, indices: ["SP500"] },
  { ticker: "AMT", company_name: "American Tower", sector: "Real Estate", market_cap: 90000000000, indices: ["SP500"] },
  { ticker: "O", company_name: "Realty Income", sector: "Real Estate", market_cap: 50000000000, indices: ["SP500"] },
];

export const MARKET_UNIVERSE_BY_TICKER = Object.fromEntries(
  MARKET_UNIVERSE.map((entry) => [entry.ticker, entry])
) as Record<string, MarketUniverseEntry>;