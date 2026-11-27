import assert from "node:assert/strict";
import { test } from "node:test";
import { UPDATERS, failureReason } from "../scripts/update-data.mjs";

test("data updater list includes every data/*.json producer", () => {
  assert.deepEqual(UPDATERS, ["update-dams.mjs", "update-cabaz.mjs", "update-imob.mjs", "update-exports.mjs", "update-aforro.mjs"]);
});

test("failure reason skips the Node version line and stack frames", () => {
  const out = [
    "node:internal/modules/run_main:107",
    "    triggerUncaughtException(",
    "    ^",
    "[TypeError: fetch failed] {",
    "  [cause]: Error: read ECONNRESET",
    "    errno: -104,",
    "    code: 'ECONNRESET',",
    "    syscall: 'read'",
    "  }",
    "}",
    "Node.js v24.19.0",
  ];
  assert.equal(failureReason(out), "code: 'ECONNRESET',");
  assert.equal(failureReason(["Error: HTTP 429 em www.ine.pt", "    at x (file.js:1:1)", "Node.js v24.19.0"]), "Error: HTTP 429 em www.ine.pt");
  assert.equal(failureReason(["Node.js v24.19.0"]), "");
});
