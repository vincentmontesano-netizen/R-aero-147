import { spreadsheetCsv } from './csvExport';

// Stable import headings across interface languages. No example employee to import accidentally.
export const employeeCsvHeader = ['prenom', 'nom', 'email', 'fonction', 'licence', 'categories', 'typeratings', 'departement', 'base'] as const;
export const employeeCsvTemplate = spreadsheetCsv([employeeCsvHeader]) + '\r\n';
