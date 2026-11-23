# Painel Pessoal · Portugal

Dashboard pessoal (single-page) focado em Portugal, mercados e contexto global — funciona sem backend próprio e usa um gateway serverless para um conjunto limitado de fontes. Mantém cache local (`localStorage`) com TTL por tipo; envelopes inválidos ou com datas futuras são ignorados.

## O que inclui

- **Quatro secções com título**: *Portugal · dia a dia*, *Economia*, *Mercados* e *Mundo*. Cada card pertence a uma secção (`CARD_SECTIONS` em `src/app.js`); a ordem definida pelo utilizador nas definições é mantida dentro de cada secção.
- **Grelha em mosaico sem buracos** (`src/layout.js`): cada secção tem a sua grelha; no desktop são 6 colunas (card normal = 1/3, card largo `.s2` = 1/2, `.s3`/`.s4` = largura total), 2 colunas em tablet e 1 em telemóvel, sem overflow horizontal.
- **Sistema visual comum**: uma fonte (Inter, algarismos tabulares), tamanho mínimo ~11 px, cartões neutros e cor com significado (acento azul para dados/interação, verde/vermelho para subida/descida, âmbar para avisos; níveis oficiais IPMA para avisos e risco de incêndio). Os tokens estão no `:root` de `styles.css` e as regras comuns no bloco "Sistema visual v2" no fim do ficheiro.
- **Skeleton Screens & Shimmer**: Carregamento visual fluido com animações GPU-accelerated (60fps).
- **Personalização Instantânea**: Painel de settings (toggle cards, drag & drop dentro de cada secção, localização IPMA, tickers, **preferências de conforto visual e pesquisa em tempo-real**) aplicado em tempo-real **sem recarregar a página**.
- **Notificações** (centro + badge + persistência) — com limitações conhecidas de CORS. O alerta de preço da gasolina 95 é opcional, desligado por omissão, só considera observações até 72h e guarda apenas limite/estado/data do último aviso neste browser. Notificações do sistema pedem permissão após clique e só são avaliadas com o dashboard aberto; push com a página fechada requer Worker agendado e chaves VAPID configuradas.
- **Estado e idade dos dados por card**: badges compactos (ponto de cor + texto curto como "há 15m", "Referência", "Erro"); o texto completo, com fonte e data observada, fica no tooltip e no `aria-label`. Quando a fonte fornece uma data reconhecível, o tooltip distingue-a da gravação em cache. Envelopes inválidos ou com timestamps futuros não são apresentados como válidos.
- **Resumo de saúde dos dados**: numa linha recolhível por baixo de "Portugal hoje", agrega os cards disponíveis, a carregar e que precisam de atenção; permite saltar diretamente para cards com dados antigos, parciais, de referência ou erro. Quando os metadados existem, mostra também fonte e hora da observação. Para IPMA, combustíveis, câmbio, IHPC e Euribor, limites de idade da observação são avaliados separadamente da idade da cache local. O resumo regista a hora da última verificação e quantos cards reportam erro ou dados antigos; ausência de alertas não equivale a monitorização histórica da fonte.
- **Histórico local da saúde dos dados**: guarda até 30 resumos diários das visitas deste browser e mostra os últimos sete dias observados. Não faz sondagens em background, não sincroniza dispositivos e não mede disponibilidade contínua dos fornecedores.
- **Portugal hoje**: mostra primeiro os indicadores; estimativas, alertas e histórico local ficam num bloco recolhido. Síntese personalizável de observações recentes da previsão IPMA, gasolina 95 (com comparação PT/ES quando ambas as fontes são recentes), histórico do cabaz e, quando as fontes live estão disponíveis, IHPC Eurostat e Euribor BCE — sempre com data/fonte e sem tratar cache antiga como dado atual. As preferências ficam neste browser. Inclui uma estimativa opcional de custo mensal de gasolina baseada nos litros indicados na página; não persiste o consumo.
- **Alterações desde a visita anterior**: compara indicadores recentes com o último snapshot observado neste browser. Só compara observações atuais; o primeiro acesso cria a referência, guardada ao sair da página.
- **Alterações relevantes**: filtra diferenças pequenas com limites próprios por indicador (2 °C/20 pp na meteorologia, €0,01/L no combustível, €1 no cabaz, 0,1 pp no IHPC e 0,05 pp na Euribor); a comparação não é uma recomendação nem usa dados antigos como atuais.
- **Tendência local de Portugal**: guarda até 90 dias de observações diárias recentes de meteorologia, combustível, cabaz, IHPC e Euribor neste browser; mostra a diferença desde a observação local anterior e mantém fonte/data nos cartões. O histórico começa a acumular após a atualização e não sincroniza entre dispositivos.
- **Custos do agregado**: estimativa opcional baseada apenas nas compras e eletricidade introduzidas e no combustível calculado pelos litros mensais e por um preço recente. Mostra que percentagem estes custos representam do rendimento líquido indicado; não é um orçamento completo e não guarda os valores.
- **Contexto PSI 20**: distingue fim de semana/feriado, fora do horário normal e falta de cotação durante sessão; valores de referência permanecem ocultos. Quando há preços, o card indica a hora em que a consulta foi recebida (não a hora exata do negócio).
- **Eletricidade em Portugal**: preços do mercado diário OMIE na zona portuguesa, obtidos do ficheiro oficial `MARGINALPDBCPT`; períodos de 15 minutos são agregados em médias horárias e a janela mais barata é calculada sobre períodos consecutivos. O preço OMIE é grossista e não representa a fatura doméstica. O simulador opcional usa consumo e preços do contrato introduzidos pelo utilizador, guardados apenas neste browser, e identifica os encargos que exclui. A tendência é local e começa a acumular depois da atualização.
- **Pedidos de card sem duplicação simultânea**: PSI, cripto e geopolítica partilham a mesma operação quando carregamentos automáticos, lazy loading ou refresh coincidem.
- **Proveniência da cache**: gravações podem guardar fonte, estado (`live`, `partial`, `stale`, `static`, `fallback`) e hora observada. IPMA, combustíveis, câmbio, IHPC, Euribor, taxas BdP, notícias, qualidade do ar, Fear & Greed, spread 10Y−2Y (Tesouro dos EUA), sismos, TTF, agrícolas, barragens, cabaz, habitação e Proteção Civil registam metadados de origem; o tooltip distingue cache recente de observação recente e envelopes antigos continuam compatíveis.
- **Validade de referências estáticas**: EMMI, IHPC de referência, habitação, agricultura, spread 10Y−2Y e TTF têm fonte/período e limite de revisão em `STATIC_REFERENCE_POLICY` (usados só quando as fontes em direto falham); o resumo assinala referências que ultrapassam esse prazo.
- **Exportação** (PNG/PDF/CSV/JSON) — base implementada; PNG/PDF pode falhar em conteúdo em iframes (ex.: widgets TradingView).
- **Acessibilidade Profissional (WCAG AA)**: Contraste verificado, `aria-*` landmarks, foco visível por teclado e modais com focus trap.
- **UI Consistente**: Padronização de tabelas, footers, badges de estado, micro-interações e **scroll interno com headers sticky** em cards longos.
- **Gráficos históricos (7/30/90 dias)** em alguns módulos (ex.: eletricidade, TTF, PSI20, câmbio, gás PT e spread 10Y−2Y).
- **Monitorização em tempo-real**: Tráfego aéreo em direto sobre Portugal continental (ADS-B de adsb.lol pelo gateway `/v1/air`, atualizado no máximo de 3 em 3 min) com mapa interactivo em Canvas/TopoJSON; sem dados em direto o card diz-o, sem estatísticas antigas.
- **Combustíveis PT vs ES**: Comparação de preços entre Portugal e Espanha, com detalhe de postos, timestamps e preferências de combustível.
- **Estreito de Ormuz (simulação identificada)**: a conta pública da AISHub deixou de ser aceite em 2026 e não há fonte AIS gratuita estável; o card mostra uma simulação ilustrativa do tráfego, assinalada como "Simulação".
- **Barragens**: armazenamento das 12 bacias do boletim mensal SNIRH/APA, com média histórica do mês e total ponderado pela capacidade (`data/dams.json`, ver "Dados atualizados fora do browser"); sem fonte nem cache verificável, o card mostra indisponibilidade em vez de percentagens aproximadas.
- **Cabaz alimentar DECO PROteste**: valor semanal lido das notícias da Lusa por consenso de títulos (`data/cabaz.json`); entradas manuais (✏️) continuam possíveis e o valor automático prevalece na mesma semana.
- **Proteção Civil**: ocorrências ativas da ANEPC (meios terrestres/aéreos) e risco de incêndio rural do IPMA por distrito (1–5), com o distrito da cidade escolhida em destaque.
- **Avisos meteorológicos IPMA** no card da meteorologia (amarelo/laranja/vermelho para a área da cidade e contagem nacional) e **alertas da Carris Metropolitana** num separador do card de transportes (greves e cortes primeiro, filtro por concelho).
- **Mercados e macro em direto**: Euribor 1M/3M/6M/12M (médias mensais BCE) e próxima reunião do BCE pelo calendário oficial; taxas-chave BCE e taxa média do crédito à habitação (Banco de Portugal); IHPC Portugal/área do euro (Eurostat, ECOICOP v2); spread 10Y−2Y dos EUA (Tesouro dos EUA); TTF e futuros agrícolas (Yahoo Finance via gateway); habitação (INE, mediana dos últimos 12 meses).

