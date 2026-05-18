// GET /api/media/[mediaId]/file — serve a BLOB image stored in Oracle
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getMediaFile } from '@/lib/repositories/mediaRepo';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const file = await getMediaFile(params.mediaId);
  if (!file) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Length': String(file.data.byteLength),
    },
  });
}
