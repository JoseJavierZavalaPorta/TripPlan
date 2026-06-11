'use client';

import { useState, useEffect, useCallback } from 'react';
import { TripMediaAlbumEntry } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface AlbumTabProps {
  tripId: string;
}

interface UploaderGroup {
  userId: string;
  uploaderName: string;
  uploaderAvatar: string | null;
  photos: TripMediaAlbumEntry[];
}

function groupByUploader(entries: TripMediaAlbumEntry[]): UploaderGroup[] {
  const map = new Map<string, UploaderGroup>();
  for (const e of entries) {
    if (e.mediaType !== 'image') continue;
    if (!map.has(e.userId)) {
      map.set(e.userId, {
        userId: e.userId,
        uploaderName: e.uploaderName,
        uploaderAvatar: e.uploaderAvatar,
        photos: [],
      });
    }
    map.get(e.userId)!.photos.push(e);
  }
  return Array.from(map.values());
}

function AvatarInitials({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const letters = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const cls = size === 'sm'
    ? 'w-7 h-7 text-xs'
    : 'w-9 h-9 text-sm';
  return (
    <div className={`${cls} rounded-full bg-sky-400/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold flex-shrink-0`}>
      {letters || '?'}
    </div>
  );
}

interface LightboxProps {
  photos: TripMediaAlbumEntry[];
  index: number;
  onClose: () => void;
}

function Lightbox({ photos, index: initialIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);
  const photo = photos[idx];

  const prev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : photos.length - 1)), [photos.length]);
  const next = useCallback(() => setIdx((i) => (i < photos.length - 1 ? i + 1 : 0)), [photos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [prev, next, onClose]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer"
        onClick={onClose}
        aria-label="Cerrar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {photos.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Anterior"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Siguiente"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.title ?? 'Foto'}
          className="w-full max-h-[70vh] object-contain rounded-xl"
        />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            {photo.title && <p className="text-white font-semibold text-sm">{photo.title}</p>}
            <p className="text-slate-400 text-xs mt-0.5">
              {photo.uploaderName}
              {photo.dayNumber && ` · Día ${photo.dayNumber}`}
              {photo.itemTitle && ` — ${photo.itemTitle}`}
            </p>
          </div>
          <span className="text-slate-500 text-xs flex-shrink-0">
            {idx + 1} / {photos.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AlbumTab({ tripId }: AlbumTabProps) {
  const [entries, setEntries] = useState<TripMediaAlbumEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<{ photos: TripMediaAlbumEntry[]; index: number } | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/media`)
      .then((r) => r.json())
      .then((body: { data?: TripMediaAlbumEntry[]; error?: string }) => {
        if (body.error) throw new Error(body.error);
        setEntries(body.data ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
        {error}
      </div>
    );
  }

  const groups = groupByUploader(entries);

  if (groups.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-white font-semibold mb-2">Sin fotos aún</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Las fotos subidas a actividades del itinerario aparecerán aquí agrupadas por viajero.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.userId}>
          {/* Uploader header */}
          <div className="flex items-center gap-2.5 mb-3">
            <AvatarInitials name={group.uploaderName} size="md" />
            <div>
              <p className="text-white text-sm font-semibold">{group.uploaderName}</p>
              <p className="text-slate-500 text-xs">{group.photos.length} foto{group.photos.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {group.photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setLightbox({ photos: group.photos, index: idx })}
                className="aspect-square rounded-xl overflow-hidden bg-navy-800 cursor-pointer group relative"
                aria-label={photo.title ?? `Foto ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.title ?? ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {photo.dayNumber && (
                  <div className="absolute bottom-1 left-1 bg-black/60 rounded-md px-1.5 py-0.5">
                    <span className="text-white text-[10px] font-medium">Día {photo.dayNumber}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {lightbox && (
        <Lightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
