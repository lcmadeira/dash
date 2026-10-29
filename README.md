# Painel Pessoal · Portugal

Dashboard pessoal (single-page) focado em Portugal, mercados e contexto global — funciona sem backend próprio e usa um gateway serverless para um conjunto limitado de fontes. Mantém cache local (`localStorage`) com TTL por tipo; envelopes inválidos ou com datas futuras são ignorados.

## O que inclui

- **Cards modulares** (Portugal, Mercados Financeiros, Notícias e outros módulos do painel).
- **Responsivo (mobile/tablet/desktop)** com grid adaptativo, controlos de toque maiores no resumo e smoke check do viewport móvel sem overflow horizontal.
- **Skeleton Screens & Shimmer**: Carregamento visual fluido com animações GPU-accelerated (60fps).
- **Personalização Instantânea**: Painel de settings (toggle cards, drag & drop, localização IPMA, tickers, **preferências de conforto visual e pesquisa em tempo-real**) aplicado em tempo-real **sem recarregar a página**.
- **Notificações** (centro + badge + persistência) — com limitações conhecidas de CORS. O alerta de preço da gasolina 95 é opcional, desligado por omissão, só considera observações até 72h e guarda apenas limite/estado/data do último aviso neste browser. Notificações do sistema pedem permissão após clique e só são avaliadas com o dashboard aberto; push com a página fechada requer Worker agendado e chaves VAPID configuradas.
- **Estado e idade dos dados por card**: badges mostram a idade da gravação local, dados antigos, carregamento e erros; quando a fonte fornece uma data reconhecível, o tooltip distingue-a da gravação em cache. Envelopes inválidos ou com timestamps futuros não são apresentados como válidos.
- **Resumo de saúde dos dados**: no topo do painel, agrega os cards disponíveis, a carregar e que precisam de atenção; permite saltar diretamente para cards com dados antigos, parciais, de referência ou erro. Quando os metadados existem, mostra também fonte e hora da observação. Para IPMA, combustíveis, câmbio, IHPC e Euribor, limites de idade da observação são avaliados separadamente da idade da cache local. O resumo regista a hora da última verificação e quantos cards reportam erro ou dados antigos; ausência de alertas não equivale a monitorização histórica da fonte.
- **Histórico local da saúde dos dados**: guarda até 30 resumos diários das visitas deste browser e mostra os últimos sete dias observados. Não faz sondagens em background, não sincroniza dispositivos e não mede disponibilidade contínua dos fornecedores.
- **Portugal hoje**: síntese personalizável de observações recentes da previsão IPMA, gasolina 95 (com comparação PT/ES quando ambas as fontes são recentes), histórico do cabaz e, quando as fontes live estão disponíveis, IHPC Eurostat e Euribor BCE — sempre com data/fonte e sem tratar cache antiga como dado atual. As preferências ficam neste browser. Inclui uma estimativa opcional de custo mensal de gasolina baseada nos litros indicados na página; não persiste o consumo.
- **Alterações desde a visita anterior**: compara indicadores recentes com o último snapshot observado neste browser. Só compara observações atuais; o primeiro acesso cria a referência, guardada ao sair da página.
- **Alterações relevantes**: filtra diferenças pequenas com limites próprios por indicador (2 °C/20 pp na meteorologia, €0,01/L no combustível, €1 no cabaz, 0,1 pp no IHPC e 0,05 pp na Euribor); a comparação não é uma recomendação nem usa dados antigos como atuais.
- **Tendência local de Portugal**: guarda até 90 dias de observações diárias recentes de meteorologia, combustível, cabaz, IHPC e Euribor neste browser; mostra a diferença desde a observação local anterior e mantém fonte/data nos cartões. O histórico começa a acumular após a atualização e não sincroniza entre dispositivos.
- **Custos do agregado**: estimativa opcional baseada apenas nas compras e eletricidade introduzidas e no combustível calculado pelos litros mensais e por um preço recente. Mostra que percentagem estes custos representam do rendimento líquido indicado; não é um orçamento completo e não guarda os valores.
- **Contexto PSI 20**: distingue fim de semana/feriado, fora do horário normal e falta de cotação durante sessão; valores de referência permanecem ocultos. Quando há preços, o card indica a hora em que a consulta foi recebida (não a hora exata do negócio).
- **Pedidos de card sem duplicação simultânea**: PSI, cripto e geopolítica partilham a mesma operação quando carregamentos automáticos, lazy loading ou refresh coincidem.
- **Proveniência da cache**: gravações podem guardar fonte, estado (`live`, `partial`, `stale`, `static`, `fallback`) e hora observada. IPMA, combustíveis, câmbio, IHPC, Euribor, notícias, qualidade do ar, Fear & Greed, spread FRED e sismos registam metadados de origem; o tooltip distingue cache recente de observação recente e envelopes antigos continuam compatíveis.
- **Validade de referências estáticas**: EMMI, IHPC de referência, habitação, agricultura, spread FRED e TTF têm fonte/período e limite de revisão em `STATIC_REFERENCE_POLICY`; o resumo assinala referências que ultrapassam esse prazo.
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
- **Verificação agendada da publicação** — confirma diariamente a página GitHub Pages e os recursos críticos, e abre o dashboard em Chromium para verificar a inicialização da UI; também pode ser executada manualmente em Actions.

