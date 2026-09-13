import {z} from 'zod';
export const invoiceLanguageSchema=z.enum(['fr','en','ar']);
export type InvoiceLanguage=z.infer<typeof invoiceLanguageSchema>;
export const invoiceLabels={
  fr:{title:'FACTURE',issued:'Émise le',ordered:'Commande du',buyer:'FACTURÉ À',item:'Prestation',continued:'Prestation (suite)',quantity:'Qté',unit:'PU HT',net:'Total HT',gross:'Total TTC',vat:'TVA'},
  en:{title:'INVOICE',issued:'Issued on',ordered:'Order dated',buyer:'BILL TO',item:'Service',continued:'Service (continued)',quantity:'Qty',unit:'Unit excl. VAT',net:'Total excl. VAT',gross:'Total incl. VAT',vat:'VAT'},
  ar:{title:'فاتورة',issued:'تاريخ الإصدار',ordered:'تاريخ الطلب',buyer:'بيانات العميل',item:'الخدمة',continued:'الخدمة (تابع)',quantity:'الكمية',unit:'الوحدة دون ضريبة',net:'الإجمالي دون ضريبة',gross:'الإجمالي شامل الضريبة',vat:'ضريبة القيمة المضافة'},
} satisfies Record<InvoiceLanguage,Record<string,string>>;
