import { queryRow, queryRows, runSql } from "./postgres-access";

interface SecTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecSubmissionResponse {
  cik: string;
  name: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

export interface SecFilingRow {
  id: number;
  ticker: string;
  cik: string;
  company_name: string | null;
  form: string;
  accession_number: string;
  filing_date: string;
  report_date: string | null;
  primary_document: string | null;
  filing_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const SEC_FORMS = new Set(["10-K", "10-Q", "8-K", "S-1", "DEF 14A", "4"]);

function secHeaders(): HeadersInit {
  return {
    "User-Agent": process.env.SEC_USER_AGENT || "Projekt Gielda Marek kontakt@example.com",
    Accept: "application/json",
  };
}

function normalizeCik(value: number | string): string {
  return String(value).padStart(10, "0");
}

function buildFilingUrl(cik: string, accessionNumber: string, primaryDocument?: string): string {
  const cikNoLeadingZeros = String(Number(cik));
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  const document = primaryDocument || `${accessionNumber}.txt`;
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${document}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: secHeaders(),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`SEC request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function resolveSecTicker(ticker: string): Promise<{ cik: string; companyName: string } | null> {
  const normalizedTicker = ticker.toUpperCase();
  const cached = await queryRow<{ cik: string; company_name: string | null }>(
    "SELECT cik, company_name FROM sec_filings WHERE ticker = ? ORDER BY updated_at DESC LIMIT 1",
    [normalizedTicker]
  );

  if (cached?.cik) {
    return {
      cik: normalizeCik(cached.cik),
      companyName: cached.company_name || normalizedTicker,
    };
  }

  const entries = await fetchJson<Record<string, SecTickerEntry>>("https://www.sec.gov/files/company_tickers.json");
  const match = Object.values(entries).find((entry) => entry.ticker.toUpperCase() === normalizedTicker);

  if (!match) return null;

  return {
    cik: normalizeCik(match.cik_str),
    companyName: match.title,
  };
}

export async function refreshSecFilings(ticker: string): Promise<SecFilingRow[]> {
  const normalizedTicker = ticker.toUpperCase();
  const resolved = await resolveSecTicker(normalizedTicker);
  if (!resolved) {
    throw new Error(`SEC CIK not found for ticker ${normalizedTicker}`);
  }

  const submission = await fetchJson<SecSubmissionResponse>(
    `https://data.sec.gov/submissions/CIK${resolved.cik}.json`
  );

  const recent = submission.filings?.recent;
  const forms = recent?.form || [];
  const accessionNumbers = recent?.accessionNumber || [];
  const filingDates = recent?.filingDate || [];
  const reportDates = recent?.reportDate || [];
  const primaryDocuments = recent?.primaryDocument || [];

  for (let index = 0; index < forms.length; index += 1) {
    const form = forms[index];
    const accessionNumber = accessionNumbers[index];
    const filingDate = filingDates[index];
    if (!form || !accessionNumber || !filingDate || !SEC_FORMS.has(form)) continue;

    const primaryDocument = primaryDocuments[index] || null;
    await runSql(
      `INSERT INTO sec_filings (
         ticker, cik, company_name, form, accession_number, filing_date, report_date,
         primary_document, filing_url, source, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sec', datetime('now'))
       ON CONFLICT(ticker, accession_number, form) DO UPDATE SET
         company_name = excluded.company_name,
         filing_date = excluded.filing_date,
         report_date = excluded.report_date,
         primary_document = excluded.primary_document,
         filing_url = excluded.filing_url,
         updated_at = datetime('now')`,
      [
        normalizedTicker,
        resolved.cik,
        submission.name || resolved.companyName,
        form,
        accessionNumber,
        filingDate,
        reportDates[index] || null,
        primaryDocument,
        buildFilingUrl(resolved.cik, accessionNumber, primaryDocument || undefined),
      ]
    );
  }

  return getSecFilings(normalizedTicker);
}

export async function generateSecFilingAlerts(ticker: string): Promise<number> {
  const normalizedTicker = ticker.toUpperCase();
  const rule = await queryRow<{ is_enabled: number }>(
    "SELECT is_enabled FROM alert_rules WHERE rule_key = ? LIMIT 1",
    ["sec_recent_filing"]
  );

  if (rule && rule.is_enabled !== 1) return 0;

  const filings = await queryRows<SecFilingRow>(
    `SELECT * FROM sec_filings
     WHERE ticker = ?
       AND filing_date >= ?
       AND form IN ('10-K', '10-Q', '8-K', '4')
     ORDER BY filing_date DESC, id DESC
     LIMIT 10`,
    [
      normalizedTicker,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    ]
  );

  let created = 0;
  for (const filing of filings) {
    const alertType = `sec_${filing.form.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const existing = await queryRow<{ id: number }>(
      "SELECT id FROM alerts WHERE ticker = ? AND alert_type = ? AND metadata_json LIKE ? LIMIT 1",
      [normalizedTicker, alertType, `%${filing.accession_number}%`]
    );

    if (existing) continue;

    const severity = filing.form === "4" ? "info" : "warning";
    const message = `${normalizedTicker}: nowy filing SEC ${filing.form} z ${filing.filing_date}`;
    await runSql(
      `INSERT INTO alerts (ticker, alert_type, severity, message, value, threshold, rule_key, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizedTicker,
        alertType,
        severity,
        message,
        null,
        null,
        "sec_recent_filing",
        JSON.stringify({
          accession_number: filing.accession_number,
          form: filing.form,
          filing_date: filing.filing_date,
          report_date: filing.report_date,
          filing_url: filing.filing_url,
        }),
      ]
    );
    created += 1;
  }

  return created;
}

export async function getSecFilings(ticker?: string): Promise<SecFilingRow[]> {
  if (ticker) {
    return queryRows<SecFilingRow>(
      "SELECT * FROM sec_filings WHERE ticker = ? ORDER BY filing_date DESC, id DESC LIMIT 50",
      [ticker.toUpperCase()]
    );
  }

  return queryRows<SecFilingRow>("SELECT * FROM sec_filings ORDER BY filing_date DESC, id DESC LIMIT 100");
}
