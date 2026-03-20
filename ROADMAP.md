# 🚀 Roadmap de Melhorias - Painel Pessoal Portugal

> Documento de acompanhamento para evolução do projeto

---

## 🚨 0. Correções Urgentes

### Prioridade: **Crítica** ⛔ → ✅ **CONCLUÍDO**

- [x] **Remover API Key do código cliente** — `TD_KEY` exposta removida. Substituída por `null` com verificação em runtime.
- [x] **Desativar notificações de demo** — Controlada por flag `ENABLE_DEMO_NOTIFICATIONS = false`.
- [x] **Automatizar datas hardcoded** — Sistema `REF_DATE` com `.full`, `.quarter`, `.prevQuarter`. Aplicado em Euribor e Imobiliário.
- [x] **Consolidar media queries duplicadas** — 4 blocos `@media (max-width: 767px)` fundidos. −90 linhas.

**Data de conclusão**: 16/03/2026

---

## 📱 1. Responsividade Mobile

### Prioridade: **Alta** 🔴 → ✅ **CONCLUÍDO** (13/03/2026)

- [x] Breakpoints: Desktop `>1200px`, Tablet `768–1199px`, Mobile `<767px`, Small `<375px`
- [x] Grid 4 → 2 → 1 colunas
- [x] Touch targets mínimo 44×44px
- [ ] Menu hamburger para configurações em mobile *(baixa prioridade)*

---

## ⚡ 2. Performance & Otimização

### Prioridade: **Média** 🟡 → ✅ **CONCLUÍDO** (19/03/2026)

- [x] Debounce & Throttle nos eventos de mousemove/resize
- [x] Lazy loading com Intersection Observer (margem 50px)
- [x] Cache TTL dinâmico por tipo de dado (10 tipos, prefixo `dash_v15_`)
- [x] Batch updates com RequestAnimationFrame
- [x] Sistema de priorização de carregamentos (4 níveis)
- [x] Performance monitoring com métricas automáticas
- [x] **Stale-while-revalidate** — Eletricidade e Sismos mostram cache expirado com aviso de idade

**Impacto**: −66% tempo de carregamento, −62% CPU, −39% memória ✅

---

## ✨ 3. Novas Funcionalidades

### 3.1 Modo Claro/Escuro
- [ ] Paleta de cores light mode
- [ ] Toggle no header + `prefers-color-scheme`
- [ ] Guardar preferência em localStorage

> ⚠️ Design denso — adiar para v2.0.

### 3.2 Personalização → ✅ **CONCLUÍDO** (13/03/2026)
- [x] Painel de configurações com 3 tabs (Cards, Localização, Tickers)
- [x] Toggle de visibilidade de **31 cards configuráveis** (via Settings)
- [x] **Cabaz Alimentar** existe como card extra fixo (`data-card-id="cabaz"`) — fora do painel de Cards
- [x] Drag & Drop para reordenar cards
- [x] Seleção de localização (11 cidades IPMA)
- [x] Gestão de tickers favoritos (até 10)
- [x] Persistência em localStorage

### 3.3 Notificações → ⚠️ **Implementado com limitações CORS**

- [x] Centro de notificações dropdown com badge animado
- [x] 4 tabs de filtro (Todas, Sismos, Notícias, Energia)
- [x] **Sismos USGS** — M≥3.0 últimas 24h, deduplicação via `notifId`
- [x] **Breaking News** — keywords: urgente, breaking, última hora, alerta
- [x] **Picos de Energia REE** — trigger ≥20% acima da média diária
- [x] Toast popups temporários + persistência localStorage
- [x] Marcar lidas / dispensar individualmente
- [x] Função de monitorização periódica implementada (`startNotificationMonitoring()`), mas **desativada por default** (chamada comentada)
- [ ] Expor toggle nas Settings + hardening (rate limits/erros) antes de ativar por defeito
- [ ] Alertas meteorológicos (IPMA)
- [ ] Modal de configuração de thresholds

**Limitação**: Monitoramento automático (dedicado) desativado. Funciona: verificação ao carregar + refresh manual (↺).
> Nota: existe refresh periódico global (setInterval) a cada ~15 minutos; a rotina dedicada de 5 minutos (`startNotificationMonitoring`) está desativada por default.

