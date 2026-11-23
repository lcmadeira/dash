/*
 * GET com node:https e limite de tempo próprio (JSON ou bytes). O fetch do Node desiste de ligar ao fim
 * de 10 s (limite do undici, não configurável sem dependências), e o INE chega a demorar 15 s só
 * a aceitar a ligação.
 */
import https from "node:https";

/** GET → Buffer; erros HTTP, de ligação e de tempo repetidos até `attempts` vezes, com espera crescente. */
export function getBuffer(url, { timeoutMs = 90000, attempts = 3, retryDelayMs = 20000, accept = "*/*" } = {}) {
  const once = () => new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; dash-data-updater/1.0)", Accept: accept },
      timeout: timeoutMs,
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} em ${new URL(url).hostname}`));
        return;
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error(`sem resposta de ${new URL(url).hostname} em ${timeoutMs / 1000} s`)));
    req.on("error", error => reject(error.code ? new Error(`${error.code} em ${new URL(url).hostname}`) : error));
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

export async function getJson(url, options = {}) {
  const body = await getBuffer(url, { accept: "application/json", ...options });
  return JSON.parse(body.toString("utf8"));
}
