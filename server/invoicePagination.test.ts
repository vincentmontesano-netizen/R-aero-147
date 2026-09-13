import {it,expect,vi} from 'vitest';
import PDFDocument from 'pdfkit';
import {renderInvoicePDF} from './invoice';

it('paginates a single tall address and item without losing lines or repeating amounts',async()=>{
  const output:Array<{text:string;y:number}>=[];
  const original=PDFDocument.prototype.text;
  const spy=vi.spyOn(PDFDocument.prototype,'text').mockImplementation(function(this:PDFKit.PDFDocument,text:string,...args:any[]){
    if(typeof args[1]==='number')output.push({text,y:args[1]});
    return (original as any).call(this,text,...args);
  });
  try{
    const identity={name:'Specimen',address:Array.from({length:70},(_,i)=>`ADR${i+1}`).join('\n'),country:'FR',registration:'',taxId:''};
    const bytes=await renderInvoicePDF({number:'TEST-PAGINATION',issuedAt:'2026-09-13',orderDate:'2026-09-12',buyer:identity,issuer:{...identity,address:'Adresse test',email:'test@example.invalid',legalDetails:'Spécimen sans valeur comptable',paymentTerms:'Aucun paiement attendu',taxStatement:'TVA de test'},items:[{title:Array.from({length:70},(_,i)=>`LIG${i+1}`).join('\n'),quantity:2,unitHt:10000,unitTtc:12000}],totalHt:20000,totalTtc:24000,vat:4000,vatRate:'20'});
    expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
    for(let i=1;i<=70;i++)for(const prefix of ['ADR','LIG'])expect(output.filter(line=>line.text===prefix+i)).toHaveLength(1);
    expect(output.filter(line=>line.text==='240.00 EUR')).toHaveLength(1);
    expect(output.some(line=>line.text==='Prestation (suite)')).toBe(true);
    const footers=output.filter(line=>line.text.startsWith('TEST-PAGINATION |')&&line.y===770);
    expect(footers.length).toBeGreaterThan(3);
    for(const line of output.filter(line=>line.y!==770)){expect(line.y).toBeGreaterThanOrEqual(50);expect(line.y).toBeLessThanOrEqual(711);}
  }finally{spy.mockRestore();}
});
