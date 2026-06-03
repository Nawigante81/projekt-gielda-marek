import type { OHLCV, TechnicalResult } from "./technicals";

export interface ScoreBreakdown {
  trend: number;
  rsi: number;
  macd: number;
  volume: number;
  sma: number;
  ema: number;
  bollinger: number;
  adx: number;
  sentiment: number;
}

export interface StockScoringInput {
  price: number;
  changePct: number;
  volume: number;
  history: OHLCV[];
  technicals: TechnicalResult;
  sentimentScore: number;
}

export interface StockScoreResult {
  score: number;
  recommendation: string;
  breakdown: ScoreBreakdown;
  summary: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function movingAverageVolume(history: OHLCV[], period: number): number {
  const volumes = history.slice(-period).map((entry) => entry.volume || 0).filter(Boolean);
  return avg(volumes);
}

function classifyScore(score: number): string {
  if (score >= 90) return "Strong Buy";
  if (score >= 70) return "Buy";
  if (score >= 50) return "Hold";
  if (score >= 30) return "Sell";
  return "Strong Sell";
}

export function classifyAiScore(score: number): string {
  return classifyScore(score);
}

export function calculateStockScore(input: StockScoringInput): StockScoreResult {
  const { price, changePct, volume, history, technicals, sentimentScore } = input;
  const breakdown: ScoreBreakdown = {
    trend: 0,
    rsi: 0,
    macd: 0,
    volume: 0,
    sma: 0,
    ema: 0,
    bollinger: 0,
    adx: 0,
    sentiment: 0,
  };
  const summary: string[] = [];

  const avgVolume20 = movingAverageVolume(history, 20);
  const closeSeries = history.slice(-30).map((entry) => entry.close);
  const firstClose = closeSeries[0] || price;
  const lastClose = closeSeries[closeSeries.length - 1] || price;
  const localTrendPct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : changePct;

  const bullishTrendCount = [technicals.signal_sma, technicals.signal_ema, technicals.signal_ichimoku].filter(
    (signal) => signal === "bullish"
  ).length;
  const bearishTrendCount = [technicals.signal_sma, technicals.signal_ema, technicals.signal_ichimoku].filter(
    (signal) => signal === "bearish"
  ).length;
  breakdown.trend = round(
    clamp(10 + localTrendPct * 0.7 + bullishTrendCount * 2.5 - bearishTrendCount * 3, 0, 20)
  );
  if (breakdown.trend >= 14) summary.push("Silny trend cenowy");
  if (breakdown.trend <= 6) summary.push("Słaby lub negatywny trend");

  if (technicals.rsi_14 !== null) {
    const rsi = technicals.rsi_14;
    let rsiScore = 5;
    if (rsi >= 45 && rsi <= 60) rsiScore = 10;
    else if (rsi >= 35 && rsi < 45) rsiScore = 8.5;
    else if (rsi > 60 && rsi <= 68) rsiScore = 7;
    else if (rsi >= 25 && rsi < 35) rsiScore = 7.5;
    else if (rsi > 68 && rsi <= 75) rsiScore = 4;
    else if (rsi < 25) rsiScore = 5.5;
    else if (rsi > 75) rsiScore = 1.5;
    breakdown.rsi = round(clamp(rsiScore, 0, 10));
    if (rsi < 30) summary.push("RSI w strefie wyprzedania");
    if (rsi > 70) summary.push("RSI w strefie wykupienia");
  }

  if (technicals.macd_line !== null && technicals.macd_signal !== null) {
    const macdDiff = technicals.macd_line - technicals.macd_signal;
    breakdown.macd = round(
      clamp(
        technicals.signal_macd === "bullish"
          ? 7 + clamp(macdDiff * 20, 0, 3)
          : technicals.signal_macd === "bearish"
          ? 3 - clamp(Math.abs(macdDiff) * 15, 0, 3)
          : 5,
        0,
        10
      )
    );
  }

  if (avgVolume20 > 0) {
    const relativeVolume = volume / avgVolume20;
    const positivePriceBias = changePct >= 0 ? 1.15 : 0.8;
    breakdown.volume = round(clamp(relativeVolume * 5 * positivePriceBias, 0, 15));
    if (relativeVolume >= 3) summary.push("Wolumen powyżej 300% średniej");
  }

  const smaTargets = [technicals.sma_20, technicals.sma_50, technicals.sma_200].filter(
    (value): value is number => value !== null
  );
  if (smaTargets.length > 0) {
    const aboveCount = smaTargets.filter((value) => price > value).length;
    breakdown.sma = round(clamp((aboveCount / smaTargets.length) * 10, 0, 10));
    if (technicals.sma_200 !== null && price > technicals.sma_200) {
      summary.push("Cena powyżej SMA200");
    }
  }

  const emaTargets = [technicals.ema_12, technicals.ema_26, technicals.ema_50].filter(
    (value): value is number => value !== null
  );
  if (emaTargets.length > 0) {
    const alignedBullish = technicals.ema_12 !== null && technicals.ema_26 !== null && technicals.ema_50 !== null
      ? technicals.ema_12 >= technicals.ema_26 && technicals.ema_26 >= technicals.ema_50
      : false;
    const aboveCount = emaTargets.filter((value) => price >= value).length;
    breakdown.ema = round(clamp((aboveCount / emaTargets.length) * 8 + (alignedBullish ? 2 : 0), 0, 10));
    if (alignedBullish) summary.push("EMA w układzie wzrostowym");
  }

  if (technicals.bb_upper !== null && technicals.bb_lower !== null && technicals.bb_middle !== null) {
    const bandRange = technicals.bb_upper - technicals.bb_lower;
    const bandPosition = bandRange > 0 ? (price - technicals.bb_lower) / bandRange : 0.5;
    const bbScore = bandPosition >= 0.35 && bandPosition <= 0.72
      ? 10
      : bandPosition < 0.2
      ? 8
      : bandPosition > 0.9
      ? 3
      : 6;
    breakdown.bollinger = round(clamp(bbScore, 0, 10));
  }

  if (technicals.adx !== null) {
    const trendDirection = technicals.plus_di !== null && technicals.minus_di !== null
      ? technicals.plus_di - technicals.minus_di
      : 0;
    breakdown.adx = round(
      clamp((technicals.adx / 40) * 5 + (trendDirection > 0 ? 1 : trendDirection < 0 ? -1.5 : 0), 0, 5)
    );
  }

  breakdown.sentiment = round(clamp(((sentimentScore + 100) / 200) * 10, 0, 10));
  if (sentimentScore >= 25) summary.push("Pozytywny sentyment newsów");
  if (sentimentScore <= -25) summary.push("Negatywny sentyment newsów");

  const rawScore =
    breakdown.trend +
    breakdown.rsi +
    breakdown.macd +
    breakdown.volume +
    breakdown.sma +
    breakdown.ema +
    breakdown.bollinger +
    breakdown.adx +
    breakdown.sentiment;

  const score = round(clamp(rawScore, 0, 100));
  const recommendation = classifyScore(score);

  return {
    score,
    recommendation,
    breakdown,
    summary: [...new Set(summary)],
  };
}