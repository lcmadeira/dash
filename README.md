# Painel Pessoal · Portugal

Dashboard pessoal (single-page) focado em Portugal, mercados e contexto global — desenhado para correr **sem backend** e com **cache local (localStorage)**.

## O que inclui

- **Cards modulares** (Portugal, Mercados Financeiros, Notícias e outros módulos do painel).
- **Responsivo (mobile/tablet/desktop)** com grid adaptativo e touch targets.
- **Skeleton Screens & Shimmer**: Carregamento visual fluido com animações GPU-accelerated (60fps).
- **Personalização Instantânea**: Painel de settings (toggle cards, drag & drop, localização IPMA, tickers, **preferências de conforto visual e pesquisa em tempo-real**) aplicado em tempo-real **sem recarregar a página**.
- **Notificações** (centro + badge + persistência) — com limitações conhecidas de CORS.
- **Exportação** (PNG/PDF/CSV/JSON) — base implementada; PNG/PDF pode falhar em conteúdo em iframes (ex.: widgets TradingView).
- **Acessibilidade Profissional (WCAG AA)**: Contraste verificado, `aria-*` landmarks, foco visível por teclado e modais com focus trap.
- **UI Consistente**: Padronização de tabelas, footers, badges de estado, micro-interações e **scroll interno com headers sticky** em cards longos.
- **Gráficos históricos (7/30/90 dias)** em alguns módulos (ex.: eletricidade, TTF, PSI20, câmbio e gás PT).
- **Monitorização em tempo-real**: Tráfego aéreo (OpenSky) e Marítimo (Estreito de Ormuz) com mapas interactivos em Canvas/TopoJSON.
- **Combustíveis PT vs ES**: Comparação de preços entre Portugal e Espanha, com detalhe de postos, timestamps e preferências de combustível.
- **Simulação de Alta Fidelidade**: Tráfego marítimo dinâmico baseado no tempo real (UTC) para contornar limitações de APIs públicas de AIS.
- **Dados de Barragens**: Níveis de água por bacia hidrográfica via SNIRH/APA.

## Stack / dependências

- **Single-page** em `index.html` + helpers JS em `src/` (sem bundler / sem build step)
- **Chart.js** via CDN
- **TradingView widgets** (ticker tape, advanced chart, heatmap)
- **Estratégia Anti-CORS**: Tentativa de fetch direto (nacional/nativa) com fallback automático para múltiplos proxies públicos.
- Sem build step / sem bundler

### Ferramentas de dev

- **ESLint** + `eslint-plugin-html` — lint do JS (principalmente `index.html`)
- **html-validate** — validação estrutural e acessibilidade HTML
- **Ruff** — lint de `dev_server.py`
- **GitHub Actions** — pipeline CI com 6 jobs (ver abaixo)

## Como executar

Opção 1 (mais simples): abrir `index.html` no browser.

Opção 2 (recomendado para evitar problemas de fetch com `file://`):

```bash
python3 -m http.server 8000
```

Depois abrir `http://localhost:8000`.

Opção 3 (recomendado se apanhares erros de CORS/429 em proxies públicos):

```bash
python3 dev_server.py
```

Depois abrir `http://localhost:8000` (inclui um endpoint `/proxy` para contornar CORS em dev).

## Configuração (API keys)

Por omissão, a chave da Twelve Data está **desativada** por segurança (`TD_KEY: null`).

- Edita localmente a secção `CFG` em `index.html` para adicionares a tua chave.
- Importante: **não commitar keys** no repositório.

## Fontes de dados (alto nível)

O painel combina múltiplas fontes públicas/sem chave (e algumas opcionais), incluindo:

- **IPMA** (meteorologia), **date.nager.at** (feriados)
- **api.apiaberta.pt** (combustíveis PT) e **MITECO/MINETUR** (combustíveis ES)
- **BCE/ECB (SDMX)** e **Eurostat** (séries macroeconómicas)
- **CoinGecko**, **Stooq**, **Yahoo Finance** (mercados)
- **Open-Meteo (Air Quality / CAMS + UV)** (qualidade do ar)
- **OpenSky Network** (tráfego aéreo) e **AISHub** (tráfego marítimo / fallback simulado)
- **USGS** (sismos), **Google News RSS** + feeds de geopolítica

Notas:

- Alguns endpoints recorrem a **proxies CORS públicos** (ex.: `allorigins`, `corsproxy`, `thingproxy`) e podem falhar por indisponibilidade/limites.
- Certas funcionalidades (ex.: notificações periódicas) estão condicionadas por CORS — ver `ROADMAP.md`.

## Roadmap

Ver `ROADMAP.md`.

## CI/CD

Pipeline GitHub Actions (`.github/workflows/ci.yml`) executado em push e PR:

| Job | Descrição | Falha se... |
|---|---|---|
| `lint-js` | ESLint no JS inline do `index.html` | Erros de sintaxe ou `no-undef` |
| `lint-py` | Ruff no `dev_server.py` | Erros de lint Python |
| `validate-html` | html-validate na estrutura HTML | Erros estruturais ou acessibilidade |
| `secret-scan` | Regex por API keys hardcoded no código | Encontrar secrets em código activo |
| `cdn-health` | curl nos CDNs críticos (Chart.js, html2canvas, jspdf, Google Fonts) | HTTP != 200 |
| `file-size` | Tamanho do `index.html` | Warning se > 700KB |

### Executar lint localmente

```bash
npm install          # instalar dependências (uma vez)
npm run lint         # ESLint
npm run validate     # html-validate
ruff check dev_server.py  # Ruff (requer Python)
```

## Estrutura do repositório

- `index.html` — aplicação (UI + lógica + integrações)
- `src/` — código extraído de `index.html` (cache/fetch/UI + cards)
- `dev_server.py` — servidor dev com proxy CORS local
- `ROADMAP.md` — plano de evolução e histórico recente
- `package.json` — dev dependencies (ESLint, html-validate)
- `eslint.config.js` — configuração ESLint (flat config)
- `.htmlvalidate.json` — regras de validação HTML
- `.github/workflows/ci.yml` — pipeline CI
