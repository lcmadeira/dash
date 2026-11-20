#!/usr/bin/env node
/*
 * Corre todas as atualizações de dados estáticos do painel (data/*.json), uma a uma.
 * Uma falha numa fonte não impede as outras; o código de saída só é 1 se todas falharem.
 * Chamado pelo cron do portátil (~/scripts/dash-update-dams.sh); para acrescentar uma
 * fonte nova basta juntá-la à lista abaixo, sem mexer no cron.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UPDATERS = ["update-dams.mjs", "update-cabaz.mjs", "update-imob.mjs"];
let failures = 0;
for (const name of UPDATERS) {
  const script = fileURLToPath(new URL(name, import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 240000 });
  const out = `${result.stdout || ""}${result.stderr || ""}`.trim().split("\n").filter(Boolean);
  if (result.status === 0) {
    console.log(`[${name}] ${out.at(-1) || "ok"}`);
  } else {
    failures++;
    console.log(`[${name}] AVISO: falhou · ${out.at(-1) || result.error?.message || `código ${result.status}`}`);
  }
}
process.exitCode = failures === UPDATERS.length ? 1 : 0;
