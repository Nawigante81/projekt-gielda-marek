INSERT INTO alert_rules (rule_key, name, description, threshold_value)
VALUES
  ('sec_recent_filing', 'Nowy filing SEC', 'Alert przy swiezym raporcie SEC 10-K, 10-Q, 8-K lub Form 4', NULL)
ON CONFLICT (rule_key)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
