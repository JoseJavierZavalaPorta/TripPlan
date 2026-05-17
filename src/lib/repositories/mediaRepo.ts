import oracledb from 'oracledb';
import { query, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
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

export async function deleteItemMedia(mediaId: string, userId: string): Promise<boolean> {
  const result = await execute(
    `DELETE FROM trip_media WHERE id = :mediaId AND user_id = :userId`,
    { mediaId: hexToBuffer(mediaId), userId: hexToBuffer(userId) }
  );
  return (result.rowsAffected ?? 0) > 0;
}
