import { normalizeForMatch } from "./normalize";

const ALIASES: Record<string, string> = {
  playstation3: "ps3",
  playstation4: "ps4",
  playstation5: "ps5",
  xboxone: "xone",
  xboxseriessx: "xsx",
  xboxseriesx: "xsx",
  nintendoswitch: "switch",
  pcmicrosoftwindows: "pc",
  windows: "pc",
};

/** Canonical key for a console name, so "PS4", "PlayStation 4" and "ps4" compare equal. */
export function platformKey(value: string | null | undefined): string {
  const key = normalizeForMatch(value ?? "").replace(/ /g, "");
  return ALIASES[key] ?? key;
}

export function samePlatform(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = platformKey(a);
  return Boolean(x) && x === platformKey(b);
}