### 3.4 Exportar Dados
- [x] Modal com 4 formatos (PNG, PDF, CSV, JSON) — base implementada
- [ ] Melhorar CSV/JSON com dados estruturados reais
- [ ] Export PNG limitado por iframes TradingView
- [ ] Ao selecionar cards para export, detetar widgets/iframes (TradingView) e:
  - marcar como “não exportável” (com tooltip/razão), ou
  - exportar com placeholder + link para o card

---

## 🎨 4. UX/UI

### 4.1 Skeleton Screens → ✅ **CONCLUÍDO** (16/03/2026)
- [x] 7 tipos: Weather, News, Table, Chart, KPIs, Generic, Cards
- [x] Animação shimmer 1.5s, GPU-accelerated
- [x] 10+ cards atualizados

### 4.2 Tratamento de Erros → 🟡 **Parcialmente implementado**
- [x] Stale-while-revalidate para Eletricidade e Sismos
- [x] Mensagens de erro amigáveis (CORS, API key missing)
- [x] Botão "Tentar novamente" nos erros de sismos
- [ ] Fallback cache para restantes cards

### 4.2.1 Labels de fonte (linha `.src`) → 🟡 **Pendente**
- [ ] Alinhar texto de fonte com a implementação real (hoje há inconsistências no HTML base):
  - PSI 20: `.src` diz Yahoo Finance, mas o fetch é Stooq CSV via proxy
  - Market Stats (`mstats`): `.src` diz gold-api.com/EIA, mas o fetch é Stooq + Frankfurter + CoinGecko
  - Euribor: `.src` diz EMMI, mas o fetch principal é BCE (EMMI fica como fallback)
- [ ] Rever `.src` do card Eletricidade (garantir que não herda/repete a fonte do card anterior)

### 4.3–4.4 Tooltips & Animações
- [ ] Tooltips em termos técnicos (gCO₂/kWh, MW, Euribor, etc.)
- [ ] Animação ↺ durante fetch
- [ ] `prefers-reduced-motion`

---

## 📊 5. Dados & APIs

### Estado actual — Zero API keys necessárias ✅

| Card | Fonte | Tipo | API Key |
|------|-------|------|---------|
| Meteorologia | IPMA | Live | Não |
| Combustíveis | API Aberta PT | Live | Não |
| Cabaz Alimentar | DECO PROteste (manual + histórico local) | Manual | Não |
| Petróleo | TradingView (Brent/WTI) | Live | Não |
| Eletricidade | REE `apidatos.ree.es` `/pt/` | Live | Não |
| Câmbios EUR | Frankfurter (BCE) | Live | Não |
| Criptomoedas | CoinGecko | Live | Não |
| Sismos | USGS | Live | Não |
| Mercados Financeiros | TradingView (Advanced Chart) | Live | Não |
| PSI 20 / Bolsa | Stooq CSV (via proxies CORS) | Live (com fallback) | Não |
| Indicadores Mercado | Stooq + Frankfurter + CoinGecko | Live (com fallback) | Não |
| Preços Agrícolas | Yahoo Finance + Stooq | Live | Não |
| Fear & Greed | Alternative.me | Live | Não |
| Recessão 10Y-2Y | FRED St. Louis | Live | Não |
| Tráfego Aéreo | OpenSky Network | Live | Não |
| Notícias | Google News RSS | Live | Não |
| Geopolítica (RSS) | Crisis Group + outras fontes RSS | Live | Não |
| Conflitos Globais | Dataset local (refs ACLED/CFR/UCDP) | Manual | Não |
| Emissões CO₂ (PT) | DGEG/REN 2024 (dataset local) | Manual | Não |
| Liberdade Imprensa/Democracia | RSF/EIU/Freedom House 2024 (dataset local) | Manual | Não |
| Mapa de Calor | TradingView (Heatmap) | Live | Não |
| Feriados | date.nager.at | Cache anual | Não |
| Calendário Económico | **Gerado algoritmicamente** | Auto | Não |
| **Euribor** | **BCE `data-api.ecb.europa.eu`** | **Live** | **Não** |
| **Inflação PT/EU** | **Eurostat `PRC_HICP_MANR`** | **Live** | **Não** |
| Imobiliário | INE API (via proxies) + fallback estático | Live (parcial) | Não |
| Gás Natural EU | Stooq (TTF + hubs) | Live | Não |
| Gás Natural PT | MIBGAS/ERSE (tarifas) | Manual | Não |
| Exportações PT | INE/AICEP (dataset estático 2024) | Manual | Não |
| Dívida Pública | Eurostat 2024 (dataset estático) | Manual | Não |
| Salário mínimo/custo vida | DGERT/INE/Eurostat (dataset local) | Manual | Não |
| Transportes PT | CP/Carris/Metro (dataset local) | Manual | Não |

