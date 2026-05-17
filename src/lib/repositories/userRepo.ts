// src/lib/repositories/userRepo.ts
import { query, queryOne, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbUser } from '@/types/db';
import { User } from '@/types';

function mapUser(row: DbUser): User {
  return {
    id: rawToHex(row.ID),
    email: row.EMAIL,
    name: row.NAME,
    avatarUrl: row.AVATAR_URL,
    createdAt: row.CREATED_AT.toISOString(),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const row = await queryOne<DbUser>(
    `SELECT id, email, name, avatar_url, created_at FROM users WHERE id = :id`,
    { id: hexToBuffer(id) }
  );
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await queryOne<DbUser>(
    `SELECT id, email, name, avatar_url, created_at FROM users WHERE email = :email`,
    { email }
  );
  return row ? mapUser(row) : null;
}

export async function getUserByEmailWithHash(
  email: string
): Promise<(User & { passwordHash: string | null }) | null> {
  const row = await queryOne<DbUser>(
    `SELECT id, email, name, avatar_url, password_hash, created_at FROM users WHERE email = :email`,
    { email }
  );
  if (!row) return null;
  return { ...mapUser(row), passwordHash: row.PASSWORD_HASH };
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash?: string;
  avatarUrl?: string;
}): Promise<string> {
  const oracledb = await import('oracledb');
  const result = await execute(
    `INSERT INTO users (id, email, name, password_hash, avatar_url)
     VALUES (SYS_GUID(), :email, :name, :passwordHash, :avatarUrl)
     RETURNING id INTO :newId`,
    {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash ?? null,
      avatarUrl: data.avatarUrl ?? null,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
    }
  );
  const outBinds = result.outBinds as { newId: Buffer[] };
  return rawToHex(outBinds.newId[0]);
}

export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  // Build bind params for IN clause
  const binds: Record<string, Buffer> = {};
  const placeholders = ids.map((id, i) => {
    binds[`id${i}`] = hexToBuffer(id);
    return `:id${i}`;
  });
  const rows = await query<DbUser>(
    `SELECT id, email, name, avatar_url, created_at FROM users WHERE id IN (${placeholders.join(',')})`,
    binds
  );
  return rows.map(mapUser);
}
