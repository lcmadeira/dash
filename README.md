# Painel Pessoal · Portugal

Dashboard pessoal (single-page) focado em Portugal, mercados e contexto global — desenhado para correr **sem backend** e com **cache local (localStorage)**. Os registos têm TTL por tipo; envelopes inválidos ou com datas futuras são ignorados.

## O que inclui

- **Cards modulares** (Portugal, Mercados Financeiros, Notícias e outros módulos do painel).
- **Responsivo (mobile/tablet/desktop)** com grid adaptativo e touch targets.
- **Skeleton Screens & Shimmer**: Carregamento visual fluido com animações GPU-accelerated (60fps).
- **Personalização Instantânea**: Painel de settings (toggle cards, drag & drop, localização IPMA, tickers, **preferências de conforto visual e pesquisa em tempo-real**) aplicado em tempo-real **sem recarregar a página**.
- **Notificações** (centro + badge + persistência) — com limitações conhecidas de CORS.
- **Estado e idade dos dados por card**: badges mostram a idade da gravação local, dados antigos, carregamento e erros; quando a fonte fornece uma data reconhecível, o tooltip distingue-a da gravação em cache. Envelopes inválidos ou com timestamps futuros não são apresentados como válidos.
- **Exportação** (PNG/PDF/CSV/JSON) — base implementada; PNG/PDF pode falhar em conteúdo em iframes (ex.: widgets TradingView).
- **Acessibilidade Profissional (WCAG AA)**: Contraste verificado, `aria-*` landmarks, foco visível por teclado e modais com focus trap.
- **UI Consistente**: Padronização de tabelas, footers, badges de estado, micro-interações e **scroll interno com headers sticky** em cards longos.
- **Gráficos históricos (7/30/90 dias)** em alguns módulos (ex.: eletricidade, TTF, PSI20, câmbio e gás PT).
- **Monitorização em tempo-real**: Tráfego aéreo (OpenSky) e Marítimo (Estreito de Ormuz) com mapas interactivos em Canvas/TopoJSON.
- **Combustíveis PT vs ES**: Comparação de preços entre Portugal e Espanha, com detalhe de postos, timestamps e preferências de combustível.
- **Simulação de Alta Fidelidade**: Tráfego marítimo dinâmico baseado no tempo real (UTC) para contornar limitações de APIs públicas de AIS.
- **Dados de Barragens**: Níveis de água por bacia hidrográfica via SNIRH/APA.

## Stack / dependências

- **Single-page** em `index.html`, estilos em `styles.css` e JavaScript da aplicação em `src/` (sem bundler / sem build step)
- **Chart.js** via CDN
- **TradingView widgets** (ticker tape, advanced chart, heatmap)
- **Estratégia Anti-CORS**: Tentativa de fetch direto (nacional/nativa) com fallback automático para múltiplos proxies públicos; todos os cards passam pelos helpers partilhados, com no máximo dois pedidos simultâneos por proxy. Pedidos cancelados param a cadeia e falhas `401`/`403`, `408`, `429`, `5xx` e de rede ativam backoff partilhado durante a sessão da tab.
- Sem build step / sem bundler

### Ferramentas de dev

- **ESLint** + `eslint-plugin-html` — lint do JavaScript inline e dos módulos em `src/`
- **html-validate** — validação estrutural e acessibilidade HTML
- **Node.js test runner** — testes de regressão executados com `npm test`
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

Depois abrir `http://localhost:8000`. O servidor liga apenas ao loopback da máquina, limita CORS a páginas locais, rejeita nomes DNS sem endereços públicos e inclui um endpoint `/proxy` para contornar CORS em desenvolvimento.

### Cache e consola do browser

O GitHub Pages pode manter HTML, CSS e JavaScript em cache durante alguns minutos. Ao alterar `styles.css`, `src/widgets/market-clock.js` ou `src/app.js`, atualiza o parâmetro `v` nas respetivas tags `<link>`/`<script>` em `index.html`; isso força o browser a pedir os ficheiros novos. Para confirmar uma publicação, faz uma atualização forçada (`Ctrl+Shift+R`). O HTML atual não declara recursos `preload`; ao investigar avisos desse tipo, verifica o URL completo, pois widgets e folhas de estilo externas também podem criar as suas próprias sugestões de carregamento.

