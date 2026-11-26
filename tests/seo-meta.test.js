import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

// Os motores de pesquisa mostram 150-160 caracteres; o Bing assinala fora de 25-160.
test("index.html meta description has 25-160 characters", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<meta name="description" content="([^"]*)"/);
  assert.ok(match, "missing meta description");
  const length = [...match[1]].length;
  assert.ok(length >= 25 && length <= 160, `meta description has ${length} characters`);
});

test("og:image points to a file in the repository", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<meta property="og:image" content="https:\/\/lcmadeira\.github\.io\/dash\/([^"?]+)/);
  assert.ok(match, "missing og:image");
  await readFile(new URL(`../${match[1]}`, import.meta.url));
});
