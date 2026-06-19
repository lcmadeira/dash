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
    }));
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

    const candidates = (buildFetchPlan(url, sources) || []).map((x) => x.url);
    let lastErr = null;
    for (const u of candidates) {
      try {
        const r = await fetch(u, withTimeoutOpts({}, 12000));
        if (!r.ok) {
          lastErr = new Error(`HTTP ${r.status}`);
          continue;
        }
        const xml = await r.text();
        const parsed = parseRSS(xml);
        if (Array.isArray(parsed) && parsed.length) return parsed;
        lastErr = new Error("RSS vazio");
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("RSS indisponível");
  }

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
        arts = (await fetchRSS(url)).slice(0, 8);
        if (arts.length) lsSet(cKey, arts);
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

  function renderNewsItems(arts, isPT, stale = false) {
    return `<div class="news-wrap">${arts
      .map(
        (a) => `
        <div class="ni" onclick="window.open('${a.link.replace(/'/g, "\\'")}','_blank')">
          <div class="ni-meta"><span class="ni-src">${(a.source || "—").slice(0, 24)}</span>
            <span class="ni-tag ${isPT ? "tpt" : "twld"}">${isPT ? "PT" : "WORLD"}</span>
            <span class="ni-time">${agoRSS(a.pubDate)}</span></div>
          <div class="ni-title">${a.title}</div>
        </div>`,
      )
      .join("")}</div>
      <div class="src">✦ Google News RSS · ${stale ? "cache" : new Date().toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
      })} · Clica para ler</div>`;
  }

  window.loadNews = loadNews;
})();
