import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const fixture = JSON.parse(readFileSync("tmp/mobile/fixture.json"));
const platform = process.argv.includes("ios") ? "ios" : "android";
const proof = JSON.parse(readFileSync(`tmp/mobile/contract-${platform}.json`));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:3189/login");
  await page.locator("#login-field-2").fill(fixture.accounts[platform].email);
  await page.locator("#login-password").fill(fixture.accounts[platform].password);
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/dashboard");
  await page.getByText("Recette mobile · Parcours complet", { exact: true }).waitFor();
  assert.match(await page.locator("body").innerText(), /100\s*%/);
  await page.screenshot({ path: `tmp/mobile/web-${platform}-completed-course.png` });
  await page.getByRole("button", { name: /Mes certificats/ }).click();
  await page.getByText(proof.completedCourseAndCertificate.certificateNumber, { exact: false }).waitFor();
  await page.screenshot({ path: `tmp/mobile/web-${platform}-certificate.png` });
  writeFileSync(`tmp/mobile/web-parity-${platform}.json`, JSON.stringify({ platform, at: new Date().toISOString(), sameLearner: true, completedCourseVisible: true, certificateNumber: proof.completedCourseAndCertificate.certificateNumber }, null, 2));
  console.log(`Web UI shows the course completed on ${platform} and the same certificate.`);
} finally { await browser.close(); }
