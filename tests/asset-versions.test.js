import assert from "node:assert/strict";
import { test } from "node:test";
import { assetVersions, staleAssetVersions } from "../scripts/check-asset-versions.mjs";

const html = v => `<link rel="stylesheet" href="styles.css?v=1"/>
<script src="src/cards/recession.js?v=${v}"></script>
<script src="https://cdn.example.org/lib.js?v=9"></script>
<script src="src/app.js?v=7"></script>`;

test("asset versions are read from local src/href attributes only", () => {
  const versions = assetVersions(html("a"));
  assert.equal(versions.get("src/cards/recession.js"), "a");
  assert.equal(versions.get("styles.css"), "1");
  assert.equal(versions.size, 3, "external URLs are ignored");
});

test("a changed file must get a new ?v= in index.html", () => {
  const changed = ["src/cards/recession.js", "src/app.js", "README.md", "worker/src/index.js"];
  assert.deepEqual(staleAssetVersions(changed, html("a"), html("a")), ["src/cards/recession.js", "src/app.js"]);
  assert.deepEqual(staleAssetVersions(["src/cards/recession.js"], html("a"), html("b")), []);
  assert.deepEqual(staleAssetVersions(["src/new.js"], html("a"), html("a")), [], "files not loaded by index.html are ignored");
});
