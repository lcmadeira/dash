import { pathToFileURL } from "node:url";

export async function checkPublishedSite(base, request = fetch) {
  const baseUrl = new URL(base);
  const response = await request(baseUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Dashboard respondeu HTTP ${response.status}: ${baseUrl}`);

  const html = await response.text();
  for (const marker of ['id="dataOverview"', 'id="dataSourceHistory"', 'id="briefingBody"', 'id="briefingHistory"', 'id="costOfLiving"', 'id="offlineBanner"', 'id="main-grid"', 'data-dashboard-profile="portugal"', 'id="dataCountProvenance"']) {
    if (!html.includes(marker)) throw new Error(`Marcador obrigatório ausente: ${marker}`);
  }

  const requiredAssets = [
    "styles.css",
    "manifest.webmanifest",
    "pwa-icon.svg",
    "sw.js",
    "src/offline.js",
    "src/config.js",
    "src/fetch.js",
    "src/cache.js",
    "src/ui.js",
    "src/cards/briefing.js",
    "src/cards/news.js",
    "src/app.js",
  ];
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
  let manifest = null;
  for (const asset of requiredAssets) {
    const reference = references.find(value => new URL(value, baseUrl).pathname.endsWith(`/${asset}`))
      || (asset === "sw.js" ? "sw.js" : null)
      || (asset === "pwa-icon.svg" && manifest?.icons?.some(icon => typeof icon?.src === "string" && new URL(icon.src, new URL("manifest.webmanifest", baseUrl)).pathname.endsWith("/pwa-icon.svg")) ? "./pwa-icon.svg" : null);
    if (!reference) throw new Error(`Recurso obrigatório não referenciado: ${asset}`);
    const assetUrl = new URL(reference, baseUrl);
    const assetResponse = await request(assetUrl, { signal: AbortSignal.timeout(15000) });
    if (!assetResponse.ok) throw new Error(`${asset} respondeu HTTP ${assetResponse.status}`);
    const body = await assetResponse.text();
    if (!body.trim()) throw new Error(`${asset} foi publicado vazio`);
    if (asset === "manifest.webmanifest") {
      try { manifest = JSON.parse(body); } catch { throw new Error("manifest.webmanifest não contém JSON válido"); }
    }
  }
  return requiredAssets.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseUrl = process.env.DASHBOARD_URL || "https://lcmadeira.github.io/dash/";
  const checked = await checkPublishedSite(baseUrl);
  console.log(`Publicação saudável: ${baseUrl} e ${checked} recursos críticos verificados.`);
}
