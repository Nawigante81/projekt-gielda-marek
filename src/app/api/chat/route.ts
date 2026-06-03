import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, getSetting } from "@/lib/db";

function extractTickers(question: string): string[] {
  const stopwords = new Set(["AI", "US", "ETF"]);
  return [...new Set((question.toUpperCase().match(/\b[A-Z]{1,5}\b/g) || []).filter((token) => token.length >= 2 && !stopwords.has(token)))];
}

function fetchTopContext(db: ReturnType<typeof getDb>): Array<Record<string, unknown>> {
  return db.prepare(`
    SELECT s.ticker,
      COALESCE(s.company_name, s.ticker) as company_name,
      cp.price,
      cp.change_pct,
      ti.ai_score,
      ti.recommendation,
      ti.rsi_14,
      ti.signal_macd,
      se.score as sentiment_score,
      se.label as sentiment_label,
      (SELECT summary FROM sentiment WHERE ticker = s.ticker ORDER BY created_at DESC LIMIT 1) as latest_summary
    FROM stocks s
    LEFT JOIN current_prices cp ON cp.ticker = s.ticker
    LEFT JOIN technical_indicators ti ON ti.id = (
      SELECT id FROM technical_indicators WHERE ticker = s.ticker ORDER BY calculated_at DESC, id DESC LIMIT 1
    )
    LEFT JOIN sentiment se ON se.id = (
      SELECT id FROM sentiment WHERE ticker = s.ticker ORDER BY created_at DESC, id DESC LIMIT 1
    )
    WHERE ti.ai_score IS NOT NULL
    ORDER BY ti.ai_score DESC
    LIMIT 5
  `).all() as Array<Record<string, unknown>>;
}

function buildDeterministicAnswer(question: string, contexts: Array<Record<string, unknown>>): string {
  const lowerQuestion = question.toLowerCase();
  if (contexts.length === 0) {
    return "Brak danych dla wskazanego pytania. Najpierw uruchom analizę dla odpowiednich tickerów.";
  }

  if (lowerQuestion.includes("porównaj") && contexts.length >= 2) {
    const [left, right] = contexts;
    return `${left.ticker}: AI ${left.ai_score}, rekomendacja ${left.recommendation}, RSI ${left.rsi_14}, sentyment ${left.sentiment_label} (${left.sentiment_score}). ${right.ticker}: AI ${right.ai_score}, rekomendacja ${right.recommendation}, RSI ${right.rsi_14}, sentyment ${right.sentiment_label} (${right.sentiment_score}). Wyższy wynik AI ma ${Number(left.ai_score || 0) >= Number(right.ai_score || 0) ? left.ticker : right.ticker}.`;
  }

  if (lowerQuestion.includes("najwyższy") || lowerQuestion.includes("rating")) {
    const sorted = [...contexts].sort((a, b) => Number(b.ai_score || 0) - Number(a.ai_score || 0));
    return sorted.slice(0, 3).map((item, index) => `${index + 1}. ${item.ticker}: AI ${item.ai_score}, ${item.recommendation}, zmiana ${item.change_pct}%`).join(" ");
  }

  const item = contexts[0];
  return `${item.ticker}: cena ${item.price}, zmiana ${item.change_pct}%, AI Score ${item.ai_score}, rekomendacja ${item.recommendation}, RSI ${item.rsi_14}, MACD ${item.signal_macd}, sentyment ${item.sentiment_label} (${item.sentiment_score}). Ostatni wniosek: ${item.latest_summary || "brak świeżego podsumowania"}.`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question } = await req.json();
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Pytanie jest wymagane" }, { status: 400 });
  }

  const tickers = extractTickers(question);
  const db = getDb();

  const rawContexts = tickers.length > 0
    ? tickers.map((ticker) => db.prepare(`
        SELECT s.ticker,
          COALESCE(s.company_name, s.ticker) as company_name,
          cp.price,
          cp.change_pct,
          ti.ai_score,
          ti.recommendation,
          ti.rsi_14,
          ti.signal_macd,
          se.score as sentiment_score,
          se.label as sentiment_label,
          (SELECT summary FROM sentiment WHERE ticker = s.ticker ORDER BY created_at DESC LIMIT 1) as latest_summary
        FROM stocks s
        LEFT JOIN current_prices cp ON cp.ticker = s.ticker
        LEFT JOIN technical_indicators ti ON ti.id = (
          SELECT id FROM technical_indicators WHERE ticker = s.ticker ORDER BY calculated_at DESC, id DESC LIMIT 1
        )
        LEFT JOIN sentiment se ON se.id = (
          SELECT id FROM sentiment WHERE ticker = s.ticker ORDER BY created_at DESC, id DESC LIMIT 1
        )
        WHERE s.ticker = ?
      `).get(ticker))
    : fetchTopContext(db);

  const contexts = rawContexts.filter(Boolean) as Array<Record<string, unknown>>;

  let validContexts = contexts.filter((item) => item.price !== null || item.ai_score !== null);
  if (validContexts.length === 0) {
    validContexts = fetchTopContext(db).filter((item) => item.price !== null || item.ai_score !== null);
  }
  if (validContexts.length === 0) {
    return NextResponse.json({ error: "Brak danych do odpowiedzi. Uruchom analizę dla wybranych spółek." }, { status: 400 });
  }

  let answer = buildDeterministicAnswer(question, validContexts);
  const openaiKey = process.env.OPENAI_API_KEY || getSetting("openai_api_key");
  if (openaiKey) {
    try {
      const response = await fetch(`${process.env.OPENAI_BASE_URL || getSetting("openai_base_url") || "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: "Odpowiadasz wyłącznie na podstawie dostarczonego kontekstu giełdowego. Jeśli w kontekście czegoś nie ma, powiedz to wprost. Nie spekuluj.",
            },
            {
              role: "user",
              content: `Pytanie: ${question}\n\nKontekst JSON:\n${JSON.stringify(validContexts, null, 2)}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) answer = content;
      }
    } catch {
      // Keep deterministic answer.
    }
  }

  db.prepare(`
    INSERT INTO ai_chat_logs (user_id, question, answer, context_json)
    VALUES (?, ?, ?, ?)
  `).run(session.userId, question, answer, JSON.stringify(validContexts));

  return NextResponse.json({ answer, contexts: validContexts });
}