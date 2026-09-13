/** Keep selected answers attached to their original options when blank draft rows are omitted. */
export function compactLivePollOptions(options: string[], correct: number[]) {
  const kept = options.map((text, index) => ({ text: text.trim(), index })).filter(row => row.text.length > 0);
  const mapped = correct.map(index => kept.findIndex(row => row.index === index));
  if (mapped.some(index => index < 0)) return null;
  return { options: kept.map(row => row.text), correct: mapped };
}
