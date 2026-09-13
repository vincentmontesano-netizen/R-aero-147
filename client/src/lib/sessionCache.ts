import type { QueryClient } from '@tanstack/react-query';

/** Cancel old reads before dropping query data and cached mutation payloads. */
export async function clearSessionCache(client: QueryClient) {
  await client.cancelQueries();
  client.clear();
}
