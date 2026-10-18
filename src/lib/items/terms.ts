import type { MessageKey, Translate } from "@/lib/i18n/translate";

/**
 * Formats, release types and genres that come from catalogs, the vision model or the user in any
 * language. They are saved as codes and shown in the UI language (`term.<code>` messages), so the
 * whole screen stays in one language. Platforms ("PS5") and other free text are kept as written.
 * Aliases are compared lowercased and without diacritics; add every language's spelling here.
 */
const TERM_ALIASES: Record<string, string[]> = {
  // Media / formats
  cd: ["cd", "compact disc", "plyta cd"],
  vinyl: ["vinyl", "winyl", "plyta winylowa", "lp", "schallplatte", "vinyl lp"],
  cassette: ["cassette", "kaseta", "kaseta magnetofonowa", "kassette"],
  dvd: ["dvd"],
  bluray: ["blu-ray", "bluray", "blu ray"],
  digital: ["file", "digital", "plik", "cyfrowy", "datei", "digital download"],
  box_set: ["box set", "boxset"],
  // Release types (MusicBrainz)
  album: ["album"],
  single: ["single", "singiel"],
  ep: ["ep"],
  compilation: ["compilation", "kompilacja", "kompilation"],
  soundtrack: ["soundtrack", "sciezka dzwiekowa", "filmmusik"],
  live: ["live", "koncertowy", "na zywo"],
  broadcast: ["broadcast", "audycja", "sendung"],
  // Books / comics
  comic: ["comic", "komiks", "comics"],
  manga: ["manga"],
  hardcover: ["hardcover", "twarda oprawa", "gebunden", "gebundene ausgabe"],
  paperback: ["paperback", "miekka oprawa", "taschenbuch"],
  ebook: ["ebook", "e-book"],
  audiobook: ["audiobook", "audiobuk", "horbuch"],
  // Game genres (RAWG)
  action: ["action", "akcja"],
  adventure: ["adventure", "przygodowa", "abenteuer"],
  rpg: ["rpg", "role-playing games (rpg)", "role-playing", "rollenspiel"],
  strategy: ["strategy", "strategia", "strategie"],
  shooter: ["shooter", "strzelanka"],
  indie: ["indie"],
  casual: ["casual", "rekreacyjna"],
  simulation: ["simulation", "symulacja"],
  puzzle: ["puzzle", "logiczna", "logikspiel"],
  arcade: ["arcade", "zrecznosciowa"],
  platformer: ["platformer", "platformowa", "plattformer"],
  racing: ["racing", "wyscigi", "rennspiel"],
  sports: ["sports", "sportowa", "sport"],
  fighting: ["fighting", "bijatyka", "kampfspiel"],
  family: ["family", "rodzinna", "familie"],
  mmo: ["massively multiplayer", "mmo"],
  board_games: ["board games", "planszowa", "brettspiel"],
  educational: ["educational", "edukacyjna", "lernspiel"],
  card: ["card", "karciana", "kartenspiel"],
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ");
}

const BY_ALIAS = new Map<string, string>(
  Object.entries(TERM_ALIASES).flatMap(([code, aliases]) =>
    [code, ...aliases].map((alias): [string, string] => [normalize(alias), code])
  )
);

/** Code of a known format / release type / genre, or null. */
export function termCode(value: string): string | null {
  return BY_ALIAS.get(normalize(value)) ?? null;
}

/** What to save: the code of a known value, otherwise the trimmed text (null when empty). */
export function canonicalTerm(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return termCode(text) ?? text;
}

/** A saved value in the UI language: known values translated, anything else as written. */
export function displayTerm(value: string, t: Translate): string {
  const code = termCode(value);
  return code ? t(`term.${code}` as MessageKey) : value;
}

export const TERM_CODES = Object.keys(TERM_ALIASES);
