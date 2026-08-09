-- V5__create_outbox.sql (Transactional Outbox Pattern)
CREATE TABLE outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(100) NOT NULL,
    aggregate_id    VARCHAR(100) NOT NULL,
    event_type      VARCHAR(200) NOT NULL,
    payload         JSONB NOT NULL,
    headers         JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status_retry ON outbox_events(status, next_retry_at)
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
