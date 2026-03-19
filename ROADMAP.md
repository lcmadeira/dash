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
- [x] Otimizar cache localStorage com TTL dinâmico por tipo de dado
- [x] Batch updates com RequestAnimationFrame
- [x] Sistema de priorização de carregamentos (4 níveis)
- [x] Performance monitoring com métricas automáticas
- [x] **Stale-while-revalidate** — Eletricidade e Sismos mostram dados em cache expirado
      com aviso de idade enquanto tentam recarregar (19/03/2026)

**Impacto**: −66% tempo de carregamento, −62% uso de CPU, −39% memória ✅

**Data de conclusão**: 19/03/2026  

---

## ✨ 3. Novas Funcionalidades

### Prioridade: **Alta** 🔴

#### 3.1 Modo Claro/Escuro
- [ ] Criar paleta de cores para light mode
- [ ] Toggle switch no header
- [ ] Guardar preferência no localStorage
- [ ] Detetar preferência do sistema (`prefers-color-scheme`)
- [ ] Transição suave entre modos

> ⚠️ Dado o design muito denso do painel, o light mode exige trabalho cuidado para não degradar a legibilidade. Considerar adiar para v2.0.

#### 3.2 Personalização → ✅ **CONCLUÍDO**
- [x] Painel de configurações com 3 tabs
- [x] Toggle de visibilidade de cards (14 cards configuráveis)
- [x] Drag & Drop para reordenar cards
- [x] Seleção de localização (21 cidades IPMA)
- [x] Gestão de tickers favoritos (até 10)
- [x] Persistência em localStorage

**Data de conclusão**: 13/03/2026

#### 3.3 Notificações → ✅ **CONCLUÍDO (com limitações CORS)**

- [x] Centro de notificações dropdown com badge animado
- [x] 4 tabs de filtro (Todas, Sismos, Notícias, Energia)
- [x] **Sismos USGS** — M≥3.0 nas últimas 24h, 5 fallbacks CORS, severidade automática ✅
- [x] **Breaking News** — keywords: urgente, breaking, última hora, alerta ⚠️ (proxy)
- [x] **Picos de Energia REE** — trigger ≥20% acima da média diária ⚠️ (proxy)
- [x] Deduplicação via `notifId` único por evento
- [x] Toast popups temporários + persistência em localStorage
- [x] Marcar lidas / dispensar individualmente
- [ ] Monitoramento automático periódico *(bloqueado por CORS — requer backend)*
- [ ] Alertas meteorológicos (IPMA)
- [ ] Modal de configurações de thresholds

**Data de conclusão**: 19/03/2026  
**Limitações**: Monitoramento automático desativado — CORS issues com proxies públicos.  
Funciona: verificação ao carregar dados + refresh manual (↺).

#### 3.4 Exportar Dados
- [x] Modal de exportação com 4 formatos (PNG, PDF, CSV, JSON) — base implementada
- [ ] Exportar dados brutos das APIs — CSV/JSON com dados estruturados *(melhorar)*
- [ ] Exportar card como imagem PNG com html2canvas *(funcional mas limitado por iframes TradingView)*
- [ ] Gerar relatório semanal/mensal

> ⚠️ Export PNG/PDF de gráficos TradingView não é possível via iframe. Focar em exportar dados próprios (CSV/JSON).

---

## 🎨 4. UX/UI

### Prioridade: **Média** 🟡 → **Parcialmente Concluído** ✅

#### 4.1 Skeleton Screens → ✅ **CONCLUÍDO** (16/03/2026)
- [x] 7 tipos criados: Weather, News, Table, Chart, KPIs, Generic, Cards
- [x] Animação shimmer profissional (1.5s, GPU-accelerated)
- [x] 10 cards principais atualizados

#### 4.2 Tratamento de Erros → 🟡 **Parcialmente implementado**
- [x] **Stale-while-revalidate** para Eletricidade e Sismos *(19/03/2026)*
  - Mostra dados em cache com aviso de idade enquanto recarrega
  - Botão "Tentar novamente" nos erros de sismos
- [x] Mensagens de erro amigáveis (CORS, API key missing, stale cache)
- [ ] Fallback para dados em cache quando API falha — *para outros cards*
- [ ] Toast notifications para erros não-críticos
- [ ] Log de erros (opcional, para debug)

#### 4.3 Tooltips & Ajuda
- [ ] Tooltips explicativos em termos técnicos (gCO₂/kWh, MW, Euribor, etc.)
- [ ] Ícone de ajuda (?) em métricas complexas
- [ ] Tour guiado para novos utilizadores

