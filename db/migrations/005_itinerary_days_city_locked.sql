-- Migration 005: Add city/country/flag/locked columns to itinerary_days
-- These columns were added to the codebase but never migrated to production.
-- Run once against your Oracle DB schema.

ALTER TABLE itinerary_days ADD (
  locked   NUMBER(1) DEFAULT 0 NOT NULL CHECK (locked IN (0, 1)),
  city     VARCHAR2(200),
  country  VARCHAR2(200),
  flag     VARCHAR2(10)
);
