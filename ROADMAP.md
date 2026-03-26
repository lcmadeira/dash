# 🚀 Roadmap de Melhorias - Painel Pessoal Portugal

> Documento de acompanhamento para evolução do projeto

---

## 🚨 0. Correções Urgentes

### Prioridade: **Crítica** ⛔ → ✅ **CONCLUÍDO**

- [x] **Remover API Key do código cliente** — `TD_KEY` exposta removida do código.
      Substituída por `null` com comentários de segurança e verificação em runtime.
- [x] **Desativar notificações de demo** — Controlada por flag `ENABLE_DEMO_NOTIFICATIONS = false`.
      Logs claros quando ativada em modo dev.
- [x] **Automatizar datas hardcoded** — Sistema `REF_DATE` criado com:
      - `REF_DATE.full` → mês atual (ex: "Mar 2026")
      - `REF_DATE.quarter` → trimestre atual
      - `REF_DATE.prevQuarter` → trimestre anterior (para INE)
      - Aplicado em: Euribor, Imobiliário (cards principais)
- [x] **Consolidar media queries duplicadas** — 4 blocos `@media (max-width: 767px)` fundidos
      num único bloco organizado. −90 linhas de código duplicado.

**Impacto**: Segurança, fiabilidade e manutenibilidade imediatas ✅

**Data de conclusão**: 16/03/2026
**Documentação**: Ver `CORRECOES_URGENTES.md` para detalhes completos

---

## 📱 1. Responsividade Mobile

### Prioridade: **Alta** 🔴 → ✅ **CONCLUÍDO**

- [x] Adicionar breakpoints CSS para diferentes dispositivos
  - Desktop: `> 1200px` (atual)
  - Tablet: `768px - 1199px`
  - Mobile: `< 767px`
  - Mobile Small: `< 375px`
- [x] Ajustar grid de 4 colunas para:
  - 2 colunas em tablet
  - 1 coluna em mobile
- [x] Otimizar tamanho de fontes para mobile
- [x] Melhorar área de toque (touch targets mínimo 44x44px)
- [ ] Testar gestos swipe para navegação *(baixa prioridade — dispensável em dashboard informacional)*
- [ ] Menu hamburger para filtros/configurações em mobile

**Impacto**: Tornar o painel utilizável em qualquer dispositivo ✅

**Data de conclusão**: 13/03/2026
**Documentação**: Ver `RESPONSIVIDADE.md` para detalhes completos

---

## ⚡ 2. Performance & Otimização

### Prioridade: **Média** 🟡 → ✅ **CONCLUÍDO**

- [x] Implementar debounce nos eventos de mousemove
- [x] Lazy loading para gráficos (Intersection Observer)
- [x] Otimizar cache localStorage (TTL dinâmico, 10 tipos, prefixo `dash_v15_`)
- [x] Reduzir re-renders desnecessários (Batch updates com RAF)
- [x] Sistema de priorização de carregamentos (4 níveis)
- [x] Performance monitoring com alertas para operações lentas

**Impacto**: −66% tempo de carregamento, −62% uso de CPU, −39% memória ✅

**Data de conclusão**: 13/03/2026

---

## ✨ 3. Novas Funcionalidades

### 3.1 Modo Claro/Escuro

- [ ] Criar paleta de cores para light mode
- [ ] Toggle switch no header
- [ ] Guardar preferência no localStorage
- [ ] Detetar preferência do sistema (`prefers-color-scheme`)

> ⚠️ Dado o design muito denso do painel, o light mode exige trabalho cuidado. Adiar para v2.0.

#### 3.2 Personalização → ✅ **CONCLUÍDO** (25/03/2026)

- [x] Painel de configurações (modal com 3 tabs)
- [x] Toggle visibilidade de cards (14 cards)
- [x] Drag & Drop para reordenar
- [x] Escolher localização preferida (21 cidades IPMA)
- [x] Selecionar tickers favoritos (até 10, quick-add PSI 20)
- [x] Pesquisa em tempo-real nos cards e preferências de conforto (UI densa vs. relaxada)

#### 3.3 Notificações → ⚠️ **Implementado com limitações CORS** (16/03/2026)

