import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  deltaFromTitle, mergeCabazEntries, parseCabazNews, publicationWednesday, valueFromTitle,
} from "../scripts/lib/cabaz-news.mjs";

const item = (title, pubDate, link = "https://news.example/a") =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>`;
const rss = items => `<rss><channel>${items.join("")}</channel></rss>`;

test("titles yield the basket value and the announced weekly change", () => {
  assert.equal(valueFromTitle("Cabaz alimentar desce 87 cêntimos para 255,86 euros – Deco Proteste - Agroportal"), 255.86);
  assert.equal(valueFromTitle("Cabaz alimentar volta a aumentar e ultrapassa os 256 euros - LUSA"), null);
  assert.equal(valueFromTitle("Cabaz de Natal custa 312,40 euros"), null);
  assert.equal(deltaFromTitle("Cabaz alimentar desce 87 cêntimos para 255,86 euros"), -0.87);
  assert.equal(deltaFromTitle("Cabaz alimentar da Deco sobe 1,34 euros numa semana e chega aos 255,56 euros"), 1.34);
  assert.equal(deltaFromTitle("Cabaz alimentar desce para 255,97 euros após três subidas"), null);
});

test("articles are grouped by the Wednesday of publication (Lisbon)", () => {
  assert.equal(publicationWednesday("Wed, 18 Nov 2026 10:00:00 GMT"), "2026-11-18");
  assert.equal(publicationWednesday("Thu, 19 Nov 2026 08:00:00 GMT"), "2026-11-18");
  assert.equal(publicationWednesday("Tue, 24 Nov 2026 23:30:00 GMT"), "2026-11-18");
});

test("news values need consensus or a change that matches the previous week", () => {
  const xml = rss([
    item("Cabaz alimentar desce 87 cêntimos para 255,86 euros – Deco Proteste - Agroportal", "Wed, 18 Nov 2026 11:00:00 GMT"),
    item("Cabaz alimentar desce 87 cêntimos para 255,86 euros - Dinheiro Vivo", "Wed, 18 Nov 2026 12:00:00 GMT"),
    item("Cabaz alimentar desce 44 cêntimos para 253,55 euros na última semana - ECO", "Wed, 28 Oct 2026 12:00:00 GMT"),
    item("Cabaz alimentar da Deco sobe 3,00 euros para 260,00 euros - X", "Wed, 21 Oct 2026 12:00:00 GMT"),
    item("Cabaz alimentar Deco sobe para 250,00 euros - A", "Wed, 04 Nov 2026 12:00:00 GMT"),
    item("Cabaz alimentar Deco desce para 251,00 euros - B", "Wed, 04 Nov 2026 13:00:00 GMT"),
  ]);
  const found = parseCabazNews(xml, [["2026-10-21", 253.99]]);
  const byDate = Object.fromEntries(found.map(f => [f.date, f]));
  assert.equal(byDate["2026-11-18"].value, 255.86);
  assert.match(byDate["2026-11-18"].how, /2 fontes/);
  assert.equal(byDate["2026-11-11"].value, 256.73);
  assert.equal(byDate["2026-11-11"].how, "derivado da variação");
  assert.equal(byDate["2026-10-28"].value, 253.55);
  assert.equal(byDate["2026-10-28"].how, "variação confirma semana anterior");
  assert.equal(byDate["2026-10-21"], undefined, "single source that contradicts the known week is ignored");
  assert.equal(byDate["2026-11-04"], undefined, "tied values are rejected");
});

test("merge keeps earlier weeks and rejects implausible jumps", () => {
  const merged = mergeCabazEntries([["2026-11-11", 256.73, "a", ""]], [
    { date: "2026-11-18", value: 255.86, title: "t", how: "2 fontes", link: "l" },
    { date: "2026-11-25", value: 290, title: "t", how: "2 fontes", link: "l" },
  ]);
  assert.deepEqual(merged.map(e => [e[0], e[1]]), [["2026-11-11", 256.73], ["2026-11-18", 255.86]]);
});

test("committed cabaz snapshot is valid for the dashboard card", async () => {
  const data = JSON.parse(await readFile(new URL("../data/cabaz.json", import.meta.url), "utf8"));
  assert.ok(data.entries.length > 0);
  let previous = null;
  for (const [date, value] of data.entries) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(value > 150 && value < 400);
    if (previous) assert.ok(date > previous);
    previous = date;
  }
});
