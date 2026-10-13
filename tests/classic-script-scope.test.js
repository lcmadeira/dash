import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

function createBrowserContext() {
  const sandbox = {
    document: { getElementById: () => null },
    Intl,
    Date,
    Object,
    parseInt,
  };
  sandbox.window = sandbox;
  return vm.createContext(sandbox);
}

test("market clock loads alongside a cached classic script declaring MARKETS", async () => {
  const context = createBrowserContext();
  vm.runInContext('const MARKETS = ["cached app"];', context);

  const source = await readFile("src/widgets/market-clock.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.tickMarkets, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_MARKETS = MARKETS;", context));
});

test("fuel card loads alongside a cached classic script declaring FUEL_SLUGS", async () => {
  const context = createBrowserContext();
  vm.runInContext('const FUEL_SLUGS = ["cached app"];', context);

  const source = await readFile("src/cards/fuel.js", "utf8");
  vm.runInContext(source, context);

  assert.equal(typeof context.renderFuel, "function");
  assert.equal(typeof context.getFuelPrefs, "function");
  assert.doesNotThrow(() => vm.runInContext("const APP_FUEL_SLUGS = FUEL_SLUGS;", context));
});
