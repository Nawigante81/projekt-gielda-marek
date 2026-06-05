import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettingValue, queryRow, queryRows, runSql } from "@/lib/postgres-access";

function extractTickers(question: string): string[] {
  const stopwords = new Set(["AI", "US", "ETF"]);
  return [...new Set((question.toUpperCase().match(/\b[A-Z]{1,5}\b/g) || []).filter((token) => token.length >= 2 && !stopwords.has(token)))];
}

async function fetchTopContext(): Promise<Array<Record<string, unknown>>> {
  return queryRows(`
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
  `);
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

  const rawContexts = tickers.length > 0
    ? await Promise.all(tickers.map((ticker) => queryRow(`
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
      `, [ticker])))
    : await fetchTopContext();

  const contexts = rawContexts.filter(Boolean) as Array<Record<string, unknown>>;

  let validContexts = contexts.filter((item) => item.price !== null || item.ai_score !== null);
  if (validContexts.length === 0) {
    validContexts = (await fetchTopContext()).filter((item) => item.price !== null || item.ai_score !== null);
  }
  if (validContexts.length === 0) {
    return NextResponse.json({ error: "Brak danych do odpowiedzi. Uruchom analizę dla wybranych spółek." }, { status: 400 });
  }

  let answer = buildDeterministicAnswer(question, validContexts);
  const openaiKey = process.env.OPENAI_API_KEY || (await getSettingValue("openai_api_key"));
  let usedModelProvider = "deterministic";
  if (openaiKey) {
    try {
      const openaiBaseUrl = process.env.OPENAI_BASE_URL || (await getSettingValue("openai_base_url")) || "https://api.openai.com/v1";
      const response = await fetch(`${openaiBaseUrl}/chat/completions`, {
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
        if (content) {
          answer = content;
          usedModelProvider = "openai";
        }
      }
    } catch {
      // Keep deterministic answer.
    }
  }

  if (usedModelProvider === "deterministic") {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || (await getSettingValue("anthropic_api_key"));
    if (anthropicKey) {
      try {
        const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || (await getSettingValue("anthropic_base_url")) || "https://api.anthropic.com";
        const response = await fetch(`${anthropicBaseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 500,
            temperature: 0.2,
            system: "Odpowiadasz wyłącznie na podstawie dostarczonego kontekstu giełdowego. Jeśli w kontekście czegoś nie ma, powiedz to wprost. Nie spekuluj.",
            messages: [
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
          const content = Array.isArray(data.content)
            ? data.content.map((part: { text?: string }) => part.text || "").join("\n").trim()
            : "";
          if (content) {
            answer = content;
            usedModelProvider = "anthropic";
          }
        }
      } catch {
        // Keep deterministic answer.
      }
    }
  }

  await runSql(`
    INSERT INTO ai_chat_logs (user_id, question, answer, context_json)
    VALUES (?, ?, ?, ?)
  `, [session.userId, question, answer, JSON.stringify(validContexts)]);

  return NextResponse.json({ answer, contexts: validContexts, provider: usedModelProvider });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await queryRows(`
    SELECT id, question, answer, context_json, created_at
    FROM ai_chat_logs
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `, [session.userId]);

  return NextResponse.json(rows);
}
