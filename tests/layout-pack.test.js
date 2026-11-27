import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function loadPack() {
  const code = await readFile(new URL("../src/layout.js", import.meta.url), "utf8");
  const window = { requestAnimationFrame() {}, addEventListener() {} };
  const document = { readyState: "loading", addEventListener() {}, querySelectorAll: () => [], documentElement: { classList: { add() {} } } };
  vm.runInNewContext(code, { window, document });
  return window.packMosaic;
}

test("packMosaic puts each card at the highest free slot", async () => {
  const pack = await loadPack();
  const { placed } = pack([{ span: 2, height: 100 }, { span: 2, height: 300 }, { span: 2, height: 200 }, { span: 2, height: 50 }], 6, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(placed.map(p => [p.start, p.top]))), [[0, 0], [2, 0], [4, 0], [0, 110]]);
});

test("a wide card yields to smaller ones to avoid a hole, at most twice", async () => {
  const pack = await loadPack();
  // Colunas 0-1 baixas, 2-5 altas: o card de 6 colunas cede a vez ao card de 2.
  const { placed } = pack([{ span: 2, height: 100 }, { span: 4, height: 400 }, { span: 6, height: 50 }, { span: 2, height: 280 }], 6, 0);
  assert.equal(placed[3].start, 0);
  assert.equal(placed[3].top, 100);
  assert.equal(placed[2].top, 400);
});

test("the last card of each column stretches to the section bottom", async () => {
  const pack = await loadPack();
  const { placed, height } = pack([{ span: 3, height: 100 }, { span: 3, height: 300 }], 6, 0);
  assert.equal(height, 300);
  assert.equal(placed[0].fill, true);
  assert.equal(placed[0].rows * 2, 300);
  assert.equal(placed[1].fill, false);
});
