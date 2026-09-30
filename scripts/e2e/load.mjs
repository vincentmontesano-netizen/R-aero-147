import fs from 'node:fs';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { origin, output } from './harness.mjs';

const state = JSON.parse(fs.readFileSync(`${output}/learner-state.json`, 'utf8'));
const headers = { cookie: state.cookies.map(c => `${c.name}=${c.value}`).join('; ') };
const catalogue = '/api/trpc/public.trainings?input=' + encodeURIComponent(JSON.stringify({ json: {} }));
const paths = [catalogue, '/api/trpc/public.categories', '/api/trpc/auth.me', '/api/trpc/dashboard.enrollments', '/catalogue'];
const identity = await (await fetch(origin + '/api/trpc/auth.me', { headers })).json();
assert.ok(identity.result?.data?.json?.id, 'Load fixture must have an authenticated learner');
const report = { startedAt: new Date().toISOString(), scope: 'Isolated synthetic read workload; not a commercial capacity guarantee', criteria: { p95Ms: 500, p99Ms: 1000, errors: 0 }, phases: [] };
for (const [name, concurrency, seconds] of [['nominal', 5, 10], ['peak', 25, 30], ['endurance', 5, 60]]) {
  const durations = [], errors = [];
  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
    let index = worker;
    while (performance.now() - start < seconds * 1000) {
      const route = paths[index++ % paths.length], before = performance.now();
      try {
        const response = await fetch(origin + route, { headers, signal: AbortSignal.timeout(10000) });
        const body = await response.text();
        assert.ok(response.ok, `HTTP ${response.status}`);
        if (route.startsWith('/api/')) assert.ok(JSON.parse(body).result?.data, 'Missing tRPC result');
      } catch (error) { errors.push({ route: route.split('?')[0], error: String(error) }); }
      durations.push(performance.now() - before);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }));
  durations.sort((a, b) => a - b);
  const percentile = q => durations[Math.min(durations.length - 1, Math.floor(durations.length * q))];
  const phase = { name, concurrency, seconds, requests: durations.length, p95Ms: percentile(.95), p99Ms: percentile(.99), errors };
  phase.passed = !errors.length && phase.p95Ms < report.criteria.p95Ms && phase.p99Ms < report.criteria.p99Ms;
  report.phases.push(phase);
  fs.writeFileSync(`${output}/load-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(phase));
}
report.finishedAt = new Date().toISOString();
report.passed = report.phases.every(phase => phase.passed);
fs.writeFileSync(`${output}/load-results.json`, JSON.stringify(report, null, 2));
assert.ok(report.passed, 'Local performance gate failed; see load-results.json');
