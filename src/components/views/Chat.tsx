"use client";

import { useState } from "react";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import toast from "react-hot-toast";

const SUGGESTIONS = [
  "Czy AMD jest obecnie atrakcyjne?",
  "Porównaj NVDA i AMD.",
  "Jakie spółki AI mają najwyższy rating?",
  "Dlaczego Tesla spada?",
];

interface ChatResponse {
  answer: string;
  contexts: Array<Record<string, unknown>>;
}

export default function Chat() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async (prompt: string) => {
    if (!prompt.trim()) {
      toast.error("Podaj pytanie do asystenta");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nie udało się uzyskać odpowiedzi");
        return;
      }
      setAnswer(data);
    } catch {
      toast.error("Błąd połączenia z asystentem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessagesSquare size={18} className="text-blue-400" /> AI Chat
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Asystent odpowiada wyłącznie na podstawie danych dostępnych w bazie i ostatnich analiz.
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => { setQuestion(suggestion); void ask(suggestion); }}
              className="text-left px-3 py-2 rounded-md bg-slate-800/60 hover:bg-slate-800 text-sm text-slate-300 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Zadaj pytanie o spółkę, porównanie lub ranking..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            onClick={() => void ask(question)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Zapytaj
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[2fr,1fr] gap-4">
        <div className="card p-4 min-h-64">
          <div className="text-xs font-medium text-slate-400 mb-3">Odpowiedź</div>
          {loading && (
            <div className="flex items-center justify-center h-48 text-slate-500">
              <Loader2 size={22} className="animate-spin text-blue-400" />
            </div>
          )}
          {!loading && answer && (
            <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{answer.answer}</div>
          )}
          {!loading && !answer && (
            <div className="h-48 flex items-center justify-center text-sm text-slate-600">
              Zadaj pytanie, aby wygenerować odpowiedź opartą na danych z analizy.
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="text-xs font-medium text-slate-400 mb-3">Użyty kontekst</div>
          <div className="space-y-2">
            {answer?.contexts?.map((ctx, index) => (
              <div key={`${ctx.ticker || index}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-xs">
                <div className="text-white font-medium">{String(ctx.ticker || "Rynek")}</div>
                <div className="text-slate-400 mt-1">AI Score: {String(ctx.ai_score ?? "—")}</div>
                <div className="text-slate-400">Rekomendacja: {String(ctx.recommendation ?? "—")}</div>
                <div className="text-slate-400">Sentyment: {String(ctx.sentiment_label ?? "—")} ({String(ctx.sentiment_score ?? "0")})</div>
              </div>
            ))}
            {!answer?.contexts?.length && (
              <div className="text-sm text-slate-600">Brak danych kontekstowych.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}