## Stack / dependências

- **Single-page** em `index.html`, estilos em `styles.css` e JavaScript da aplicação em `src/` (sem bundler / sem build step)
- **Chart.js** via CDN
- **TradingView widgets** (ticker tape, advanced chart, heatmap)
- **Estratégia Anti-CORS**: fontes com CORS são pedidas diretamente; as restantes passam pelo gateway próprio (`worker/`) ou por `data/*.json` gerados fora do browser; os proxies públicos ficam como último recurso, com fallback automático; todos os cards passam pelos helpers partilhados, com no máximo dois pedidos simultâneos por proxy. Pedidos cancelados param a cadeia e falhas `401`/`403`, `408`, `429`, `5xx` e de rede ativam backoff partilhado durante a sessão da tab.
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

Opção 2 (recomendado para evitar problemas de fetch com `file://`; noutra porta se a 8000 estiver ocupada, ex.: `python3 -m http.server 8010`):

```bash
python3 -m http.server 8000
```

Depois abrir `http://localhost:8000`.

Opção 3 (recomendado se apanhares erros de CORS/429 em proxies públicos):

```bash
python3 dev_server.py
```

Depois abrir `http://localhost:8000` (a porta pode ser mudada com `PORT=8010 python3 dev_server.py`). O servidor liga apenas ao loopback da máquina, limita CORS a páginas locais, rejeita nomes DNS sem endereços públicos e inclui um endpoint `/proxy` para contornar CORS em desenvolvimento.

