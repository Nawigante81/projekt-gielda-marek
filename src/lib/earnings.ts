import { queryRow, queryRows, runSql } from "./postgres-access";

export interface EarningsEventRow {
  id: number;
  event_type: string;
  title: string;
  ticker: string | null;
  sector: string | null;
  event_date: string;
  period_label: string | null;
  impact: string | null;
  source: string | null;
  details_json: string | null;
  created_at: string;
}

function daysUntil(value: string): number | null {
  const eventTime = new Date(value).getTime();
  if (!Number.isFinite(eventTime)) return null;
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.ceil((eventTime - startToday) / (24 * 60 * 60 * 1000));
}

export async function getUpcomingEarnings(limit = 100): Promise<EarningsEventRow[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return queryRows<EarningsEventRow>(
    `SELECT * FROM market_events
     WHERE event_type = 'earnings'
       AND event_date >= ?
     ORDER BY event_date ASC, ticker ASC
     LIMIT ?`,
    [cutoff, limit]
  );
}

export async function generateUpcomingEarningsAlerts(): Promise<number> {
  const rule = await queryRow<{ is_enabled: number }>(
    "SELECT is_enabled FROM alert_rules WHERE rule_key = ? LIMIT 1",
    ["earnings_upcoming"]
  );

  if (rule && rule.is_enabled !== 1) return 0;

  const upcoming = await getUpcomingEarnings(200);
  let created = 0;

  for (const event of upcoming) {
    if (!event.ticker) continue;
    const days = daysUntil(event.event_date);
    if (days === null || days < 0 || days > 3) continue;

    const alertType = "earnings_upcoming";
    const existing = await queryRow<{ id: number }>(
      "SELECT id FROM alerts WHERE ticker = ? AND alert_type = ? AND metadata_json LIKE ? LIMIT 1",
      [event.ticker, alertType, `%"event_id":${event.id}%`]
    );
    if (existing) continue;

    const when = days === 0 ? "dzisiaj" : days === 1 ? "jutro" : `za ${days} dni`;
    await runSql(
      `INSERT INTO alerts (ticker, alert_type, severity, message, value, threshold, rule_key, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.ticker,
        alertType,
        days === 0 ? "warning" : "info",
        `${event.ticker}: wyniki kwartalne ${when}`,
        days,
        3,
        "earnings_upcoming",
        JSON.stringify({
          event_id: event.id,
          event_date: event.event_date,
          source: event.source,
          title: event.title,
        }),
      ]
    );
    created += 1;
  }

  return created;
}
