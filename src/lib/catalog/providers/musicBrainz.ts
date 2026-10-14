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
  "release-group"?: { "primary-type"?: string };
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

async function coverUrlForRelease(mbid: string): Promise<string | null> {
  const url = `https://coverartarchive.org/release/${mbid}/front-500`;
  try {
    const res = await catalogFetch(url, { method: "HEAD" });
    if (res.ok) return url;
  } catch {
    return null;
  }
  return null;
}

async function fromRelease(release: MusicBrainzRelease): Promise<CatalogItem | null> {
  if (!release.title || !release.id) return null;
  const cover_url = await coverUrlForRelease(release.id);
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

async function search(query: string): Promise<CatalogItem | null> {
  const params = new URLSearchParams({
    query,
    fmt: "json",
    limit: "5",
  });
  const json = await readJson<MusicBrainzSearchResponse>(
    await catalogFetch(`https://musicbrainz.org/ws/2/release/?${params.toString()}`)
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
