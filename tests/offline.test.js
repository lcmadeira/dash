import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

function createWorkerContext() {
  const handlers = {};
  const entries = new Map();
  const cache = {
    async add(url) { entries.set(String(url), new Response(String(url).endsWith("pwa-icon.svg") ? "cached icon" : "cached shell")); },
    async match(request) { return entries.get(typeof request === "string" ? request : request.url) || null; },
    async put(request, response) { entries.set(typeof request === "string" ? request : request.url, response); },
  };
  const context = vm.createContext({
    URL, Response, Promise,
    caches: { async open() { return cache; }, async keys() { return ["dash-shell-v0", "other-cache"]; }, async delete(key) { return key === "dash-shell-v0"; }, async match(request) { return cache.match(request); } },
    fetch: async () => {
      const response = new Response("network shell");
      Object.defineProperty(response, "type", { value: "basic" });
      return response;
    },
  });
  context.self = { location: { href: "https://example.test/dash/sw.js" }, clients: { claim: async () => {} }, addEventListener(type, listener) { handlers[type] = listener; } };
  vm.runInContext("", context);
  return { context, handlers, entries, cache };
}

test("offline worker precaches the app, excludes proxies, and falls back to the shell", async () => {
  const { context, handlers, entries, cache } = createWorkerContext();
  vm.runInContext(await readFile("sw.js", "utf8"), context);
  let installPromise;
  handlers.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  assert.equal((await cache.match("https://example.test/dash/")).status, 200);

  let responded = false;
  handlers.fetch({ request: { method: "GET", url: "https://example.test/dash/proxy?url=https://upstream.test", mode: "cors" }, respondWith() { responded = true; } });
  assert.equal(responded, false);
  handlers.fetch({ request: { method: "GET", url: "https://external.test/data", mode: "cors" }, respondWith() { responded = true; } });
  assert.equal(responded, false);
  handlers.fetch({ request: { method: "GET", url: "https://example.test/dash/api/data.json", mode: "cors" }, respondWith() { responded = true; } });
  assert.equal(responded, false);

  context.fetch = async () => { throw new Error("offline"); };
  let navigation;
  handlers.fetch({ request: { method: "GET", url: "https://example.test/dash/", mode: "navigate" }, respondWith(promise) { navigation = promise; } });
  assert.equal(await (await navigation).text(), "cached shell");
  assert.equal(entries.size, 2);
});

test("offline worker caches only successful same-origin assets", async () => {
  const { context, handlers, entries, cache } = createWorkerContext();
  vm.runInContext(await readFile("sw.js", "utf8"), context);
  let asset;
  handlers.fetch({ request: { method: "GET", url: "https://example.test/dash/styles.css?v=1", mode: "no-cors" }, respondWith(promise) { asset = promise; } });
  assert.equal(await (await asset).text(), "network shell");
  assert.equal((await cache.match("https://example.test/dash/styles.css?v=1")).status, 200);
  assert.equal(entries.size, 1);
});
