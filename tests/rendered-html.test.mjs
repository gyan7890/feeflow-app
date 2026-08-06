import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const handler = typeof worker === "function" ? worker : worker.fetch.bind(worker);
  return handler(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
  );
}

test("server-renders the FeeFlow landing page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FeeFlow \| Tuition Fee Management SaaS<\/title>/i);
  assert.match(html, /Manage Tuition Fees Effortlessly/);
  assert.match(html, /app-icon-192\.png/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("keeps starter preview removed and FeeFlow source connected", async () => {
  const [page, layout, teacherApp, packageJson, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /FeeFlowLanding/);
  assert.match(layout, /FeeFlow \| Tuition Fee Management SaaS/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(layout, /PwaRegister/);
  assert.match(layout, /app-icon-192\.png/);
  assert.match(teacherApp, /feeflow_students/);
  assert.match(teacherApp, /feeflow_payments/);
  assert.match(teacherApp, /feeflow_reminders/);
  assert.match(teacherApp, /https:\/\/wa\.me\//);
  assert.match(teacherApp, /Quick Actions/);
  assert.match(teacherApp, /Recent Payments/);
  assert.match(teacherApp, /Database tables are missing/);
  assert.match(packageJson, /"@supabase\/supabase-js"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"orientation": "portrait"/);
  assert.match(manifest, /"maskable"/);
  assert.match(manifest, /app-icon-512\.png/);
  assert.match(manifest, /#5B5FEF/);
  assert.match(serviceWorker, /CACHE_NAME/);
  assert.match(serviceWorker, /app-icon-192\.png/);

  const previewFiles = await readdir(new URL("../app/_sites-preview", import.meta.url)).catch(() => []);
  assert.deepEqual(previewFiles, []);
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("renders app store support pages", async () => {
  for (const [path, text] of [
    ["/privacy", "FeeFlow Privacy"],
    ["/terms", "FeeFlow Terms"],
    ["/support", "support@feeflow.app"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(text));
  }
});