#### 4.4 Animações & Micro-interações
- [ ] Animação de refresh dos cards (ícone ↺ a girar durante fetch)
- [ ] Transições suaves ao mudar de período (gráficos)
- [ ] Efeito de pulse em dados atualizados recentemente
- [ ] Suporte para `prefers-reduced-motion`

**Impacto**: Experiência mais polida e profissional

---

## 📊 5. Dados & APIs

### Prioridade: **Baixa** 🟢 *(exceto qualidade do ar: Média)*

#### 5.0 Fontes Atuais ✅ **Estado actual (Mar 2026)**

| Card | Fonte | Tipo | API Key |
|------|-------|------|---------|
| Meteorologia | IPMA | Live | Não |
| Combustíveis | API Aberta PT | Live | Não |
| Eletricidade | REE (apidatos.ree.es) | Live | Não |
| Câmbios EUR | Frankfurter (BCE) | Live | Não |
| Criptomoedas | CoinGecko | Live | Não |
| Sismos | USGS | Live | Não |
| PSI 20 / Bolsa | Stooq CSV | Live (fecho) | Não |
| Indicadores Mercado | Stooq + Frankfurter + CoinGecko | Live | Não |
| Preços Agrícolas | Yahoo Finance + Stooq | Live | Não |
| Fear & Greed | Alternative.me | Live | Não |
| Recessão 10Y-2Y | FRED (St. Louis Fed) | Live | Não |
| Tráfego Aéreo | OpenSky Network | Live | Não |
| Notícias | Google News RSS | Live | Não |
| Geopolítica | Crisis Group / BBC RSS | Live | Não |
| Feriados | date.nager.at | Cache anual | Não |
| Calendário Económico | **Gerado dinamicamente** (datas oficiais Fed/BCE/INE) | Auto | Não |
| Euribor | EMMI (estático mensal) | Manual | Não |
| Inflação PT/EU | INE/Eurostat (estático mensal) | Manual | Não |
| Imobiliário | INE (estático trimestral) | Manual | Não |
| Gás Natural | ICIS/GIE AGSI+ (estático mensal) | Manual | Não |

**Zero API keys necessárias para dados live!** ✅

