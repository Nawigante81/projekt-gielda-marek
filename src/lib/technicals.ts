// Technical indicators calculated from OHLCV data

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalResult {
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;
  ema_50: number | null;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  bb_width: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  adx: number | null;
  plus_di: number | null;
  minus_di: number | null;
  ichimoku_tenkan: number | null;
  ichimoku_kijun: number | null;
  ichimoku_senkou_a: number | null;
  ichimoku_senkou_b: number | null;
  fib_0: number | null;
  fib_236: number | null;
  fib_382: number | null;
  fib_500: number | null;
  fib_618: number | null;
  fib_100: number | null;
  signal_sma: string;
  signal_ema: string;
  signal_macd: string;
  signal_rsi: string;
  signal_bb: string;
  signal_stoch: string;
  signal_adx: string;
  signal_ichimoku: string;
  signal_fib: string;
  overall_signal: string;
  overall_score: number;
}

function sma(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let emaPrev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(emaPrev);
  for (let i = period; i < data.length; i++) {
    const emaVal = data[i] * k + emaPrev * (1 - k);
    result.push(emaVal);
    emaPrev = emaVal;
  }
  return result;
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function bollinger(
  closes: number[],
  period = 20,
  stdDev = 2
): { upper: number; middle: number; lower: number; width: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = middle + stdDev * std;
  const lower = middle - stdDev * std;
  const width = middle > 0 ? ((upper - lower) / middle) * 100 : 0;
  return { upper, middle, lower, width };
}

function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
): { k: number; d: number } | null {
  if (closes.length < kPeriod) return null;
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const hSlice = highs.slice(i - kPeriod + 1, i + 1);
    const lSlice = lows.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...hSlice);
    const lowestLow = Math.min(...lSlice);
    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    kValues.push(k);
  }
  if (kValues.length < dPeriod) return null;
  const k = kValues[kValues.length - 1];
  const d =
    kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
  return { k, d };
}

function adxCalc(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number; plusDI: number; minusDI: number } | null {
  if (closes.length < period + 1) return null;
  const trList: number[] = [];
  const plusDMList: number[] = [];
  const minusDMList: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const upMove = h - highs[i - 1];
    const downMove = lows[i - 1] - l;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    trList.push(tr);
    plusDMList.push(plusDM);
    minusDMList.push(minusDM);
  }

  if (trList.length < period) return null;

  let smoothTR = trList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMList.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMList
    .slice(0, period)
    .reduce((a, b) => a + b, 0);

  const dxList: number[] = [];
  for (let i = period; i < trList.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trList[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMList[i];
    smoothMinusDM =
      smoothMinusDM - smoothMinusDM / period + minusDMList[i];
    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxList.push(dx);
  }

  if (dxList.length < period) return null;
  const adxVal = dxList.slice(-period).reduce((a, b) => a + b, 0) / period;
  const lastTR =
    smoothTR - smoothTR / period + trList[trList.length - 1];
  const lastPlusDM =
    smoothPlusDM -
    smoothPlusDM / period +
    plusDMList[plusDMList.length - 1];
  const lastMinusDM =
    smoothMinusDM -
    smoothMinusDM / period +
    minusDMList[minusDMList.length - 1];
  const plusDI = lastTR > 0 ? (lastPlusDM / lastTR) * 100 : 0;
  const minusDI = lastTR > 0 ? (lastMinusDM / lastTR) * 100 : 0;

  return { adx: adxVal, plusDI, minusDI };
}

function ichimoku(highs: number[], lows: number[], closes: number[]) {
  const high9 = highs.slice(-9);
  const low9 = lows.slice(-9);
  const high26 = highs.slice(-26);
  const low26 = lows.slice(-26);
  const high52 = highs.slice(-52);
  const low52 = lows.slice(-52);

  if (high9.length < 9 || high26.length < 26) return null;

  const tenkan = (Math.max(...high9) + Math.min(...low9)) / 2;
  const kijun = (Math.max(...high26) + Math.min(...low26)) / 2;
  const senkouA = (tenkan + kijun) / 2;
  const senkouB =
    high52.length >= 52
      ? (Math.max(...high52) + Math.min(...low52)) / 2
      : null;

  return { tenkan, kijun, senkouA, senkouB };
}

function fibonacci(highs: number[], lows: number[], lookback = 50) {
  const h = highs.slice(-lookback);
  const l = lows.slice(-lookback);
  if (h.length < 10) return null;
  const high = Math.max(...h);
  const low = Math.min(...l);
  const diff = high - low;
  return {
    fib_0: low,
    fib_236: low + diff * 0.236,
    fib_382: low + diff * 0.382,
    fib_500: low + diff * 0.5,
    fib_618: low + diff * 0.618,
    fib_100: high,
  };
}

