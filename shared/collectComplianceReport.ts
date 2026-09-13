/** Assemble a full export before creating its download; failures never yield a partial file. */
export async function collectComplianceReport<T>(fetchPage:(cursor?:number)=>Promise<{entries:T[];nextCursor:number|null}>, options:{signal?:AbortSignal;onProgress?:(count:number)=>void}={}):Promise<T[]>{
  const entries:T[]=[];
  let cursor:number|undefined;
  do{
    options.signal?.throwIfAborted();
    const page=await fetchPage(cursor);
    options.signal?.throwIfAborted();
    entries.push(...page.entries);
    options.onProgress?.(entries.length);
    options.signal?.throwIfAborted();
    if(page.nextCursor===null)return entries;
    if(cursor!=null&&page.nextCursor>=cursor)throw new Error('Report cursor did not advance');
    cursor=page.nextCursor;
  }while(true);
}
