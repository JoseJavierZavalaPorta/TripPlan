// src/lib/db.ts
import oracledb from 'oracledb';
import path from 'path';
import fs from 'fs';

// ── Wallet bootstrap ──────────────────────────────────────────────────────────
// Two modes:
//   Production (Railway): ORACLE_EWALLET_PEM_B64 — base64 of ewallet.pem only.
//                         Passed directly as walletContent — no unzip needed.
//   Local dev:            ORACLE_WALLET_DIR — path to extracted wallet folder.
//                         Falls back to <cwd>/wallet/extracted.

function getWalletConfig(): {
  walletLocation?: string;
  configDir?: string;
} {
  // Production (Railway): write ewallet.pem directly from env var — no zip/unzip
  if (process.env.ORACLE_EWALLET_PEM_B64) {
    const tmpDir = '/tmp/oracle-wallet';
    const pemPath = path.join(tmpDir, 'ewallet.pem');
    if (!fs.existsSync(pemPath)) {
      fs.mkdirSync(tmpDir, { recursive: true });
      const pemBuf = Buffer.from(process.env.ORACLE_EWALLET_PEM_B64, 'base64');
      fs.writeFileSync(pemPath, pemBuf);
    }
    return { walletLocation: tmpDir };
  }

  // Local dev: use extracted wallet folder
  const walletDir =
    process.env.ORACLE_WALLET_DIR ||
    path.join(process.cwd(), 'wallet', 'extracted');
  return { walletLocation: walletDir, configDir: walletDir };
}

let pool: oracledb.Pool | null = null;

export async function getPool(): Promise<oracledb.Pool> {
  if (pool) return pool;

  if (process.env.ORACLE_LIB_DIR) {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_LIB_DIR });
  }

  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;
  oracledb.fetchAsString = [oracledb.CLOB];

  const walletConfig = getWalletConfig();

  pool = await oracledb.createPool({
    user:          process.env.ORACLE_USER!,
    password:      process.env.ORACLE_PASSWORD!,
    connectString: process.env.ORACLE_CONNECT_STRING!,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    poolMin:       0,
    poolMax:       4,
    poolIncrement: 1,
    poolTimeout:   30,
    queueTimeout:  10000,
    ...walletConfig,
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
