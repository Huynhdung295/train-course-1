-- V15__update_outbox_events_schema.sql
ALTER TABLE outbox_events DROP COLUMN IF EXISTS headers;
ALTER TABLE outbox_events DROP COLUMN IF EXISTS status;
ALTER TABLE outbox_events DROP COLUMN IF EXISTS retry_count;
ALTER TABLE outbox_events DROP COLUMN IF EXISTS next_retry_at;
ALTER TABLE outbox_events DROP COLUMN IF EXISTS sent_at;

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

DROP INDEX IF EXISTS idx_outbox_status_retry;
CREATE INDEX IF NOT EXISTS idx_outbox_published ON outbox_events(published);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox_events(created_at);
