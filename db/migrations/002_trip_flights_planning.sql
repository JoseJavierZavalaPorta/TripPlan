-- Migration 002: Trip flight info, trip notes, and planning conversations
-- Run once against your Oracle DB schema

-- 1. Add flight and planning context columns to trips
ALTER TABLE trips ADD (
  flight_status    VARCHAR2(20)   DEFAULT 'none',
  outbound_date    DATE,
  return_date      DATE,
  outbound_flight  VARCHAR2(200),
  return_flight    VARCHAR2(200),
  trip_notes       CLOB
);

-- 2. Store the planning agent conversation history per trip
CREATE TABLE planning_conversations (
  id          RAW(16)       DEFAULT SYS_GUID() NOT NULL,
  trip_id     RAW(16)       NOT NULL,
  role        VARCHAR2(10)  NOT NULL,   -- 'user' | 'agent'
  content     CLOB          NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT pk_planning_conversations PRIMARY KEY (id),
  CONSTRAINT fk_pc_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX idx_pc_trip_id ON planning_conversations (trip_id);
