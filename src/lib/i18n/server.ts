import { DEFAULT_LOCALE, LOCALE_HEADER, isLocale, type Locale } from "./config";
import { translator, type Translate } from "./translate";

/** UI language sent by the client (`x-locale`), English otherwise. */
export function requestLocale(req: Pick<Request, "headers">): Locale {
  const value = req.headers.get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function requestTranslator(req: Pick<Request, "headers">): Translate {
  return translator(requestLocale(req));
}
