import { expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '../client/src/lib/sessionCache';

it('removes private reads and mutation payloads and prevents a late old read from restoring them', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(['passport'], [{ title: 'Private file' }]);
  client.getMutationCache().build(client, { mutationKey: ['upload'] }, { context: undefined, data: undefined, error: null, failureCount: 0, failureReason: null, isPaused: false, status: 'success', variables: { dataBase64: 'private-payload' }, submittedAt: 1 });
  let resolve!: (value: string) => void;
  const oldRead = client.fetchQuery({ queryKey: ['old-account'], queryFn: () => new Promise<string>(done => { resolve = done; }) }).catch(() => undefined);
  await clearSessionCache(client);
  client.setQueryData(['auth'], { id: 2 });
  resolve('old private response');
  await oldRead;
  expect(client.getQueryData(['passport'])).toBeUndefined();
  expect(client.getQueryData(['old-account'])).toBeUndefined();
  expect(client.getMutationCache().getAll()).toHaveLength(0);
  expect(client.getQueryData(['auth'])).toEqual({ id: 2 });
  client.clear();
});
