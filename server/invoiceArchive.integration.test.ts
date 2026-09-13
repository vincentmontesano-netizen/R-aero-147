import {canReadPrivateFile} from "./storageAccess";
import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
vi.mock('./storage',()=>({storagePut:vi.fn(async(key:string,_bytes:Buffer)=>({key,url:`/storage/${key}`}))}));
import {storagePut} from './storage';
import {getDb} from './db';
import {generateInvoicePDF,verifyInvoiceBytes} from './invoice';
import {users,trainings,orders,orderItems} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
const buyer={name:'Synthetic Buyer',address:'12 Fixture Avenue',country:'FR',registration:'',taxId:''};
const issuer={...buyer,name:'Synthetic Issuer',legalDetails:'Synthetic legal details for testing only',paymentTerms:'Paid in full - synthetic fixture',taxStatement:'Synthetic tax statement',email:'fixture@example.invalid'};
describe.skipIf(!url)('immutable invoice issuance · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});beforeEach(()=>{vi.stubEnv('INVOICE_ISSUER_JSON',JSON.stringify(issuer));vi.mocked(storagePut).mockClear();});afterEach(()=>vi.unstubAllEnvs());
 async function fixture(){const db=(await getDb())!;const [user]=await db.insert(users).values({openId:randomUUID(),name:'Original buyer'}).returning();const [course]=await db.insert(trainings).values({title:'Original course title',slug:randomUUID()}).returning();const [order]=await db.insert(orders).values({userId:user.id,status:'paid',totalHt:'20.00',totalTtc:'24.00',vatAmount:'4.00',vatRate:'20.00'}).returning();await db.insert(orderItems).values({orderId:order.id,trainingId:course.id,quantity:2,unitPriceHt:'10.00',unitPriceTtc:'12.00'});return {db,user,course,order};}
 it('issues once under concurrent requests and preserves identities and amounts after later changes',async()=>{
  const f=await fixture();const [a,b]=await Promise.all([generateInvoicePDF(f.order.id,'https://ignored.invalid',f.user.id,buyer,'ar'),generateInvoicePDF(f.order.id,'https://ignored.invalid',f.user.id,buyer,'ar')]);expect(a).toBe(b);expect(storagePut).toHaveBeenCalledTimes(1);
  const [record]=await f.db.execute<{snapshot:any;storageKey:string;number:string}>(sql`select snapshot,"storageKey",number from invoice_archives where "orderId"=${f.order.id}`);expect(record.snapshot).toMatchObject({language:'ar',buyer,issuer,totalHt:2000,totalTtc:2400,vat:400,items:[{title:'Original course title',quantity:2,unitHt:1000,unitTtc:1200}]});
  await f.db.update(trainings).set({title:'Changed title',priceTtc:'999.00'}).where(eq(trainings.id,f.course.id));await f.db.update(users).set({name:'Changed identity'}).where(eq(users.id,f.user.id));vi.stubEnv('INVOICE_ISSUER_JSON','');expect(await generateInvoicePDF(f.order.id,'',f.user.id,{...buyer,name:'Other name'},'en')).toBe(a);expect(storagePut).toHaveBeenCalledTimes(1);
  await f.db.update(orders).set({invoiceUrl:null}).where(eq(orders.id,f.order.id));expect(await canReadPrivateFile(record.storageKey,f.user)).toBe(true);
  const bytes=vi.mocked(storagePut).mock.calls[0][1] as Buffer;expect(await verifyInvoiceBytes(record.storageKey,bytes)).toBe(true);expect(await verifyInvoiceBytes(record.storageKey,Buffer.from('tampered'))).toBe(false);
  await expect(f.db.execute(sql`update invoice_archives set number='changed' where "orderId"=${f.order.id}`)).rejects.toThrow();await expect(f.db.execute(sql`delete from invoice_archives where "orderId"=${f.order.id}`)).rejects.toThrow();
 });
 it('refuses missing issuer, foreign ownership, incomplete buyer and inconsistent totals without issuing',async()=>{
  const f=await fixture();vi.stubEnv('INVOICE_ISSUER_JSON','');await expect(generateInvoicePDF(f.order.id,'',f.user.id,buyer)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});vi.stubEnv('INVOICE_ISSUER_JSON',JSON.stringify(issuer));expect(await generateInvoicePDF(f.order.id,'',f.user.id+999999,buyer)).toBeNull();await expect(generateInvoicePDF(f.order.id,'',f.user.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.db.update(orders).set({totalTtc:'25.00'}).where(eq(orders.id,f.order.id));await expect(generateInvoicePDF(f.order.id,'',f.user.id,buyer)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(storagePut).not.toHaveBeenCalled();expect(await f.db.execute(sql`select id from invoice_archives where "orderId"=${f.order.id}`)).toHaveLength(0);
 });
});