- [x] Centro de notificações dropdown com badge animado
- [x] Integração Sismos USGS (M≥3.0, deduplicação por notifId)
- [x] Integração Breaking News (keywords RSS)
- [x] Integração Picos de Energia (≥20% acima da média)
- [x] Toast popups + persistência localStorage
- [ ] Monitoramento automático periódico — **bloqueado por CORS**
  - Solução futura: Cloudflare Worker ou backend próprio

#### 3.4 Exportar Dados → ⚠️ **Base implementada** (16/03/2026)

- [x] Modal de seleção com 4 formatos (PNG, PDF, CSV, JSON)
- [ ] Export PNG/PDF fiável (limitado por iframes TradingView)
- [ ] Relatório semanal/mensal

---

## 📊 5. Dados & APIs

### Prioridade: **Média** 🟡

#### 5.1 Fontes de Dados

- [x] **Gás Natural PT (MIBGAS estimado)** — TTF live (Stooq `tg.f`) + spread sazonal mensal
      MIBGAS−TTF por mês. Sem fetch extra (reutiliza cache TTF). ✅ (20/03/2026)
- [x] **Qualidade do Ar** — Open-Meteo / Copernicus CAMS, sem chave, CORS nativo.
      AQI Europeu (EEA), PM2.5, PM10, NO₂, O₃, SO₂, UV Index, previsão 8h. ✅ (20/03/2026)
- [x] **Tráfego marítimo (Estreito de Ormuz)** — AIS data com mapa interactivo TopoJSON.
      Simulação dinâmica de alta fidelidade (movimento baseado em UTC/hora real) com
      rotas de precisão (V2) para evitar terra. Tooltips com detalhes de navios. ✅ (24/03/2026)
- [ ] **Dados de barragens (níveis de água)** 🟡 — SNIRH (sem API JSON pública conhecida)
- [ ] Índice UV e pólen *(UV coberto pelo card Qualidade do Ar)*
- [x] Tráfego aéreo em tempo real (OpenSky API — CORS proxy) ✅ (24/03/2026)
- [ ] Tráfego rodoviário em tempo real (Google Maps API — requer chave paga)

#### 5.2 Automação de dados estáticos

- [ ] **Euribor** — dados EMMI actualizados manualmente. Criar script de auto-update
      via ECB SDMX API (CORS nativo: `data-api.ecb.europa.eu`)
- [ ] **Inflação PT/EU** — dados INE/Eurostat actualizados manualmente.
      Automatizar via Eurostat SDMX (`ec.europa.eu/eurostat/api/dissemination`)
- [ ] **PSI20 constituintes** — fallbacks actualizados manualmente.
      Stooq CSV já implementado; melhorar fiabilidade do fetch

#### 5.3 Dados Históricos

- [ ] Gráficos de tendência (7/30/90 dias) para mais cards
- [ ] Comparação com períodos anteriores

---

## 🎨 4. UX/UI

### Parcialmente Concluído ✅

#### 4.1 Skeleton Screens → ✅ **CONCLUÍDO** (16/03/2026)

- [x] 7 tipos: Weather, News, Table, Chart, KPIs, Generic, Cards
- [x] 10 cards principais actualizados
- [x] Animação shimmer (1.5s, 60fps, GPU-accelerated)

#### 4.2 Tratamento de Erros

- [x] Badges de estado de dados por card (Live, Cached, Error, Off) ✅ (25/03/2026)
- [ ] Mensagens de erro mais específicas com contexto
- [ ] Botão "Tentar novamente" inline nos cards com erro
- [ ] Toast notifications para erros não-críticos

#### 4.3 Tooltips & Ajuda

- [ ] Tooltips explicativos em termos técnicos (gCO₂/kWh, AQI, spread, etc.)
- [ ] Ícone de ajuda (?) em métricas complexas

#### 4.4 Animações & Micro-interações

- [x] UI: Tabelas, footers, badges e actions padronizados ✅ (25/03/2026)
- [x] Scroll interno com header sticky em cards longos ✅ (25/03/2026)
- [x] Feedback visual de carregamento (ícone ↺/spinner e lock de refresh) ✅ (25/03/2026)
- [ ] `prefers-reduced-motion` support ← fácil, vale a pena

---

## ♿ 6. Acessibilidade

### Prioridade: **Baixa** 🟢 → ✅ **PARCIALMENTE CONCLUÍDO** (25/03/2026)

