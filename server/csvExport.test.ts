import {describe,it,expect} from 'vitest';
import {spreadsheetCsv} from '../shared/csvExport';
describe('spreadsheet CSV export',()=>{
 it('keeps separators, quotes, newlines and multilingual names in their original cells',()=>{
  expect(spreadsheetCsv([['Nom','Formation'],['Élodie; Martin','Inspection "A"\nSuite'],['فاطمة',null],[42,false]])).toBe('\ufeff"Nom";"Formation"\r\n"Élodie; Martin";"Inspection ""A""\nSuite"\r\n"فاطمة";""\r\n"42";"false"');
 });
 it('marks formula prefixes, hidden prefixes and delimiter-breakout payloads as text',()=>{
  for(const value of ['=1+1','+1','-1','@SUM(A1)','\t=1','\r=1','\n=1','  =1','\ufeff=1','\u200b=1','＝1','＋1','－1','＠SUM(A1)'])expect(spreadsheetCsv([[value]])).toBe('\ufeff"\''+value+'"');
  expect(spreadsheetCsv([['=1";=2','ordinary;=2']])).toBe('\ufeff"\'=1"";=2";"ordinary;=2"');
 });
});
