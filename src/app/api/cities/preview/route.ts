// src/app/api/cities/preview/route.ts
import { NextResponse } from 'next/server';

interface WikiSummary {
  title: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
  content_urls?: { desktop?: { page?: string } };
}

interface WikiRelatedPage {
  title: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
}

interface WikiRelated {
  pages?: WikiRelatedPage[];
}

const HEADERS = { 'User-Agent': 'TripPlan/1.0 (travel planning app)' };

async function fetchWikiSummary(title: string): Promise<WikiSummary | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: HEADERS, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    return await res.json() as WikiSummary;
  } catch {
    return null;
  }
}

async function fetchWikiRelated(title: string): Promise<WikiRelatedPage[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(title)}`,
      { headers: HEADERS, next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as WikiRelated;
    return data.pages ?? [];
  } catch {
    return [];
  }
}

// Extract first N sentences (up to maxChars)
function trimExtract(text: string, maxChars = 280): string {
  if (!text) return '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  let result = '';
  for (const s of sentences) {
    if (result.length + s.length > maxChars) break;
    result += (result ? ' ' : '') + s;
  }
  return result || text.slice(0, maxChars);
}

// Heuristic filter: skip pages that are people, events, or too generic
const SKIP_KEYWORDS = [
  'footballer', 'singer', 'politician', 'actor', 'film', 'television',
  'series', 'album', 'song', 'river', 'province', 'region', 'airport',
  'railway', 'station', 'university', 'history of', 'economy of',
];

function isAttractionPage(page: WikiRelatedPage): boolean {
  const t = (page.title + ' ' + (page.extract ?? '')).toLowerCase();
  return (
    !!page.thumbnail?.source &&
    !SKIP_KEYWORDS.some((k) => t.includes(k))
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city    = searchParams.get('city')?.trim();
  const country = searchParams.get('country')?.trim();

  if (!city) {
    return NextResponse.json({ error: 'city required' }, { status: 400 });
  }

  // Try exact city name first, then "City, Country" if needed
  let summary = await fetchWikiSummary(city);
  if (!summary?.extract && country) {
    summary = await fetchWikiSummary(`${city}, ${country}`);
  }

  if (!summary) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Get related pages for extra images
  const related = await fetchWikiRelated(summary.title);
  const attractionPages = related.filter(isAttractionPage).slice(0, 8);

  const images: Array<{ url: string; caption: string }> = [];

  if (summary.thumbnail?.source) {
    images.push({ url: summary.thumbnail.source, caption: summary.title });
  }

  for (const page of attractionPages) {
    if (page.thumbnail?.source && images.length < 8) {
      images.push({ url: page.thumbnail.source, caption: page.title });
    }
  }

  return NextResponse.json({
    city: summary.title,
    description: trimExtract(summary.extract ?? ''),
    images,
    wikiUrl: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(city)}`,
  });
}
