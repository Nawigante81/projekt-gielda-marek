ALTER TABLE watchlist
  ADD COLUMN IF NOT EXISTS opportunity_type TEXT NOT NULL DEFAULT 'observed';

UPDATE watchlist
SET opportunity_type = COALESCE(NULLIF(opportunity_type, ''), 'observed')
WHERE opportunity_type IS NULL
   OR opportunity_type = '';

ALTER TABLE watchlist
  ADD CONSTRAINT watchlist_opportunity_type_check
  CHECK (opportunity_type IN ('observed', 'opportunity', 'high_volume', 'after_earnings', 'unusual_move'));