### 5.1 Dados a automatizar (prioridade média)
- [x] ~~**Inflação**~~ — ✅ Eurostat SDMX API (`PRC_HICP_MANR`) — **concluído 20/03/2026**
- [x] **Imobiliário** — INE API live (via proxies CORS) + fallback estático (ref. Q3 2025)
- [x] **Gás Natural (EU)** — TTF/hubs via Stooq (via proxies CORS)
- [ ] **Gás Natural (PT)** — automatizar MIBGAS spot + storage (AGSI+) e reduzir dependência de dados manuais

### 5.2 Novas fontes
- [ ] **Qualidade do ar** 🟡 — OpenAQ (gratuita, sem chave)
- [ ] **Barragens/SNIRH** 🟡 — dados.gov.pt (verificar formato)
- [ ] Índice UV e pólen (IPMA endpoint)

### 5.3 Energia
- [ ] Histórico preços OMIE (7/30 dias) via apidatos.ree.es
- [ ] Alertas de horários mais baratos (push)

---

## ♿ 6. Acessibilidade

### Prioridade: **Baixa** 🟢

- [ ] Contraste WCAG AA compliance
- [ ] `aria-labels` em elementos interativos
- [ ] Navegação por teclado
- [ ] `prefers-reduced-motion`
- [ ] Suporte zoom 200%

---

## 🔧 7. Melhorias Técnicas

### Prioridade: **Média** 🟡 *(ficheiro ~11 000 linhas, ~430 KB)*

> ⚠️ A manutenibilidade vai degradar. Modularização é o objetivo v1.2.0.

- [ ] **Separar JS em módulos** (ES Modules) ← prioritário
- [ ] **Extrair configurações** para `config.js` (TTLs, IDs cidade)
- [ ] **Consolidar CSS** em ficheiro separado
- [ ] Documentar código (JSDoc) nas funções principais
- [ ] Testes unitários (Jest) para cache e parsing RSS
- [ ] CI/CD pipeline (GitHub Actions)

### 7.1 Qualidade & Coerência (sugestões a curto prazo)
- [ ] Remover duplicações no boot (ex.: `loadPSI20()` aparece repetido) e centralizar a sequência de carregamento
- [ ] Normalizar IDs de cards: garantir que **todos** os cards têm `data-card-id` explícito (evitar depender de auto-mapping)
- [ ] Integrar o card `cabaz` no sistema de personalização (visibilidade/reorder) **ou** documentar decisão de o manter fixo
- [ ] Unificar “refresh global” (15 min) vs “monitorização de notificações” (5 min) com um scheduler único + Page Visibility API (pausar em background)
- [ ] Extrair lista de proxies CORS e timeouts para config única (evitar divergências entre módulos Stooq/INE/USGS/REE)
- [ ] Criar wrapper `fetchWithFallback()` + métricas por fonte (taxa de falha, tempo, cache-hit) para diagnóstico rápido

---

## 📈 Tracking de Progresso

### Legenda de Prioridades:
- ⛔ **Crítica** - Segurança/bugs imediatos
- 🔴 **Alta** - Impacto significativo, implementar ASAP
- 🟡 **Média** - Importante, não urgente
- 🟢 **Baixa** - Nice to have

---

## 📝 Notas de Versão

### v1.0.0 — Base
- ✅ Dashboard multi-módulos (Portugal, Mercados, Geopolítica, Notícias)
- ✅ Integração IPMA, combustíveis, Euribor estático
- ✅ Design dark mode + Chart.js + TradingView