## Como executar

`src/config.js` centraliza os contratos de fonte e os limites de atualidade das séries com data verificável. Esses limites são distintos do TTL da cache local.

O modo instalável/offline funciona em contexto seguro (GitHub Pages/HTTPS ou `localhost`). Abre o painel online pelo menos uma vez para guardar o shell local. O Service Worker guarda apenas a página e recursos do próprio site; APIs e proxies continuam dependentes da rede. A faixa offline conta os cards com dados guardados ou de referência e liga ao estado/idade detalhados; a idade de cada observação continua visível no respetivo card. Se as fontes não responderem, “Portugal hoje” pode mostrar o snapshot da última visita, com data/hora e aviso de que os valores podem estar antigos. Limpar os dados do site remove a cópia local.

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

### Gateway de dados

`worker/` contém um Cloudflare Worker com rotas limitadas a CoinGecko, GDELT e feeds RSS fixos de notícias PT/Mundo. Não aceita URLs fornecidos pelo chamador. O gateway valida a origem, valida o formato das respostas e guarda respostas no cache da edge. Para o publicar, é necessário um projeto Cloudflare:

```bash
npx wrangler deploy --config worker/wrangler.toml
```

O Worker de produção está publicado em `https://dash-data-gateway.luiscarlosmadeira.workers.dev` e `CFG.DATA_API_BASE` já aponta para esse endereço. As rotas atuais são `/v1/crypto`, `/v1/geopolitics`, `/v1/news-pt` e `/v1/news-world`; a lista também está em `/v1/status`. A integração Cloudflare com este repositório publica alterações automaticamente na branch de produção. O gateway rejeita respostas acima de limites por rota (250 KB cripto, 1,5 MB geopolítica, 500 KB notícias), além de validar payloads antes de os guardar.

Uma expansão para o INE foi avaliada e adiada: o endpoint do indicador `0009494` consultado em 29/10/2026 devolveu apenas o 3.º trimestre de 2021 e não uma série nacional agregada. Isso é mais antigo e menos adequado do que a referência Q3 2025 apresentada pelo card; encaminhar essa resposta como dado live criaria uma regressão de atualidade. O card mantém o fallback identificado até existir um indicador INE correto e recente.

