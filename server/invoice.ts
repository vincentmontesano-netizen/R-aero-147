import PDFDocument from 'pdfkit';
import {invoiceLabels,invoiceLanguageSchema,type InvoiceLanguage} from '../shared/invoiceLanguage';
import {invoiceFontPath,invoiceText} from './invoiceText';
import {createHash,randomUUID} from 'node:crypto';
import {eq,and,sql} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {orders,orderItems,trainings,trainingVersions} from '../drizzle/schema';
import {storagePut} from './storage';
import {euroCents} from './paymentVerification';
import {invoiceBuyerSchema,invoiceIssuerSchema} from '../shared/invoiceIdentity';
import {z} from 'zod';
export type InvoiceSnapshot={language?:InvoiceLanguage;number:string;issuedAt:string;orderDate:string;buyer:z.infer<typeof invoiceBuyerSchema>;issuer:z.infer<typeof invoiceIssuerSchema>;items:Array<{title:string;quantity:number;unitHt:number;unitTtc:number}>;totalHt:number;totalTtc:number;vat:number;vatRate:string};
const money=(cents:number)=>(cents/100).toFixed(2)+' EUR';
export function renderInvoicePDF(data:InvoiceSnapshot):Promise<Buffer>{return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margin:50,bufferPages:true});const chunks:Buffer[]=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
 doc.registerFont('Invoice',invoiceFontPath);
 const labels=invoiceLabels[data.language??'fr'];
 const ltr=(text:string)=>data.language==='ar'?`\u2066${text}\u2069`:text;
 const width=495;let y=50;
 const paragraph=(text:string,size=9)=>{
   const block=invoiceText(doc,text,width,size);
   if(block.height<=675&&y+block.height>725){doc.addPage();y=50;}
   let offset=0;
   while(offset<block.lineCount){
     if(y+block.lineHeight>725){doc.addPage();y=50;}
     const count=Math.min(block.lineCount-offset,Math.floor((725-y)/block.lineHeight));
     doc.fillColor('#26394B');block.draw(50,y,undefined,offset,count);
     offset+=count;y+=count*block.lineHeight;
   }
   y+=8;
 };
 doc.fillColor('#002554');invoiceText(doc,labels.title,width,22).draw(50,y);y+=52;
 paragraph([data.number,`${labels.issued} ${ltr(data.issuedAt.slice(0,10))}`,`${labels.ordered} ${ltr(data.orderDate.slice(0,10))}`].join(data.language==='ar'?'\n':' | '));
 paragraph(data.issuer.name,13);paragraph(`${data.issuer.address}\n${data.issuer.country}\n${data.issuer.registration}\n${data.issuer.taxId}\n${data.issuer.email}`);paragraph(data.issuer.legalDetails);
 paragraph(labels.buyer,11);paragraph(`${data.buyer.name}\n${data.buyer.address}\n${data.buyer.country}${data.buyer.registration?'\n'+data.buyer.registration:''}${data.buyer.taxId?'\n'+data.buyer.taxId:''}`);
 const header=(continuation=false)=>{
   const cells=([[continuation?labels.continued:labels.item,58,225],[labels.quantity,295,30],[labels.unit,330,60],[labels.net,398,64],[labels.gross,470,68]] as const).map(([text,x,w])=>({block:invoiceText(doc,text,w,8),x}));
   const height=Math.max(25,...cells.map(cell=>cell.block.height+8));
   if(y+height+30>715){doc.addPage();y=50;}
   doc.rect(50,y,width,height).fill('#002554');doc.fillColor('white');
   cells.forEach(cell=>cell.block.draw(cell.x,y+3));y+=height+6;
 };header();

 for(const item of data.items){
   const cells=[invoiceText(doc,item.title,225,9),invoiceText(doc,String(item.quantity),30,9),invoiceText(doc,money(item.unitHt),65,9),invoiceText(doc,money(item.unitHt*item.quantity),67,9),invoiceText(doc,money(item.unitTtc*item.quantity),73,9)];
   const lineHeight=cells[0].lineHeight;
   const lineCount=Math.max(...cells.map(cell=>cell.lineCount));
   const height=Math.max(22,lineCount*lineHeight+12);
   if(height<=634&&y+height+(item===data.items[data.items.length-1]?170:0)>715){doc.addPage();y=50;header();}
   let offset=0;
   while(offset<lineCount){
     if(y+lineHeight+12>715){doc.addPage();y=50;header(offset>0);}
     const count=Math.min(lineCount-offset,Math.floor((715-y-12)/lineHeight));
     const fragmentHeight=count*lineHeight+12;
     doc.rect(50,y,width,fragmentHeight).fill('#F4F6F8');doc.fillColor('#26394B');
     cells.forEach((cell,index)=>cell.draw([58,295,325,395,465][index],y+5,index>1?'right':undefined,offset,count));
     offset+=count;y+=fragmentHeight+3;
   }

 }
 y+=14;paragraph(`${labels.net} : ${ltr(money(data.totalHt))}\n${labels.vat} (${ltr(data.vatRate+' %')}) : ${ltr(money(data.vat))}\n${labels.gross} : ${ltr(money(data.totalTtc))}`,11);paragraph(data.issuer.taxStatement);paragraph(data.issuer.paymentTerms);
 const range=doc.bufferedPageRange();for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.moveTo(50,760).lineTo(545,760).strokeColor('#C9A55A').stroke();doc.fillColor('#526170');invoiceText(doc,`${data.number} | ${i+1} / ${range.count}`,width,8).draw(50,770,'center');}
 doc.end();
});}
export async function generateInvoicePDF(orderId:number,_appOrigin:string,userId:number,buyerInput?:z.input<typeof invoiceBuyerSchema>,language:InvoiceLanguage='fr'):Promise<string|null>{const db=(await getDb())!;return db.transaction(async tx=>{
 const [order]=await tx.select().from(orders).where(and(eq(orders.id,orderId),eq(orders.userId,userId))).for('update');if(!order)return null;
 const [saved]=await tx.execute<{storageKey:string}>(sql`select "storageKey" from invoice_archives where "orderId"=${orderId}`);if(saved)return `/storage/${saved.storageKey}`;
 // Keep historical files available without silently replacing them under the same identity.
 if(order.invoiceUrl)return order.invoiceUrl;
 if(order.invoiceNumber)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Une référence de facture existe déjà ; son document doit être rapproché.'});
 if(order.status!=='paid')throw new TRPCError({code:'PRECONDITION_FAILED',message:'La commande doit être payée avant émission.'});
 let issuer:z.infer<typeof invoiceIssuerSchema>;try{issuer=invoiceIssuerSchema.parse(JSON.parse(process.env.INVOICE_ISSUER_JSON??''));}catch{throw new TRPCError({code:'PRECONDITION_FAILED',message:'L’identité juridique et les mentions de facturation de l’émetteur doivent être configurées.'});}
 const documentLanguage=invoiceLanguageSchema.parse(language);
 const buyer=invoiceBuyerSchema.safeParse(buyerInput);if(!buyer.success)throw new TRPCError({code:'BAD_REQUEST',message:'Renseignez les coordonnées de facturation avant émission.'});
 const rows=await tx.select().from(orderItems).where(eq(orderItems.orderId,orderId)).orderBy(orderItems.id);if(!rows.length||rows.length>500)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Lignes de commande invalides.'});
 const items:InvoiceSnapshot['items']=[];for(const row of rows){const [course]=row.trainingVersionId!=null?await tx.select({title:sql<string>`snapshot->'training'->>'title'`}).from(trainingVersions).where(eq(trainingVersions.id,row.trainingVersionId)):await tx.select({title:trainings.title}).from(trainings).where(eq(trainings.id,row.trainingId));if(!course?.title||course.title.length>1000||!Number.isInteger(row.quantity)||row.quantity!<1)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Ligne de commande incomplète.'});items.push({title:course.title,quantity:row.quantity!,unitHt:euroCents(row.unitPriceHt),unitTtc:euroCents(row.unitPriceTtc)});}
 const totalHt=euroCents(order.totalHt),totalTtc=euroCents(order.totalTtc),vat=euroCents(order.vatAmount??'0');if(items.reduce((s,i)=>s+i.unitHt*i.quantity,0)!==totalHt||items.reduce((s,i)=>s+i.unitTtc*i.quantity,0)!==totalTtc||totalHt+vat!==totalTtc)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Les totaux de commande doivent être rapprochés avant émission.'});
 const issuedAt=new Date(),year=issuedAt.getUTCFullYear();const [counter]=await tx.execute<{value:number}>(sql`insert into invoice_counters(year,value) values (${year},1) on conflict(year) do update set value=invoice_counters.value+1 returning value`);const number=`RA-${year}-${String(counter.value).padStart(6,'0')}`;
 const snapshot:InvoiceSnapshot={language:documentLanguage,number,issuedAt:issuedAt.toISOString(),orderDate:order.createdAt.toISOString(),buyer:buyer.data,issuer,items,totalHt,totalTtc,vat,vatRate:order.vatRate??'0'};
 const bytes=await renderInvoicePDF(snapshot),key=`invoices/${number}-${randomUUID()}.pdf`;const stored=await storagePut(key,bytes,'application/pdf');
 await tx.execute(sql`insert into invoice_archives ("orderId","userId",number,snapshot,"storageKey",sha256,"byteSize","issuedAt") values (${orderId},${userId},${number},${JSON.stringify(snapshot)}::jsonb,${stored.key},${createHash('sha256').update(bytes).digest('hex')},${bytes.length},${issuedAt.toISOString()})`);
 await tx.update(orders).set({invoiceUrl:stored.url,invoiceNumber:number}).where(eq(orders.id,orderId));return stored.url;
});}

export async function verifyInvoiceBytes(key:string,bytes:Buffer){const db=(await getDb())!;const [record]=await db.execute<{sha256:string;byteSize:number}>(sql`select sha256,"byteSize" from invoice_archives where "storageKey"=${key}`);return !record||(record.byteSize===bytes.length&&record.sha256===createHash('sha256').update(bytes).digest('hex'));}
