import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPublishedSite } from "../scripts/check-published-site.mjs";

test("published-site smoke check validates dashboard markers and critical assets", async () => {
  const paths = [];
  const html = [
    'id="dataOverview"', 'id="briefingBody"', 'id="main-grid"', 'data-dashboard-profile="portugal"', 'id="dataCountProvenance"',
    'src="src/cards/news.js?v=1"',
    'href="styles.css?v=1"', 'src="src/fetch.js?v=1"', 'src="src/cache.js?v=1"',
    'src="src/ui.js?v=1"', 'src="src/cards/briefing.js?v=1"', 'src="src/app.js?v=1"',
  ].join(" ");
  const fakeFetch = async url => {
    const parsed = new URL(url);
    paths.push(parsed.pathname);
    return new Response(parsed.pathname.endsWith("/") ? html : "asset contents", { status: 200 });
  };

  assert.equal(await checkPublishedSite("https://example.test/dash/", fakeFetch), 7);
  assert.equal(paths.length, 8);
  assert.ok(paths.includes("/dash/src/cards/briefing.js"));
  assert.ok(paths.includes("/dash/src/cards/news.js"));
});

test("published-site smoke check fails when a critical asset is missing", async () => {
  const html = 'id="dataOverview" id="briefingBody" id="main-grid" data-dashboard-profile="portugal" id="dataCountProvenance"';
  await assert.rejects(
    checkPublishedSite("https://example.test/dash/", async () => new Response(html, { status: 200 })),
    /Recurso obrigatório não referenciado: styles\.css/,
  );
});
