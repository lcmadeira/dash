/* global AbortSignal, $, DOMParser, URL, console, document, er, fetchJsonFirstOk, fetchTextFirstOk, lsGet, lsSet, notifyNonCriticalError, skeletonGeneric, window */
(() => {
// O GDELT saiu a 26-11-2026: recusava a Cloudflare desde 20-11 e passou a recusar também pedidos
// isolados de outros IPs (429). Os três feeds são pedidos em paralelo, até 8 artigos de cada.
const GEO_FEEDS = [
  { id: "icg", label: "Crisis Group", color: "#EF4444", url: "https://www.crisisgroup.org/rss/139", proxy: true },
  { id: "gpf", label: "Geop. Futures", color: "#F59E0B", url: "https://geopoliticalfutures.com/feed/", proxy: true },
  { id: "fa", label: "BBC World", color: "#8B5CF6", url: "https://feeds.bbci.co.uk/news/world/rss.xml", proxy: true },
];
const GEO_PER_FEED = 8;
let GEO_DATA = [];
let GEO_FILTER = "all";
function loadGeo(force = false) {
  const run = window.runSingleFlight || ((_key, task) => Promise.resolve().then(task));
  return run("card:geopolitics", () => loadGeoOnce(force));
}

const cleanTitle = value => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

/** Artigos de um feed: gateway próprio primeiro (cópia de reserva no servidor), depois proxies públicos. */
async function loadGeoFeed(feed) {
  const feedGateway = window.dataApiUrl?.(`v1/feed-${feed.id}`);
  if (feedGateway) {
    try {
      const payload = await fetchJsonFirstOk(feedGateway, { signal: AbortSignal.timeout(10000) }, 10000,
        ["direct"], value => Array.isArray(value?.articles) && value.articles.length > 0);
      return {
        stale: payload?._meta?.state === "stale",
        articles: payload.articles.slice(0, GEO_PER_FEED).map((article, index) => ({
          id: feed.id, title: cleanTitle(article.title), link: article.link,
          dt: Date.parse(article.pubDate || "") || Date.now() - index * 3600000,
        })),
      };
    } catch {
      /* segue para os proxies públicos */
    }
  }
  const sources = feed.proxy ? ["corsproxy", "allorigins", "codetabs"] : ["direct", "corsproxy", "allorigins", "codetabs"];
  const raw = await fetchTextFirstOk(feed.url, { signal: AbortSignal.timeout(10000) }, 10000,
    sources, text => text.includes("<item>"));
  const xml = new DOMParser().parseFromString(raw, "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("RSS inválido");
  return {
    stale: false,
    articles: Array.from(xml.querySelectorAll("item")).slice(0, GEO_PER_FEED).map((item, index) => {
      const published = item.querySelector("pubDate")?.textContent || "";
      return {
        id: feed.id,
        title: cleanTitle(item.querySelector("title")?.textContent),
        link: (item.querySelector("link")?.textContent || "").trim(),
        dt: (published && Date.parse(published)) || Date.now() - index * 3600000,
      };
    }),
  };
}

async function loadGeoOnce(force = false) {
  const body = $("geo-body");
  if (!body) return;
  body.innerHTML = skeletonGeneric(6);
  try {
    const cacheKey = "geo_v11";
    let cached = force ? null : sanitizeGeoItems(lsGet(cacheKey));
    if (!cached?.length) {
      const results = await Promise.allSettled(GEO_FEEDS.map(loadGeoFeed));
      const articles = [];
      const failedFeeds = [];
      let anyStale = false;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          articles.push(...result.value.articles);
          anyStale ||= result.value.stale;
        } else {
          failedFeeds.push(`${GEO_FEEDS[index].label} (${result.reason?.message || "erro"})`);
        }
      });
      if (failedFeeds.length) console.warn("Geopolítica: fontes indisponíveis", failedFeeds);

      cached = sanitizeGeoItems(articles);
      if (!cached.length) throw new Error("Feeds indisponíveis");
      const sources = [...new Set(cached.map(item => item.id))];
      const observedAt = Math.max(...cached.map(item => item.dt));
      lsSet(cacheKey, cached, {
        source: sources.map(id => GEO_FEEDS.find(feed => feed.id === id)?.label || id).join(", "),
        state: failedFeeds.length ? "partial" : anyStale ? "stale" : "live",
        observedAt,
        reason: failedFeeds.length ? `Fontes indisponíveis: ${failedFeeds.map(item => item.split(" (")[0]).join(", ")}`
          : anyStale ? "Fornecedor indisponível; snapshot do gateway" : undefined,
      });
    }
    GEO_DATA = cached;
    renderGeo();
  } catch (error) {
    body.innerHTML = er(error, { context: "Geopolítica", action: "clique em ↺ ou abra uma fonte em baixo" }) +
      "<div style='margin-top:8px'>" + GEO_FEEDS.map(feed =>
        `<div style='margin:3px 0;font-size:.74rem'>&rarr; <a href='${feed.url}' target='_blank' rel='noopener noreferrer' style='color:${feed.color}'>${feed.label}</a></div>`
      ).join("") + "</div>";
    notifyNonCriticalError("Geopolítica", error, "clique em ↺ ou abra uma fonte em baixo");
  }
}

function switchGeo(filter, button) {
  document.querySelectorAll(".geo-tab").forEach(tab => tab.classList.remove("on"));
  if (button) button.classList.add("on");
  GEO_FILTER = filter === "all" || GEO_FEEDS.some(feed => feed.id === filter) ? filter : "all";
  renderGeo();
}

function renderGeo() {
  const body = $("geo-body");
  if (!body) return;
  const items = GEO_FILTER === "all" ? GEO_DATA : GEO_DATA.filter(item => item.id === GEO_FILTER);
  if (!items.length) {
    body.innerHTML = '<p style="color:var(--t3);font-size:.74rem;padding:10px 0">Sem artigos.</p>';
    return;
  }
  body.innerHTML = items.slice(0, 10).map(item => {
    const feed = GEO_FEEDS.find(source => source.id === item.id);
    if (!feed) return "";
    const title = escapeHTML(item.title);
    const url = escapeHTML(item.link);
    return `<a class="geo-item" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir artigo ${escapeHTML(feed.label)}: ${title}">
      <span class="geo-src-tag" style="color:${feed.color};border-color:${feed.color}44;background:${feed.color}11">${escapeHTML(feed.label)}</span>
      <div class="geo-title">${title}</div>
      <div class="geo-date">${fmtAgo(item.dt)}</div></a>`;
  }).join("");
}

function sanitizeGeoItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 24).map(item => {
    const feed = GEO_FEEDS.find(source => source.id === item?.id);
    if (!feed || typeof item.title !== "string" || typeof item.link !== "string") return null;
    const title = item.title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
    let url;
    try {
      url = new URL(item.link);
      if (url.protocol !== "https:" || url.username || url.password) return null;
    } catch {
      return null;
    }
    const timestamp = Number(item.dt);
    if (title.length <= 8 || !Number.isFinite(timestamp) || timestamp <= 0) return null;
    return { id: feed.id, title, link: url.href, dt: timestamp };
  }).filter(Boolean).sort((a, b) => b.dt - a.dt);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[char]);
}

function fmtAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "agora";
  if (seconds < 3600) return Math.floor(seconds / 60) + "min";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h";
  return Math.floor(seconds / 86400) + "d";
}

window.loadGeo = loadGeo;
window.switchGeo = switchGeo;
})();
