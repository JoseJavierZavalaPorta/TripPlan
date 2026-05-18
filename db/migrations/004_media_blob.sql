-- Migration 004: Store uploaded photo files as BLOBs in Oracle
-- Run once against your Oracle DB schema

CREATE TABLE trip_media_files (
  media_id  RAW(16) PRIMARY KEY REFERENCES trip_media(id) ON DELETE CASCADE,
  mime_type VARCHAR2(100) NOT NULL,
  file_data BLOB NOT NULL
);
