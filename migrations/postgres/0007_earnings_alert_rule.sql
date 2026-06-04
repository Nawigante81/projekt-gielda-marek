INSERT INTO alert_rules (rule_key, name, description, threshold_value)
VALUES
  ('earnings_upcoming', 'Nadchodzace wyniki', 'Alert przed publikacja wynikow kwartalnych', NULL)
ON CONFLICT (rule_key)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