### Gateway de dados

`worker/` contém um Cloudflare Worker (`dash-data-gateway`) com rotas fixas; **nunca aceita URLs fornecidos pelo chamador** (os feeds e símbolos estão em listas no código). Valida a origem (`DASH_ORIGIN` em `worker/wrangler.toml` e `localhost`), envia `User-Agent` próprio, valida o formato das respostas, aplica limites de tamanho por rota e guarda respostas na cache da edge. Cada rota tem uma lista de fornecedores tentados por ordem e, se todos falharem, serve a última cópia válida (`_meta.state: "stale"`, `X-Dash-Cache: STALE`, `Warning: 110`) durante um prazo adequado aos dados.

Produção: `https://dash-data-gateway.luiscarlosmadeira.workers.dev` (`CFG.DATA_API_BASE`). Rotas (lista também em `/v1/status`):

| Rota | Fonte(s), por ordem | Cache · cópia de reserva |
|---|---|---|
| `/v1/air` | adsb.lol (aeronaves ADS-B em lat 36–44, lon −12 a −5, convertidas para vetores de estado ao estilo OpenSky; país pelo bloco ICAO). O adsb.fi recusa a Cloudflare (403) e o adsb.lol limita os IPs da Cloudflare (429), daí a cache de 3 min | 3 min · 15 min |
| `/v1/markets` | Yahoo Finance (query1 → query2): PSI 20 (`PSI20.LS`, com 3 meses de fechos), DAX, CAC 40, IBEX 35, FTSE 100, EURO STOXX 50 e 8 constituintes do PSI; fecho anterior = fecho diário anterior | 5 min · 4 dias |
| `/v1/indicators` | Yahoo Finance (query1 → query2): VIX, ouro (GC=F), prata (SI=F), S&P 500, WTI (CL=F) e gás natural (NG=F) | 5 min · 4 dias |
| `/v1/electricity?date=AAAA-MM-DD` | OMIE `MARGINALPDBCPT` (zona PT); dia ainda não publicado → `200 {published:false}` | 5 min · 1 dia |
| `/v1/news-pt` | RTP → Público → Google News | 5 min · 1 dia |
| `/v1/news-world` | BBC World → Google News | 5 min · 1 dia |
| `/v1/feed-icg`, `/v1/feed-gpf`, `/v1/feed-fa` | Crisis Group, Geopolitical Futures, BBC World (RSS) | 15 min · 2 dias |
| `/v1/geopolitics` | GDELT DOC | 1 h · 3 dias (responde com a cópia até 12 h e atualiza em segundo plano) |
| `/v1/crypto` | CoinGecko → Binance (`data-api.binance.vision`, pares EUR) | 90 s · 1 dia |
| `/v1/ttf` | Yahoo Finance `TTF=F` (só EUR), com série diária de 3 meses | 15 min · 7 dias |
| `/v1/agri` | Yahoo Finance: trigo, milho, soja, café, açúcar, algodão (`query1` → `query2`) | 15 min · 7 dias |
| `/v1/euribor` | BCE, médias mensais 1M/3M/6M/12M (`FM.M.U2.EUR.RT.MM.*.HSTA`; o BCE demora 16–25 s) | 12 h · 45 dias (cópia até 3 dias + atualização em segundo plano) |
| `/v1/dams` | SNIRH `tabelageral.php` → `data/dams.json` do site | 6 h · 45 dias (cópia até 3 dias + atualização em segundo plano) |

