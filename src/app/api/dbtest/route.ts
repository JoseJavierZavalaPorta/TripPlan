// TEMPORARY DEBUG ENDPOINT — remove after fixing production DB connection
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import path from 'path';
import fs from 'fs';
import net from 'net';

export async function GET() {
  const info: Record<string, unknown> = {};

  // 1. Check env vars (masked)
  info.user = process.env.ORACLE_USER ?? 'NOT SET';
  info.connectString = process.env.ORACLE_CONNECT_STRING?.slice(0, 80) ?? 'NOT SET';
  info.walletPassword = process.env.ORACLE_WALLET_PASSWORD ? '***set***' : 'NOT SET';
  info.hasPemB64 = !!process.env.ORACLE_EWALLET_PEM_B64;
  info.hasP12B64 = !!process.env.ORACLE_EWALLET_P12_B64;
  info.pemB64Length = process.env.ORACLE_EWALLET_PEM_B64?.length ?? 0;
  info.p12B64Length = process.env.ORACLE_EWALLET_P12_B64?.length ?? 0;
  info.oracledbVersion = oracledb.versionString;
  info.thinMode = oracledb.thin;

  // 2. Write wallet files and check they exist
  const tmpDir = '/tmp/oracle-wallet-test';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    if (process.env.ORACLE_EWALLET_P12_B64) {
      fs.writeFileSync(path.join(tmpDir, 'ewallet.p12'), Buffer.from(process.env.ORACLE_EWALLET_P12_B64, 'base64'));
    }
    if (process.env.ORACLE_EWALLET_PEM_B64) {
      fs.writeFileSync(path.join(tmpDir, 'ewallet.pem'), Buffer.from(process.env.ORACLE_EWALLET_PEM_B64, 'base64'));
    }
    const walletFiles = fs.readdirSync(tmpDir);
    info.walletFiles = walletFiles;
    for (const f of walletFiles) {
      info[`${f}_size`] = fs.statSync(path.join(tmpDir, f)).size;
    }
  } catch (e: unknown) {
    info.walletWriteError = String(e);
  }

  // 3. Try a standalone connection (not pooled) with 8s timeout
  try {
    const conn = await Promise.race([
      oracledb.getConnection({
        user:           process.env.ORACLE_USER!,
        password:       process.env.ORACLE_PASSWORD!,
        connectString:  process.env.ORACLE_CONNECT_STRING!,
        walletPassword: process.env.ORACLE_WALLET_PASSWORD,
        walletLocation: tmpDir,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MANUAL_TIMEOUT after 8s')), 8000)
      ),
    ]);
    const result = await (conn as oracledb.Connection).execute('SELECT 1 FROM DUAL');
    await (conn as oracledb.Connection).close();
    info.connection = 'SUCCESS';
    info.queryResult = result.rows;
  } catch (e: unknown) {
    const err = e as Error & { errorNum?: number; offset?: number; cause?: unknown };
    info.connection = 'FAILED';
    info.error = err.message;
    info.errorNum = err.errorNum;
    info.errorCause = err.cause ? String(err.cause) : undefined;
    info.errorStack = err.stack?.split('\n').slice(0, 5).join('\n');
  }

  // 4. Raw TCP connectivity test to Oracle host:port
  const oracleHost = 'adb.sa-saopaulo-1.oraclecloud.com';
  const oraclePort = 1522;
  info.tcpTest = await new Promise((resolve) => {
    const socket = net.createConnection(oraclePort, oracleHost);
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(`TIMEOUT after 6s (port ${oraclePort} on ${oracleHost} unreachable from Railway)`);
    }, 6000);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(`CONNECTED to ${oracleHost}:${oraclePort} — TCP OK`);
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      resolve(`TCP ERROR: ${err.message}`);
    });
  });

  return NextResponse.json(info, { status: 200 });
}
