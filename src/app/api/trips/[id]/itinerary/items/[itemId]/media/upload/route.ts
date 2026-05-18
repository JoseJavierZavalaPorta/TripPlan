// POST /api/trips/[id]/itinerary/items/[itemId]/media/upload
// Accepts a multipart/form-data with a `file` field (image) and optional `title`.
// Stores the image as a BLOB in Oracle and returns the updated media list.
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById, isParticipant } from '@/lib/repositories/tripRepo';
import { addUploadedMedia } from '@/lib/repositories/mediaRepo';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const hasAccess =
      trip.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));
    if (!hasAccess) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const form = await req.formData();
    const file = form.get('file');
    // Node.js 18 doesn't expose File as a global — Blob is always available and File extends Blob
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Se requiere un archivo' }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Solo se permiten imágenes (JPG, PNG, WEBP, GIF)' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'La imagen no puede superar 5 MB' },
        { status: 400 }
      );
    }

    const title = (form.get('title') as string | null)?.slice(0, 300) ?? null;
    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    const media = await addUploadedMedia({
      tripId: params.id,
      itemId: params.itemId,
      userId: session.user.id,
      title,
      mimeType: file.type,
      fileBuffer,
    });

    return NextResponse.json({ data: media }, { status: 201 });
  } catch (err) {
    console.error('[POST /media/upload]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
