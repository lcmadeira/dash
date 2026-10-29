/* global AbortSignal, DOMParser, $, fetchJsonFirstOk, fetchTextFirstOk, lsGet, lsSet, notifyNonCriticalError, skeletonNews, window */
/* Google News RSS cards (moved out of index.html) */
(function () {
  function parseRSS(xml) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = [...doc.querySelectorAll("item")];
    if (!items.length) throw new Error("RSS vazio");
    return items.map((el) => ({
      title: el.querySelector("title")?.textContent?.trim() || "—",
      link:
        el.querySelector("link")?.textContent?.trim() ||
        el.getElementsByTagName("link")[0]?.nextSibling?.nodeValue?.trim() ||
        "#",
      source: el.querySelector("source")?.textContent?.trim() || "—",
      pubDate: el.querySelector("pubDate")?.textContent?.trim() || "",
    })).filter(article => {
      const publishedAt = Date.parse(article.pubDate);
      return !Number.isFinite(publishedAt) || publishedAt <= Date.now() + 5 * 60 * 1000;
    });
  }

  function agoRSS(s) {
    if (!s) return "";
    try {
      const m = Math.floor((Date.now() - new Date(s)) / 60000);
      if (m < 1) return "agora";
      if (m < 60) return `há ${m}m`;
      const h = Math.floor(m / 60);
      return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
    } catch {
      return "";
    }
  }

  async function fetchRSS(url) {
    const isGoogleNews = /(^|\/\/)news\.google\.com\//i.test(url);
    const sources = isGoogleNews
      ? ["local", "jina", "allorigins"]
      : ["direct", "local", "allorigins", "jina", "corsproxy"];

    const xml = await fetchTextFirstOk(url, {}, 12000, sources, text => {
      try { return parseRSS(text).length > 0; } catch { return false; }
    });
    return parseRSS(xml);
  }

  async function fetchGatewayNews(scope) {
    const route = scope === "pt" ? "v1/news-pt" : "v1/news-world";
    const gatewayUrl = window.dataApiUrl?.(route);
    if (!gatewayUrl) return null;
    try {
      const payload = await fetchJsonFirstOk(gatewayUrl, { signal: AbortSignal.timeout(10000) }, 10000,
        ["direct"], value => Array.isArray(value?.articles) && value.articles.length > 0);
      const articles = payload.articles.map(article => ({
        title: String(article.title || "").slice(0, 300),
        link: safeArticleUrl(article.link),
        source: String(article.source || "Google News").slice(0, 80),
        pubDate: String(article.pubDate || "").slice(0, 100),
      })).filter(article => article.title && article.link);
      return articles.length ? { articles, meta: payload._meta || null } : null;
    } catch {
      return null;
    }
  }

  /** Carrega e apresenta notícias RSS portuguesas ou mundiais, recorrendo ao cache em caso de falha.
   * @param {"pt"|"world"} scope Seleciona o feed e o card de destino.
   * @param {boolean} [force=false] Se true, ignora o cache válido.
   * @returns {Promise<void>}
   */
  async function loadNews(scope, force = false) {
    const isPT = scope === "pt",
      el = $(isPT ? "news-pt" : "news-world");
    el.innerHTML = skeletonNews(8);
    const cKey = `rss_${scope}`;

    try {
      let arts = force ? null : lsGet(cKey);
      if (!arts) {
        const url = isPT
          ? "https://news.google.com/rss/search?q=portugal+hoje&hl=pt-PT&gl=PT&ceid=PT:pt"
          : "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en";
        const gateway = await fetchGatewayNews(scope);
        arts = (gateway?.articles || await fetchRSS(url)).slice(0, 8);
        if (arts.length) {
          const latestPublished = arts.map(article => Date.parse(article.pubDate || "")).filter(Number.isFinite).reduce((latest, value) => Math.max(latest, value), 0);
          const observedAt = gateway?.meta?.observedAt || latestPublished || undefined;
          const state = gateway ? (gateway.meta?.state === "stale" ? "stale" : "live") : "partial";
          lsSet(cKey, arts, {
            source: gateway?.meta?.source || "Google News RSS",
            state,
            observedAt,
            reason: state === "stale" ? "Snapshot do gateway; verificar data das notícias" : "Feed agregado; publicação individual por artigo",
          });
        }
      }

      if (notificationSettings.news.enabled && isPT && arts && arts.length > 0) {
        const breakingKeywords = [
          "urgente",
          "breaking",
          "última hora",
          "agora",
          "alerta",
          "atenção",
          "emergência",
          "rápido",
        ];

        arts.forEach((article) => {
          const title = (article.title || "").toLowerCase();
          const isBreaking = breakingKeywords.some((kw) => title.includes(kw));
          if (!isBreaking) return;

          const notifId = `news-${article.link}`;
          const exists = notifications.find((n) => n.data?.notifId === notifId);
          if (exists) return;

          addNotification(
            "news",
            article.title || "Notícia importante",
            article.source || "Última hora",
            "high",
            { notifId, url: article.link, source: article.source },
          );
        });
      }

      if (!arts.length) throw new Error("Sem artigos");
      el.innerHTML = renderNewsItems(arts, isPT);
    } catch (e) {
      const stale = lsGet(cKey);
      if (Array.isArray(stale) && stale.length) {
        el.innerHTML = renderNewsItems(stale.slice(0, 8), isPT, true);
        return;
      }
      el.innerHTML = er(e.message);
    }
  }

  /** Gera o HTML dos artigos RSS com etiqueta de idioma e idade de publicação.
   * @param {{title: string, link: string, source?: string, pubDate?: string}[]} arts Artigos a apresentar.
   * @param {boolean} isPT Indica se os artigos pertencem ao feed português.
   * @param {boolean} [stale=false] Indica que os artigos vieram de cache usado como fallback.
   * @returns {string} HTML dos artigos e da respetiva fonte.
   */
  function renderNewsItems(arts, isPT, stale = false) {
    return `<div class="news-wrap">${arts
      .map(
        (a) => {
          const link = safeArticleUrl(a.link);
          if (!link) return "";
          return `
        <a class="ni" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">
          <div class="ni-meta"><span class="ni-src">${escapeHTML((a.source || "—").slice(0, 24))}</span>
            <span class="ni-tag ${isPT ? "tpt" : "twld"}">${isPT ? "PT" : "WORLD"}</span>
            <span class="ni-time">${agoRSS(a.pubDate)}</span></div>
          <div class="ni-title">${escapeHTML(a.title)}</div>
        </a>`;
        },
      )
      .join("")}</div>
      <div class="src">✦ Google News RSS · ${stale ? "cache" : new Date().toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
      })} · Clica para ler</div>`;
  }

  function safeArticleUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  window.loadNews = loadNews;
})();
