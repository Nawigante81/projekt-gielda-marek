export interface SentimentArticleInput {
  headline: string;
  summary?: string;
  publishedAt?: string;
}

export interface SentimentArticleResult {
  label: "positive" | "neutral" | "negative";
  score: number;
  impactScore: number;
}

export interface AggregatedSentimentResult {
  label: "positive" | "neutral" | "negative";
  score: number;
  impactScore: number;
  sourceCount: number;
  summary: string;
}

const POSITIVE_TERMS = [
  "beat",
  "beats",
  "surge",
  "growth",
  "upgrade",
  "bullish",
  "strong",
  "record",
  "profit",
  "outperform",
  "partnership",
  "expands",
  "breakout",
  "buyback",
  "guidance raised",
  "momentum",
  "innovation",
  "contract",
  "wins",
  "acquisition",
];

const NEGATIVE_TERMS = [
  "miss",
  "misses",
  "downgrade",
  "lawsuit",
  "probe",
  "bearish",
  "warning",
  "cuts",
  "cut",
  "decline",
  "drop",
  "falls",
  "slump",
  "layoffs",
  "fraud",
  "recall",
  "delay",
  "bankruptcy",
  "weaker",
  "guidance lowered",
];

function countTerms(text: string, dictionary: string[]): number {
  const normalized = text.toLowerCase();
  return dictionary.reduce((count, term) => (normalized.includes(term) ? count + 1 : count), 0);
}

function getRecencyWeight(publishedAt?: string): number {
  if (!publishedAt) return 1;
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3600000;
  if (ageHours <= 24) return 1.35;
  if (ageHours <= 72) return 1.15;
  if (ageHours <= 168) return 1;
  return 0.75;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function analyzeNewsArticle(article: SentimentArticleInput): SentimentArticleResult {
  const text = `${article.headline} ${article.summary || ""}`.trim();
  const positiveHits = countTerms(text, POSITIVE_TERMS);
  const negativeHits = countTerms(text, NEGATIVE_TERMS);
  const recencyWeight = getRecencyWeight(article.publishedAt);
  const polarity = positiveHits - negativeHits;
  const rawScore = Math.max(-100, Math.min(100, polarity * 22 * recencyWeight));

  let label: "positive" | "neutral" | "negative" = "neutral";
  if (rawScore >= 15) label = "positive";
  else if (rawScore <= -15) label = "negative";

  const impactScore = round(Math.min(100, Math.abs(rawScore) * (1 + Math.min(positiveHits + negativeHits, 3) * 0.1)));

  return {
    label,
    score: round(rawScore),
    impactScore,
  };
}

export function aggregateNewsSentiment(articles: SentimentArticleInput[]): AggregatedSentimentResult {
  if (articles.length === 0) {
    return {
      label: "neutral",
      score: 0,
      impactScore: 0,
      sourceCount: 0,
      summary: "Brak aktualnych newsów do oceny sentymentu.",
    };
  }

  const scored = articles.map(analyzeNewsArticle);
  const totalScore = scored.reduce((sum, article) => sum + article.score, 0);
  const totalImpact = scored.reduce((sum, article) => sum + article.impactScore, 0);
  const avgScore = round(totalScore / scored.length);
  const avgImpact = round(totalImpact / scored.length);

  let label: "positive" | "neutral" | "negative" = "neutral";
  if (avgScore >= 15) label = "positive";
  else if (avgScore <= -15) label = "negative";

  const positiveCount = scored.filter((article) => article.label === "positive").length;
  const negativeCount = scored.filter((article) => article.label === "negative").length;
  const summary =
    label === "positive"
      ? `Przewaga pozytywnych impulsów (${positiveCount}/${scored.length} newsów pozytywnych).`
      : label === "negative"
      ? `Przewaga negatywnych impulsów (${negativeCount}/${scored.length} newsów negatywnych).`
      : "Sentyment mieszany lub neutralny.";

  return {
    label,
    score: avgScore,
    impactScore: avgImpact,
    sourceCount: articles.length,
    summary,
  };
}