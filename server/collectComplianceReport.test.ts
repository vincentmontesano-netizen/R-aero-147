import {it,expect,vi} from 'vitest';
import {collectComplianceReport} from '../shared/collectComplianceReport';
it('collects every page before returning export rows',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce({entries:[{id:9}],nextCursor:9}).mockResolvedValueOnce({entries:[{id:3}],nextCursor:3}).mockResolvedValueOnce({entries:[{id:1}],nextCursor:null});
 expect(await collectComplianceReport(fetch)).toEqual([{id:9},{id:3},{id:1}]);
 expect(fetch.mock.calls).toEqual([[undefined],[9],[3]]);
});
it('rejects incomplete exports and non-advancing cursors',async()=>{
 const failed=vi.fn().mockResolvedValueOnce({entries:[{id:9}],nextCursor:9}).mockRejectedValueOnce(new Error('Page unavailable'));
 await expect(collectComplianceReport(failed)).rejects.toThrow('Page unavailable');
 const repeated=vi.fn().mockResolvedValue({entries:[{id:9}],nextCursor:9});
 await expect(collectComplianceReport(repeated)).rejects.toThrow('cursor did not advance');expect(repeated).toHaveBeenCalledTimes(2);
});
it('reports complete pages and discards an in-flight page after cancellation',async()=>{
 const controller=new AbortController(),progress=vi.fn();
 let release!:(value:{entries:number[];nextCursor:null})=>void;
 const fetch=vi.fn().mockResolvedValueOnce({entries:[9,8],nextCursor:8}).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const result=collectComplianceReport(fetch,{signal:controller.signal,onProgress:progress});
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 controller.abort();
 const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});
 release({entries:[7],nextCursor:null});
 await rejected;
 expect(progress.mock.calls).toEqual([[2]]);
 expect(fetch).toHaveBeenCalledTimes(2);
 const untouched=vi.fn();
 await expect(collectComplianceReport(untouched,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
 expect(untouched).not.toHaveBeenCalled();
});
