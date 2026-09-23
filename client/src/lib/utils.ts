import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Training duration as stored ("6.00") → "6 h" / "1,5 h" in the reader's locale. */
export function formatHours(value: string | number | null | undefined, lang: string) {
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(Number(value))} h`;
}

/** Amount in euros in the reader's locale ("264,00 €", "€264.00"). */
export function formatEuro(value: string | number | null | undefined, lang: string) {
  return new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

/** Translation key of a catalogue code: ("catalogue.type", "elearning") → "catalogue.typeElearning". */
export function catalogueKey(prefix: string, code: string | null | undefined) {
  return code ? prefix + code.charAt(0).toUpperCase() + code.slice(1) : "";
}
