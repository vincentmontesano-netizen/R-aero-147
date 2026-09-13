import { z } from 'zod';

const fields = {
  firstName: z.string().min(1).max(128), lastName: z.string().min(1).max(128),
  email: z.string().email().max(320), jobTitle: z.string().max(128).optional(),
  licenseNumber: z.string().max(64).optional(), licenseCategories: z.string().max(128).optional(),
  typeRatings: z.string().max(255).optional(), department: z.string().max(128).optional(),
  base: z.string().max(128).optional(),
};
const employee = z.object(fields);
const aliases: Record<string, keyof typeof fields> = {
  prenom: 'firstName', prénom: 'firstName', firstname: 'firstName',
  nom: 'lastName', lastname: 'lastName', email: 'email',
  fonction: 'jobTitle', jobtitle: 'jobTitle', licence: 'licenseNumber', licensenumber: 'licenseNumber',
  categories: 'licenseCategories', licensecategories: 'licenseCategories',
  typeratings: 'typeRatings', type_ratings: 'typeRatings',
  departement: 'department', department: 'department', base: 'base',
};

/** Parse the entire document before any insertion, including quoted multiline fields. */
export function parseEmployeeCsv(source: string) {
  if (Buffer.byteLength(source, 'utf8') > 1024 * 1024) throw new Error('Fichier CSV limité à 1 Mio.');
  const text = source.replace(/^\ufeff/, '');
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], value = '', state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  let line = 1, startLine = 1;
  const fail = () => { throw new Error(`Ligne ${line} : guillemets CSV invalides.`); };
  const cell = () => { cells.push(value.trim()); value = ''; state = 'start'; };
  const record = () => {
    cell();
    if (cells.some(Boolean)) records.push({ line: startLine, cells });
    cells = [];
    if (records.length > 1001) throw new Error('Fichier CSV limité à 1 000 salariés.');
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === 'quoted') {
      if (char === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; } else state = 'closed';
      } else {
        value += char;
        if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line++;
      }
    } else if (char === ';') {
      cell();
    } else if (char === '\n' || char === '\r') {
      record();
      if (char === '\r' && text[i + 1] === '\n') i++;
      line++; startLine = line;
    } else if (char === '"') {
      if (state !== 'start') fail();
      state = 'quoted';
    } else {
      if (state === 'closed') fail();
      state = 'plain'; value += char;
    }
  }
  if (state === 'quoted') fail();
  record();
  if (records.length < 2) throw new Error('Fichier CSV vide ou sans salarié.');
  const header = records.shift()!.cells;
  const keys = header.map(name => Object.hasOwn(aliases, name.toLowerCase()) ? aliases[name.toLowerCase()] : undefined);
  if (keys.some(key => !key)) throw new Error('En-tête CSV inconnu : utilisez les colonnes du modèle.');
  if (new Set(keys).size !== keys.length) throw new Error('Colonnes CSV en double, y compris leurs alias.');
  if (!['firstName', 'lastName', 'email'].every(key => keys.includes(key as keyof typeof fields))) {
    throw new Error('Colonnes prénom, nom et email requises.');
  }
  return records.map(row => {
    if (row.cells.length !== keys.length) return { line: row.line, error: `Ligne ${row.line} : nombre de colonnes incorrect.` };
    const data = Object.fromEntries(keys.map((key, index) => [key!, row.cells[index] || undefined]));
    const parsed = employee.safeParse(data);
    if (!parsed.success) return { line: row.line, error: `Ligne ${row.line} : champs invalides (${Array.from(new Set(parsed.error.issues.map(issue => issue.path[0]))).join(', ')}).` };
    return { line: row.line, data: parsed.data };
  });
}
