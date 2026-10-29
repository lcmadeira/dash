import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { checkPublishedSite } from "../scripts/check-published-site.mjs";

test("published-site smoke check validates dashboard markers and critical assets", async () => {
  const paths = [];
  const html = [
    'id="dataOverview"', 'id="briefingBody"', 'id="briefingHistory"', 'id="briefingChanges"', 'id="dataSourceHealth"', 'id="dataSourceHistory"', 'id="costOfLiving"', 'id="offlineBanner"', 'id="main-grid"', 'data-dashboard-profile="portugal"', 'id="dataCountProvenance"',
    'src="src/cards/news.js?v=1"',
    'href="styles.css?v=20261029-9"', 'href="./manifest.webmanifest"', 'src="sw.js"',
    'src="src/config.js?v=20261029-3"', 'src="src/offline.js?v=20261029-2"',
    'src="src/fetch.js?v=1"', 'src="src/cache.js?v=1"',
    'src="sw.js"',
    'src="src/ui.js?v=1"', 'src="src/cards/briefing.js?v=1"', 'src="src/app.js?v=1"',
  ].join(" ");
  const fakeFetch = async url => {
    const parsed = new URL(url);
    paths.push(parsed.pathname);
    const body = parsed.pathname.endsWith("/") ? html : parsed.pathname.endsWith("manifest.webmanifest")
      ? JSON.stringify({ icons: [{ src: "./pwa-icon.svg" }] }) : "asset contents";
    return new Response(body, { status: 200 });
  };

  assert.equal(await checkPublishedSite("https://example.test/dash/", fakeFetch), 12);
  assert.equal(paths.length, 13);
  assert.ok(paths.includes("/dash/src/cards/briefing.js"));
  assert.ok(paths.includes("/dash/src/cards/news.js"));
});

test("published-site smoke check fails when a critical asset is missing", async () => {
  const html = 'id="dataOverview" id="briefingBody" id="briefingHistory" id="briefingChanges" id="dataSourceHealth" id="dataSourceHistory" id="costOfLiving" id="offlineBanner" id="main-grid" data-dashboard-profile="portugal" id="dataCountProvenance"';
  await assert.rejects(
    checkPublishedSite("https://example.test/dash/", async () => new Response(html, { status: 200 })),
    /Recurso obrigatório não referenciado: styles\.css/,
  );
});

test("integrity hashes in HTML match the source-health and briefing scripts", async () => {
  const html = await readFile("index.html", "utf8");
  for (const path of ["src/ui.js", "src/cards/briefing.js"]) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`<script src="${escaped}\\?v=[^"]+" integrity="(sha384-[^"]+)"`).exec(html);
    assert.ok(match, `SRI ausente para ${path}`);
    const expected = `sha384-${createHash("sha384").update(await readFile(path)).digest("base64")}`;
    assert.equal(match[1], expected, `SRI incorreto para ${path}`);
  }
});
