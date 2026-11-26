// Os ficheiros carregados pelo index.html levam "?v=..." para o browser não usar a cópia em cache.
// Este controlo falha se um desses ficheiros mudar sem que a sua versão no index.html mude também
// (em 26-11-2026 o recession.js mudou sem nova versão e o browser continuou com a cópia antiga).
// Uso: node scripts/check-asset-versions.mjs [ref-base]   (por omissão origin/main)
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Mapa ficheiro → versão, a partir dos atributos src/href do index.html. */
export function assetVersions(html) {
  const versions = new Map();
  for (const m of String(html).matchAll(/(?:src|href)="([^"?#:]+)\?v=([^"&#]+)"/g)) versions.set(m[1], m[2]);
  return versions;
}

/** Ficheiros alterados que o index.html carrega com a mesma versão de antes. */
export function staleAssetVersions(changedFiles, baseHtml, headHtml) {
  const before = assetVersions(baseHtml);
  const after = assetVersions(headHtml);
  return changedFiles.filter(file => after.has(file) && before.has(file) && before.get(file) === after.get(file));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] || "origin/main";
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
  const mergeBase = git("merge-base", base, "HEAD").trim();
  const changed = git("diff", "--name-only", mergeBase, "HEAD").split("\n").filter(Boolean);
  const stale = staleAssetVersions(changed, git("show", `${mergeBase}:index.html`), git("show", "HEAD:index.html"));
  if (stale.length) {
    console.error(`Ficheiros alterados sem nova versão ?v= no index.html: ${stale.join(", ")}\n`
      + "Corrigir com: python3 scripts/bump-asset-versions.py AAAAMMDD-N (também recalcula os hashes SRI).");
    process.exit(1);
  }
  console.log(`Versões ?v= em ordem (${changed.length} ficheiros alterados desde ${base}).`);
}
