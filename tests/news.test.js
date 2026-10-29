import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

class TestDOMParser {
  parseFromString(xml) {
    return {
      querySelectorAll: selector => selector !== "item" ? [] : [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => ({
        querySelector(name) {
          const found = new RegExp("<" + name + ">([\\s\\S]*?)<\\/" + name + ">").exec(match[1]);
          return found ? { textContent: decodeXml(found[1]) } : null;
        },
        getElementsByTagName() { return []; },
      })),
    };
  }
}

test("news card escapes provider text and rejects unsafe article destinations", async () => {
  const body = { innerHTML: "" };
  const xml = `<rss><channel>
    <item><title>&lt;img src=x onerror=alert(1)&gt;</title><link>https://example.test/story?x=1&amp;y=2</link><source>Fonte &amp; Jornal</source><pubDate>Thu, 29 Oct 2026 10:00:00 GMT</pubDate></item>
    <item><title>Link perigoso</title><link>javascript:alert(1)</link></item>
    <item><title>Data no futuro</title><link>https://example.test/futuro</link><pubDate>Thu, 29 Oct 2100 10:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const context = vm.createContext({
    Date, String, Array, URL, DOMParser: TestDOMParser,
    $: () => body,
    fetchTextFirstOk: async () => xml,
    lsGet: () => null,
    lsSet: () => {},
    skeletonNews: () => "loading",
    notificationSettings: { news: { enabled: false } },
    er: message => "ERROR " + message,
    window: { dataApiUrl: () => null },
  });
  context.window = context;
  vm.runInContext(await readFile("src/cards/news.js", "utf8"), context);
  await context.loadNews("pt");
  assert.match(body.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(!body.innerHTML.includes("<img"));
  assert.match(body.innerHTML, /href="https:\/\/example\.test\/story\?x=1&amp;y=2"/);
  assert.match(body.innerHTML, /Fonte &amp; Jornal/);
  assert.ok(!body.innerHTML.includes("javascript:"));
});
