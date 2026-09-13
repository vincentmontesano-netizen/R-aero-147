/** Match existing accent/case-insensitive grading without changing accepted scripts. */
export const normalizeFreeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const isUsableKeyword = (value: unknown): value is string => typeof value === 'string' && normalizeFreeText(value).length > 0;
