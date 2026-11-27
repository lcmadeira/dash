import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";

const row = (id, name, fuel, price, extra = {}) => ({
  station_id: id, name, brand: "MARCA", fuel_name: fuel, price_eur: price,
  address: `Rua ${id}`, locality: "Évora", municipality: "Évora", updated_at: "2026-11-27T07:30:07.134Z", ...extra,
});
const DIESEL = [row(1, "Alfa", "Gasóleo simples", 1.899), row(2, "Beta", "Gasóleo simples", 1.859), row(3, "Gama <b>", "Gasóleo simples", 1.959)];
const GAS = [row(1, "Alfa", "Gasolina simples 95", 1.81), row(2, "Beta", "Gasolina simples 95", 1.829), row(4, "Delta", "Gasolina simples 95", 1.79)];

async function loadFuel({ fetchJson, store = new Map() } = {}) {
  const body = { innerHTML: "" };
  const title = { textContent: "" };
  const context = vm.createContext({
    Intl, Date, Math, Promise, Map, JSON, String, Number,
    PFX: "dash_",
    console: { log() {}, warn() {} },
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: k => store.delete(k),
    },
    document: {
      getElementById: id => (id === "fuel-body" ? body : id === "fuelTitle" ? title : null),
      querySelectorAll: () => [],
    },
    $: id => (id === "fuel-body" ? body : null),
    skeletonTable: () => "…",
    er: e => `ERRO ${e.message}`,
    notifyNonCriticalError() {},
    renderFuelModal() {},
    lsGet: k => { const raw = store.get(`dash_${k}`); return raw ? JSON.parse(raw).d : null; },
    lsSet: (k, d) => store.set(`dash_${k}`, JSON.stringify({ d, ts: Date.now() })),
    fetchJsonFirstOk: fetchJson || (async () => { throw new Error("offline"); }),
    fetchWithCORS: async () => { throw new Error("offline"); },
  });
  context.window = context;
  vm.runInContext(`window.nf = (v, d) => Number(v).toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d });`, context);
  vm.runInContext(await readFile("src/cards/fuel.js", "utf8"), context);
  return { context, body, title, store };
}

test("merges per-fuel rows into one line per station", async () => {
  const { context } = await loadFuel();
  const list = context.mergeFuelEvoraStations({ diesel: DIESEL, gasoline_95: GAS });
  assert.equal(list.length, 4);
  const byName = Object.fromEntries(list.map(s => [s.name, s.prices]));
  assert.deepEqual({ ...byName.Alfa }, { diesel: 1.899, gasoline_95: 1.81 });
  assert.deepEqual({ ...byName.Delta }, { diesel: null, gasoline_95: 1.79 });
  // Linhas de outro combustível (resposta inesperada) são ignoradas.
  const other = context.mergeFuelEvoraStations({ diesel: [row(9, "X", "Gasolina simples 95", 1.7)], gasoline_95: [] });
  assert.equal(other.length, 0);
});

test("sorts ascending/descending by price with missing prices last", async () => {
  const { context } = await loadFuel();
  const list = context.mergeFuelEvoraStations({ diesel: DIESEL, gasoline_95: GAS });
  const names = (col, dir) => [...context.sortFuelEvoraStations(list, col, dir).map(s => s.name)];
  assert.deepEqual(names("diesel", "asc"), ["Beta", "Alfa", "Gama <b>", "Delta"]);
  assert.deepEqual(names("diesel", "desc"), ["Gama <b>", "Alfa", "Beta", "Delta"]);
  assert.deepEqual(names("gasoline_95", "asc"), ["Delta", "Alfa", "Beta", "Gama <b>"]);
  assert.deepEqual(names("gasoline_95", "desc"), ["Beta", "Alfa", "Delta", "Gama <b>"]);
});

