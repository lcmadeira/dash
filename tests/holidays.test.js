import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import "./nf-context.js";

// Feriados nacionais 2026/2027 (subconjunto suficiente para o fim do ano)
const H2026 = [
  ["2026-01-01", "Ano Novo"], ["2026-04-03", "Sexta-feira Santa"], ["2026-04-05", "Páscoa"], ["2026-04-25", "Dia da Liberdade"],
  ["2026-05-01", "Dia do Trabalhador"], ["2026-06-04", "Corpo de Deus"], ["2026-06-10", "Dia de Portugal"], ["2026-08-15", "Assunção de Nossa Senhora"],
  ["2026-10-05", "Implantação da República"], ["2026-11-01", "Dia de Todos-os-Santos"], ["2026-12-01", "Restauração da Independência"],
  ["2026-12-08", "Imaculada Conceição"], ["2026-12-25", "Natal"],
].map(([date, localName]) => ({ date, localName }));
const H2027 = [["2027-01-01", "Ano Novo"], ["2027-03-26", "Sexta-feira Santa"]].map(([date, localName]) => ({ date, localName }));

async function load() {
  const context = vm.createContext({ Date, Math, JSON, String, Number, Object, Array, Set, console });
  context.window = context;
  vm.runInContext(await readFile("src/cards/holidays.js", "utf8"), context);
  return context;
}
const plain = v => JSON.parse(JSON.stringify(v));

test("workdays, next holiday and bridges at the end of November 2026 (Évora)", async () => {
  const { computeHolidaySummary } = await load();
  const s = plain(computeHolidaySummary({ holsByYear: { 2026: H2026, 2027: H2027 }, today: new Date(2026, 10, 27), city: "Évora" }));
  assert.equal(s.monthName, "novembro");
  assert.equal(s.monthTotal, 21);
  assert.equal(s.monthLeft, 2);           // sex 27 e seg 30
  assert.equal(s.weekLeft, 1);            // só sexta
  assert.equal(s.nextWeek, 4);            // 1 de dezembro é feriado
  assert.equal(s.yearLeft, 2 + 23 - 3);   // dezembro: 23 dias de semana, 3 feriados
  assert.equal(s.upcoming[0].localName, "Restauração da Independência");
  assert.equal(s.upcoming[0].days, 4);
  assert.deepEqual(s.bridges.slice(0, 2).map(b => [b.bridgeDate, b.holidayDate]), [["2026-11-30", "2026-12-01"], ["2026-12-07", "2026-12-08"]]);
  assert.equal(s.months[0].label, "nov");
  assert.equal(s.months[1].label, "dez");
  assert.equal(s.months[2].label, "jan 27", "os próximos meses passam para o ano seguinte");
  assert.equal(s.months[1].hols, 3);
  assert.ok(s.yearList.some(h => h.type === "municipal" && h.date === "2026-06-29"));
  assert.ok(s.yearList.every(h => h.type !== "municipal" || h.city === "Évora"), "só o municipal da cidade escolhida");
});

test("municipal holiday of the chosen city counts as a holiday and appears as next", async () => {
  const { computeHolidaySummary } = await load();
  const s = plain(computeHolidaySummary({ holsByYear: { 2026: H2026 }, today: new Date(2026, 5, 25), city: "Évora" }));
  assert.equal(s.upcoming[0].localName, "São Pedro");
  assert.equal(s.upcoming[0].type, "municipal");
  assert.equal(s.weekLeft, 2); // qui 25 e sex 26 (o dia 29 é na semana seguinte)
  const lisboa = plain(computeHolidaySummary({ holsByYear: { 2026: H2026 }, today: new Date(2026, 5, 25), city: "Lisboa" }));
  assert.notEqual(lisboa.upcoming[0].localName, "São Pedro");
  const semMunic = plain(computeHolidaySummary({ holsByYear: { 2026: H2026 }, today: new Date(2026, 5, 25), city: "Beja" }));
  assert.equal(semMunic.hasMunicipal, false);
});

test("dates use local time, not UTC (summer time does not shift holidays)", async () => {
  const { computeHolidaySummary } = await load();
  // 10 de junho (quarta): com toISOString em UTC+1 a meia-noite local caía no dia 9.
  const s = plain(computeHolidaySummary({ holsByYear: { 2026: H2026 }, today: new Date(2026, 5, 8), city: "Lisboa" }));
  assert.equal(s.weekLeft, 4); // seg 8, ter 9, qui 11, sex 12 (qua 10 é feriado)
});

test("regional holidays only for Madeira/Azores cities; optional Carnaval never counts", async () => {
  const { computeHolidaySummary } = await load();
  const extra = [
    { date: "2026-02-17", localName: "Carnaval", global: true, types: ["Optional"] },
    { date: "2026-07-01", localName: "Dia da Madeira", global: false, counties: ["PT-30"], types: ["Public"] },
  ];
  const hols = { 2026: [...H2026.map(h => ({ ...h, global: true, types: ["Public"] })), ...extra] };
  const evora = plain(computeHolidaySummary({ holsByYear: hols, today: new Date(2026, 0, 2), city: "Évora" }));
  assert.ok(!evora.yearList.some(h => h.localName === "Carnaval" || h.localName === "Dia da Madeira"));
  const funchal = plain(computeHolidaySummary({ holsByYear: hols, today: new Date(2026, 0, 2), city: "Funchal" }));
  assert.equal(funchal.yearList.find(h => h.localName === "Dia da Madeira")?.type, "regional");
  assert.ok(!funchal.yearList.some(h => h.localName === "Carnaval"));
});
