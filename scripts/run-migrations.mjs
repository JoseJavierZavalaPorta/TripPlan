// scripts/run-migrations.mjs — run pending DB migrations
// Usage: node scripts/run-migrations.mjs
import oracledb from 'oracledb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Load .env.local manually
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

const walletDir = process.env.ORACLE_WALLET_DIR;

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

let conn;
try {
  console.log('Connecting to Oracle…');
  conn = await oracledb.getConnection({
    user:           process.env.ORACLE_USER,
    password:       process.env.ORACLE_PASSWORD,
    connectString:  process.env.ORACLE_CONNECT_STRING,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    walletLocation: walletDir,
    configDir:      walletDir,
  });
  console.log('Connected.\n');
} catch (err) {
  console.error('Connection failed:', err.message);
  process.exit(1);
}

const migrations = [
  {
    name: '003 — Add can_edit to trip_participants',
    check: `SELECT COUNT(*) AS CNT FROM user_tab_columns WHERE table_name='TRIP_PARTICIPANTS' AND column_name='CAN_EDIT'`,
    sql: `ALTER TABLE trip_participants ADD (
      can_edit  NUMBER(1) DEFAULT 0 NOT NULL
                CHECK (can_edit IN (0, 1))
    )`,
  },
  {
    name: '004 — Create trip_media_files (BLOB storage)',
    check: `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name='TRIP_MEDIA_FILES'`,
    sql: `CREATE TABLE trip_media_files (
      media_id  RAW(16) PRIMARY KEY REFERENCES trip_media(id) ON DELETE CASCADE,
      mime_type VARCHAR2(100) NOT NULL,
      file_data BLOB NOT NULL
    )`,
  },
  {
    name: '005 — Add locked/city/country/flag to itinerary_days',
    check: `SELECT COUNT(*) AS CNT FROM user_tab_columns WHERE table_name='ITINERARY_DAYS' AND column_name='LOCKED'`,
    sql: `ALTER TABLE itinerary_days ADD (
      locked   NUMBER(1) DEFAULT 0 NOT NULL CHECK (locked IN (0, 1)),
      city     VARCHAR2(200),
      country  VARCHAR2(200),
      flag     VARCHAR2(10)
    )`,
  },
  {
    name: '006 — Create trip_blacklist table',
    check: `SELECT COUNT(*) AS CNT FROM user_tables WHERE table_name='TRIP_BLACKLIST'`,
    sql: `CREATE TABLE trip_blacklist (
      id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      trip_id    RAW(16) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      title      VARCHAR2(300) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
  },
  {
    name: '006b — Index on trip_blacklist(trip_id)',
    check: `SELECT COUNT(*) AS CNT FROM user_indexes WHERE index_name='IDX_BLACKLIST_TRIP'`,
    sql: `CREATE INDEX idx_blacklist_trip ON trip_blacklist (trip_id)`,
  },
];

let allOk = true;
for (const mig of migrations) {
  process.stdout.write(`Running: ${mig.name}… `);
  try {
    const check = await conn.execute(mig.check);
    const cnt = check.rows[0].CNT;
    if (cnt > 0) {
      console.log('already applied, skipping.');
      continue;
    }
    await conn.execute(mig.sql);
    console.log('done.');
  } catch (err) {
    console.log('FAILED:', err.message);
    allOk = false;
  }
}

await conn.close();
console.log(allOk ? '\nAll migrations completed successfully.' : '\nSome migrations failed — see output above.');
process.exit(allOk ? 0 : 1);
