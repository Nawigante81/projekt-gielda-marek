ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS alert_threshold NUMERIC;

ALTER TABLE portfolio
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'owned';

UPDATE portfolio
SET
  currency = COALESCE(NULLIF(currency, ''), 'USD'),
  status = COALESCE(NULLIF(status, ''), 'owned')
WHERE currency IS NULL
   OR currency = ''
   OR status IS NULL
   OR status = '';

ALTER TABLE portfolio
  ADD CONSTRAINT portfolio_status_check
  CHECK (status IN ('observed', 'owned', 'sold'));

ALTER TABLE portfolio
  ADD CONSTRAINT portfolio_currency_check
  CHECK (currency IN ('USD', 'EUR', 'PLN', 'GBP'));
