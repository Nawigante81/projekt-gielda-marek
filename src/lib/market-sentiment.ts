import { getSettingValue, queryRows, runSql, upsertSetting } from "./postgres-access";

type FearGreedResponse = {
  fear_and_greed?: {
    score?: number;
    rating?: string;
    timestamp?: string;
    previous_close?: number;
    previous_1_week?: number;
    previous_1_month?: number;
    previous_1_year?: number;
  };
};

export interface MarketSentimentSnapshot {
  fearGreedScore: number | null;
  fearGreedLabel: string | null;
  fearGreedUpdatedAt: string | null;
  putCallRatio: number | null;
  putCallType: string | null;
  vixValue: number | null;
  vixChangePct: number | null;
  breadthScore: number | null;
  breadthLabel: string | null;
  source: {
    fearGreed: string;
    putCall: string;
  };
}

export interface MarketSentimentHistoryRow {
  captured_at: string;
  fear_greed_score: number | null;
  put_call_ratio: number | null;
  fear_greed_label: string | null;
  vix_value: number | null;
  breadth_score: number | null;
}

const CACHE_KEY = "market_sentiment_cache";
const CACHE_TTL_MS = 30 * 60 * 1000;

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchVixSnapshot(): Promise<{ value: number | null; changePct: number | null }> {
  const rows = await queryRows<{ value: number | null; change_pct: number | null }>(`
    SELECT value, change_pct
    FROM market_indices
    WHERE symbol = ?
    LIMIT 1
  `, ["^VIX"]);
  const row = rows[0];
  return {
    value: row?.value ?? null,
    changePct: row?.change_pct ?? null,
  };
}

async function fetchBreadthProxy(): Promise<number | null> {
  const rows = await queryRows<{ change_pct: number | null }>(`
    SELECT change_pct
    FROM market_indices
    WHERE symbol IN ('SPY', 'QQQ', 'DIA', 'IWM')
  `);
  const valid = rows.map((row) => row.change_pct).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  const positives = valid.filter((value) => value > 0).length;
  return positives / valid.length;
}

function parseCachedSnapshot(value: string | null): { cachedAt: string; data: MarketSentimentSnapshot } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { cachedAt?: string; data?: MarketSentimentSnapshot };
    if (!parsed.cachedAt || !parsed.data) return null;
    return { cachedAt: parsed.cachedAt, data: parsed.data };
  } catch {
    return null;
  }
}

async function saveSnapshotHistory(snapshot: MarketSentimentSnapshot): Promise<void> {
  await runSql(
    `INSERT INTO market_sentiment_history (captured_at, fear_greed_score, put_call_ratio, fear_greed_label, vix_value, breadth_score)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      new Date().toISOString(),
      snapshot.fearGreedScore,
      snapshot.putCallRatio,
      snapshot.fearGreedLabel,
      snapshot.vixValue,
      snapshot.breadthScore,
    ]
  );

  await runSql(`
    DELETE FROM market_sentiment_history
    WHERE id NOT IN (
      SELECT id FROM market_sentiment_history
      ORDER BY captured_at DESC
      LIMIT 90
    )
  `);
}

async function getCachedSnapshot(): Promise<MarketSentimentSnapshot | null> {
  const cached = parseCachedSnapshot(await getSettingValue(CACHE_KEY));
  if (!cached) return null;
  const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > CACHE_TTL_MS) return null;
  return cached.data;
}

async function setCachedSnapshot(snapshot: MarketSentimentSnapshot): Promise<void> {
  await upsertSetting(CACHE_KEY, JSON.stringify({ cachedAt: new Date().toISOString(), data: snapshot }));
}

async function fetchFearGreed(): Promise<{ score: number | null; label: string | null; updatedAt: string | null }> {
  const response = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
    headers: {
      Origin: "https://www.cnn.com",
      Referer: "https://www.cnn.com/markets/fear-and-greed",
      "User-Agent": "Mozilla/5.0 (compatible; GieldaMarek/1.0)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Fear & Greed HTTP ${response.status}`);
  }

  const data = (await response.json()) as FearGreedResponse;
  return {
    score: data.fear_and_greed?.score ?? null,
    label: data.fear_and_greed?.rating ?? null,
    updatedAt: data.fear_and_greed?.timestamp ?? null,
  };
}

async function fetchPutCall(): Promise<{ ratio: number | null; type: string | null }> {
  const response = await fetch("https://www.cboe.com/data/mktstat.aspx", {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GieldaMarek/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Put/Call HTTP ${response.status}`);
  }

  const html = await response.text();
  const values = {
    total: html.match(/TOTAL PUT\/CALL RATIO<\/td>\s*<td[^>]*>([^<]+)/i)?.[1] ?? null,
    equity: html.match(/EQUITY PUT\/CALL RATIO<\/td>\s*<td[^>]*>([^<]+)/i)?.[1] ?? null,
  };

  return {
    ratio: parseNumber(values.total),
    type: values.equity ? `equity ${values.equity}` : null,
  };
}

export async function fetchExternalMarketSentiment(): Promise<MarketSentimentSnapshot> {
  const cached = await getCachedSnapshot();
  if (cached) {
    return cached;
  }

  const [fearGreed, putCall, vix, breadth] = await Promise.allSettled([
    fetchFearGreed(),
    fetchPutCall(),
    fetchVixSnapshot(),
    fetchBreadthProxy(),
  ]);
  const snapshot: MarketSentimentSnapshot = {
    fearGreedScore: fearGreed.status === "fulfilled" ? fearGreed.value.score : null,
    fearGreedLabel: fearGreed.status === "fulfilled" ? fearGreed.value.label : null,
    fearGreedUpdatedAt: fearGreed.status === "fulfilled" ? fearGreed.value.updatedAt : null,
    putCallRatio: putCall.status === "fulfilled" ? putCall.value.ratio : null,
    putCallType: putCall.status === "fulfilled" ? putCall.value.type : null,
    vixValue: vix.status === "fulfilled" ? vix.value.value : null,
    vixChangePct: vix.status === "fulfilled" ? vix.value.changePct : null,
    breadthScore: breadth.status === "fulfilled" ? breadth.value : null,
    breadthLabel:
      breadth.status === "fulfilled" && breadth.value !== null
        ? breadth.value > 0.66
          ? "risk-on"
          : breadth.value < 0.34
            ? "risk-off"
            : "neutral"
        : null,
    source: {
      fearGreed: "CNN Fear & Greed Index",
      putCall: "Cboe Daily Market Statistics",
    },
  };

  await setCachedSnapshot(snapshot);
  if (snapshot.fearGreedScore !== null || snapshot.putCallRatio !== null || snapshot.vixValue !== null || snapshot.breadthScore !== null) {
    await saveSnapshotHistory(snapshot);
  }
  return snapshot;
}

export async function getMarketSentimentHistory(limit = 7): Promise<MarketSentimentHistoryRow[]> {
  return queryRows<MarketSentimentHistoryRow>(
    `
      SELECT captured_at, fear_greed_score, put_call_ratio, fear_greed_label, vix_value, breadth_score
      FROM market_sentiment_history
      ORDER BY captured_at DESC
      LIMIT ?
    `,
    [limit]
  );
}
