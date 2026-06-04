import { getSettingValue, runSql } from "./postgres-access";

export type NewsSentimentLabel = "positive" | "neutral" | "negative";
export type NewsImpactLabel = "High Impact" | "Medium Impact" | "Low Impact";
export type NewsPriorityCategory =
  | "SEC Filings"
  | "Earnings"
  | "Guidance"
  | "Insider Activity"
  | "M&A / FDA"
  | "Analyst Upgrades/Downgrades"
  | "Price Target Changes"
  | "Volume / Technical Move"
  | "General Market";

export interface NewsDbRow {
  id: number;
  ticker: string | null;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  sentiment_label: NewsSentimentLabel | null;
  sentiment_score: number | null;
  impact_score: number | null;
  clean_summary?: string | null;
  impact_label?: string | null;
  priority_category?: string | null;
  priority_rank?: number | null;
  priority_score?: number | null;
  ai_summary_json?: string | null;
}

export interface EnrichedNewsItem {
  id: number;
  ticker: string;
  headline: string;
  summary: string;
  clean_summary: string;
  source: string;
  url: string | null;
  published_at: string | null;
  sentiment_label: NewsSentimentLabel;
  sentiment_score: number;
  impact_score: number;
  impact_label: NewsImpactLabel;
  priority_category: NewsPriorityCategory;
  priority_rank: number;
  priority_score: number;
  ai_summary: string[];
  is_portfolio: boolean;
}

type ArticleForSummary = {
  id: number;
  ticker: string;
  headline: string;
  cleanSummary: string;
  source: string;
  publishedAt: string | null;
  sentimentLabel: NewsSentimentLabel;
  impactLabel: NewsImpactLabel;
  priorityCategory: NewsPriorityCategory;
};

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

const PRIORITY_RULES: Array<{
  category: NewsPriorityCategory;
  rank: number;
  impactLabel: NewsImpactLabel;
  keywords: string[];
}> = [
  {
    category: "SEC Filings",
    rank: 1,
    impactLabel: "High Impact",
    keywords: ["sec filing", "10-k", "10-q", "8-k", "form 4", "13f", "proxy statement", "def 14a"],
  },
  {
    category: "Earnings",
    rank: 2,
    impactLabel: "High Impact",
    keywords: ["earnings", "eps", "revenue", "quarterly results", "guides", "results beat", "results miss"],
  },
  {
    category: "Guidance",
    rank: 3,
    impactLabel: "High Impact",
    keywords: ["guidance raised", "guidance lowered", "outlook", "forecast", "raises outlook", "cuts outlook"],
  },
  {
    category: "Insider Activity",
    rank: 4,
    impactLabel: "High Impact",
    keywords: ["insider", "ceo sold", "director bought", "share sale", "share purchase"],
  },
  {
    category: "M&A / FDA",
    rank: 5,
    impactLabel: "High Impact",
    keywords: ["acquisition", "merger", "takeover", "buyout", "fda approval", "phase 3", "drug approval"],
  },
  {
    category: "Analyst Upgrades/Downgrades",
    rank: 6,
    impactLabel: "Medium Impact",
    keywords: ["upgrade", "downgrade", "outperform", "underperform", "overweight", "equal weight", "brokerage"],
  },
  {
    category: "Price Target Changes",
    rank: 7,
    impactLabel: "Medium Impact",
    keywords: ["price target", "target raised", "target lowered", "pt raised", "pt lowered"],
  },
  {
    category: "Volume / Technical Move",
    rank: 8,
    impactLabel: "Medium Impact",
    keywords: ["volume", "breakout", "breakdown", "momentum", "moving average", "ma50", "ma200", "sma50", "sma200"],
  },
];

function decodeEntities(value: string): string {
  return value.replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (entity) => ENTITY_MAP[entity] || entity);
}

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";

  return decodeEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, ". ")
      .replace(/<\/p>/gi, ". ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function normalizeTicker(ticker: string | null | undefined): string {
  return String(ticker || "").trim().toUpperCase();
}

function toSentimentLabel(label: string | null | undefined, score: number): NewsSentimentLabel {
  if (label === "positive" || label === "neutral" || label === "negative") return label;
  if (score >= 15) return "positive";
  if (score <= -15) return "negative";
  return "neutral";
}

function getRecencyBoost(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (!Number.isFinite(ageHours)) return 0;
  if (ageHours <= 6) return 18;
  if (ageHours <= 24) return 12;
  if (ageHours <= 72) return 6;
  return 0;
}

function classifyPriority(text: string): { category: NewsPriorityCategory; rank: number; impactLabel: NewsImpactLabel } {
  const normalized = text.toLowerCase();
  for (const rule of PRIORITY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return { category: rule.category, rank: rule.rank, impactLabel: rule.impactLabel };
    }
  }

  return { category: "General Market", rank: 9, impactLabel: "Low Impact" };
}