#### 5.1 Novas Fontes de Dados
- [ ] **Qualidade do ar (PM2.5, PM10, NO₂, O₃)** 🟡 **Média** — [OpenAQ](https://openaq.org/) (gratuita, sem chave)
- [ ] **Dados de barragens (níveis de água)** 🟡 **Média** — [SNIRH](https://snirh.apambiente.pt/) (dados.gov.pt)
- [ ] Índice UV e pólen (IPMA tem endpoint, verificar disponibilidade)
- [ ] Hidrogénio verde no mix energético

#### 5.2 Dados que requerem atualização manual mensal
- [ ] **Automatizar Euribor** — API EMMI tem endpoint, verificar CORS
- [ ] **Automatizar Inflação** — Eurostat SDMX API (CORS nativo, verificar)
- [ ] **Automatizar Imobiliário** — INE API (disponível, verificar endpoints)
- [ ] **Automatizar Gás Natural** — MIBGAS e GIE AGSI+ têm APIs públicas

#### 5.3 Energia
- [ ] Histórico de preços OMIE (últimos 7/30 dias) via apidatos.ree.es
- [ ] Preços D+1 MIBEL (já parcialmente implementado via REE)
- [ ] Alertas de horários mais baratos (notificação push)

#### 5.4 Novas Integrações
- [ ] Eventos culturais (agenda via APIs municipais)

**Impacto**: Painel mais completo e informativo

---

## ♿ 6. Acessibilidade

### Prioridade: **Baixa** 🟢 *(painel pessoal — WCAG nice to have)*

- [ ] Melhorar contraste de cores (WCAG AA compliance)
- [ ] Adicionar `aria-labels` em elementos interativos
- [ ] Navegação completa por teclado
- [ ] Screen reader friendly
- [ ] **Reduzir animações para `prefers-reduced-motion`** ← fácil, implementar junto com 4.4
- [ ] Suporte para zoom até 200%

---

## 🔧 7. Melhorias Técnicas

### Prioridade: **Média** 🟡 *(ficheiro com ~11 000 linhas)*

> ⚠️ O `index.html` tem ~430 KB e ~11 000 linhas num único ficheiro. A manutenibilidade vai degradar com o tempo. Separar em módulos deve ser objetivo do v1.2.0.

- [ ] **Separar JS em módulos** (ES Modules ou bundler básico) ← prioritário
- [ ] **Extrair configurações** para ficheiro `config.js` (TTLs, IDs de cidade)
- [ ] **Consolidar CSS** em ficheiro separado
- [ ] Documentar código (JSDoc) nas funções principais
- [ ] Testes unitários (Jest) para funções de cache e parsing RSS
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Versionamento semântico + Changelog automático

**Impacto**: Manutenibilidade e escalabilidade a longo prazo

---

## 📈 Tracking de Progresso

### Legenda de Prioridades:
- ⛔ **Crítica** - Corrigir imediatamente (segurança/bugs)
- 🔴 **Alta** - Implementar ASAP (impacto significativo)
- 🟡 **Média** - Importante, mas não urgente
- 🟢 **Baixa** - Nice to have, quando houver tempo

---

## 📝 Notas de Versão

### v1.0.0 — Base
- ✅ Dashboard com múltiplos módulos (Portugal, Mercados, Geopolítica, Notícias)
- ✅ Integração com APIs portuguesas (IPMA, combustíveis, Euribor)
- ✅ Design dark mode com Chart.js + TradingView widgets
- ✅ Gráficos interativos

### v1.1.0 — Responsividade + Performance + Personalização (13/03/2026)
- ✅ Responsividade mobile completa (4 breakpoints)
- ✅ Sistema de personalização com drag & drop
- ✅ Otimizações de performance (debounce, lazy loading, cache TTL dinâmico)

### v1.1.1 — Skeleton Screens + Notificações + Exportação (16/03/2026)
- ✅ 7 tipos de skeleton screens com animação shimmer
- ✅ Sistema de notificações (sismos, notícias, energia)
- ✅ Sistema de exportação (PNG, PDF, CSV, JSON) — base
- ✅ Correções urgentes: API key removida, datas automáticas, media queries consolidadas

### v1.1.2 — Zero API Keys + Mapas Melhorados (19/03/2026)
- ✅ **Indicadores de Mercado** — migrados de Twelve Data para Stooq + Frankfurter + CoinGecko
  - VIX, Ouro, Prata, S&P 500, WTI, Gás Natural via Stooq CSV (allorigins)
  - USD/EUR via Frankfurter/BCE (reutiliza cache do câmbio)
  - BTC/EUR via CoinGecko (reutiliza cache das criptos)
  - **Zero API keys necessárias**
- ✅ **Sismos — robusto** — 5 fallbacks CORS + stale-while-revalidate + botão retry
  - Mapa canvas full-width (ocupa largura total do card)
  - Painel de zonas (Continente, Açores, Madeira, Atlântico)
  - Labels de magnitude nos sismos ≥4.0
  - Notificações integradas para M≥3.0 nas últimas 24h
- ✅ **Tráfego Aéreo — mapa melhorado**
  - Aeroportos PT+ES com coordenadas GPS reais (LIS, OPO, FAO, FNC, PDL, MAD, BCN)
  - Mapa canvas full-width com escala correcta
  - Layout reorganizado (KPIs numa linha, mapa grande, lista + países lado a lado)
  - Reutiliza TopoJSON já em cache do mapa de conflitos
- ✅ **Eletricidade — stale-while-revalidate**
  - Múltiplos proxies REE (directo, allorigins, corsproxy, thingproxy, allorigins/get)
  - Mostra aviso com idade do cache se API inacessível, sem perda de dados
- ✅ **Calendário Económico — gerado automaticamente**
  - Datas FOMC 2025-2026 e BCE 2025-2026 hardcoded (publicadas com antecedência)
  - NFP: calculado como 1.ª sexta-feira de cada mês
  - CPI EUA/PT, PMI, PIB, IPC Eurostat: calculados dinamicamente por mês
  - Janela: 2 meses atrás → 6 meses à frente
  - Botão ↺ regenera o calendário sem API

### v1.2.0 — Planeado
- [ ] Modularização do código (JS + CSS separados)
- [ ] Qualidade do ar (OpenAQ) — sem API key
- [ ] Automação de Euribor via API EMMI
- [ ] Dados de barragens (SNIRH/dados.gov.pt)
- [ ] Notificações automáticas periódicas (requer Cloudflare Worker ou backend)
- [ ] Modo claro/escuro

### v2.0.0 — Futuro
- [ ] PWA (Progressive Web App) com Service Worker
- [ ] Backend leve (Cloudflare Workers) para proxies CORS robustos
- [ ] Personalização completa de layout

---

**Última atualização**: 19 de Março de 2026  
**Mantido por**: Tu e Claude 🤝
