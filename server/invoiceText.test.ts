import {describe,it,expect} from 'vitest';
import PDFDocument from 'pdfkit';
import {invoiceFontPath,invoiceText,invoiceVisualRuns} from './invoiceText';

describe('invoice multilingual text',()=>{
  it('preserves logical Arabic shaping runs, LTR references and mirrored punctuation',()=>{
    expect(invoiceVisualRuns('تاريخ الإصدار \u20662026-09-13\u2069')).toEqual({runs:['2026-09-13','تاريخ الإصدار '],rtl:true});
    expect(invoiceVisualRuns('محمد أحمد')).toEqual({runs:['محمد أحمد'],rtl:true});
    expect(invoiceVisualRuns('تدريب صيانة الطائرات Airbus A320 - المرحلة 2 (اختبار)')).toEqual({runs:[' )اختبار(','2',' - المرحلة ','Airbus A320','تدريب صيانة الطائرات '],rtl:true});
    expect(invoiceVisualRuns('Équipements : 120.00 EUR')).toEqual({runs:['Équipements : 120.00 EUR'],rtl:false});
  });

  it('wraps mixed scripts and an unbroken reference inside the available cell',()=>{
    const doc=new PDFDocument();doc.registerFont('Invoice',invoiceFontPath);
    const rendered:Array<{x:number;y:number;width:number}>=[];
    doc.text=((text:string,x:number,y:number)=>{rendered.push({x,y,width:doc.widthOfString(text,{features:[]})});return doc;}) as typeof doc.text;
    const block=invoiceText(doc,'فحص الهياكل وتوثيق إجراءات الصيانة Airbus A320\n'+ 'REF123'.repeat(25),120,9);
    block.draw(50,50);
    expect(block.height).toBeGreaterThan(9*1.6*2);
    expect(rendered.length).toBeGreaterThan(3);
    for(const line of rendered){expect(line.x).toBeGreaterThanOrEqual(49.99);expect(line.x+line.width).toBeLessThanOrEqual(170.01);expect(line.y).toBeLessThan(50+block.height);}
    doc.end();
  });
});
