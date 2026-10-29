import { chromium } from "playwright";

const dashboardUrl = process.env.DASHBOARD_URL || "https://lcmadeira.github.io/dash/";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(dashboardUrl).hostname ? route.continue() : route.abort();
  });

  const response = await page.goto(dashboardUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (!response?.ok()) throw new Error(`Dashboard respondeu HTTP ${response?.status() ?? "sem resposta"}`);
  await page.waitForSelector("#dataOverviewItems", { timeout: 15000 });
  await page.waitForFunction(() => {
    const items = document.getElementById("dataOverviewItems");
    return items && !items.textContent.includes("A recolher estado dos cards");
  }, { timeout: 15000 });

  const result = await page.evaluate(() => ({
    title: document.title,
    cardCount: document.querySelectorAll("#main-grid .card").length,
    hasBriefing: Boolean(document.querySelector("#briefingBody")),
    hasStatus: Boolean(document.querySelector("#dataOverviewItems")?.textContent.trim()),
  }));
  if (!result.title.includes("Painel Pessoal") || result.cardCount < 20 || !result.hasBriefing || !result.hasStatus) {
    throw new Error(`Inicialização incompleta: ${JSON.stringify(result)}`);
  }
  if (pageErrors.length) throw new Error(`Erros JavaScript na página: ${pageErrors.join(" | ")}`);
  console.log(`Browser smoke OK: ${result.cardCount} cards, briefing e estado de dados inicializados.`);
} finally {
  await browser.close();
}
