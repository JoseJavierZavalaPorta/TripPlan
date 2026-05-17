// src/lib/db-helpers.ts
import oracledb from 'oracledb';
import { getConnection } from './db';

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<T[]> {
  let conn: oracledb.Connection | null = null;
  try {
    conn = await getConnection();
    const result = await conn.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return (result.rows ?? []) as T[];
  } finally {
    if (conn) await conn.close();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<T | null> {
  const rows = await query<T>(sql, binds);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<oracledb.Result<unknown>> {
  let conn: oracledb.Connection | null = null;
  try {
    conn = await getConnection();
    const result = await conn.execute(sql, binds, {
      autoCommit: true,
    });
    return result;
  } finally {
    if (conn) await conn.close();
  }
}

export async function transaction<T>(
  fn: (conn: oracledb.Connection) => Promise<T>
): Promise<T> {
  let conn: oracledb.Connection | null = null;
  try {
    conn = await getConnection();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}
