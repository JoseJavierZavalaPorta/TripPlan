-- Migration 006: Create trip_blacklist table
-- Used by the itinerary agent to remember activities the user doesn't want regenerated.
-- Run once against your Oracle DB schema.

CREATE TABLE trip_blacklist (
  id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id    RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title      VARCHAR2(300) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_blacklist_trip ON trip_blacklist (trip_id);