**Fornecedores que recusam pedidos da Cloudflare** (verificado em 20/11/2026): Google News (503), CoinGecko (403/429), SNIRH (403) e GDELT (429/timeout). Por isso as notícias usam RTP/Público/BBC primeiro, a rota de cripto passa para a Binance quando o CoinGecko recusa, e a rota `/v1/dams` lê `data/dams.json` (atualizado no portátil) quando o SNIRH recusa. A 23/11/2026 o SNIRH respondia 520 à Cloudflare.

**Deploy (manual):** um merge na `main` **não** publica o Worker. Correr o workflow **Deploy data gateway** (`gh workflow run "Deploy data gateway" --ref main`), que publica com Wrangler e verifica as rotas e o CORS. Usa os secrets de repositório `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (configurados); nunca os guardes no repositório. Alternativa local: `npx wrangler deploy --config worker/wrangler.toml`. O Wrangler mantém `workers.dev` ativo e desativa URLs de preview.

### Dados atualizados fora do browser (`data/*.json`)

Algumas fontes recusam servidores (Cloudflare e runners do GitHub) ou são demasiado lentas para o browser, mas respondem a um IP doméstico. Para estas, `scripts/update-data.mjs` corre os atualizadores e escreve ficheiros estáticos que o GitHub Pages serve no mesmo domínio:

| Ficheiro | Script | Fonte | Frequência da fonte |
|---|---|---|---|
| `data/dams.json` | `scripts/update-dams.mjs` | SNIRH/APA, boletim mensal de albufeiras (mesmo leitor que o Worker) | mensal |
| `data/cabaz.json` | `scripts/update-cabaz.mjs` + `scripts/lib/cabaz-news.mjs` | notícias Lusa sobre o boletim DECO PROteste (Google News RSS) | semanal (quartas) |
| `data/imob.json` | `scripts/update-imob.mjs` + `scripts/lib/ine-imob.mjs` | INE, indicador 0012234 (mediana das vendas por m², últimos 12 meses) | trimestral |

- Cada atualizador só reescreve o ficheiro quando os dados mudam e uma falha não impede os outros.
- **Cabaz:** um valor semanal só é aceite se ≥2 jornais derem o mesmo valor sem empate, ou se a variação anunciada num título bater certo, ao cêntimo, com a semana anterior conhecida; uma semana em falta pode ser calculada pela variação da seguinte; saltos > 15 € são rejeitados.
- **Execução:** cron diário no portátil do mantenedor (`20 10 * * * ~/scripts/dash-update-dams.sh`), que usa uma cópia própria do repositório em `~/.local/share/dash-dams-repo`, corre `node scripts/update-data.mjs` e faz commit/push de `data/` para a `main` só quando há alterações (registo em `~/.local/state/dash-update-dams.log`). Para acrescentar uma fonte nova basta juntá-la à lista em `scripts/update-data.mjs`.
- Manualmente: `node scripts/update-data.mjs` (ou um dos scripts individuais) e fazer commit dos ficheiros de `data/` alterados.

### Cache e consola do browser

O estado dos dados e o resumo “Portugal hoje” usam uma hierarquia tipográfica mais legível, contagens agrupadas e cartões de observação com maior contraste, preservando os mesmos dados e controlos. Os estados continuam identificados por cor e texto, e os cartões mantêm foco visível e adaptação a ecrãs pequenos.

Os botões de vista **Tudo**, **Portugal**, **Economia**, **Mercados** e **Mundo** correspondem às secções e filtram os cards sem alterar a personalização guardada de ordem/visibilidade; a escolha fica no armazenamento local deste browser. O resumo de dados também mostra quantos estados já incluem fonte ou data observada. Estes indicadores são uma medida de cobertura de proveniência, não uma garantia de que a fonte esteja atualizada.

O GitHub Pages e o service worker guardam HTML, CSS e JavaScript por URL. **Ao alterar qualquer ficheiro `.css`/`.js` referenciado em `index.html`, atualiza o parâmetro `?v=`** e, nos `<script>` com `integrity="sha384-…"` (por exemplo `src/ui.js`, `src/layout.js`, `src/cards/civil-protection.js`), **recalcula o hash SRI**, senão o browser recusa o ficheiro. O script `python3 scripts/bump-asset-versions.py AAAAMMDD-N` faz as duas coisas para os ficheiros alterados face à `main`. Para confirmar uma publicação, faz uma atualização forçada (`Ctrl+Shift+R`). O HTML atual não declara recursos `preload`; ao investigar avisos desse tipo, verifica o URL completo, pois widgets e folhas de estilo externas também podem criar as suas próprias sugestões de carregamento.

Os widgets TradingView são montados quando se aproximam da área visível. As tabs do mapa de calor mantêm os widgets já visitados montados para evitar recarregamentos ao alternar entre mercados. Os embeds externos ainda podem emitir avisos de `preload` dentro dos seus próprios iframes quando carregam; esses recursos são geridos pelo TradingView. Os widgets são preparados a partir de elementos `<template>` e carregados com `IntersectionObserver`, seguindo a [orientação oficial do TradingView](https://www.tradingview.com/widget-docs/tutorials/iframe/lazy-loading/).

## Credenciais de APIs

A integração com a Twelve Data está desativada. Não coloques chaves API em `src/config.js`, `index.html` ou noutro ficheiro servido ao browser: qualquer visitante pode lê-las. Uma futura integração deve enviar pedidos através de um endpoint de backend que mantenha a credencial no servidor.

## Fontes de dados (alto nível)

O painel combina fontes públicas sem chave:

- **IPMA**: previsão (IDs `globalIdLocal` oficiais de `api.ipma.pt/open-data/distrits-islands.json`) e avisos meteorológicos; **date.nager.at** (feriados)
- **API Aberta** (`api.apiaberta.pt`, CORS para o site e `localhost`, 30 pedidos/min sem chave): combustíveis PT, catálogo sísmico do IPMA, taxas Banco de Portugal (BCE e crédito à habitação), Proteção Civil (ANEPC/fogos.pt e risco IPMA) e alertas da Carris Metropolitana; **MITECO/MINETUR** (combustíveis ES)
- **BCE** (Euribor, via gateway), **Eurostat** (IHPC `PRC_HICP_MINR`, ECOICOP v2), **Tesouro dos EUA** (curva diária, spread 10Y−2Y), **INE** (habitação 0012234), **SNIRH/APA** (barragens), **DECO PROteste via Lusa** (cabaz)
- **OMIE** (preços do mercado diário, zona portuguesa; ficheiros `MARGINALPDBCPT`)
- **CoinGecko**, **Stooq**, **Yahoo Finance** (mercados; TTF e agrícolas via gateway)
- **Open-Meteo (Air Quality / CAMS + UV)** (qualidade do ar), **adsb.lol** (ODbL, tráfego aéreo ADS-B)
- **USGS** (sismos, alternativa ao IPMA), **FRED** (spread, alternativa ao Tesouro)
- Notícias e geopolítica: RTP, Público, BBC, Crisis Group, Geopolitical Futures, Google News RSS e GDELT

Notas:

Dados fora do gateway e de `data/` continuam dependentes dos fornecedores e, em último recurso, de proxies públicos. Falhas mantêm estados de cache/fallback identificados; uma mensagem de fallback não representa uma cotação atual.

- Alguns endpoints recorrem a **proxies CORS públicos** (ex.: `allorigins`, `corsproxy`) apenas como último recurso e podem falhar por indisponibilidade/limites.
- **Séries que mudaram de endereço em 2026** (documentado para evitar regressões): Eurostat congelou `PRC_HICP_MANR` em dez/2025 (o IHPC passou a `PRC_HICP_MINR`, `unit=RCH_A`, `coicop18=TOTAL`); a chave da Euribor no BCE é `RT` e não `RT0`, e a Euribor a 1 semana foi descontinuada em 2018; o INE 0009494 parou em 2021 (usar 0012234); a FRED deixou de responder de forma fiável; a página do SNIRH passou a mapa (os dados estão em `tabelageral.php`); a conta pública da AISHub deixou de ser aceite; o Stooq não responde.
- A API Air Quality da Open-Meteo usa `nitrogen_dioxide`, `ozone` e `sulphur_dioxide` para os poluentes; o card converte estes campos para os nomes internos `no2`, `o3` e `so2`.
- O card PSI 20 tenta primeiro obter as cotações em lote da Stooq, usa Yahoo Finance para símbolos em falta e oculta os valores de referência quando os proxies não devolvem cotações atuais. A ligação oficial da Euronext permanece disponível como consulta alternativa.
- O card de geopolítica tenta o gateway para GDELT e para os feeds RSS (`/v1/feed-*`); quando o gateway está configurado mas indisponível, não repete a consulta GDELT no browser. O card de cripto tenta CoinGecko diretamente antes de recorrer a proxies.
- O card de eletricidade usa o ficheiro diário oficial OMIE `MARGINALPDBCPT` da zona portuguesa pelo gateway. O OMIE passou a publicar períodos de 15 minutos em outubro de 2025; a média diária e o gráfico usam agregação horária, enquanto a janela de três horas é calculada sobre os períodos originais. Horas de mercado são apresentadas no fuso CET/CEST (uma hora à frente de Portugal continental). O dia seguinte só existe depois da publicação OMIE (à tarde); até lá o card mostra "Ainda não publicado". O spot é grossista; não se infere a fatura nem se apresentam tarifas fixas hardcoded. O estimador doméstico calcula apenas o subtotal com os preços contratuais introduzidos localmente. Ver [preços OMIE](https://www.omie.es/pt/market-results/daily/daily-market/day-ahead-price) e [tarifas/horários ERSE](https://www.erse.pt/atividade/regulacao/tarifas-e-precos-eletricidade/).
- Euribor: a próxima reunião do BCE vem das datas oficiais em `src/widgets/economic-calendar.js` (`window.ECB_MEETING_DATES`); as "probabilidades de consenso" de `EURIBOR_FALLBACK.bceNext` são estáticas e só aparecem enquanto a reunião a que se referem for a próxima.
- Imobiliário: o preço (total/novos/existentes) é automático; transações e regiões NUTS III continuam como referência do 3.º trimestre de 2025, assinaladas como tal.
- Quando o gateway e os proxies não respondem, o card TTF usa o último ponto manual da série e identifica-o como referência estática. Os hubs secundários e as reservas europeias no card do gás são snapshots históricos de março de 2026; as tarifas ERSE 2025-2026 são referência histórica (o período regulatório terminou em outubro de 2026).
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

Um workflow separado, agendado diariamente e executável manualmente, verifica a página publicada e os treze recursos locais críticos (incluindo o card de eletricidade), e corre um smoke test Chromium sem depender dos fornecedores de dados externos. Para repetir a verificação HTTP noutro endereço: `DASHBOARD_URL=https://exemplo.test/ npm run check:published`.

### Executar lint localmente

```bash
npm ci --no-bin-links  # instalar versões fixadas no package-lock.json
npm run lint         # ESLint
npm run validate     # html-validate
npm run lint:py     # Ruff (requer Python)
npm test            # testes Node (cards, gateway, atualizadores de data/)
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Estrutura do repositório

- `index.html` — estrutura da página, das secções e dos cards, com referências aos estilos e scripts (`?v=` e SRI)
- `styles.css` — estilos globais; tokens de cor/tipografia no `:root` e regras comuns no bloco "Sistema visual v2" (fim do ficheiro)
- `src/app.js` — lógica principal, carregada como script clássico para manter compatibilidade com handlers inline; `CARD_SECTIONS` define a secção de cada card e o comentário `/* exported */` lista os globais usados pelo HTML
- `src/layout.js` — grelha em mosaico (alturas por `ResizeObserver`)
- `src/config.js` — configuração, referências estáticas (`STATIC_REFERENCE_POLICY`), IDs IPMA oficiais
- `src/cache.js`, `src/fetch.js`, `src/ui.js` — helpers partilhados (cache com TTL e proveniência, pedidos com fallback e `dataApiUrl`, badges e vistas), documentados com JSDoc
- `src/cards/` — um ficheiro por card (ex.: `civil-protection.js`, `euribor.js`, `dams.js`, `gas-markets.js` com TTF e gás PT); `src/widgets/` — relógios das praças e calendário económico
- `data/` — `dams.json`, `cabaz.json`, `imob.json`, gerados por `scripts/update-data.mjs` (não editar à mão, exceto para corrigir)
- `scripts/` — atualizadores de `data/` (`update-*.mjs`, `lib/`), `bump-asset-versions.py`, verificações da publicação e do gateway, smoke test em browser
- `worker/` — gateway Cloudflare (rotas, validação, cache na edge, contingência stale); `worker/wrangler.toml` com `DASH_ORIGIN`
- `dev_server.py` — servidor de desenvolvimento com proxy CORS local
- `tests/` — testes Node (`npm test`) e Python do servidor de desenvolvimento; `tests/fixtures/` com respostas reais de fontes (INE, Eurostat, Tesouro dos EUA, SNIRH, Google News)
- `ROADMAP.md` — plano de evolução e histórico
- `package.json`, `eslint.config.js`, `.htmlvalidate.json` — ferramentas de lint/validação
- `.github/workflows/` — `ci.yml` (CI), `published-smoke.yml` (verificação diária da publicação), `deploy-data-gateway.yml` (deploy manual do Worker)