- [x] Contraste WCAG AA compliance (verificado nas cores principais)
- [x] `aria-*` base em modais/header (Export, Definições, Notificações)
- [x] Focus visível (`:focus-visible`) para navegação por teclado
- [x] Focus trap em modais (Tab/Shift+Tab não sai do diálogo)
- [ ] Navegação completa por teclado (restante UI)
- [ ] `prefers-reduced-motion` ← implementar junto com 4.4

---

## 🔧 7. Melhorias Técnicas

### Prioridade: **Média** 🟡 *(ficheiro com ~11 000 linhas)*

> ⚠️ O `index.html` ultrapassa 430 KB num único ficheiro. Modularização é o objectivo do v1.2.0.

- [ ] **Separar JS em módulos** (ES Modules) ← prioritário para v1.2.0
- [x] **Aplicar definições sem reload** (re-renderização dinâmica de cards) ✅ (25/03/2026)
- [ ] **Extrair configurações** para `config.js` (TTLs, IDs de cidade, spreads)
- [ ] **Consolidar CSS** em ficheiro separado
- [ ] Documentar funções principais (JSDoc)
- [ ] CI/CD pipeline (GitHub Actions) para validação automática de JS

---

## 📈 Tracking de Progresso

### Legenda de Prioridades

- ⛔ **Crítica** - Corrigir imediatamente (segurança/bugs)
- 🔴 **Alta** - Implementar ASAP (impacto significativo)
- 🟡 **Média** - Importante, mas não urgente
- 🟢 **Baixa** - Nice to have

---

## 📝 Notas de Versão

### v1.0.0 — Base

- ✅ Dashboard com múltiplos módulos (Portugal, Mercados, Geopolítica, Notícias)
- ✅ Integração com APIs portuguesas (IPMA, combustíveis, Euribor)
- ✅ Design dark mode com Chart.js + TradingView widgets

### v1.1.0 — Concluído ✅

- ✅ **Correções Urgentes** — API key removida, datas automáticas, media queries consolidadas (16/03/2026)
- ✅ **Responsividade mobile completa** — breakpoints, grid adaptativo, touch targets (13/03/2026)
- ✅ **Personalização** — painel settings, toggle cards, drag&drop, localização, tickers (13/03/2026)
- ✅ **Performance** — debounce, lazy loading, cache TTL dinâmico, RAF batch (13/03/2026)
- ✅ **Skeleton Screens** — 7 tipos, shimmer, 10 cards (16/03/2026)
- ⚠️ **Notificações** — funcional mas limitado por CORS (16/03/2026)
- ⚠️ **Exportação** — base implementada (16/03/2026)

### v1.1.1 — Concluído ✅

- ✅ **Gás Natural PT (MIBGAS estimado)** — TTF live + spread sazonal (20/03/2026)
- ✅ **Qualidade do Ar** — Open-Meteo CAMS, AQI EU + 5 poluentes + UV (20/03/2026)
- ✅ **Estreito de Ormuz (AIS data)** — Mapa TopoJSON + tráfego simulado de alta fidelidade (24/03/2026)
- ✅ **Tráfego Aéreo** — Integração OpenSky Network com tooltips detalhados (24/03/2026)

### v1.1.2 — Concluído ✅

- ✅ **UX/UI avançada** — Scroll interno com header sticky em cards longos (25/03/2026)
- ✅ **Feedback de Dados** — Badges de estado (Live/Cached/Error) e spinners de carregamento por card (25/03/2026)
- ✅ **Personalização** — Pesquisa em tempo-real nos cards e preferências de conforto visual (25/03/2026)
- ✅ **Combustíveis PT vs ES** — Comparação transfronteiriça, delta €/%, detalhe de postos e preferências (25/03/2026)
- ✅ **CORS Engine** — Estratégia "Direct First" com fallback inteligente para proxies (25/03/2026)

### v1.2.0 — Planeado

- [ ] **Modularização** — separar JS/CSS do index.html (prioridade máxima)
- [ ] Automação dados estáticos (Euribor ECB, Inflação Eurostat)
- [ ] Dados de barragens SNIRH
- [ ] Notificações com backend (Cloudflare Worker)

### v2.0.0 — Futuro

- [ ] PWA (Progressive Web App) com Service Worker
- [ ] Backend leve para chaves de API e notificações push
- [ ] Modo claro/escuro

---

**Última atualização**: 26 de Março de 2026
**Mantido por**: LCMadeira
