-- Migration 003: Add can_edit permission column to trip_participants
-- Run once against your Oracle DB schema

ALTER TABLE trip_participants ADD (
  can_edit  NUMBER(1) DEFAULT 0 NOT NULL
            CHECK (can_edit IN (0, 1))
);