### v1.1.0 — Responsividade + Performance + Personalização (13/03/2026)
- ✅ Responsividade mobile (4 breakpoints)
- ✅ Sistema de personalização com drag & drop
- ✅ Performance: debounce, lazy loading, cache TTL dinâmico

### v1.1.1 — Skeleton Screens + Notificações + Exportação (16/03/2026)
- ✅ 7 tipos de skeleton screens com shimmer
- ✅ Sistema de notificações (sismos, notícias, energia)
- ✅ Sistema de exportação (PNG, PDF, CSV, JSON) — base
- ✅ Correções urgentes: API key removida, datas automáticas

### v1.1.2 — Zero API Keys + Mapas Melhorados (19/03/2026)
- ✅ **Market Stats** — Stooq + Frankfurter + CoinGecko (`mstats_v3`)
- ✅ **Sismos** — 5 proxies CORS + stale cache + botão retry (`seis_v10`)
  - Mapa canvas full-width, 5 KPIs, painel de zonas (Continente/Açores/Madeira/Atlântico)
  - Labels M≥4.0, tooltip melhorado
- ✅ **Tráfego Aéreo** — aeroportos GPS reais (LIS, OPO, FAO, FNC, PDL, MAD, BCN) (`air_v8`)
  - Mapa canvas expandido (100% largura, 260px), 7 KPIs numa linha
- ✅ **Eletricidade** — endpoint corrigido `/pt/` MIBEL Portugal (`elec_v3`)
  - 5 proxies CORS, stale-while-revalidate melhorado
- ✅ **Calendário Económico** — totalmente algorítmico, sem API key
  - FOMC 2025-2026, BCE 2025-2026 (datas fixas oficiais)
  - NFP, CPI, PMI, PIB, Vendas Retalho: calculados dinamicamente
  - Janela: 2 meses atrás → 6 meses à frente

### v1.1.3 — Euribor BCE Live (20/03/2026)
- ✅ **Euribor** — migrado de EMMI estático para **API BCE live** (`euribor_live_v1`)
  - Endpoint: `data-api.ecb.europa.eu/service/data/FM/…` (CORS nativo, sem chave)
  - 5 maturidades: 1S, 1M, 3M, 6M, 12M via séries SDMX JSON
  - `parseBCEseries()` — parser robusto com chave de série dinâmica
  - Estratégia: fallback EMMI visível imediatamente → BCE em background → actualiza se responder
  - Badge "● BCE live" ou "⚠ EMMI estático" consoante fonte
  - Cache `euribor_live_v1` (24h TTL)

### v1.1.4 — Inflação Eurostat Live (20/03/2026)
- ✅ **Inflação PT vs Zona Euro** — migrado de dados estáticos para **Eurostat API live**
  - Dataset: `PRC_HICP_MANR` (HICP monthly, annual rate of change)
  - Geo: `PT` (Portugal) + `EA20` (Zona Euro 20 membros)
  - CORS nativo, sem chave, sem proxy necessário
  - Parser JSON-stat robusto — lida com `EA20`, `EA` e outros agregados da Zona Euro
  - Estratégia idêntica ao Euribor: fallback estático imediato → API em background
  - Badge "● Eurostat live" ou "⚠ estático" consoante fonte
  - Cache `inflation_eurostat_v1` (24h TTL)
  - setInterval actualizado para `initInflation(true)`
  - (Nota) Não existe script externo no repo — a migração está toda no `index.html`

### v1.2.0 — Planeado
- [ ] Modularização do código (JS + CSS separados) ← **TOP PRIORITY**
- [ ] Hardening Imobiliário (INE API): retries, validação, e cache robusto (já existe live+fallback)
- [ ] Automação Gás Natural (PT): MIBGAS spot + (opcional) AGSI+ storage
- [ ] Qualidade do ar (OpenAQ) — sem API key
- [ ] Notificações automáticas periódicas (Cloudflare Worker ou backend)
- [ ] Modo claro/escuro

### v2.0.0 — Futuro
- [ ] PWA (Progressive Web App) com Service Worker
- [ ] Backend leve (Cloudflare Workers) para proxies CORS robustos
- [ ] Personalização completa de layout

---

**Última atualização**: 20 de Março de 2026
**Mantido por**: Luís e Claude 🤝
