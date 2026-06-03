import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed not available in production" }, { status: 403 });
  }

  const db = getDb();

  // Reset admin password to 'admin123'
  const hash = hashPassword("admin123");
  db.prepare("INSERT OR REPLACE INTO users (username, password_hash) VALUES (?, ?)").run("pytomek@o2.pl", hash);

  // Seed portfolio
  const portfolioItems = [
    { ticker: "AAPL", company_name: "Apple Inc.", shares: 10, purchase_price: 150.00, purchase_date: "2024-01-15" },
    { ticker: "NVDA", company_name: "NVIDIA Corporation", shares: 5, purchase_price: 450.00, purchase_date: "2024-02-01" },
    { ticker: "AMD", company_name: "Advanced Micro Devices", shares: 15, purchase_price: 120.00, purchase_date: "2024-03-10" },
    { ticker: "MSFT", company_name: "Microsoft Corporation", shares: 8, purchase_price: 380.00, purchase_date: "2024-01-20" },
  ];

  db.prepare("DELETE FROM portfolio").run();
  const insertPortfolio = db.prepare(`
    INSERT INTO portfolio (ticker, company_name, shares, purchase_price, purchase_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const item of portfolioItems) {
    insertPortfolio.run(item.ticker, item.company_name, item.shares, item.purchase_price, item.purchase_date, "");
  }

  // Seed watchlist
  const watchlistItems = [
    { ticker: "PLTR", company_name: "Palantir Technologies" },
    { ticker: "TSLA", company_name: "Tesla Inc." },
    { ticker: "META", company_name: "Meta Platforms" },
    { ticker: "AMZN", company_name: "Amazon.com Inc." },
    { ticker: "GOOGL", company_name: "Alphabet Inc." },
  ];

  db.prepare("DELETE FROM watchlist").run();
  const insertWatchlist = db.prepare("INSERT OR IGNORE INTO watchlist (ticker, company_name) VALUES (?, ?)");
  for (const item of watchlistItems) {
    insertWatchlist.run(item.ticker, item.company_name);
  }

  // Seed some example alerts
  db.prepare("DELETE FROM alerts").run();
  const alertItems = [
    { ticker: "NVDA", type: "rsi_overbought", severity: "warning", message: "NVDA: RSI 72.3 przekroczył 70 (wykupienie)", value: 72.3 },
    { ticker: "AMD", type: "macd_bullish", severity: "info", message: "AMD: Sygnał MACD bullish", value: 0.45 },
    { ticker: "TSLA", type: "large_price_move", severity: "warning", message: "TSLA: Duży ruch ceny +6.2%", value: 6.2 },
    { ticker: "PLTR", type: "adx_strong_trend", severity: "info", message: "PLTR: ADX 28.5 - silny trend", value: 28.5 },
  ];

  const insertAlert = db.prepare(`
    INSERT INTO alerts (ticker, alert_type, severity, message, value)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const alert of alertItems) {
    insertAlert.run(alert.ticker, alert.type, alert.severity, alert.message, alert.value);
  }

  // Seed example AI report
  db.prepare("DELETE FROM ai_reports").run();
  db.prepare(`
    INSERT INTO ai_reports (report_type, content, market_sentiment) VALUES (?, ?, ?)
  `).run("seed", `## Raport Analizy Technicznej
*Przykładowy raport wygenerowany przy seed danych*

### Sytuacja Rynkowa
Rynek neutralny z lekkim sentymentem risk-on. Nasdaq mocniejszy od S&P 500. VIX stabilny poniżej 20.

### Sentyment: NEUTRAL → lekki risk-on
S&P 500 w trendzie bocznym, QQQ wykazuje relative strength. Brak wyraźnych sygnałów do zmiany sentymentu.

### Portfolio
- **NVDA**: RSI zbliża się do strefy wykupienia (72.3). MACD pozytywny. Trend wzrostowy zachowany.
- **AAPL**: Neutralny sygnał. Cena powyżej SMA50. Konsolidacja.
- **AMD**: Sygnał MACD bullish po korekcie. Warte obserwacji.
- **MSFT**: Powyżej wszystkich SMA. Stabilna pozycja.

### Watchlista
- **PLTR**: Wzrost wolumenu, silny trend ADX. Obserwuj poziomy Fibonacci.
- **TSLA**: Duży ruch dzienny +6.2%. RSI w normalnej strefie.
- **META**: Neutralnie, bez wyraźnego sygnału.

### Alerty
- NVDA: RSI wykupienie (72.3)
- TSLA: Duży ruch +6.2%
- PLTR: Silny trend ADX (28.5)

### Podsumowanie
Sesja neutralna. Portfolio zachowuje się stabilnie. Uwaga na NVDA - RSI bliski wykupienia, można rozważyć monitorowanie poziomu 75+.

---
*Nie stanowi porady inwestycyjnej.*`, "neutral");

  return NextResponse.json({ success: true, message: "Dane seed załadowane. Login: pytomek@o2.pl / admin123" });
}
