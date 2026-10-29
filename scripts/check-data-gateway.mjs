import { pathToFileURL } from "node:url";

const REQUIRED_ROUTES = ["/v1/crypto", "/v1/geopolitics", "/v1/news-pt", "/v1/news-world"];

export async function checkDataGateway(base, request = fetch) {
  const url = new URL("/v1/status", base);
  const response = await request(url, { headers: { Origin: "https://lcmadeira.github.io" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Gateway respondeu HTTP ${response.status}`);
  if (response.headers.get("Access-Control-Allow-Origin") !== "https://lcmadeira.github.io") {
    throw new Error("Gateway sem CORS configurado para o dashboard publicado");
  }
  const payload = await response.json();
  if (payload.service !== "dash-data-gateway") throw new Error("Serviço inesperado no endpoint /v1/status");
  const missing = REQUIRED_ROUTES.filter(route => !payload.routes?.includes(route));
  if (missing.length) throw new Error(`Rotas em falta: ${missing.join(", ")}`);
  return REQUIRED_ROUTES.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.env.DATA_GATEWAY_URL;
  if (!base) throw new Error("Defina DATA_GATEWAY_URL com o URL workers.dev publicado.");
  const count = await checkDataGateway(base);
  console.log(`Gateway saudável: ${count} rotas registadas e CORS validado em ${new URL(base)}.`);
}
