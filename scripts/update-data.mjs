#!/usr/bin/env node
/*
 * Corre todas as atualizações de dados estáticos do painel (data/*.json), uma a uma.
 * Uma falha numa fonte não impede as outras; o código de saída só é 1 se todas falharem.
 * Chamado pelo cron do portátil (~/scripts/dash-update-dams.sh); para acrescentar uma
 * fonte nova basta juntá-la à lista abaixo, sem mexer no cron.
 * As fontes (SNIRH, INE) têm cortes intermitentes: o que falhar é tentado outra vez
 * passados DASH_UPDATE_RETRY_MIN minutos (10 por omissão; 0 desliga), na mesma execução.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const UPDATERS = ["update-dams.mjs", "update-cabaz.mjs", "update-imob.mjs", "update-exports.mjs", "update-aforro.mjs", "update-wages.mjs"];

/** Linha mais útil do erro de um processo Node (a última é "Node.js vXX", que não diz nada). */
export function failureReason(lines) {
  const useful = lines.map(l => l.trim()).filter(l => l && !/^Node\.js v\d/.test(l) && !/^at /.test(l) && !/^[\^{}[\]]+$/.test(l)
    && !/^node:internal/.test(l) && !/triggerUncaughtException/.test(l));
  const preferred = [...useful].reverse().find(l => /\b(E[A-Z]{3,}|Error|HTTP \d{3}|sem resposta|code:)/.test(l));
  return (preferred || useful.at(-1) || "").slice(0, 200);
}

function run(name) {
  const script = fileURLToPath(new URL(name, import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 900000 });
  const out = `${result.stdout || ""}${result.stderr || ""}`.trim().split("\n").filter(Boolean);
  if (result.status === 0) {
    console.log(`[${name}] ${out.at(-1) || "ok"}`);
    return true;
  }
  console.log(`[${name}] AVISO: falhou · ${failureReason(out) || result.error?.message || `código ${result.status}`}`);
  return false;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let failed = UPDATERS.filter(name => !run(name));
  const retryMin = Number(process.env.DASH_UPDATE_RETRY_MIN ?? 10);
  if (failed.length && retryMin > 0) {
    console.log(`A tentar outra vez dentro de ${retryMin} min: ${failed.join(", ")}`);
    await new Promise(resolve => setTimeout(resolve, retryMin * 60 * 1000));
    failed = failed.filter(name => !run(name));
  }
  process.exitCode = failed.length === UPDATERS.length ? 1 : 0;
}