function scorePriority(
  classification: { rank: number; impactLabel: NewsImpactLabel },
  sentimentScore: number,
  impactScore: number,
  publishedAt: string | null
): number {
  const base = Math.max(0, 110 - classification.rank * 10);
  const impactBoost = Math.min(impactScore || 0, 25);
  const sentimentBoost = Math.min(Math.abs(sentimentScore || 0) * 0.2, 12);
  const recencyBoost = getRecencyBoost(publishedAt);
  return Math.round((base + impactBoost + sentimentBoost + recencyBoost) * 100) / 100;
}

function buildFallbackSummary(article: ArticleForSummary): string[] {
  const bullets: string[] = [];
  const lead = article.cleanSummary || article.headline;
  const sentences = lead
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (article.priorityCategory === "SEC Filings") {
    bullets.push(`${article.ticker} ma świeży filing SEC, który może zmienić ocenę ryzyka.`);
  } else if (article.priorityCategory === "Earnings") {
    bullets.push(`${article.ticker} jest powiązany z publikacją wyników lub reakcją na earnings.`);
  } else if (article.priorityCategory === "Guidance") {
    bullets.push(`Komunikat dotyczy outlooku lub guidance dla ${article.ticker}.`);
  } else if (article.priorityCategory === "Insider Activity") {
    bullets.push(`Wiadomość dotyczy aktywności insiderów w ${article.ticker}.`);
  } else if (article.priorityCategory === "Analyst Upgrades/Downgrades") {
    bullets.push(`Analitycy zaktualizowali ocenę lub nastawienie wobec ${article.ticker}.`);
  } else if (article.priorityCategory === "Price Target Changes") {
    bullets.push(`Zmiana price target może wpłynąć na krótkoterminowy sentyment dla ${article.ticker}.`);
  }

  for (const sentence of sentences) {
    const cleaned = sentence.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    if (bullets.some((bullet) => bullet.toLowerCase() === cleaned.toLowerCase())) continue;
    bullets.push(cleaned.endsWith(".") ? cleaned : `${cleaned}.`);
    if (bullets.length >= 3) break;
  }

  if (bullets.length < 2) {
    const sentimentText =
      article.sentimentLabel === "positive"
        ? "Sentyment wiadomości jest obecnie pozytywny."
        : article.sentimentLabel === "negative"
        ? "Sentyment wiadomości jest obecnie negatywny."
        : "Sentyment wiadomości pozostaje mieszany lub neutralny.";
    bullets.push(sentimentText);
  }

  bullets.push(
    article.impactLabel === "High Impact"
      ? "To informacja, która może realnie zmienić decyzje inwestorów krótkoterminowych."
      : article.impactLabel === "Medium Impact"
      ? "To średniej wagi impuls, który warto obserwować w kontekście ceny i wolumenu."
      : "To bardziej kontekstowy news niż bezpośredni katalizator ceny."
  );

  return [...new Set(bullets)].slice(0, 4);
}

