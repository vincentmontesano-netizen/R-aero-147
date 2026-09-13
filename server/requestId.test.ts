import {afterEach,expect,it,vi} from 'vitest';
import {requestId} from '../client/src/lib/requestId';
afterEach(()=>vi.unstubAllGlobals());
it('uses native UUID generation when available',()=>{
  const randomUUID=vi.fn(()=> 'c189bb90-9023-4b75-a775-d4089928f8e7');
  vi.stubGlobal('crypto',{randomUUID});
  expect(requestId()).toBe('c189bb90-9023-4b75-a775-d4089928f8e7');
  expect(randomUUID).toHaveBeenCalledOnce();
});
it('generates a correctly formatted v4 UUID without randomUUID using secure random bytes',()=>{
  const getRandomValues=vi.fn((bytes:Uint8Array)=>bytes.fill(255));
  vi.stubGlobal('crypto',{getRandomValues});
  expect(requestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  expect(getRandomValues).toHaveBeenCalledOnce();
  expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
});
it('does not silently substitute an insecure generator if secure randomness is unavailable',()=>{
  vi.stubGlobal('crypto',{});
  expect(()=>requestId()).toThrow();
});
