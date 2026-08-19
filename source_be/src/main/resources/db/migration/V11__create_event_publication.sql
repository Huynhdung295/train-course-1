-- V6__create_event_publication.sql
-- Spring Modulith Event Publication Registry

CREATE TABLE event_publication (
    id UUID PRIMARY KEY,
    listener_id VARCHAR(512) NOT NULL,
    event_type VARCHAR(512) NOT NULL,
    serialized_event TEXT NOT NULL,
    publication_date TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    completion_date TIMESTAMP(6) WITH TIME ZONE
);
