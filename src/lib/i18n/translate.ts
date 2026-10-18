import { DEFAULT_LOCALE, type Locale } from "./config";
import { en, type MessageKey, type Messages, type PluralForms } from "./messages/en";
import { pl } from "./messages/pl";
import { de } from "./messages/de";

export type { MessageKey } from "./messages/en";

const MESSAGES: Record<Locale, Messages> = { en, pl, de };

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

function pickPlural(locale: Locale, forms: PluralForms, count: number): string {
  const rule = new Intl.PluralRules(locale).select(count);
  return forms[rule] ?? forms.other;
}

/** Message in the given language (English when missing), with `{name}` placeholders filled in. */
export function translate(locale: Locale, key: MessageKey, params: TranslateParams = {}): string {
  const message = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  const text = typeof message === "string" ? message : pickPlural(locale, message, Number(params.count ?? 0));
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function translator(locale: Locale): Translate {
  return (key, params) => translate(locale, key, params);
}

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