function signalFromValue(
  indicator: string,
  values: Record<string, number | null>,
  currentPrice: number
): string {
  switch (indicator) {
    case "rsi": {
      const r = values.rsi_14;
      if (r === null) return "no_data";
      if (r > 70) return "bearish"; // overbought
      if (r < 30) return "bullish"; // oversold
      if (r > 55) return "bullish";
      if (r < 45) return "bearish";
      return "neutral";
    }
    case "macd": {
      const hist = values.macd_histogram;
      const line = values.macd_line;
      if (hist === null || line === null) return "no_data";
      if (hist > 0 && line > 0) return "bullish";
      if (hist < 0 && line < 0) return "bearish";
      if (hist > 0) return "bullish";
      if (hist < 0) return "bearish";
      return "neutral";
    }
    case "sma": {
      const s20 = values.sma_20;
      const s50 = values.sma_50;
      const s200 = values.sma_200;
      if (s20 === null) return "no_data";
      if (s200 !== null && currentPrice > s200 && currentPrice > s50! && currentPrice > s20) return "bullish";
      if (s200 !== null && currentPrice < s200 && currentPrice < s50! && currentPrice < s20) return "bearish";
      if (currentPrice > s20) return "bullish";
      if (currentPrice < s20) return "bearish";
      return "neutral";
    }
    case "ema": {
      const e12 = values.ema_12;
      const e26 = values.ema_26;
      if (e12 === null || e26 === null) return "no_data";
      if (e12 > e26 && currentPrice > e12) return "bullish";
      if (e12 < e26 && currentPrice < e12) return "bearish";
      return "neutral";
    }
    case "bb": {
      const upper = values.bb_upper;
      const lower = values.bb_lower;
      const middle = values.bb_middle;
      if (upper === null || lower === null) return "no_data";
      if (currentPrice > upper) return "bearish"; // overbought
      if (currentPrice < lower) return "bullish"; // oversold
      if (middle && currentPrice > middle) return "bullish";
      if (middle && currentPrice < middle) return "bearish";
      return "neutral";
    }
    case "stoch": {
      const k = values.stoch_k;
      const d = values.stoch_d;
      if (k === null || d === null) return "no_data";
      if (k > 80 && d > 80) return "bearish"; // overbought
      if (k < 20 && d < 20) return "bullish"; // oversold
      if (k > d && k > 50) return "bullish";
      if (k < d && k < 50) return "bearish";
      return "neutral";
    }
    case "adx": {
      const adxV = values.adx;
      const plusDI = values.plus_di;
      const minusDI = values.minus_di;
      if (adxV === null) return "no_data";
      if (adxV < 20) return "neutral"; // weak trend
      if (adxV >= 25 && plusDI !== null && minusDI !== null) {
        if (plusDI > minusDI) return "bullish";
        if (minusDI > plusDI) return "bearish";
      }
      return "neutral";
    }
    case "ichimoku": {
      const tenkan = values.ichimoku_tenkan;
      const kijun = values.ichimoku_kijun;
      const senkouA = values.ichimoku_senkou_a;
      if (tenkan === null || kijun === null) return "no_data";
      if (currentPrice > tenkan && currentPrice > kijun) {
        if (senkouA && currentPrice > senkouA) return "bullish";
        return "bullish";
      }
      if (currentPrice < tenkan && currentPrice < kijun) {
        if (senkouA && currentPrice < senkouA) return "bearish";
        return "bearish";
      }
      return "neutral";
    }
    case "fib": {
      const f382 = values.fib_382;
      const f618 = values.fib_618;
      const f500 = values.fib_500;
      if (f382 === null || f618 === null) return "no_data";
      if (Math.abs(currentPrice - f382) / currentPrice < 0.02) return "bullish";
      if (Math.abs(currentPrice - f618) / currentPrice < 0.02) return "bearish";
      if (f500 && currentPrice > f500) return "bullish";
      return "neutral";
    }
    default:
      return "neutral";
  }
}

function computeOverallSignal(signals: string[]): { signal: string; score: number } {
  const weights: Record<string, number> = {
    bullish: 1,
    bearish: -1,
    neutral: 0,
    no_data: 0,
  };

  const validSignals = signals.filter(s => s !== "no_data");
  if (validSignals.length === 0) return { signal: "neutral", score: 0 };

  const score = validSignals.reduce((sum, s) => sum + (weights[s] || 0), 0);
  const normalizedScore = score / validSignals.length;

  let signal: string;
  if (normalizedScore >= 0.7) signal = "strong_bullish";
  else if (normalizedScore >= 0.35) signal = "bullish";
  else if (normalizedScore >= 0.1) signal = "watch";
  else if (normalizedScore <= -0.7) signal = "strong_bearish";
  else if (normalizedScore <= -0.35) signal = "bearish";
  else if (normalizedScore <= -0.1) signal = "risk";
  else signal = "neutral";

  return { signal, score: normalizedScore };
}

