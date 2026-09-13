import {it,expect,vi} from 'vitest';
import PDFDocument from 'pdfkit';
import {renderInvoicePDF} from './invoice';

it.each([
  ['fr','FACTURE','Prestation','FACTURÉ À'],
  ['en','INVOICE','Service','BILL TO'],
  ['ar','فاتورة','الخدمة','بيانات العميل'],
] as const)('renders %s labels and retains the original billing details',async(language,title,item,buyerLabel)=>{
  const written:string[]=[];
  const original=PDFDocument.prototype.text;
  const spy=vi.spyOn(PDFDocument.prototype,'text').mockImplementation(function(this:PDFKit.PDFDocument,text:string,...args:any[]){written.push(text);return (original as any).call(this,text,...args);});
  try{
    const identity={name:'Nom original',address:'Adresse originale',country:'FR',registration:'',taxId:''};
    const bytes=await renderInvoicePDF({language,number:'SPECIMEN',issuedAt:'2026-09-13',orderDate:'2026-09-12',buyer:identity,issuer:{...identity,email:'test@example.invalid',legalDetails:'Mentions originales',paymentTerms:'Conditions originales',taxStatement:'Mention fiscale originale'},items:[{title:'Formation originale',quantity:1,unitHt:1000,unitTtc:1200}],totalHt:1000,totalTtc:1200,vat:200,vatRate:'20'});
    expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
    for(const label of [title,item,buyerLabel,'Adresse originale','Formation originale','Conditions originales'])expect(written).toContain(label);
  }finally{spy.mockRestore();}
});
