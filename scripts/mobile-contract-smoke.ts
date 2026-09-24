import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";

const origin = "http://127.0.0.1:3189";
const fixture = JSON.parse(await readFile("tmp/mobile/fixture.json", "utf8"));
const results: Record<string, unknown> = {};
const native = (credential?: string) =>
  createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${origin}/api/trpc`,
        transformer: superjson,
        headers: () => ({
          "x-raero-client": "native",
          ...(credential ? { authorization: `Bearer ${credential}` } : {}),
        }),
      }),
    ],
  });
const platform = process.argv.includes("ios") ? "ios" : "android";
const account = fixture.accounts[platform];
const login = await native().auth.login.mutate({
  email: account.email,
  password: account.password,
});
assert.ok("nativeSession" in login && login.nativeSession?.token);
const token = login.nativeSession.token;
const client = native(token);
assert.equal((await client.auth.me.query())?.id, account.userId);
let cookie = "";
const browser = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${origin}/api/trpc`,
      transformer: superjson,
      headers: () => ({ cookie }),
      fetch: async (url, init) => {
        const response = await fetch(url, init as RequestInit);
        const received = response.headers
          .getSetCookie()
          .find(value => value.startsWith("app_session_id="));
        if (received) cookie = received.split(";")[0];
        return response;
      },
    }),
  ],
});
await browser.auth.login.mutate({
  email: account.email,
  password: account.password,
});
assert.ok(cookie);
assert.equal((await browser.auth.me.query())?.id, account.userId);
assert.deepEqual(
  await browser.dashboard.enrollments.query(),
  await client.dashboard.enrollments.query()
);
const wrongTransport = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${origin}/api/trpc`,
      transformer: superjson,
      headers: { cookie: `app_session_id=${token}` },
    }),
  ],
});
assert.equal(await wrongTransport.auth.me.query(), null);
results.sameAccountAndProgress = true;
results.nativeTokenRejectedAsCookie = true;

const other = await native().auth.login.mutate(fixture.accounts.other);
assert.ok("nativeSession" in other && other.nativeSession?.token);
const lesson = await client.learning.slides.query({
  trainingId: fixture.trainingId,
  enrollmentId: account.enrollmentId,
});
const media = [
  ...new Set(
    lesson
      .flatMap(slide => [slide.imageUrl, slide.videoUrl, slide.audioUrl])
      .filter((value): value is string => !!value)
  ),
];
for (const url of media) {
  const response = await fetch(origin + url, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.ok((await response.arrayBuffer()).byteLength > 0);
  assert.equal((await fetch(origin + url)).status, 404);
  assert.equal(
    (
      await fetch(origin + url, {
        headers: { authorization: `Bearer ${other.nativeSession.token}` },
      })
    ).status,
    404
  );
  if (url.endsWith(".mp4") || url.endsWith(".mp3")) {
    const range = await fetch(origin + url, {
      headers: { authorization: `Bearer ${token}`, range: "bytes=0-15" },
    });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 16);
  }
}
results.privateMedia = media.length;
results.unauthorizedMediaDenied = true;
const questions = await client.learning.quizQuestions.query({
  trainingId: fixture.trainingId,
  enrollmentId: account.enrollmentId,
});
for (const question of questions) {
  assert.equal("correctAnswer" in question, false);
  assert.equal("answerKey" in question, false);
}
results.examAnswersNotDisclosed = true;
if (process.argv.includes("--completed")) {
  const enrollment = await client.dashboard.enrollment.query({
    id: account.enrollmentId,
  });
  assert.equal(enrollment?.status, "completed");
  assert.equal(enrollment.progressPercent, 100);
  const chapters = await client.learning.moduleProgress.query({
    enrollmentId: account.enrollmentId,
  });
  assert.ok(
    chapters.some(
      chapter => chapter.moduleId === fixture.moduleId && chapter.isCompleted
    )
  );
  const attempts = await client.learning.quizAttempts.query({
    enrollmentId: account.enrollmentId,
  });
  assert.ok(attempts.some(attempt => attempt.isPassed));
  const certificates = await client.dashboard.certificates.query();
  const certificate = certificates.find(
    c => c.enrollmentId === account.enrollmentId
  );
  assert.ok(certificate?.pdfUrl);
  const pdf = await fetch(origin + certificate.pdfUrl, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-"
  );
  assert.equal(
    (
      await fetch(origin + certificate.pdfUrl, {
        headers: { authorization: `Bearer ${other.nativeSession.token}` },
      })
    ).status,
    404
  );
  results.completedCourseAndCertificate = {
    enrollmentId: account.enrollmentId,
    certificateNumber: certificate.certificateNumber,
    passingFinalAttempts: attempts.filter(a => a.isPassed).length,
  };
}
await writeFile(
  `tmp/mobile/contract-${platform}.json`,
  JSON.stringify(
    { platform, at: new Date().toISOString(), ...results },
    null,
    2
  )
);
console.log(JSON.stringify(results));
