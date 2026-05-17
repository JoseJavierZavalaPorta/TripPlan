// POST /api/places/enrich
// Enriches a place name with data from Nominatim (OSM) + Wikipedia.
// Zero AI tokens consumed for known places. AI fallback only for description when both APIs miss.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { ociChat } from '@/lib/oci-ai';

const Schema = z.object({
  name:    z.string().min(1).max(300),
  city:    z.string().max(200).optional(),
  country: z.string().max(100).optional(),
});

export interface EnrichedPlace {
  title: string;
  description: string;
  locationName: string;
  locationLat: number | null;
  locationLng: number | null;
  address: string | null;
  itemType: 'activity' | 'meal' | 'transport' | 'rest' | 'accommodation' | 'free_time';
  durationMin: number;
  source: 'osm+wiki' | 'osm' | 'wiki' | 'ai' | 'none';
}

// ── OSM category → itemType ───────────────────────────────────────────────────

function inferItemType(
  osmCategory: string | null,
  osmType: string | null,
  name: string,
): EnrichedPlace['itemType'] {
  const cat  = osmCategory ?? '';
  const type = osmType ?? '';
  const n    = name.toLowerCase();

  if (cat === 'amenity' && ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court', 'biergarten', 'ice_cream'].includes(type)) return 'meal';
  if (cat === 'tourism' && ['hotel', 'hostel', 'motel', 'guest_house', 'apartment'].includes(type)) return 'accommodation';
  if (cat === 'amenity' && ['hotel', 'hostel'].includes(type)) return 'accommodation';
  if (cat === 'railway' || cat === 'highway' || (cat === 'amenity' && ['bus_station', 'ferry_terminal'].includes(type))) return 'transport';

  // Keyword fallbacks for the name
  if (/restauran|tapas|cervecería|taberna|bistro|bodega|comida|cena|almuerzo|desayuno/i.test(n)) return 'meal';
  if (/hotel|hostal|alojamiento|pensión/i.test(n)) return 'accommodation';
  if (/aeropuerto|estación|terminal|puerto|tren|metro/i.test(n)) return 'transport';

  return 'activity';
}

// Rough duration estimate by type and name
function estimateDuration(itemType: EnrichedPlace['itemType'], name: string): number {
  if (itemType === 'meal') return 75;
  if (itemType === 'accommodation') return 30;
  if (itemType === 'transport') return 60;
  const n = name.toLowerCase();
  if (/museo|museum|galería/i.test(n)) return 120;
  if (/parque|jardín|garden|park/i.test(n)) return 90;
  if (/mirador|viewpoint|puerta|arco|monumento|memorial|plaza/i.test(n)) return 45;
  if (/castillo|castle|palacio|palace|cathedral|catedral|basílica|iglesia/i.test(n)) return 90;
  return 60;
}

// ── Wikipedia (Spanish first, English fallback) ───────────────────────────────

interface WikiSummary {
  title: string;
  extract: string;
  lat?: number;
  lng?: number;
}

async function fetchWikiSummary(query: string): Promise<WikiSummary | null> {
  // First: search for the page title in Spanish Wikipedia
  for (const lang of ['es', 'en']) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=1&srnamespace=0&origin=*`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'TripPlan/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json() as { query?: { search?: Array<{ title: string }> } };
      const pageTitle = searchData.query?.search?.[0]?.title;
      if (!pageTitle) continue;

      // Fetch the page summary
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: { 'User-Agent': 'TripPlan/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (!summaryRes.ok) continue;
      const s = await summaryRes.json() as {
        title?: string;
        extract?: string;
        coordinates?: { lat: number; lon: number };
      };
      if (!s.extract) continue;

      // Truncate to 2 sentences max
      const sentences = s.extract.split(/(?<=[.!?])\s+/);
      const extract = sentences.slice(0, 2).join(' ');

      return {
        title: s.title ?? pageTitle,
        extract,
        lat: s.coordinates?.lat,
        lng: s.coordinates?.lon,
      };
    } catch { continue; }
  }
  return null;
}

// ── Nominatim (OpenStreetMap geocoding) ──────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  category: string;
  type: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    country?: string;
    postcode?: string;
  };
}

async function fetchNominatim(query: string): Promise<NominatimResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&accept-language=es&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TripPlan/1.0 (contact@tripplan.app)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as NominatimResult[];
    return data[0] ?? null;
  } catch { return null; }
}

function buildAddress(osm: NominatimResult): string {
  const a = osm.address;
  if (!a) return osm.display_name.split(',').slice(0, 2).join(',').trim();
  const parts = [a.road, a.suburb, a.city].filter(Boolean);
  return parts.join(', ');
}

// ── AI fallback — description only, minimal tokens ───────────────────────────

async function aiFallbackDescription(name: string, city: string | undefined): Promise<string> {
  const context = city ? ` en ${city}` : '';
  const prompt = `Describe "${name}"${context} en exactamente 2 oraciones cortas. Sé específico y factual. Sin markdown.`;
  try {
    const text = await ociChat(prompt, 200);
    return text.trim();
  } catch {
    return '';
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { name, city, country } = parsed.data;
    const searchQuery = [name, city, country].filter(Boolean).join(', ');

    // Run Nominatim and Wikipedia in parallel
    const [osm, wiki] = await Promise.all([
      fetchNominatim(searchQuery),
      fetchWikiSummary(searchQuery),
    ]);

    const itemType = inferItemType(osm?.category ?? null, osm?.type ?? null, name);
    const durationMin = estimateDuration(itemType, name);

    let description = wiki?.extract ?? '';
    let source: EnrichedPlace['source'] = 'none';

    if (osm && wiki) source = 'osm+wiki';
    else if (osm) source = 'osm';
    else if (wiki) source = 'wiki';

    // AI fallback only when no description found at all
    if (!description) {
      description = await aiFallbackDescription(name, city);
      if (description) source = 'ai';
    }

    const lat = wiki?.lat ?? (osm ? parseFloat(osm.lat) : null);
    const lng = wiki?.lng ?? (osm ? parseFloat(osm.lon) : null);

    const result: EnrichedPlace = {
      title: name,
      description,
      locationName: name,
      locationLat: lat,
      locationLng: lng,
      address: osm ? buildAddress(osm) : null,
      itemType,
      durationMin,
      source,
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[POST /api/places/enrich]', err);
    return NextResponse.json({ error: 'Error al buscar información del lugar' }, { status: 500 });
  }
}
