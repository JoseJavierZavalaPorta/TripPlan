// scripts/migrate-add-times.js
// Run with: node scripts/migrate-add-times.js
// Adds arrival_time and departure_time columns to traveler_profiles

const path = require('path');
require('fs');

// Load env vars from .env.local
const dotenvPath = path.join(__dirname, '..', '.env.local');
require('fs').readFileSync(dotenvPath, 'utf-8')
  .split('\n')
  .forEach((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const eq = clean.indexOf('=');
    if (eq === -1) return;
    const key = clean.slice(0, eq).trim();
    let val = clean.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  });

const oracledb = require('oracledb');

async function migrate() {
  let conn;
  try {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    conn = await oracledb.getConnection({
      user:            process.env.ORACLE_USER,
      password:        process.env.ORACLE_PASSWORD,
      connectString:   process.env.ORACLE_CONNECT_STRING,
      walletLocation:  process.env.ORACLE_WALLET_DIR,
      walletPassword:  process.env.ORACLE_WALLET_PASSWORD,
      configDir:       process.env.ORACLE_WALLET_DIR,
    });

    // Check which columns already exist
    const existing = await conn.execute(
      `SELECT column_name FROM user_tab_columns
       WHERE table_name = 'TRAVELER_PROFILES'
         AND column_name IN ('ARRIVAL_TIME','DEPARTURE_TIME')`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const cols = (existing.rows ?? []).map(r => r.COLUMN_NAME);

    if (!cols.includes('ARRIVAL_TIME')) {
      await conn.execute(`ALTER TABLE traveler_profiles ADD arrival_time VARCHAR2(5)`);
      console.log('✓ Added arrival_time column');
    } else {
      console.log('· arrival_time already exists — skipped');
    }

    if (!cols.includes('DEPARTURE_TIME')) {
      await conn.execute(`ALTER TABLE traveler_profiles ADD departure_time VARCHAR2(5)`);
      console.log('✓ Added departure_time column');
    } else {
      console.log('· departure_time already exists — skipped');
    }

    await conn.commit();
    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.close();
  }
}

migrate();
