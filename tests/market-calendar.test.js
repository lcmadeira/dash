import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

test("Lisbon market context uses local time, weekends, session bounds and Euronext holidays", async () => {
  const context = vm.createContext({ Date, Intl, Math, Set, window: {} });
  context.window = context;
  vm.runInContext(await readFile("src/market-calendar.js", "utf8"), context);

  assert.equal(context.getLisbonMarketContext(new Date("2026-11-02T10:00:00Z")).state, "open");
  assert.equal(context.getLisbonMarketContext(new Date("2026-11-02T07:59:00Z")).state, "outside-session");
  assert.equal(context.getLisbonMarketContext(new Date("2026-11-02T16:31:00Z")).state, "outside-session");
  assert.equal(context.getLisbonMarketContext(new Date("2026-10-31T10:00:00Z")).state, "closed");
  assert.equal(context.getLisbonMarketContext(new Date("2026-04-03T10:00:00Z")).state, "closed");
  assert.equal(context.getLisbonMarketContext(new Date("2026-12-25T10:00:00Z")).state, "closed");
  assert.equal(context.getLisbonMarketContext(new Date("2026-12-24T10:00:00Z")).state, "special-session");
});
