// TEMPORARY DEBUG ENDPOINT — remove after fixing production DB connection
import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import path from 'path';
import fs from 'fs';
import net from 'net';
import tls from 'tls';

export async function GET() {
  const info: Record<string, unknown> = {};

  // 1. Env var diagnostics (show lengths + first/last char to detect stray quotes)
  const walletPwd = process.env.ORACLE_WALLET_PASSWORD ?? '';
  const oraclePwd = process.env.ORACLE_PASSWORD ?? '';
  info.walletPasswordLen = walletPwd.length;
  info.walletPasswordFirst = walletPwd[0] ?? '';
  info.walletPasswordLast = walletPwd[walletPwd.length - 1] ?? '';
  info.oraclePasswordLen = oraclePwd.length;
  info.hasPemB64 = !!process.env.ORACLE_EWALLET_PEM_B64;
  info.hasP12B64 = !!process.env.ORACLE_EWALLET_P12_B64;
  info.oracledbVersion = oracledb.versionString;
  info.thinMode = oracledb.thin;
  info.nodeVersion = process.version;
  // Show the full connect string so we can verify it has no stray quotes
  info.connectString = process.env.ORACLE_CONNECT_STRING ?? 'NOT SET';

  // 2. Write wallet files
  const tmpDir = '/tmp/oracle-wallet-test';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    if (process.env.ORACLE_EWALLET_P12_B64) {
      fs.writeFileSync(path.join(tmpDir, 'ewallet.p12'), Buffer.from(process.env.ORACLE_EWALLET_P12_B64, 'base64'));
    }
    if (process.env.ORACLE_EWALLET_PEM_B64) {
      fs.writeFileSync(path.join(tmpDir, 'ewallet.pem'), Buffer.from(process.env.ORACLE_EWALLET_PEM_B64, 'base64'));
    }
    info.walletFiles = fs.readdirSync(tmpDir);
  } catch (e: unknown) {
    info.walletWriteError = String(e);
  }

  // 3. Raw TCP test
  const oracleHost = 'adb.sa-saopaulo-1.oraclecloud.com';
  const oraclePort = 1522;
  info.tcpTest = await new Promise((resolve) => {
    const socket = net.createConnection(oraclePort, oracleHost);
    const timer = setTimeout(() => { socket.destroy(); resolve('TIMEOUT 6s'); }, 6000);
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve('TCP OK'); });
    socket.on('error', (e) => { clearTimeout(timer); resolve(`TCP ERROR: ${e.message}`); });
  });

  // 4. TLS test (see what Oracle says during handshake)
  info.tlsTest = await new Promise((resolve) => {
    const pemContent = process.env.ORACLE_EWALLET_PEM_B64
      ? Buffer.from(process.env.ORACLE_EWALLET_PEM_B64, 'base64').toString()
      : undefined;
    let tlsResult = '';
    try {
      const socket = tls.connect({
        host: oracleHost,
        port: oraclePort,
        rejectUnauthorized: false, // accept any server cert for test
        pfx: process.env.ORACLE_EWALLET_P12_B64
          ? Buffer.from(process.env.ORACLE_EWALLET_P12_B64, 'base64')
          : undefined,
        passphrase: walletPwd || undefined,
      });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(`TLS TIMEOUT 7s (handshake did not complete). TLS partial: ${tlsResult}`);
      }, 7000);
      socket.on('secureConnect', () => {
        clearTimeout(timer);
        const cipher = socket.getCipher();
        socket.destroy();
        resolve(`TLS OK — cipher: ${cipher?.name}, protocol: ${socket.getProtocol()}`);
      });
      socket.on('error', (e) => {
        clearTimeout(timer);
        resolve(`TLS ERROR: ${e.message}`);
      });
      socket.on('data', (d) => { tlsResult += d.toString('hex').slice(0, 40); });
    } catch (e: unknown) {
      resolve(`TLS EXCEPTION: ${String(e)}`);
    }
  });

  // 5. Oracle connection test (30s timeout to catch any eventual error)
  try {
    const conn = await Promise.race([
      oracledb.getConnection({
        user:           process.env.ORACLE_USER!,
        password:       oraclePwd,
        connectString:  process.env.ORACLE_CONNECT_STRING!,
        walletPassword: walletPwd || undefined,
        walletLocation: tmpDir,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MANUAL_TIMEOUT after 25s')), 25000)
      ),
    ]);
    const result = await (conn as oracledb.Connection).execute('SELECT 1 FROM DUAL');
    await (conn as oracledb.Connection).close();
    info.connection = 'SUCCESS';
    info.queryResult = result.rows;
  } catch (e: unknown) {
    const err = e as Error & { errorNum?: number; cause?: unknown };
    info.connection = 'FAILED';
    info.error = err.message;
    info.errorNum = err.errorNum;
    info.errorCause = err.cause ? String(err.cause) : undefined;
  }

  return NextResponse.json(info, { status: 200 });
}
