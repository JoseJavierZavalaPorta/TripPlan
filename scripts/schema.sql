-- TripPlan schema — same Oracle DB as Splitta (Oracle 26ai)
-- Run order matters due to FK dependencies
-- Users table already exists from Splitta — do NOT recreate it

-- ── TRIPS ─────────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id              RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  title           VARCHAR2(200) NOT NULL,
  description     CLOB,
  destination     VARCHAR2(300) NOT NULL,
  destination_lat NUMBER(10,6),
  destination_lng NUMBER(10,6),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR2(20) DEFAULT 'planning'
                  CHECK (status IN ('planning','confirmed','in_progress','completed','cancelled')),
  leader_id       RAW(16) NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── TRIP PARTICIPANTS ─────────────────────────────────────────────────────────
CREATE TABLE trip_participants (
  id          RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id     RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     RAW(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR2(20) DEFAULT 'member'
              CHECK (role IN ('leader','member')),
  status      VARCHAR2(20) DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined')),
  can_edit    NUMBER(1) DEFAULT 0 NOT NULL CHECK (can_edit IN (0,1)),
  joined_at   TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_trip_participant UNIQUE (trip_id, user_id)
);

-- ── TRAVELER PROFILES ─────────────────────────────────────────────────────────
-- Migration (run once on existing DB):
--   ALTER TABLE traveler_profiles ADD arrival_time VARCHAR2(5);
--   ALTER TABLE traveler_profiles ADD departure_time VARCHAR2(5);
CREATE TABLE traveler_profiles (
  id                  RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id             RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id             RAW(16) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Personal dates (may differ from trip dates)
  arrival_date        DATE,
  arrival_time        VARCHAR2(5),   -- 'HH:MM' — time of arrival at destination
  departure_date      DATE,
  departure_time      VARCHAR2(5),   -- 'HH:MM' — time of departure from country
  -- Food preferences
  diet_type           VARCHAR2(50)
                      CHECK (diet_type IN ('omnivore','vegetarian','vegan','pescatarian','halal','kosher','other')),
  food_allergies      VARCHAR2(500),
  cuisine_prefs       VARCHAR2(500),
  -- Accessibility
  mobility_needs      VARCHAR2(500),
  visual_needs        VARCHAR2(500),
  hearing_needs       VARCHAR2(500),
  other_accessibility VARCHAR2(500),
  -- Travel style
  travel_pace         VARCHAR2(20)
                      CHECK (travel_pace IN ('slow','moderate','fast')),
  interests           VARCHAR2(1000),  -- JSON array: ["museums","food","adventure"]
  budget_range        VARCHAR2(20)
                      CHECK (budget_range IN ('budget','mid','luxury')),
  -- Notes
  special_requests    CLOB,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_traveler_profile UNIQUE (trip_id, user_id)
);

-- ── ITINERARY DAYS ────────────────────────────────────────────────────────────
CREATE TABLE itinerary_days (
  id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id    RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date   DATE NOT NULL,
  day_number NUMBER(3) NOT NULL,
  locked     NUMBER(1) DEFAULT 0 NOT NULL CHECK (locked IN (0, 1)),
  city       VARCHAR2(200),
  country    VARCHAR2(200),
  flag       VARCHAR2(10),
  notes      CLOB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_itinerary_day UNIQUE (trip_id, day_date)
);

-- ── ITINERARY ITEMS ───────────────────────────────────────────────────────────
CREATE TABLE itinerary_items (
  id             RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  day_id         RAW(16) NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  trip_id        RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  position       NUMBER(5) NOT NULL,
  item_type      VARCHAR2(30)
                 CHECK (item_type IN ('activity','meal','transport','rest','accommodation','free_time')),
  title          VARCHAR2(300) NOT NULL,
  description    CLOB,
  location_name  VARCHAR2(300),
  location_lat   NUMBER(10,6),
  location_lng   NUMBER(10,6),
  address        VARCHAR2(500),
  start_time     VARCHAR2(5),   -- 'HH:MM'
  end_time       VARCHAR2(5),
  duration_min   NUMBER(5),
  estimated_cost NUMBER(10,2),
  currency       VARCHAR2(3) DEFAULT 'PEN',
  status         VARCHAR2(20) DEFAULT 'planned'
                 CHECK (status IN ('planned','confirmed','cancelled','completed')),
  ai_generated   NUMBER(1) DEFAULT 0 CHECK (ai_generated IN (0,1)),
  booking_url    VARCHAR2(500),
  notes          CLOB,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── TRANSPORT LEGS ────────────────────────────────────────────────────────────
CREATE TABLE transport_legs (
  id              RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id         RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_item_id    RAW(16) REFERENCES itinerary_items(id),
  to_item_id      RAW(16) REFERENCES itinerary_items(id),
  transport_mode  VARCHAR2(30)
                  CHECK (transport_mode IN ('walking','taxi','bus','metro','uber','bike','car','plane','boat','train')),
  duration_min    NUMBER(5),
  distance_km     NUMBER(8,2),
  estimated_cost  NUMBER(10,2),
  route_notes     VARCHAR2(500),
  route_color     VARCHAR2(7),   -- hex color for map polyline
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── VOTES ─────────────────────────────────────────────────────────────────────
CREATE TABLE item_votes (
  id               RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id          RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id          RAW(16) NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  action_type      VARCHAR2(20)
                   CHECK (action_type IN ('add','remove','replace')),
  proposed_by      RAW(16) NOT NULL REFERENCES users(id),
  status           VARCHAR2(20) DEFAULT 'open'
                   CHECK (status IN ('open','approved','rejected','cancelled')),
  replacement_data CLOB,   -- JSON of proposed replacement item
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at        TIMESTAMP WITH TIME ZONE
);

CREATE TABLE vote_responses (
  id        RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  vote_id   RAW(16) NOT NULL REFERENCES item_votes(id) ON DELETE CASCADE,
  user_id   RAW(16) NOT NULL REFERENCES users(id),
  response  VARCHAR2(10) CHECK (response IN ('yes','no','abstain')),
  voted_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_vote_response UNIQUE (vote_id, user_id)
);

-- ── TRIP BUDGET ───────────────────────────────────────────────────────────────
CREATE TABLE trip_budget (
  id          RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id     RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     RAW(16) REFERENCES users(id),   -- NULL = shared budget line
  category    VARCHAR2(50)
              CHECK (category IN ('accommodation','food','transport','activities','shopping','other')),
  description VARCHAR2(300) NOT NULL,
  estimated   NUMBER(10,2),
  actual      NUMBER(10,2),
  currency    VARCHAR2(3) DEFAULT 'PEN',
  is_shared   NUMBER(1) DEFAULT 0 CHECK (is_shared IN (0,1)),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── TRIP MEDIA ────────────────────────────────────────────────────────────────
CREATE TABLE trip_media (
  id            RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id       RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id       RAW(16) REFERENCES itinerary_items(id) ON DELETE CASCADE,
  user_id       RAW(16) NOT NULL REFERENCES users(id),
  media_type    VARCHAR2(20)
                CHECK (media_type IN ('image','youtube','tiktok','instagram','link')),
  url           VARCHAR2(1000) NOT NULL,
  title         VARCHAR2(300),
  thumbnail_url VARCHAR2(1000),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── TRIP INVITATIONS ──────────────────────────────────────────────────────────
CREATE TABLE trip_invitations (
  id          RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id     RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invited_by  RAW(16) NOT NULL REFERENCES users(id),
  email       VARCHAR2(255) NOT NULL,
  token       VARCHAR2(100) UNIQUE NOT NULL,
  status      VARCHAR2(20) DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── TRIP BLACKLIST (activities to skip during regeneration) ──────────────────
CREATE TABLE trip_blacklist (
  id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  trip_id    RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title      VARCHAR2(300) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_blacklist_trip ON trip_blacklist (trip_id);

-- ── TRIP MEDIA FILES (uploaded photo BLOBs) ───────────────────────────────────
CREATE TABLE trip_media_files (
  media_id  RAW(16) PRIMARY KEY REFERENCES trip_media(id) ON DELETE CASCADE,
  mime_type VARCHAR2(100) NOT NULL,
  file_data BLOB NOT NULL
);

-- ── INDEXES ────────────────────────────────────────────────────────────────────
-- Speed up most-common queries

CREATE INDEX idx_trips_leader ON trips(leader_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_user ON trip_participants(user_id);
CREATE INDEX idx_traveler_profiles_trip ON traveler_profiles(trip_id);
CREATE INDEX idx_itinerary_days_trip ON itinerary_days(trip_id);
CREATE INDEX idx_itinerary_items_day ON itinerary_items(day_id);
CREATE INDEX idx_itinerary_items_trip ON itinerary_items(trip_id);
CREATE INDEX idx_item_votes_trip ON item_votes(trip_id);
CREATE INDEX idx_vote_responses_vote ON vote_responses(vote_id);
CREATE INDEX idx_trip_invitations_token ON trip_invitations(token);
CREATE INDEX idx_trip_budget_trip ON trip_budget(trip_id);
