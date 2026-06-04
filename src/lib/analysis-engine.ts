import { getSetting } from "./db";
import { fetchPrice, fetchHistoricalData, fetchNews } from "./data-fetcher";
import { calculateTechnicals, type OHLCV } from "./technicals";
import { calculateStockScore, type StockScoreResult } from "./stock-scoring";
import {
  getSettingValue,
  queryRow,
  queryRows,
  runSql,
  upsertPriceHistoryRow,
  upsertSectorAnalysis,
  upsertStockCompany,
  upsertTechnicalIndicators,
  updateMarketIndex,
} from "./postgres-access";

interface PortfolioItem {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  purchase_date: string;
  notes: string;
}

interface WatchlistItem {
  id: number;
  ticker: string;
  company_name: string;
}

interface PriceSnapshot {
  price: number;
  change_pct: number;
  volume: number;
}

interface SentimentSnapshot {
  score: number;
  label: string;
  impactScore: number;
  summary: string;
  sourceCount: number;
}

export async function runFullAnalysis(reportType = "manual"): Promise<number> {
  const portfolio = await queryRows<PortfolioItem>("SELECT * FROM portfolio");
  const watchlist = await queryRows<WatchlistItem>("SELECT * FROM watchlist");

  const allTickers = [
    ...new Set([
      ...portfolio.map((p) => p.ticker),
      ...watchlist.map((w) => w.ticker),
    ]),
  ];

  const companyNameByTicker = new Map<string, string>();
  for (const item of [...portfolio, ...watchlist]) {
    companyNameByTicker.set(item.ticker, item.company_name || item.ticker);
    await upsertStockCompany({
      ticker: item.ticker,
      companyName: item.company_name || item.ticker,
    });
  }

  // Market indices tickers
  const indexTickers = [
    "SPY", "QQQ", "DIA", "IWM", "^VIX", "GC=F", "CL=F", "BTC-USD", "ETH-USD",
  ];

  // Fetch prices for all tickers
  const priceResults: Record<string, PriceSnapshot> = {};

  for (const ticker of [...allTickers, ...indexTickers]) {
    const price = await fetchPrice(ticker);
    if (price) {
      priceResults[ticker] = {
        price: price.price,
        change_pct: price.change_pct,
        volume: price.volume,
      };
    }
    // Rate limit protection
    await new Promise((r) => setTimeout(r, 200));
  }

  const sentimentResults: Record<string, SentimentSnapshot> = {};
  for (const ticker of allTickers) {
    try {
      const sentiment = await fetchNews(ticker);
      sentimentResults[ticker] = {
        score: sentiment.score,
        label: sentiment.label,
        impactScore: sentiment.impactScore,
        summary: sentiment.summary,
        sourceCount: sentiment.sourceCount,
      };
    } catch (err) {
      console.error(`Error fetching news for ${ticker}:`, err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  // Update market indices
  for (const symbol of indexTickers) {
    const pd = priceResults[symbol];
    if (pd) {
      let trend = "neutral";
      if (pd.change_pct > 0.5) trend = "up";
      else if (pd.change_pct < -0.5) trend = "down";

      let marketStatus = "neutral";
      if (symbol === "^VIX") {
        marketStatus = pd.price > 25 ? "risk_off" : pd.price < 15 ? "risk_on" : "neutral";
      }

      await updateMarketIndex({
        symbol,
        value: pd.price,
        changePct: pd.change_pct,
        trend,
        marketStatus,
      });
    }
  }

  // Calculate technicals for each ticker
  const technicalResults: Record<string, ReturnType<typeof calculateTechnicals>> = {};
  const scoreResults: Record<string, StockScoreResult> = {};

  for (const ticker of allTickers) {
    try {
      // Get historical data
      let history = await queryRows<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>("SELECT * FROM price_history WHERE ticker = ? ORDER BY date ASC LIMIT 250", [ticker]);

      if (history.length < 50) {
        const bars = await fetchHistoricalData(ticker, 200);
        if (bars.length > 0) {
          for (const bar of bars) {
            await upsertPriceHistoryRow({
              table: "price_history",
              ticker,
              date: bar.date,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              source: "yahoo",
            });
          }
          history = bars;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (history.length >= 20 && priceResults[ticker]) {
        const technicals = calculateTechnicals(history);
        technicalResults[ticker] = technicals;

        if (technicals) {
          const scoreResult = calculateStockScore({
            price: priceResults[ticker].price,
            changePct: priceResults[ticker].change_pct,
            volume: priceResults[ticker].volume,
            history,
            technicals,
            sentimentScore: sentimentResults[ticker]?.score || 0,
          });
          scoreResults[ticker] = scoreResult;

          await upsertTechnicalIndicators({
            ticker,
            sma_20: technicals.sma_20,
            sma_50: technicals.sma_50,
            sma_200: technicals.sma_200,
            ema_12: technicals.ema_12,
            ema_26: technicals.ema_26,
            ema_50: technicals.ema_50,
            rsi_14: technicals.rsi_14,
            macd_line: technicals.macd_line,
            macd_signal: technicals.macd_signal,
            macd_histogram: technicals.macd_histogram,
            bb_upper: technicals.bb_upper,
            bb_middle: technicals.bb_middle,
            bb_lower: technicals.bb_lower,
            bb_width: technicals.bb_width,
            stoch_k: technicals.stoch_k,
            stoch_d: technicals.stoch_d,
            adx: technicals.adx,
            plus_di: technicals.plus_di,
            minus_di: technicals.minus_di,
            ichimoku_tenkan: technicals.ichimoku_tenkan,
            ichimoku_kijun: technicals.ichimoku_kijun,
            ichimoku_senkou_a: technicals.ichimoku_senkou_a,
            ichimoku_senkou_b: technicals.ichimoku_senkou_b,
            fib_0: technicals.fib_0,
            fib_236: technicals.fib_236,
            fib_382: technicals.fib_382,
            fib_500: technicals.fib_500,
            fib_618: technicals.fib_618,
            fib_100: technicals.fib_100,
            signal_sma: technicals.signal_sma,
            signal_ema: technicals.signal_ema,
            signal_macd: technicals.signal_macd,
            signal_rsi: technicals.signal_rsi,
            signal_bb: technicals.signal_bb,
            signal_stoch: technicals.signal_stoch,
            signal_adx: technicals.signal_adx,
            signal_ichimoku: technicals.signal_ichimoku,
            signal_fib: technicals.signal_fib,
            overall_signal: technicals.overall_signal,
            overall_score: technicals.overall_score,
            ai_score: scoreResult.score,
            recommendation: scoreResult.recommendation,
            trend_score: scoreResult.breakdown.trend,
            rsi_score: scoreResult.breakdown.rsi,
            macd_score: scoreResult.breakdown.macd,
            volume_score: scoreResult.breakdown.volume,
            sma_score: scoreResult.breakdown.sma,
            ema_score: scoreResult.breakdown.ema,
            bb_score: scoreResult.breakdown.bollinger,
            adx_score: scoreResult.breakdown.adx,
            sentiment_score: scoreResult.breakdown.sentiment,
          });

          await saveAnalysisSnapshot(
            ticker,
            companyNameByTicker.get(ticker) || ticker,
            priceResults[ticker],
            technicals,
            scoreResult,
            sentimentResults[ticker],
            reportType
          );

          await refreshPerformanceTracking(ticker);

          await generateAlerts(ticker, priceResults[ticker], technicals, history, scoreResult);
        }
      }
    } catch (err) {
      console.error(`Error calculating technicals for ${ticker}:`, err);
    }
  }

  await updateSectorAnalysis(allTickers, priceResults, sentimentResults, companyNameByTicker);

  // Generate AI report
  const reportId = await generateAIReport(
    portfolio,
    watchlist,
    priceResults,
    technicalResults,
    scoreResults,
    reportType
  );

  // Send notifications
  await sendNotifications(reportId);

  return reportId;
}

async function generateAlerts(
  ticker: string,
  priceData: PriceSnapshot | undefined,
  technicals: ReturnType<typeof calculateTechnicals>,
  history: OHLCV[],
  scoreResult: StockScoreResult
): Promise<void> {
  if (!technicals || !priceData) return;
  const today = new Date().toISOString().split("T")[0];
  const previousBar = history[history.length - 2];
  const latestBar = history[history.length - 1];
  const previousTechnicals = history.length >= 30 ? calculateTechnicals(history.slice(0, -1)) : null;
  const avgVolume20 = history.slice(-20).reduce((sum, bar) => sum + (bar.volume || 0), 0) / Math.max(Math.min(history.length, 20), 1);

  const isRuleEnabled = async (ruleKey: string): Promise<boolean> => {
    const row = await queryRow<{ is_enabled: number }>("SELECT is_enabled FROM alert_rules WHERE rule_key = ?", [ruleKey]);
    return row ? row.is_enabled === 1 : true;
  };

  const insertAlert = async (
    type: string,
    severity: string,
    message: string,
    value?: number,
    threshold?: number,
    ruleKey?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (ruleKey && !(await isRuleEnabled(ruleKey))) return;
    const exists = await queryRow<{ id: number }>(`
      SELECT id FROM alerts WHERE ticker = ? AND alert_type = ? AND date(created_at) = ?
    `, [ticker, type, today]);
    if (!exists) {
      await runSql(`
        INSERT INTO alerts (ticker, alert_type, severity, message, value, threshold, rule_key, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ticker,
        type,
        severity,
        message,
        value ?? null,
        threshold ?? null,
        ruleKey ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ]);
    }
  };

  const rsi = technicals.rsi_14;
  const rsiOverbought = parseFloat((await getSettingValue("rsi_overbought")) || "70");
  const rsiOversold = parseFloat((await getSettingValue("rsi_oversold")) || "30");

  if (rsi !== null) {
    if (rsi > rsiOverbought) {
      await insertAlert("rsi_overbought", "warning", `${ticker}: RSI ${rsi.toFixed(1)} przekroczył ${rsiOverbought} (wykupienie)`, rsi, rsiOverbought, "rsi_above_70");
    }
    if (rsi < rsiOversold) {
      await insertAlert("rsi_oversold", "warning", `${ticker}: RSI ${rsi.toFixed(1)} poniżej ${rsiOversold} (wyprzedanie)`, rsi, rsiOversold, "rsi_below_30");
    }
  }

  if (previousTechnicals && previousTechnicals.sma_50 !== null && previousTechnicals.sma_200 !== null && technicals.sma_50 !== null && technicals.sma_200 !== null) {
    if (previousTechnicals.sma_50 <= previousTechnicals.sma_200 && technicals.sma_50 > technicals.sma_200) {
      await insertAlert("golden_cross", "info", `${ticker}: Golden Cross (SMA50 powyżej SMA200)`, technicals.sma_50, technicals.sma_200, "golden_cross");
    }
    if (previousTechnicals.sma_50 >= previousTechnicals.sma_200 && technicals.sma_50 < technicals.sma_200) {
      await insertAlert("death_cross", "critical", `${ticker}: Death Cross (SMA50 poniżej SMA200)`, technicals.sma_50, technicals.sma_200, "death_cross");
    }
  }

  if (previousTechnicals && previousTechnicals.ema_12 !== null && previousTechnicals.ema_26 !== null && technicals.ema_12 !== null && technicals.ema_26 !== null) {
    if (previousTechnicals.ema_12 <= previousTechnicals.ema_26 && technicals.ema_12 > technicals.ema_26) {
      await insertAlert("ema_bullish_cross", "info", `${ticker}: EMA12 przecięła EMA26 w górę`, technicals.ema_12, technicals.ema_26, "ema_cross");
    }
    if (previousTechnicals.ema_12 >= previousTechnicals.ema_26 && technicals.ema_12 < technicals.ema_26) {
      await insertAlert("ema_bearish_cross", "warning", `${ticker}: EMA12 przecięła EMA26 w dół`, technicals.ema_12, technicals.ema_26, "ema_cross");
    }
  }

  if (previousBar && previousTechnicals && previousTechnicals.sma_200 !== null && technicals.sma_200 !== null) {
    if (previousBar.close <= previousTechnicals.sma_200 && latestBar.close > technicals.sma_200) {
      await insertAlert("break_above_sma200", "info", `${ticker}: Cena przebiła SMA200 w górę`, latestBar.close, technicals.sma_200, "break_sma200");
    }
    if (previousBar.close >= previousTechnicals.sma_200 && latestBar.close < technicals.sma_200) {
      await insertAlert("break_below_sma200", "warning", `${ticker}: Cena spadła poniżej SMA200`, latestBar.close, technicals.sma_200, "break_sma200");
    }
  }

  if (avgVolume20 > 0 && latestBar.volume > avgVolume20 * 3) {
    await insertAlert(
      "volume_spike_300",
      "warning",
      `${ticker}: Wolumen ${(latestBar.volume / avgVolume20 * 100).toFixed(0)}% średniej 20d`,
      latestBar.volume,
      avgVolume20 * 3,
      "volume_300"
    );
  }

  if (history.length >= 50) {
    const highs = history.slice(-252).map((bar) => bar.high);
    const lows = history.slice(-252).map((bar) => bar.low);
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    if (latestBar.high >= periodHigh) {
      await insertAlert("new_ath", "info", `${ticker}: Nowe ATH / 52-week high`, latestBar.high, periodHigh, "new_ath");
    }
    if (latestBar.low <= periodLow) {
      await insertAlert("new_atl", "warning", `${ticker}: Nowe ATL / 52-week low`, latestBar.low, periodLow, "new_atl");
    }
  }

  if (previousBar) {
    if (latestBar.open > previousBar.high * 1.01) {
      await insertAlert("gap_up", "info", `${ticker}: Gap Up na otwarciu`, latestBar.open, previousBar.high, "gap_up");
    }
    if (latestBar.open < previousBar.low * 0.99) {
      await insertAlert("gap_down", "warning", `${ticker}: Gap Down na otwarciu`, latestBar.open, previousBar.low, "gap_down");
    }
  }

  if (technicals.signal_macd === "bullish") {
    await insertAlert("macd_bullish", "info", `${ticker}: Sygnał MACD bullish`, technicals.macd_histogram ?? undefined, undefined, undefined, { aiScore: scoreResult.score });
  }
  if (technicals.signal_macd === "bearish") {
    await insertAlert("macd_bearish", "warning", `${ticker}: Sygnał MACD bearish`, technicals.macd_histogram ?? undefined, undefined, undefined, { aiScore: scoreResult.score });
  }

  if (technicals.adx && technicals.adx > 25) {
    await insertAlert("adx_strong_trend", "info", `${ticker}: ADX ${technicals.adx.toFixed(1)} - silny trend`, technicals.adx, 25, undefined, { recommendation: scoreResult.recommendation });
  }

  const priceThreshold = parseFloat((await getSettingValue("price_move_threshold")) || "5");
  if (Math.abs(priceData.change_pct) > priceThreshold) {
    const severity = Math.abs(priceData.change_pct) > 10 ? "critical" : "warning";
    await insertAlert(
      "large_price_move",
      severity,
      `${ticker}: Duży ruch ceny ${priceData.change_pct > 0 ? "+" : ""}${priceData.change_pct.toFixed(2)}%`,
      priceData.change_pct,
      priceThreshold,
      undefined,
      { aiScore: scoreResult.score, recommendation: scoreResult.recommendation }
    );
  }

  if (technicals.overall_signal === "strong_bullish") {
    await insertAlert("strong_bullish_signal", "info", `${ticker}: STRONG BULLISH - zbieżność wskaźników wzrostowych`, technicals.overall_score, undefined, undefined, { aiScore: scoreResult.score });
  }
  if (technicals.overall_signal === "strong_bearish") {
    await insertAlert("strong_bearish_signal", "critical", `${ticker}: STRONG BEARISH - zbieżność wskaźników spadkowych`, technicals.overall_score, undefined, undefined, { aiScore: scoreResult.score });
  }
}

async function saveAnalysisSnapshot(
  ticker: string,
  companyName: string,
  priceData: PriceSnapshot,
  technicals: NonNullable<ReturnType<typeof calculateTechnicals>>,
  scoreResult: StockScoreResult,
  sentiment: SentimentSnapshot | undefined,
  reportType: string
): Promise<void> {
  const details = {
    overallSignal: technicals.overall_signal,
    overallScore: technicals.overall_score,
    breakdown: scoreResult.breakdown,
    summary: scoreResult.summary,
    sentiment,
  };

  const historyResult = await runSql(`
    INSERT INTO analysis_history (
      ticker, company_name, price, score, recommendation, sentiment, change_pct, volume, report_type, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    ticker,
    companyName,
    priceData.price,
    scoreResult.score,
    scoreResult.recommendation,
    sentiment?.score || 0,
    priceData.change_pct,
    priceData.volume,
    reportType,
    JSON.stringify(details),
  ]);

  const recommendationResult = await runSql(`
    INSERT INTO recommendations (
      ticker, analysis_history_id, score, recommendation, entry_price, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `, [
    ticker,
    historyResult.lastInsertId ?? null,
    scoreResult.score,
    scoreResult.recommendation,
    priceData.price,
  ]);

  await runSql(`
    INSERT INTO performance_tracking (
      recommendation_id, ticker, entry_price, updated_at, created_at
    ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `, [recommendationResult.lastInsertId ?? null, ticker, priceData.price]);
}

async function refreshPerformanceTracking(ticker: string): Promise<void> {
  const rows = await queryRows<{
    id: number;
    entry_price: number;
    recommendation: string;
    created_at: string;
  }>(`
    SELECT pt.id, pt.entry_price, r.recommendation, r.created_at
    FROM performance_tracking pt
    JOIN recommendations r ON r.id = pt.recommendation_id
    WHERE pt.ticker = ?
  `, [ticker]);

  const getPriceForHorizon = async (targetDate: Date): Promise<number | null> => {
    const isoDate = targetDate.toISOString().slice(0, 10);
    const future = await queryRow<{ close: number }>(`
      SELECT close FROM stock_prices WHERE ticker = ? AND date >= ? ORDER BY date ASC LIMIT 1
    `, [ticker, isoDate]);
    if (future?.close) return future.close;
    const latest = await queryRow<{ close: number }>(`
      SELECT close FROM stock_prices WHERE ticker = ? ORDER BY date DESC LIMIT 1
    `, [ticker]);
    return latest?.close || null;
  };

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const price7d = await getPriceForHorizon(new Date(createdAt.getTime() + 7 * 86400000));
    const price30d = await getPriceForHorizon(new Date(createdAt.getTime() + 30 * 86400000));
    const price90d = await getPriceForHorizon(new Date(createdAt.getTime() + 90 * 86400000));
    const price180d = await getPriceForHorizon(new Date(createdAt.getTime() + 180 * 86400000));
    const direction = row.recommendation.includes("Sell") ? -1 : 1;
    const calcReturn = (price: number | null) =>
      price && row.entry_price > 0 ? (((price - row.entry_price) / row.entry_price) * 100) * direction : null;

    const returns = [calcReturn(price7d), calcReturn(price30d), calcReturn(price90d), calcReturn(price180d)].filter(
      (value): value is number => value !== null
    );
    const successRate = returns.length > 0
      ? (returns.filter((value) => value > 0).length / returns.length) * 100
      : 0;
    const averageReturn = returns.length > 0
      ? returns.reduce((sum, value) => sum + value, 0) / returns.length
      : 0;
    const accuracyLabel = successRate >= 70 ? "accurate" : successRate <= 35 ? "miss" : "mixed";

    await runSql(`
      UPDATE performance_tracking
      SET price_7d = ?, price_30d = ?, price_90d = ?, price_180d = ?,
          return_7d = ?, return_30d = ?, return_90d = ?, return_180d = ?,
          success_rate = ?, average_return = ?, accuracy_label = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      price7d,
      price30d,
      price90d,
      price180d,
      calcReturn(price7d),
      calcReturn(price30d),
      calcReturn(price90d),
      calcReturn(price180d),
      successRate,
      averageReturn,
      accuracyLabel,
      row.id,
    ]);
  }
}

async function updateSectorAnalysis(
  tickers: string[],
  priceResults: Record<string, PriceSnapshot>,
  sentimentResults: Record<string, SentimentSnapshot>,
  companyNameByTicker: Map<string, string>
): Promise<void> {
  const sectorMap: Record<string, string[]> = {
    Technology: ["AAPL", "MSFT", "NVDA", "AMD", "META", "GOOGL"],
    "Artificial Intelligence": ["NVDA", "AMD", "PLTR", "MSFT", "GOOGL", "META"],
    Healthcare: ["JNJ", "PFE", "UNH", "MRK"],
    Energy: ["XOM", "CVX", "SLB"],
    Finance: ["JPM", "GS", "BAC", "MS"],
    Consumer: ["AMZN", "TSLA", "COST", "WMT"],
    Industrial: ["CAT", "GE", "BA"],
    Utilities: ["NEE", "DUK", "SO"],
    "Real Estate": ["PLD", "AMT", "O"],
  };
  const analysisDate = new Date().toISOString().slice(0, 10);

  for (const [sector, universe] of Object.entries(sectorMap)) {
    const members = tickers.filter((ticker) => universe.includes(ticker));
    if (members.length === 0) continue;

    const memberSnapshots = members
      .map((ticker) => ({
        ticker,
        company_name: companyNameByTicker.get(ticker) || ticker,
        change_pct: priceResults[ticker]?.change_pct ?? 0,
        sentiment: sentimentResults[ticker]?.score ?? 0,
      }))
      .sort((left, right) => right.change_pct - left.change_pct);

    const avgChange = memberSnapshots.reduce((sum, item) => sum + item.change_pct, 0) / memberSnapshots.length;
    const avgSentiment = memberSnapshots.reduce((sum, item) => sum + item.sentiment, 0) / memberSnapshots.length;
    const sentimentLabel = avgSentiment > 10 ? "positive" : avgSentiment < -10 ? "negative" : "neutral";
    const best = memberSnapshots[0];
    const worst = memberSnapshots[memberSnapshots.length - 1];

    await upsertSectorAnalysis({
      sector,
      analysisDate,
      avgChangePct: avgChange,
      sentimentScore: avgSentiment,
      sentimentLabel,
      bestTicker: best?.ticker || null,
      bestChangePct: best?.change_pct || 0,
      worstTicker: worst?.ticker || null,
      worstChangePct: worst?.change_pct || 0,
      constituentsJson: JSON.stringify(memberSnapshots),
    });
  }
}

async function generateAIReport(
  portfolio: PortfolioItem[],
  watchlist: WatchlistItem[],
  priceResults: Record<string, PriceSnapshot>,
  technicalResults: Record<string, ReturnType<typeof calculateTechnicals>>,
  scoreResults: Record<string, StockScoreResult>,
  reportType: string
): Promise<number> {
  // Build context for AI
  const marketContext = buildMarketContext(priceResults);
  const portfolioContext = buildPortfolioContext(portfolio, priceResults, technicalResults, scoreResults);
  const watchlistContext = buildWatchlistContext(watchlist, priceResults, technicalResults, scoreResults);
  const alertsContext = await buildAlertsContext();

  const systemPrompt = `Jesteś analitykiem technicznym rynku akcji USA. Analizujesz dane i tworzysz KRÓTKIE, TECHNICZNE raporty w języku polskim. 
NIE jesteś doradcą inwestycyjnym - nie piszesz "kup", "sprzedaj", "gwarantowany zysk". 
Piszesz o sygnałach, ryzyku, kontekście i możliwych scenariuszach.
Raport ma być zwięzły, konkretny, bez lania wody.`;

  const userPrompt = `Stwórz krótki raport analizy technicznej na podstawie poniższych danych:

## RYNEK / INDEKSY
${marketContext}

## PORTFOLIO
${portfolioContext}

## WATCHLISTA
${watchlistContext}

## ALERTY
${alertsContext}

Raport musi zawierać:
1. Ogólna sytuacja rynkowa (2-3 zdania)
2. Sentyment: risk-on / risk-off / neutral i dlaczego
3. Portfolio - które pozycje mocne, które ryzykowne
4. Watchlista - co warte uwagi
5. Kluczowe alerty techniczne
6. Podsumowanie dnia (1-2 zdania)

Format: zwięzły, techniczny, bez zbędnych ozdobników.`;

  let reportContent = "";
  let marketSentiment = "neutral";

  try {
    const openaiKey = process.env.OPENAI_API_KEY || (await getSettingValue("openai_api_key")) || "";
    const openaiBase = process.env.OPENAI_BASE_URL || (await getSettingValue("openai_base_url")) || "https://api.openai.com/v1";

    if (openaiKey) {
      const res = await fetch(`${openaiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        reportContent = data.choices?.[0]?.message?.content || "";
      }
    }
  } catch (err) {
    console.error("OpenAI API error:", err);
  }

  // Fallback: generate basic report without AI
  if (!reportContent) {
    reportContent = generateFallbackReport(
      marketContext,
      portfolioContext,
      watchlistContext,
      alertsContext
    );
  }

  // Determine sentiment from market data
  const spyChange = priceResults["SPY"]?.change_pct || 0;
  const vixPrice = priceResults["^VIX"]?.price || 20;
  if (spyChange > 0.5 && vixPrice < 20) marketSentiment = "risk_on";
  else if (spyChange < -0.5 || vixPrice > 25) marketSentiment = "risk_off";

  // Save report
  const result = await runSql(`
    INSERT INTO ai_reports (report_type, trigger_time, content, market_sentiment)
    VALUES (?, datetime('now'), ?, ?)
  `, [reportType, reportContent, marketSentiment]);

  return result.lastInsertId as number;
}

function buildMarketContext(
  priceResults: Record<string, PriceSnapshot>
): string {
  const indices = [
    { sym: "SPY", name: "S&P 500" },
    { sym: "QQQ", name: "Nasdaq 100" },
    { sym: "DIA", name: "Dow Jones" },
    { sym: "IWM", name: "Russell 2000" },
    { sym: "^VIX", name: "VIX" },
    { sym: "GC=F", name: "Gold" },
    { sym: "CL=F", name: "Oil" },
    { sym: "BTC-USD", name: "BTC" },
  ];

  return indices
    .map((idx) => {
      const pd = priceResults[idx.sym];
      if (!pd) return `${idx.name}: brak danych`;
      const sign = pd.change_pct >= 0 ? "+" : "";
      return `${idx.name}: $${pd.price.toFixed(2)} (${sign}${pd.change_pct.toFixed(2)}%)`;
    })
    .join("\n");
}

function buildPortfolioContext(
  portfolio: PortfolioItem[],
  priceResults: Record<string, PriceSnapshot>,
  technicalResults: Record<string, ReturnType<typeof calculateTechnicals>>,
  scoreResults: Record<string, StockScoreResult>
): string {
  if (portfolio.length === 0) return "Portfolio puste";

  return portfolio
    .map((p) => {
      const pd = priceResults[p.ticker];
      const tech = technicalResults[p.ticker];
      if (!pd)
        return `${p.ticker}: brak danych cenowych`;
      const pnl = pd.price - p.purchase_price;
      const pnlPct = (pnl / p.purchase_price) * 100;
      const signal = tech?.overall_signal || "brak";
      const aiScore = scoreResults[p.ticker];
      return `${p.ticker}: $${pd.price.toFixed(2)} (${pd.change_pct >= 0 ? "+" : ""}${pd.change_pct.toFixed(2)}% dzień, P&L: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%), RSI: ${tech?.rsi_14?.toFixed(0) || "N/A"}, Sygnał: ${signal}, AI Score: ${aiScore?.score.toFixed(1) || "N/A"}, Rekomendacja: ${aiScore?.recommendation || "N/A"}`;
    })
    .join("\n");
}

function buildWatchlistContext(
  watchlist: WatchlistItem[],
  priceResults: Record<string, PriceSnapshot>,
  technicalResults: Record<string, ReturnType<typeof calculateTechnicals>>,
  scoreResults: Record<string, StockScoreResult>
): string {
  if (watchlist.length === 0) return "Watchlista pusta";

  return watchlist
    .map((w) => {
      const pd = priceResults[w.ticker];
      const tech = technicalResults[w.ticker];
      if (!pd) return `${w.ticker}: brak danych`;
      const signal = tech?.overall_signal || "brak";
      const aiScore = scoreResults[w.ticker];
      return `${w.ticker}: $${pd.price.toFixed(2)} (${pd.change_pct >= 0 ? "+" : ""}${pd.change_pct.toFixed(2)}%), RSI: ${tech?.rsi_14?.toFixed(0) || "N/A"}, Sygnał: ${signal}, AI Score: ${aiScore?.score.toFixed(1) || "N/A"}, Rekomendacja: ${aiScore?.recommendation || "N/A"}`;
    })
    .join("\n");
}

async function buildAlertsContext(): Promise<string> {
  const alerts = await queryRows<{ severity: string; message: string }>(
    "SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC LIMIT 10"
  );

  if (alerts.length === 0) return "Brak aktywnych alertów";
  return alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.message}`).join("\n");
}

function generateFallbackReport(
  marketContext: string,
  portfolioContext: string,
  watchlistContext: string,
  alertsContext: string
): string {
  const now = new Date().toLocaleString("pl-PL", { timeZone: "America/New_York" });
  return `## Raport Analizy Technicznej
*Wygenerowano: ${now} ET*

### Sytuacja Rynkowa
${marketContext}

### Portfolio
${portfolioContext}

### Watchlista
${watchlistContext}

### Alerty
${alertsContext}

---
*Raport wygenerowany automatycznie (tryb bez AI). Skonfiguruj klucz OpenAI API dla pełnej analizy AI.*
*Nie stanowi porady inwestycyjnej.*`;
}

async function sendNotifications(reportId: number): Promise<void> {
  const report = await queryRow<{ content: string }>("SELECT * FROM ai_reports WHERE id = ?", [reportId]);
  if (!report) return;

  const telegramEnabled = (await getSettingValue("notifications_telegram")) === "1";
  if (telegramEnabled) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || (await getSettingValue("telegram_bot_token"));
    const chatId = process.env.TELEGRAM_CHAT_ID || (await getSettingValue("telegram_chat_id"));
    if (botToken && chatId) {
      try {
        const message = report.content.substring(0, 4000);
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "Markdown",
            }),
            signal: AbortSignal.timeout(10000),
          }
        );
      } catch (err) {
        console.error("Telegram notification failed:", err);
      }
    }
  }

  const webhookEnabled = (await getSettingValue("notifications_webhook")) === "1";
  if (webhookEnabled) {
    const webhookUrl = await getSettingValue("webhook_url");
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "analysis_complete",
            report_id: reportId,
            content: report.content,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (err) {
        console.error("Webhook notification failed:", err);
      }
    }
  }
}
