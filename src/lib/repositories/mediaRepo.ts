import oracledb from 'oracledb';
import crypto from 'crypto';
import { query, execute, transaction } from '../db-helpers';
import { getConnection, rawToHex, hexToBuffer } from '../db';
import { DbTripMedia } from '@/types/db';
import { TripMedia, MediaType } from '@/types';

function mapMedia(row: DbTripMedia): TripMedia {
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    itemId: row.ITEM_ID ? rawToHex(row.ITEM_ID) : null,
    userId: rawToHex(row.USER_ID),
    mediaType: row.MEDIA_TYPE as MediaType,
    url: row.URL,
    title: row.TITLE,
    thumbnailUrl: row.THUMBNAIL_URL,
    createdAt: row.CREATED_AT.toISOString(),
  };
}

export async function getItemMedia(itemId: string): Promise<TripMedia[]> {
  const rows = await query<DbTripMedia>(
    `SELECT * FROM trip_media WHERE item_id = :itemId ORDER BY created_at ASC`,
    { itemId: hexToBuffer(itemId) }
  );
  return rows.map(mapMedia);
}

export async function addItemMedia(data: {
  tripId: string;
  itemId: string;
  userId: string;
  mediaType: MediaType;
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
}): Promise<string> {
  const result = await execute(
    `INSERT INTO trip_media (id, trip_id, item_id, user_id, media_type, url, title, thumbnail_url)
     VALUES (SYS_GUID(), :tripId, :itemId, :userId, :mediaType, :url, :title, :thumbnailUrl)
     RETURNING id INTO :newId`,
    {
      tripId: hexToBuffer(data.tripId),
      itemId: hexToBuffer(data.itemId),
      userId: hexToBuffer(data.userId),
      mediaType: data.mediaType,
      url: data.url,
      title: data.title ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
    }
  );
  const outBinds = result.outBinds as { newId: Buffer[] };
  return rawToHex(outBinds.newId[0]);
}

export async function addUploadedMedia(data: {
  tripId: string;
  itemId: string;
  userId: string;
  title: string | null;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<TripMedia[]> {
  // Generate the media ID in Node.js so we can build the URL before INSERT
  const mediaIdBuf = crypto.randomBytes(16);
  const mediaId    = rawToHex(mediaIdBuf);
  const finalUrl   = `/api/media/${mediaId}/file`;

  return transaction(async (conn) => {
    // 1. Insert the trip_media row with the pre-known ID and URL
    await conn.execute(
      `INSERT INTO trip_media (id, trip_id, item_id, user_id, media_type, url, title, thumbnail_url)
       VALUES (:id, :tripId, :itemId, :userId, 'image', :url, :title, :url)`,
      {
        id:      mediaIdBuf,
        tripId:  hexToBuffer(data.tripId),
        itemId:  hexToBuffer(data.itemId),
        userId:  hexToBuffer(data.userId),
        url:     finalUrl,
        title:   data.title,
      },
      { autoCommit: false }
    );

    // 2. Insert the BLOB — explicit DB_TYPE_BLOB binding for thin-mode compatibility
    await conn.execute(
      `INSERT INTO trip_media_files (media_id, mime_type, file_data)
       VALUES (:mediaId, :mimeType, :fileData)`,
      {
        mediaId:  mediaIdBuf,
        mimeType: data.mimeType,
        fileData: { val: data.fileBuffer, type: oracledb.DB_TYPE_BLOB },
      },
      { autoCommit: false }
    );

    // 3. Return updated list (inside transaction for consistency)
    const rows = await conn.execute<DbTripMedia>(
      `SELECT * FROM trip_media WHERE item_id = :itemId ORDER BY created_at ASC`,
      { itemId: hexToBuffer(data.itemId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (rows.rows ?? []).map(mapMedia);
  });
}

export async function getMediaFile(
  mediaId: string
): Promise<{ mimeType: string; data: Buffer } | null> {
  const conn = await getConnection();
  try {
    // In thin mode BLOBs come back as Lob stream objects — read via events
    const result = await conn.execute<{ MIME_TYPE: string; FILE_DATA: oracledb.Lob }>(
      `SELECT mime_type, file_data FROM trip_media_files WHERE media_id = :mediaId`,
      { mediaId: hexToBuffer(mediaId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const row = result.rows?.[0];
    if (!row) return null;

    const data = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      row.FILE_DATA.on('data', (c: Buffer) => chunks.push(c));
      row.FILE_DATA.on('end', () => resolve(Buffer.concat(chunks)));
      row.FILE_DATA.on('error', reject);
    });

    return { mimeType: row.MIME_TYPE, data };
  } finally {
    await conn.close();
  }
}

export async function deleteItemMedia(mediaId: string, userId: string): Promise<boolean> {
  const result = await execute(
    `DELETE FROM trip_media WHERE id = :mediaId AND user_id = :userId`,
    { mediaId: hexToBuffer(mediaId), userId: hexToBuffer(userId) }
  );
  return (result.rowsAffected ?? 0) > 0;
}
