CREATE TABLE IF NOT EXISTS sec_filings (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,
  company_name TEXT,
  form TEXT NOT NULL,
  accession_number TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  report_date TEXT,
  primary_document TEXT,
  filing_url TEXT,
  source TEXT NOT NULL DEFAULT 'sec',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticker, accession_number, form)
);

CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON sec_filings(ticker);
CREATE INDEX IF NOT EXISTS idx_sec_filings_filing_date ON sec_filings(filing_date);
CREATE INDEX IF NOT EXISTS idx_sec_filings_form ON sec_filings(form);
