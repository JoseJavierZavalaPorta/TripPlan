// src/lib/db.ts
import oracledb from 'oracledb';
import path from 'path';
import fs from 'fs';

// Bootstrap Oracle Wallet from base64 env var (Railway deploy)
// Same pattern as Splitta — shared Oracle DB instance
function bootstrapWallet(): string {
  const walletDir = process.env.ORACLE_WALLET_DIR || path.join(process.cwd(), 'wallet');

  if (process.env.ORACLE_WALLET_BASE64) {
    const tmpDir = '/tmp/oracle-wallet';
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
      const zipBuffer = Buffer.from(process.env.ORACLE_WALLET_BASE64, 'base64');
      const zipPath = path.join('/tmp', 'wallet.zip');
      fs.writeFileSync(zipPath, zipBuffer);
      const { execSync } = require('child_process');
      execSync(`unzip -o ${zipPath} -d ${tmpDir}`);
    }
    return tmpDir;
  }

  return walletDir;
}

let pool: oracledb.Pool | null = null;

export async function getPool(): Promise<oracledb.Pool> {
  if (pool) return pool;

  const walletDir = bootstrapWallet();

  // Thick mode only when Oracle Client libs are available (Railway/prod)
  if (process.env.ORACLE_LIB_DIR) {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;
  oracledb.fetchAsString = [oracledb.CLOB]; // return CLOB columns as JS strings

  pool = await oracledb.createPool({
    user: process.env.ORACLE_USER!,
    password: process.env.ORACLE_PASSWORD!,
    connectString: process.env.ORACLE_CONNECT_STRING!,
    walletLocation: walletDir,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    configDir: walletDir,   // resolve TNS aliases from tnsnames.ora in thin mode
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
    poolTimeout: 30,
    queueTimeout: 10000,
  });

  return pool;
}

export async function getConnection(): Promise<oracledb.Connection> {
  const p = await getPool();
  return p.getConnection();
}

// Convert Oracle RAW(16) Buffer to uppercase hex string
export function rawToHex(buf: Buffer | null | undefined): string {
  if (!buf) return '';
  return buf.toString('hex').toUpperCase();
}

// Convert hex string back to Buffer for Oracle RAW bind parameters
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/-/g, ''), 'hex');
}