async function summarizeWithOpenAI(articles: ArticleForSummary[]): Promise<Map<number, string[]>> {
  if (articles.length === 0) return new Map<number, string[]>();

  const openaiKey = process.env.OPENAI_API_KEY || (await getSettingValue("openai_api_key")) || "";
  if (!openaiKey) return new Map<number, string[]>();

  const openaiBase = process.env.OPENAI_BASE_URL || (await getSettingValue("openai_base_url")) || "https://api.openai.com/v1";
  const prompt = [
    "Zwróć wyłącznie JSON w formacie:",
    '{"items":[{"id":1,"bullets":["...", "..."]}]}',
    "Każdy news streść w 2-4 bardzo krótkich punktach po polsku.",
    "Skup się na inwestycyjnym wpływie informacji, bez wstępów i bez markdown.",
    JSON.stringify({
      items: articles.map((article) => ({
        id: article.id,
        ticker: article.ticker,
        headline: article.headline,
        summary: article.cleanSummary,
        source: article.source,
        sentiment: article.sentimentLabel,
        impact: article.impactLabel,
        category: article.priorityCategory,
      })),
    }),
  ].join("\n");

  try {
    const response = await fetch(`${openaiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Jesteś analitykiem rynku akcji. Zwracasz wyłącznie poprawny JSON.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return new Map<number, string[]>();

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return new Map<number, string[]>();

    const parsed = JSON.parse(content) as { items?: Array<{ id: number; bullets: string[] }> };
    const result = new Map<number, string[]>();
    for (const item of parsed.items || []) {
      const bullets = Array.isArray(item.bullets)
        ? item.bullets.map((bullet) => String(bullet).trim()).filter(Boolean).slice(0, 4)
        : [];
      if (bullets.length > 0) result.set(item.id, bullets);
    }
    return result;
  } catch {
    return new Map<number, string[]>();
  }
}

async function persistNewsEnrichment(item: EnrichedNewsItem): Promise<void> {
  await runSql(
    `UPDATE news
     SET clean_summary = ?,
         impact_label = ?,
         priority_category = ?,
         priority_rank = ?,
         priority_score = ?,
         ai_summary_json = ?
     WHERE id = ?`,
    [
      item.clean_summary,
      item.impact_label,
      item.priority_category,
      item.priority_rank,
      item.priority_score,
      JSON.stringify(item.ai_summary),
      item.id,
    ]
  );
}

export async function enrichNewsRows(rows: NewsDbRow[], portfolioTickers: Set<string>): Promise<EnrichedNewsItem[]> {
  const drafts = rows.map((row) => {
    const headline = stripHtml(row.headline);
    const cleanSummary = stripHtml(row.clean_summary || row.summary);
    const sentimentScore = Number(row.sentiment_score || 0);
    const impactScore = Number(row.impact_score || 0);
    const sentimentLabel = toSentimentLabel(row.sentiment_label, sentimentScore);
    const classification = classifyPriority(`${headline} ${cleanSummary}`);
    const priorityCategory = (row.priority_category as NewsPriorityCategory | null) || classification.category;
    const priorityRank = Number(row.priority_rank || classification.rank);
    const impactLabel = (row.impact_label as NewsImpactLabel | null) || classification.impactLabel;
    const priorityScore = Number(row.priority_score || scorePriority({ rank: priorityRank, impactLabel }, sentimentScore, impactScore, row.published_at));
    let aiSummary: string[] = [];
    if (row.ai_summary_json) {
      try {
        const parsed = JSON.parse(row.ai_summary_json) as unknown;
        if (Array.isArray(parsed)) {
          aiSummary = parsed.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 4);
        }
      } catch {
        aiSummary = [];
      }
    }

    return {
      id: row.id,
      ticker: normalizeTicker(row.ticker),
      headline,
      summary: stripHtml(row.summary),
      clean_summary: cleanSummary,
      source: String(row.source || "Unknown"),
      url: row.url || null,
      published_at: row.published_at,
      sentiment_label: sentimentLabel,
      sentiment_score: sentimentScore,
      impact_score: impactScore,
      impact_label: impactLabel,
      priority_category: priorityCategory,
      priority_rank: priorityRank,
      priority_score: priorityScore,
      ai_summary: aiSummary,
      is_portfolio: portfolioTickers.has(normalizeTicker(row.ticker)),
    } satisfies EnrichedNewsItem;
  });

  const missingAiSummaries = drafts
    .filter((item) => item.ai_summary.length === 0)
    .sort((left, right) => right.priority_score - left.priority_score)
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      ticker: item.ticker,
      headline: item.headline,
      cleanSummary: item.clean_summary,
      source: item.source,
      publishedAt: item.published_at,
      sentimentLabel: item.sentiment_label,
      impactLabel: item.impact_label,
      priorityCategory: item.priority_category,
    }));

  const aiSummaries = await summarizeWithOpenAI(missingAiSummaries);

  for (const item of drafts) {
    if (aiSummaries.has(item.id)) {
      item.ai_summary = aiSummaries.get(item.id) || [];
    }
    if (item.ai_summary.length === 0) {
      item.ai_summary = buildFallbackSummary({
        id: item.id,
        ticker: item.ticker,
        headline: item.headline,
        cleanSummary: item.clean_summary,
        source: item.source,
        publishedAt: item.published_at,
        sentimentLabel: item.sentiment_label,
        impactLabel: item.impact_label,
        priorityCategory: item.priority_category,
      });
    }
  }

  await Promise.all(
    drafts.map(async (item, index) => {
      const source = rows[index];
      const storedSummary = source.clean_summary ? stripHtml(source.clean_summary) : "";
      const storedAi = source.ai_summary_json || "";
      if (
        storedSummary !== item.clean_summary ||
        source.impact_label !== item.impact_label ||
        source.priority_category !== item.priority_category ||
        Number(source.priority_rank || 0) !== item.priority_rank ||
        Number(source.priority_score || 0) !== item.priority_score ||
        storedAi !== JSON.stringify(item.ai_summary)
      ) {
        await persistNewsEnrichment(item);
      }
    })
  );

  return drafts;
}

export function buildNewsStats(items: EnrichedNewsItem[]) {
  const total = items.length;
  const bullish = items.filter((item) => item.sentiment_label === "positive").length;
  const neutral = items.filter((item) => item.sentiment_label === "neutral").length;
  const bearish = items.filter((item) => item.sentiment_label === "negative").length;
  const bullishPct = total > 0 ? Math.round((bullish / total) * 100) : 0;
  const neutralPct = total > 0 ? Math.round((neutral / total) * 100) : 0;
  const bearishPct = total > 0 ? Math.round((bearish / total) * 100) : 0;
  const averageSentiment = total > 0 ? items.reduce((sum, item) => sum + item.sentiment_score, 0) / total : 0;
  const sentimentScore = Math.max(-100, Math.min(100, Math.round(averageSentiment)));

  return {
    total,
    bullish,
    neutral,
    bearish,
    bullishPct,
    neutralPct,
    bearishPct,
    sentimentScore,
  };
}