Os widgets TradingView são montados quando se aproximam da área visível. As tabs do mapa de calor mantêm os widgets já visitados montados para evitar recarregamentos ao alternar entre mercados. Os embeds externos ainda podem emitir avisos de `preload` dentro dos seus próprios iframes quando carregam; esses recursos são geridos pelo TradingView. Os widgets são preparados a partir de elementos `<template>` e carregados com `IntersectionObserver`, seguindo a [orientação oficial do TradingView](https://www.tradingview.com/widget-docs/tutorials/iframe/lazy-loading/).

## Credenciais de APIs

A integração com a Twelve Data está desativada. Não coloques chaves API em `src/config.js`, `index.html` ou noutro ficheiro servido ao browser: qualquer visitante pode lê-las. Uma futura integração deve enviar pedidos através de um endpoint de backend que mantenha a credencial no servidor.

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
- A API Air Quality da Open-Meteo usa `nitrogen_dioxide`, `ozone` e `sulphur_dioxide` para os poluentes; o card converte estes campos para os nomes internos `no2`, `o3` e `so2`. No GitHub Pages, a previsão UV usa CORS direto e não o proxy local de desenvolvimento.
- No GitHub Pages, os pedidos ao Yahoo Finance passam pelos proxies CORS configurados, porque o endpoint não permite pedidos diretos do browser.
- O card PSI 20 tenta primeiro obter as cotações em lote da Stooq, usa Yahoo Finance para símbolos em falta e identifica valores estáticos quando os proxies não devolvem cotações atuais.
- Certas funcionalidades (ex.: notificações periódicas) estão condicionadas por CORS — ver `ROADMAP.md`.

## Roadmap

Ver `ROADMAP.md`.

## CI/CD

Pipeline GitHub Actions (`.github/workflows/ci.yml`) executado em push e PR:

| Job | Descrição | Falha se... |
|---|---|---|
| `lint-js` | ESLint no JavaScript inline do `index.html` e nos ficheiros listados em `package.json` | Erros de sintaxe ou `no-undef` |
| `lint-py` | Ruff e testes unitários Python do servidor de desenvolvimento | Erros de lint ou regressões no proxy |
| `validate-html` | html-validate na estrutura HTML | Erros estruturais ou acessibilidade |
| `secret-scan` | Regex por API keys hardcoded em `index.html`, `dev_server.py`, `src/` e `tests/` | Encontrar secrets em código ativo |
| `cdn-health` | curl nos CDNs críticos (Chart.js, html2canvas, jspdf, Google Fonts) | HTTP != 200 |
| `file-size` | Tamanho do `index.html` | Warning se > 700KB |

### Executar lint localmente

```bash
npm ci --no-bin-links  # instalar versões fixadas no package-lock.json
npm run lint         # ESLint
npm run validate     # html-validate
npm run lint:py     # Ruff (requer Python)
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Estrutura do repositório

- `index.html` — estrutura da página e dos cards, com referências aos estilos e scripts
- `styles.css` — estilos globais da aplicação
- `src/app.js` — lógica principal da aplicação, carregada como script clássico para manter compatibilidade com handlers inline
- `src/` — helpers de cache/fetch/UI, configuração, módulos de cards e widgets, incluindo combustíveis e relógios dos mercados
- Os helpers partilhados em `src/cache.js`, `src/fetch.js` e `src/ui.js`, e os pontos de entrada dos cards em `src/cards/`, usam JSDoc para documentar parâmetros, resultados e comportamento relevante.
- `src/cards/gas-markets.js` contém os cards TTF e gás PT; o segundo reutiliza a cache TTF, validada antes de alimentar a estimativa MIBGAS.
- `dev_server.py` — servidor dev com proxy CORS local
- `ROADMAP.md` — plano de evolução e histórico recente
- `package.json` — dev dependencies (ESLint, html-validate)
- `eslint.config.js` — configuração ESLint (flat config)
- `.htmlvalidate.json` — regras de validação HTML
- `.github/workflows/ci.yml` — pipeline CI