O card PSI mantém o link direto para a [página oficial da Euronext](https://live.euronext.com/en/product/indices/pting0200002-xlis). A Euronext descreve acesso a dados atrasados sem custo no enquadramento de MiFIR, mas a documentação dos acordos também sujeita a exibição pública de dados atrasados a licença de redistribuição. Não se assumiu que acesso gratuito equivale a autorização para redistribuir no dashboard; a [página de acesso](https://www.euronext.com/en/data/real-time-data/how-access-market-data) e os [tipos de acordo](https://www.euronext.com/en/data/pricing-specs-agreements/data-agreements-types) devem ser confirmados antes de ativar cotações.

Também é possível publicar pela GitHub Action manual **Deploy data gateway**. Configura os secrets de repositório `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` e inicia o workflow em Actions. A Action publica o Worker e verifica as rotas e o CORS; a integração Cloudflare ligada ao repositório é o método automático de produção.

O workflow manual depende dos dois secrets Cloudflare no GitHub. Não guardes nem comites estes valores no repositório. O Wrangler mantém `workers.dev` ativo e desativa URLs de preview para este Worker.

Quando um fornecedor falha, o Worker pode servir um snapshot de contingência guardado por até 24 horas. A resposta inclui `_meta.state: "stale"`, `X-Dash-Cache: STALE` e `Warning: 110`; os cards preservam esse estado para não apresentar a contingência como cotação atual. Esta proteção só existe depois de o Worker estar publicado e configurado.

### Cache e consola do browser

Os botões de vista **Tudo**, **Portugal**, **Mercados** e **Mundo** filtram os cards sem alterar a personalização guardada de ordem/visibilidade; a escolha fica no armazenamento local deste browser. O resumo de dados também mostra quantos estados já incluem fonte ou data observada. Estes indicadores são uma medida de cobertura de proveniência, não uma garantia de que a fonte esteja atualizada.

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
- O card PSI 20 tenta primeiro obter as cotações em lote da Stooq, usa Yahoo Finance para símbolos em falta e oculta os valores de referência quando os proxies não devolvem cotações atuais. A ligação oficial da Euronext permanece disponível como consulta alternativa.
- O card de geopolítica usa GDELT DOC JSON diretamente, com CORS, antes de tentar as feeds RSS de reserva. O card de cripto tenta CoinGecko diretamente antes de recorrer a proxies.
- O contexto de sessão da Euronext Lisboa usa o [calendário oficial de feriados](https://www.euronext.com/en/trading/trading-hours-holidays) e o horário regular publicado pelo [Santander](https://www.santander.pt/onebroker); em 24 e 31 de dezembro de 2026 identifica sessão curta sem assumir a hora de fecho, ainda por confirmar pela Euronext.
- Não há uma fonte pública de cotações do PSI autorizada/configurada. A Euronext apresenta opções de dados/feeds e indica que a exibição pública está sujeita a políticas de licença; dados atrasados gratuitos são para uso interno, pelo que o painel mantém as cotações ausentes ocultas até existir uma fonte compatível com publicação pública ([políticas Euronext](https://www.euronext.com/en/data/real-time-data/pricing-specs-agreements/market-data-pricing-policies), [Euronext Stream API](https://www.euronext.com/en/products-services/euronext-stream-api)).
- O envelope local mantém `{d, ts}` e aceita `meta` opcional com `source`, `state`, `observedAt` e `reason`; `ts` continua a indicar quando o browser guardou a resposta, não quando o fornecedor observou o dado.
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

Um workflow separado, agendado diariamente e executável manualmente, verifica a página publicada e os doze recursos locais críticos, e corre um smoke test Chromium sem depender dos fornecedores de dados externos. Para repetir a verificação HTTP noutro endereço: `DASHBOARD_URL=https://exemplo.test/ npm run check:published`.

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
- `src/` — helpers de cache/fetch/UI, contexto do calendário de Lisboa, briefing Portugal, módulos de cards e widgets, incluindo combustíveis e relógios dos mercados
- Os helpers partilhados em `src/cache.js`, `src/fetch.js` e `src/ui.js`, e os pontos de entrada dos cards em `src/cards/`, usam JSDoc para documentar parâmetros, resultados e comportamento relevante.
- `src/cards/gas-markets.js` contém os cards TTF e gás PT; o segundo reutiliza a cache TTF, validada antes de alimentar a estimativa MIBGAS.
- `dev_server.py` — servidor dev com proxy CORS local
- `worker/` — gateway serverless opcional para fontes com validação, cache na edge e contingência stale identificada
- `scripts/check-published-site.mjs` — smoke check da publicação GitHub Pages e dos recursos críticos
- `ROADMAP.md` — plano de evolução e histórico recente
- `package.json` — dev dependencies (ESLint, html-validate)
- `eslint.config.js` — configuração ESLint (flat config)
- `.htmlvalidate.json` — regras de validação HTML
- `.github/workflows/ci.yml` — pipeline CI