test("summary gives cheapest station and difference to the national average", async () => {
  const { context } = await loadFuel();
  const list = context.mergeFuelEvoraStations({ diesel: DIESEL, gasoline_95: GAS });
  const s = context.summarizeFuelEvora(list, { diesel: { avg_price_eur: 2.104 }, gasoline_95: { avg_price_eur: 1.907 } });
  assert.equal(s.diesel.cheapest.price, 1.859);
  assert.equal(s.diesel.cheapest.stations[0].name, "Beta");
  assert.ok(Math.abs(s.diesel.cheapestDelta - (1.859 - 2.104)) < 1e-9);
  assert.ok(Math.abs(s.gasoline_95.avgDelta - ((1.81 + 1.829 + 1.79) / 3 - 1.907)) < 1e-9);
  const noNat = context.summarizeFuelEvora(list, {});
  assert.equal(noNat.diesel.cheapestDelta, null);
});

test("Évora view renders the table, escapes names and toggles sort direction", async () => {
  const requested = [];
  const fetchJson = async url => {
    requested.push(url);
    if (url.includes("/fuel/prices")) return { data: [{ fuel_slug: "diesel", avg_price_eur: 2.104 }, { fuel_slug: "gasoline_95", avg_price_eur: 1.907 }] };
    if (url.includes("fuel=diesel")) return { data: DIESEL };
    return { data: GAS };
  };
  const { context, body, title } = await loadFuel({ fetchJson });
  context.setFuelView("evora");
  await new Promise(r => setTimeout(r, 20));
  assert.equal(title.textContent, "Combustíveis · Évora");
  assert.ok(requested.some(u => u.includes("municipality=Evora") && u.includes("fuel=diesel")));
  assert.ok(requested.every(u => !/limit=(\d+)/.test(u) || Number(u.match(/limit=(\d+)/)[1]) <= 100), "a API recusa limit > 100");
  assert.match(body.innerHTML, /Gama &lt;b&gt;/);
  assert.doesNotMatch(body.innerHTML, /Gama <b>/);
  assert.match(body.innerHTML, /1,859/);
  assert.match(body.innerHTML, /-0,245/);
  assert.match(body.innerHTML, /aria-sort="ascending"/);
  const order = () => [...body.innerHTML.slice(body.innerHTML.indexOf("<tbody>")).matchAll(/<span>([^<]+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(order(), ["Beta", "Alfa", "Gama &lt;b&gt;", "Delta"]);

  context.setFuelEvoraSort("diesel");
  await new Promise(r => setTimeout(r, 20));
  assert.match(body.innerHTML, /aria-sort="descending"/);
  assert.deepEqual(order(), ["Gama &lt;b&gt;", "Alfa", "Beta", "Delta"]);
  const fetchesBefore = requested.length;
  context.setFuelEvoraSort("gasoline_95");
  await new Promise(r => setTimeout(r, 20));
  assert.equal(requested.length, fetchesBefore, "reordenar usa a cache");
  assert.deepEqual(order(), ["Delta", "Alfa", "Beta", "Gama &lt;b&gt;"]);
});

test("Évora view falls back to the last saved reading when the API fails", async () => {
  let online = true;
  const fetchJson = async url => {
    if (!online) throw new Error("offline");
    if (url.includes("/fuel/prices")) return { data: [] };
    return { data: url.includes("fuel=diesel") ? DIESEL : GAS };
  };
  const { context, body } = await loadFuel({ fetchJson });
  context.setFuelView("evora");
  await new Promise(r => setTimeout(r, 20));
  online = false;
  await context.renderFuel(true);
  assert.match(body.innerHTML, /última leitura guardada/);
  assert.match(body.innerHTML, /1,859/);
});

test("Évora view follows pagination when the municipality has more than one page", async () => {
  const requested = [];
  const fetchJson = async url => {
    requested.push(url);
    if (url.includes("/fuel/prices")) return { data: [] };
    if (url.includes("fuel=diesel")) {
      return url.includes("page=2")
        ? { meta: { page: 2, pages: 2 }, data: [DIESEL[2]] }
        : { meta: { page: 1, pages: 2 }, data: DIESEL.slice(0, 2) };
    }
    return { meta: { page: 1, pages: 1 }, data: GAS };
  };
  const { context, body } = await loadFuel({ fetchJson });
  context.setFuelView("evora");
  await new Promise(r => setTimeout(r, 20));
  assert.ok(requested.some(u => u.includes("fuel=diesel") && u.includes("page=2")));
  assert.match(body.innerHTML, /Gama &lt;b&gt;/);
});