export function calculateTechnicals(data: OHLCV[]): TechnicalResult | null {
  if (!data || data.length < 20) return null;

  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const currentPrice = closes[closes.length - 1];

  // SMA
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);

  // EMA
  const ema12Arr = ema(closes, 12);
  const ema26Arr = ema(closes, 26);
  const ema50Arr = ema(closes, 50);
  const ema12 = ema12Arr.length > 0 ? ema12Arr[ema12Arr.length - 1] : null;
  const ema26 = ema26Arr.length > 0 ? ema26Arr[ema26Arr.length - 1] : null;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : null;

  // RSI
  const rsi14 = rsi(closes, 14);

  // MACD
  let macdLine: number | null = null;
  let macdSignal: number | null = null;
  let macdHistogram: number | null = null;
  if (ema12Arr.length > 0 && ema26Arr.length > 0) {
    const macdArr: number[] = [];
    const maxLen = Math.min(ema12Arr.length, ema26Arr.length);
    for (let i = 0; i < maxLen; i++) {
      macdArr.push(ema12Arr[ema12Arr.length - maxLen + i] - ema26Arr[ema26Arr.length - maxLen + i]);
    }
    macdLine = macdArr[macdArr.length - 1];
    const signalArr = ema(macdArr, 9);
    if (signalArr.length > 0) {
      macdSignal = signalArr[signalArr.length - 1];
      macdHistogram = macdLine - macdSignal;
    }
  }

  // Bollinger Bands
  const bb = bollinger(closes, 20, 2);

  // Stochastic
  const stoch = stochastic(highs, lows, closes, 14, 3);

  // ADX
  const adxResult = adxCalc(highs, lows, closes, 14);

  // Ichimoku
  const ichi = ichimoku(highs, lows, closes);

  // Fibonacci
  const fib = fibonacci(highs, lows, 50);

  // Values object for signals
  const values = {
    sma_20: sma20,
    sma_50: sma50,
    sma_200: sma200,
    ema_12: ema12,
    ema_26: ema26,
    rsi_14: rsi14,
    macd_line: macdLine,
    macd_signal: macdSignal,
    macd_histogram: macdHistogram,
    bb_upper: bb?.upper ?? null,
    bb_lower: bb?.lower ?? null,
    bb_middle: bb?.middle ?? null,
    stoch_k: stoch?.k ?? null,
    stoch_d: stoch?.d ?? null,
    adx: adxResult?.adx ?? null,
    plus_di: adxResult?.plusDI ?? null,
    minus_di: adxResult?.minusDI ?? null,
    ichimoku_tenkan: ichi?.tenkan ?? null,
    ichimoku_kijun: ichi?.kijun ?? null,
    ichimoku_senkou_a: ichi?.senkouA ?? null,
    fib_382: fib?.fib_382 ?? null,
    fib_618: fib?.fib_618 ?? null,
    fib_500: fib?.fib_500 ?? null,
  };

  // Compute signals
  const signal_sma = signalFromValue("sma", values, currentPrice);
  const signal_ema = signalFromValue("ema", values, currentPrice);
  const signal_macd = signalFromValue("macd", values, currentPrice);
  const signal_rsi = signalFromValue("rsi", values, currentPrice);
  const signal_bb = signalFromValue("bb", values, currentPrice);
  const signal_stoch = signalFromValue("stoch", values, currentPrice);
  const signal_adx = signalFromValue("adx", values, currentPrice);
  const signal_ichimoku = signalFromValue("ichimoku", values, currentPrice);
  const signal_fib = signalFromValue("fib", values, currentPrice);

  // Overall signal (weighted by importance)
  const allSignals = [
    signal_sma,
    signal_ema,
    signal_macd,
    signal_fib,
    signal_stoch,
    signal_bb,
    signal_rsi,
    signal_adx,
    signal_ichimoku,
  ];
  const { signal: overall_signal, score: overall_score } =
    computeOverallSignal(allSignals);

  return {
    sma_20: sma20,
    sma_50: sma50,
    sma_200: sma200,
    ema_12: ema12,
    ema_26: ema26,
    ema_50: ema50,
    rsi_14: rsi14,
    macd_line: macdLine,
    macd_signal: macdSignal,
    macd_histogram: macdHistogram,
    bb_upper: bb?.upper ?? null,
    bb_middle: bb?.middle ?? null,
    bb_lower: bb?.lower ?? null,
    bb_width: bb?.width ?? null,
    stoch_k: stoch?.k ?? null,
    stoch_d: stoch?.d ?? null,
    adx: adxResult?.adx ?? null,
    plus_di: adxResult?.plusDI ?? null,
    minus_di: adxResult?.minusDI ?? null,
    ichimoku_tenkan: ichi?.tenkan ?? null,
    ichimoku_kijun: ichi?.kijun ?? null,
    ichimoku_senkou_a: ichi?.senkouA ?? null,
    ichimoku_senkou_b: ichi?.senkouB ?? null,
    fib_0: fib?.fib_0 ?? null,
    fib_236: fib?.fib_236 ?? null,
    fib_382: fib?.fib_382 ?? null,
    fib_500: fib?.fib_500 ?? null,
    fib_618: fib?.fib_618 ?? null,
    fib_100: fib?.fib_100 ?? null,
    signal_sma,
    signal_ema,
    signal_macd,
    signal_rsi,
    signal_bb,
    signal_stoch,
    signal_adx,
    signal_ichimoku,
    signal_fib,
    overall_signal,
    overall_score,
  };
}
