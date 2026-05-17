// GET + POST /api/trips/[id]/itinerary/items/[itemId]/media
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { getItemMedia, addItemMedia } from '@/lib/repositories/mediaRepo';
import { MediaType } from '@/types';

function detectMediaType(url: string): MediaType {
  if (/youtube\.com\/watch|youtu\.be\//.test(url)) return 'youtube';
  if (/tiktok\.com\/@.+\/video\//.test(url)) return 'tiktok';
  if (/instagram\.com\/(p|reel)\//.test(url)) return 'instagram';
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i.test(url)) return 'image';
  return 'link';
}

function buildThumbnailUrl(url: string, mediaType: MediaType): string | null {
  if (mediaType === 'youtube') {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const id = m?.[1];
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  }
  if (mediaType === 'image') return url;
  return null;
}

const PostSchema = z.object({
  url:   z.string().url().max(1000),
  title: z.string().max(300).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const media = await getItemMedia(params.itemId);
    return NextResponse.json({ data: media });
  } catch (err) {
    console.error('[GET /api/.../media]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const body: unknown = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { url, title } = parsed.data;
    const mediaType = detectMediaType(url);
    const thumbnailUrl = buildThumbnailUrl(url, mediaType);

    await addItemMedia({
      tripId: params.id,
      itemId: params.itemId,
      userId: session.user.id,
      mediaType,
      url,
      title: title ?? null,
      thumbnailUrl,
    });

    const media = await getItemMedia(params.itemId);
    return NextResponse.json({ data: media }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/.../media]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
