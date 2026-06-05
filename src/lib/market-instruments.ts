export type InstrumentType = "index" | "ETF" | "futures" | "commodity" | "crypto";
export type PriceFreshness = "real-time" | "delayed" | "EOD" | "demo";

export interface MarketInstrumentMeta {
  symbol: string;
  displayName: string;
  instrumentType: InstrumentType;
  dataSource: string;
  priceFreshness: PriceFreshness;
  description: string;
  category: string;
  icon: string;
  expectedRange?: [number, number];
}

export const MARKET_INSTRUMENTS: Record<string, MarketInstrumentMeta> = {
  SPY: {
    symbol: "SPY",
    displayName: "SPY - S&P 500 ETF",
    instrumentType: "ETF",
    dataSource: "market provider quote for SPY",
    priceFreshness: "delayed",
    description: "ETF tracking S&P 500. To nie jest wartosc indeksu SPX.",
    category: "Equities",
    icon: "📈",
    expectedRange: [100, 1000],
  },
  QQQ: {
    symbol: "QQQ",
    displayName: "QQQ - Nasdaq 100 ETF",
    instrumentType: "ETF",
    dataSource: "market provider quote for QQQ",
    priceFreshness: "delayed",
    description: "ETF tracking Nasdaq 100. To nie jest wartosc indeksu NDX.",
    category: "Equities",
    icon: "💻",
    expectedRange: [100, 1000],
  },
  DIA: {
    symbol: "DIA",
    displayName: "DIA - Dow Jones ETF",
    instrumentType: "ETF",
    dataSource: "market provider quote for DIA",
    priceFreshness: "delayed",
    description: "ETF tracking Dow Jones Industrial Average. To nie jest wartosc indeksu DJIA.",
    category: "Equities",
    icon: "🏛️",
    expectedRange: [100, 1000],
  },
  IWM: {
    symbol: "IWM",
    displayName: "IWM - Russell 2000 ETF",
    instrumentType: "ETF",
    dataSource: "market provider quote for IWM",
    priceFreshness: "delayed",
    description: "ETF tracking Russell 2000. To nie jest wartosc indeksu RUT.",
    category: "Equities",
    icon: "🏢",
    expectedRange: [100, 500],
  },
  "^VIX": {
    symbol: "^VIX",
    displayName: "^VIX - CBOE Volatility Index",
    instrumentType: "index",
    dataSource: "market provider index quote",
    priceFreshness: "delayed",
    description: "Indeks zmiennosci S&P 500.",
    category: "Volatility",
    icon: "⚡",
    expectedRange: [5, 100],
  },
  "DX-Y.NYB": {
    symbol: "DX-Y.NYB",
    displayName: "DX-Y.NYB - US Dollar Index",
    instrumentType: "index",
    dataSource: "market provider index quote",
    priceFreshness: "delayed",
    description: "Indeks sily dolara amerykanskiego.",
    category: "Currencies",
    icon: "💵",
    expectedRange: [70, 150],
  },
  "^TNX": {
    symbol: "^TNX",
    displayName: "^TNX - US 10Y Yield",
    instrumentType: "index",
    dataSource: "market provider yield quote",
    priceFreshness: "delayed",
    description: "Rentownosc 10-letnich obligacji USA.",
    category: "Bonds",
    icon: "🏦",
    expectedRange: [0, 10],
  },
  "GC=F": {
    symbol: "GC=F",
    displayName: "GC=F - Gold Futures",
    instrumentType: "futures",
    dataSource: "market provider futures quote",
    priceFreshness: "delayed",
    description: "Zloto, kontrakt terminowy COMEX.",
    category: "Commodities",
    icon: "🥇",
    expectedRange: [500, 10000],
  },
  "CL=F": {
    symbol: "CL=F",
    displayName: "CL=F - WTI Crude Oil Futures",
    instrumentType: "futures",
    dataSource: "market provider futures quote",
    priceFreshness: "delayed",
    description: "Ropa WTI, kontrakt terminowy NYMEX.",
    category: "Commodities",
    icon: "🛢️",
    expectedRange: [10, 250],
  },
  "BTC-USD": {
    symbol: "BTC-USD",
    displayName: "BTC-USD - Bitcoin USD",
    instrumentType: "crypto",
    dataSource: "market provider crypto USD pair",
    priceFreshness: "delayed",
    description: "Bitcoin quoted as USD pair.",
    category: "Crypto",
    icon: "₿",
    expectedRange: [1000, 1000000],
  },
  "ETH-USD": {
    symbol: "ETH-USD",
    displayName: "ETH-USD - Ethereum USD",
    instrumentType: "crypto",
    dataSource: "market provider crypto USD pair",
    priceFreshness: "delayed",
    description: "Ethereum quoted as USD pair.",
    category: "Crypto",
    icon: "⟠",
    expectedRange: [100, 100000],
  },
};

export function getMarketInstrumentMeta(symbol: string): MarketInstrumentMeta | null {
  return MARKET_INSTRUMENTS[symbol] ?? null;
}

export function validateMarketInstrumentValue(symbol: string, value: number | null): string[] {
  const meta = getMarketInstrumentMeta(symbol);
  if (!meta || value === null || !Number.isFinite(value)) return [];

  const warnings: string[] = [];
  if (meta.expectedRange) {
    const [min, max] = meta.expectedRange;
    if (value < min || value > max) {
      warnings.push(`${symbol} value ${value} is outside expected ${meta.instrumentType} range ${min}-${max}.`);
    }
  }

  if (symbol === "DIA" && value > 1000) {
    warnings.push("DIA is an ETF; a value in thousands would look like the Dow Jones index instead.");
  }
  if ((symbol === "SPY" || symbol === "QQQ") && value > 1000) {
    warnings.push(`${symbol} is an ETF; value looks like a raw index level.`);
  }
  if (symbol === "BTC-USD" && !symbol.endsWith("-USD")) {
    warnings.push("Crypto instrument must be displayed as a USD pair.");
  }

  return warnings;
}
