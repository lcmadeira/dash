/*
 * GET de JSON com node:https e limite de tempo próprio. O fetch do Node desiste de ligar ao fim
 * de 10 s (limite do undici, não configurável sem dependências), e o INE chega a demorar 15 s só
 * a aceitar a ligação.
 */
import https from "node:https";

export function getJson(url, { timeoutMs = 90000, attempts = 3, retryDelayMs = 20000 } = {}) {
  const once = () => new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; dash-data-updater/1.0)", Accept: "application/json" },
      timeout: timeoutMs,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (error) { reject(error); }
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`sem resposta em ${timeoutMs / 1000} s`)));
    req.on("error", reject);
  });
  return (async () => {
    let lastError = null;
    for (let i = 1; i <= attempts; i++) {
      try { return await once(); } catch (error) { lastError = error; }
      // Espera crescente entre tentativas (o INE responde 429 a pedidos seguidos).
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, retryDelayMs * i));
    }
    throw lastError;
  })();
}
