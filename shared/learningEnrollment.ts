/** Resolve only a listed enrollment; never fall back from an explicit invalid selection. */
export function selectLearningEnrollment<T extends {id:number;training:{slug?:string | null} | null}>(entries:T[],slug:string,search:string):T | undefined {
  const values = new URLSearchParams(search).getAll('enrollment');
  if (values.length) {
    if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return undefined;
    const id = Number(values[0]);
    if (!Number.isSafeInteger(id) || id > 2147483647) return undefined;
    return entries.find(entry => entry.id === id && entry.training?.slug === slug);
  }
  const matching = entries.filter(entry => entry.training?.slug === slug);
  return matching.length === 1 ? matching[0] : undefined;
}
