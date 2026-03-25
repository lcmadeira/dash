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
- **Simulação de Alta Fidelidade**: Tráfego marítimo dinâmico baseado no tempo real (UTC) para contornar limitações de APIs públicas de AIS.

## Stack / dependências

- **HTML + CSS + JS** num único ficheiro: `index.html`
- **Chart.js** via CDN
- **TradingView widgets** (ticker tape, advanced chart, heatmap)
- Sem build step / sem bundler

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
- **api.apiaberta.pt** (combustíveis)
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

## Estrutura do repositório

- `index.html` — aplicação (UI + lógica + integrações)
- `ROADMAP.md` — plano de evolução e histórico recente
