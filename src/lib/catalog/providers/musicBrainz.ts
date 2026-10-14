import { catalogFetch, readJson } from "../http";
import type { CatalogItem } from "../types";

interface MusicBrainzArtistCredit {
  name?: string;
  artist?: { name?: string };
}

interface MusicBrainzRelease {
  id?: string;
  title?: string;
  date?: string;
  barcode?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  "release-group"?: { id?: string; "primary-type"?: string };
}

interface MusicBrainzSearchResponse {
  releases?: MusicBrainzRelease[];
}

function artistName(release: MusicBrainzRelease): string | null {
  const credit = release["artist-credit"]?.[0];
  return credit?.name || credit?.artist?.name || null;
}

function yearFromDate(value?: string): string | undefined {
  return value?.match(/\d{4}/)?.[0];
}

async function coverExists(url: string): Promise<boolean> {
  try {
    const res = await catalogFetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Release artwork first, then the release group's (shared by all editions of the album). */
async function coverUrlForRelease(release: MusicBrainzRelease): Promise<string | null> {
  const candidates = [`https://coverartarchive.org/release/${release.id}/front-500`];
  const groupId = release["release-group"]?.id;
  if (groupId) candidates.push(`https://coverartarchive.org/release-group/${groupId}/front-500`);

  for (const url of candidates) {
    if (await coverExists(url)) return url;
  }
  return null;
}

async function fromRelease(release: MusicBrainzRelease): Promise<CatalogItem | null> {
  if (!release.title || !release.id) return null;
  const cover_url = await coverUrlForRelease(release);
  const primaryType = release["release-group"]?.["primary-type"];

  return {
    title: release.title,
    artist_creator: artistName(release),
    category: "music",
    subcategory: primaryType || null,
    cover_url,
    metadata: {
      year: yearFromDate(release.date),
      barcode: release.barcode,
      musicbrainz_id: release.id,
      source: "musicbrainz",
    },
    source: "musicbrainz",
  };
}

/** MusicBrainz allows ~1 request/s and answers 503 when exceeded. */
const RATE_LIMIT_RETRY_MS = 1100;

async function fetchReleases(url: string): Promise<Response> {
  const res = await catalogFetch(url);
  if (res.status !== 503) return res;
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
  return catalogFetch(url);
}

async function search(query: string): Promise<CatalogItem | null> {
  const params = new URLSearchParams({
    query,
    fmt: "json",
    limit: "5",
  });
  const json = await readJson<MusicBrainzSearchResponse>(
    await fetchReleases(`https://musicbrainz.org/ws/2/release/?${params.toString()}`)
  );
  const release = json?.releases?.[0];
  if (!release) return null;
  return fromRelease(release);
}

/** Strips Lucene syntax so user text cannot break the query. */
function luceneTerms(value: string): string {
  return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
}

export async function lookupMusicBrainzByBarcode(barcode: string): Promise<CatalogItem | null> {
  return search(`barcode:${barcode}`);
}

export async function searchMusicBrainz(
  query: string,
  known?: { title?: string; creator?: string | null }
): Promise<CatalogItem | null> {
  const title = luceneTerms(known?.title ?? "");
  if (title) {
    const creator = luceneTerms(known?.creator ?? "");
    if (creator) {
      const exact = await search(`release:"${title}" AND artist:"${creator}"`);
      if (exact) return exact;
    }
    return search(`release:"${title}"`);
  }

  const terms = luceneTerms(query);
  if (!terms) return null;
  return search(`release:(${terms}) OR artist:(${terms})`);
}
