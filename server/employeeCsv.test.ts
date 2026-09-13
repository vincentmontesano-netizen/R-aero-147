import { expect, it } from 'vitest';
import { parseEmployeeCsv } from './employeeCsv';
import { spreadsheetCsv } from '../shared/csvExport';

it('reads spreadsheet quoting, BOM, escaped quotes and multiline values without shifting fields', () => {
  const csv = spreadsheetCsv([
    ['prenom', 'nom', 'email', 'fonction', 'base'],
    ['Zoé', 'Ben "Ali"', 'zoe@example.com', 'B1; B2\r\nSupport', 'CDG'],
    ['علي', 'Test', 'ali@example.com', '', 'ORY'],
  ]);
  const rows = parseEmployeeCsv(csv);
  expect(rows[0]).toMatchObject({line: 2, data: {firstName: 'Zoé', lastName: 'Ben "Ali"', jobTitle: 'B1; B2\r\nSupport', base: 'CDG'}});
  expect(rows[1]).toMatchObject({line: 4, data: {firstName: 'علي', base: 'ORY'}});
});
it('retains physical line numbers and rejects malformed rows without discarding valid ones', () => {
  const rows = parseEmployeeCsv('prenom;nom;email\n\nA;B;bad\nC;D;ok@example.com\nE;F;x@example.com;extra\n');
  expect(rows[0]).toMatchObject({line: 3, error: expect.stringContaining('email')});
  expect(rows[1].data?.email).toBe('ok@example.com');
  expect(rows[2]).toMatchObject({line: 5, error: expect.stringContaining('colonnes')});
  expect(parseEmployeeCsv(`prenom;nom;email\n${'a'.repeat(129)};B;ok@example.com`)[0].error).toContain('firstName');
});
it('refuses ambiguous headers and broken quoting before returning any rows', () => {
  for (const csv of [
    'prenom;firstname;nom;email\nA;A;B;a@example.com',
    'prenom;nom;unknown\nA;B;x', 'prenom;nom;__proto__\nA;B;x',
    'prenom;nom\nA;B', 'prenom;nom;email\nA;B;a@example.com\n"broken',
    'prenom;nom;email\nA";B;a@example.com', 'prenom;nom;email\n"A"x;B;a@example.com',
  ]) expect(() => parseEmployeeCsv(csv)).toThrow();
});
it('bounds document size and roster size, and accepts supported legacy aliases', () => {
  expect(() => parseEmployeeCsv('é'.repeat(524289))).toThrow('1 Mio');
  const header = 'firstname;lastname;email\r';
  expect(parseEmployeeCsv(header + ' A ; B ;a@example.com\r')).toMatchObject([{data: {firstName: 'A', lastName: 'B'}}]);
  expect(parseEmployeeCsv(header + 'A;B;a@example.com\r'.repeat(1000))).toHaveLength(1000);
  expect(() => parseEmployeeCsv(header + 'A;B;a@example.com\r'.repeat(1001))).toThrow('1 000');
});

it('provides an empty downloadable template whose unchanged headings accept a completed employee', async () => {
  const { employeeCsvTemplate } = await import('../shared/employeeCsvTemplate');
  expect(employeeCsvTemplate.split('\r\n')).toHaveLength(2);
  expect(() => parseEmployeeCsv(employeeCsvTemplate)).toThrow('sans salarié');
  const completed = employeeCsvTemplate + spreadsheetCsv([['Zoé', 'Test', 'zoe@example.com', 'B1; B2', '', '', '', '', 'CDG']]).replace(/^\ufeff/, '');
  expect(parseEmployeeCsv(completed)).toMatchObject([{data: {firstName: 'Zoé', jobTitle: 'B1; B2', base: 'CDG'}}]);
});
