/* global AbortSignal, $, DOMParser, URL, URLSearchParams, console, document, er, fetchJsonFirstOk, fetchTextFirstOk, lsGet, lsSet, notifyNonCriticalError, skeletonGeneric, window */
(() => {
const GEO_FEEDS = [
  { id: "gdelt", label: "GDELT · Mundo", color: "#22D3EE", url: "https://www.gdeltproject.org/", api: true },
  { id: "icg", label: "Crisis Group", color: "#EF4444", url: "https://www.crisisgroup.org/rss/139", proxy: true },
  { id: "gpf", label: "Geop. Futures", color: "#F59E0B", url: "https://geopoliticalfutures.com/feed/", proxy: true },
  { id: "fa", label: "BBC World", color: "#8B5CF6", url: "https://feeds.bbci.co.uk/news/world/rss.xml", proxy: false },
];
let GEO_DATA = [];
let GEO_FILTER = "all";

function loadGeo(force = false) {
  const run = window.runSingleFlight || ((_key, task) => Promise.resolve().then(task));
  return run("card:geopolitics", () => loadGeoOnce(force));
}

async function loadGeoOnce(force = false) {
  const body = $("geo-body");
  if (!body) return;
  body.innerHTML = skeletonGeneric(6);

  try {
    const cacheKey = "geo_v10";
    let cached = force ? null : sanitizeGeoItems(lsGet(cacheKey));
    if (!cached?.length) {
      const articles = [];
      const params = new URLSearchParams({
        query: "(geopolitics OR conflict OR war OR diplomacy OR sanctions)",
        mode: "ArtList", format: "json", maxrecords: "30", sort: "DateDesc", timespan: "7d",
      });
      const gatewayUrl = window.dataApiUrl?.("v1/geopolitics");
      let result = null;
      if (gatewayUrl) {
        try {
          result = await fetchJsonFirstOk(gatewayUrl, { signal: AbortSignal.timeout(10000) }, 10000,
            ["direct"], payload => Array.isArray(payload?.articles));
        } catch {}
      }
      try {
        if (!result) {
          const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
          result = await fetchJsonFirstOk(url, { signal: AbortSignal.timeout(10000) }, 10000,
            ["direct"], payload => Array.isArray(payload?.articles));
        }
        result.articles.slice(0, 24).forEach((article, index) => {
          const title = String(article?.title || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
          const dt = parseGdeltDate(article?.seendate) || Date.now() - index * 60000;
          if (title.length > 8 && typeof article?.url === "string") {
            articles.push({ id: "gdelt", title, link: article.url, dt });
          }
        });
      } catch (error) {
        console.warn("geo feed GDELT", error);
      }

      for (const feed of GEO_FEEDS.filter(source => !source.api)) {
        if (articles.length >= 8) break;
        let raw = null;
        try {
          const sources = feed.proxy ? ["corsproxy", "allorigins", "codetabs"] : ["direct", "corsproxy", "allorigins", "codetabs"];
          raw = await fetchTextFirstOk(feed.url, { signal: AbortSignal.timeout(10000) }, 10000,
            sources, text => text.includes("<item>"));
          if (!raw) continue;

          const xml = new DOMParser().parseFromString(raw, "text/xml");
          if (xml.querySelector("parsererror")) continue;
          const items = xml.querySelectorAll("item");
          for (let index = 0; index < Math.min(items.length, 8); index++) {
            const item = items[index];
            const title = (item.querySelector("title")?.textContent || "")
              .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
            const link = (item.querySelector("link")?.textContent || "").trim();
            const published = item.querySelector("pubDate")?.textContent || "";
            const timestamp = published ? Date.parse(published) : Date.now() - index * 3600000;
            if (title.length > 8) articles.push({ id: feed.id, title, link, dt: timestamp });
          }
        } catch (error) {
          console.warn("geo feed", feed.id, error);
        }
      }

      cached = sanitizeGeoItems(articles);
      if (!cached.length) throw new Error("Feeds indisponíveis");
      const sources = [...new Set(cached.map(item => item.id))];
      const observedAt = Math.max(...cached.map(item => item.dt));
      lsSet(cacheKey, cached, {
        source: sources.map(id => GEO_FEEDS.find(feed => feed.id === id)?.label || id).join(", "),
        state: sources.length > 1 ? "partial" : "live",
        observedAt,
      });
    }
    GEO_DATA = cached;
    renderGeo();
  } catch (error) {
    body.innerHTML = er(error, { context: "Geopolítica", action: "clique em ↺ ou abra uma fonte em baixo" }) +
      "<div style='margin-top:8px'>" + GEO_FEEDS.map(feed =>
        `<div style='margin:3px 0;font-size:.62rem'>&rarr; <a href='${feed.url}' target='_blank' rel='noopener noreferrer' style='color:${feed.color}'>${feed.label}</a></div>`
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
    body.innerHTML = '<p style="color:var(--t3);font-size:.7rem;padding:10px 0">Sem artigos.</p>';
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

function parseGdeltDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(String(value || ""));
  if (!match) return 0;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  return Number.isFinite(timestamp) ? timestamp : 0;
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
