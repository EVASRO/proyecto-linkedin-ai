# NEXUSAI — AUDITORÍA COMPLETA + ROADMAP DE MEJORAS
## Fecha: Junio 2026 | Versión auditada: V2.5

---

## OBJETIVO ORIGINAL DEL PROYECTO
NexusAI es un SaaS B2B "Todo en Uno" para automatización de prospección comercial en LinkedIn.
Compite directamente con **Waalaxy** y **Dripify**, buscando superarlos en UX/UI, IA y funcionalidad.

**Stack:** Next.js 16 + Supabase + Chrome Extension MV3 + FastAPI (Python) + Claude Sonnet 4.6

**Módulos:** Dashboard · Campañas · CRM Pipeline · Smart Inbox · Analítica · Inbound · Agentes IA · Perfil · Configuración · Equipo

---

## ESTADO ACTUAL — SEMÁFORO

| Módulo | Estado | Crítico |
|--------|--------|---------|
| Auth (Supabase SSR) | ✅ Funciona | — |
| Ghost Engine (extensión) | 🟡 Parcial | Sí |
| Scraper Sales Navigator | ✅ Funciona (132 leads) | — |
| Envío de conexiones | 🟡 Parcial | Sí |
| Actualización CRM post-conexión | 🟡 Parcial | Sí |
| CRM Kanban (drag & drop) | ✅ Funciona | — |
| CRM Lista | 🟡 Scroll roto | — |
| CRM sidebar fija | ❌ Roto | — |
| Campañas (crear/gestionar) | ✅ Funciona | — |
| Campaign stats en tiempo real | 🟡 Parcial | Sí |
| Smart Inbox | ✅ Carga datos | — |
| Autopilot IA (inbox) | 🟡 Existe, sin trigger real | Sí |
| Analítica | 🟡 Datos incorrectos | Sí |
| Inbound (monitor posts) | ✅ Funciona | — |
| Agentes IA | ✅ UI funciona | — |
| Perfil + Configuración | ✅ Funciona | — |
| Equipo | ❌ Placeholder | — |
| Backend FastAPI | 🟡 Existe, no integrado | Sí |
| full_name en leads | ❌ Texto LinkedIn basura | Sí |
| Kanban scroll por columna | ❌ Roto | — |
| Layout sidebar sticky | ❌ Roto | — |

---

## BUGS CONFIRMADOS (24 total)

### 🔴 CRÍTICOS — Motor de automatización

**BUG-01** `executeConnect` reporta `success:true` aunque el modal de conexión no se confirme
- Archivo: `extension-chrome/content.js` → función `executeConnect`
- Impacto: Leads marcados como `conexion_enviada` sin haber enviado la conexión real
- Fix: Verificar que el modal se cerró antes de reportar éxito *(prompt entregado)*

**BUG-02** Sin watchdog — `processing=true` se atasca forever si content.js no responde
- Archivo: `extension-chrome/background.js` → función `processTick`
- Impacto: Motor congelado indefinidamente tras cualquier falla de LinkedIn
- Fix: Watchdog de 60 segundos *(prompt entregado)*

**BUG-03** `handleActionDone` no garantiza liberar `processing` si hay excepción
- Archivo: `extension-chrome/background.js` → función `handleActionDone`
- Fix: Envolver en `try/finally` *(prompt entregado)*

**BUG-04** Fallo de conexión (botón no encontrado / límite diario) no tiene reintento
- Archivo: `extension-chrome/background.js`
- Fix: Reencolar con +5min o pausar engine *(prompt entregado)*

**BUG-05** `full_name` almacena texto de actividad LinkedIn
- Ejemplo: `"La última conexión de Eduardo Carreño fue Hace 36 minutos"` en vez de `"Eduardo Carreño"`
- Archivos: `extension-chrome/content.js` (scraper) + `CrmView.tsx` (cleanLinkedInName)
- Fix: Limpiar en `mapDbLead` + fix selectores del scraper *(prompt entregado)*

**BUG-06** `check_connection` no verifica si el perfil URL existe antes de navegar
- Archivo: `extension-chrome/background.js` → case `check_connection` en `executeTask`
- Impacto: Chrome navega a URL nula → error silencioso

**BUG-07** `executeMessage` no pasa `message_text` en el resultado a `handleActionDone`
- Archivo: `extension-chrome/content.js`
- Impacto: Mensajes enviados no se guardan en `conversations/messages`
- Fix: `safeSendMessage({ ..., message_text: text })` en executeMessage

### 🟠 IMPORTANTES — Analytics y datos

**BUG-08** Analytics queries `action_type` y `completed_at` de `engine_queue`
- Columnas correctas en DB: `task_type` y `executed_at` (no `action_type` / `completed_at`)
- Archivo: `src/app/dashboard/analytics/actions.ts` línea 24, 48, 51, 52
- Resultado: Actividad semanal siempre 0

**BUG-09** Campaign detail stats muestra ceros
- Archivo: `src/components/campaigns/CampanasClient.tsx`
- 3 bugs: `??` con 0, poll no actualiza `selected`, sin hidratación al abrir detalle
- Fix: *(prompt maestro entregado)*

**BUG-10** Campañas: `total_leads` no se actualiza al extraer leads del segmento
- Archivo: `extension-chrome/background.js` → `scrapeSegmentProfiles`

**BUG-11** Realtime de leads en CampanasClient ausente
- Archivo: `src/components/campaigns/CampanasClient.tsx`
- Fix: Subscription `postgres_changes` en tabla `leads` *(prompt entregado)*

### 🟡 MENORES — UI/Layout

**BUG-12** Lista CRM no scrollea horizontalmente
- Archivo: `CrmView.tsx` + `LeadsListView.tsx`
- Fix: Eliminar `overflow-hidden` en wrappers + `min-w-[1200px]` en tabla *(prompt entregado)*

**BUG-13** Kanban: scroll mueve todo el tablero en vez de solo la columna
- Archivo: `Board.tsx`
- Fix: `overflow-y-auto` en Droppable + `height: calc(100vh - 180px)` *(prompt entregado)*

**BUG-14** Sidebar no se mantiene visible al hacer scroll
- Archivo: `dashboard-shell.tsx`
- Fix: `h-screen overflow-hidden` en lugar de `min-h-screen` *(prompt entregado)*

**BUG-15** `check_connection` solo se encola para leads con >1 día enviados
- Debería verificar también leads recientes (>30min) para conexiones inmediatas

**BUG-16** RLS policies permissivas aplicadas solo a algunas tablas
- `extension_update_leads` existe pero `conversations` INSERT puede fallar

**BUG-17** Backend FastAPI en `localhost:8000` no está integrado al frontend
- El frontend llama a Next.js API routes (`/api/generate-message`) directamente
- El PRD describe endpoints `/api/engine/sync`, `/api/engine/status` que no se usan

**BUG-18** Autopilot trigger (`/api/autopilot/trigger`) requiere Supabase webhook configurado
- No hay documentación de cómo activar el webhook en Supabase Dashboard

**BUG-19** Analytics: `HEALTH_WARNINGS` hardcodeados con datos falsos
- Archivo: `AnalyticsView.tsx` líneas ~26-29
- Fix: Calcular leads en múltiples campañas desde DB

**BUG-20** `inbound_drafts` usa `localStorage` — datos se pierden entre sesiones
- Archivo: `InboundView.tsx`
- Fix: Guardar drafts en Supabase (`inbound_posts` tabla con `status: 'draft'`)

**BUG-21** Lead score siempre 0 — sin lógica de scoring implementada

**BUG-22** Popup extensión: no muestra tarea actual en tiempo real
- Falta: indicador de qué lead está procesando, último resultado
- Fix: `processing_task_type` + `last_action_log` en `getStatus()` *(prompt entregado)*

**BUG-23** CRM List: `connectionStatus` derivado incorrectamente
- `lead.crmColumn` vs `lead.status` — mapeo no consistente en `mapDbLead`

**BUG-24** No existe flow de onboarding — usuario nuevo ve dashboard vacío sin guía

---

## ROADMAP DE MEJORAS — FASE POR FASE

### FASE 0 — ESTABILIZACIÓN (En progreso)
*Bugs críticos del motor ya en fix. Aplicar prompts entregados.*

- [x] BUG-01: Fix executeConnect verificación real
- [x] BUG-02: Watchdog 60s en processTick
- [x] BUG-03: try/finally en handleActionDone
- [x] BUG-04: Reintento inteligente en fallo
- [ ] BUG-05: Limpiar full_name en scraper + mapDbLead
- [ ] BUG-09: Fix 3 bugs campaign stats
- [ ] BUG-12/13/14: Fix scrolls layout

---

### FASE 1 — MOTOR ROBUSTO (Semana 1)
*Asegurar que cada acción del Ghost Engine actualiza el CRM correctamente*

**1.1 Fix executeMessage en content.js**
Pasar `message_text` en el resultado ACTION_DONE para que se guarde en conversations/messages

**1.2 Fix full_name en el scraper**
En content.js, handler `NEXUSAI_SCRAPE_PROFILES`: extraer el nombre real del DOM con selectores específicos, no usar el texto de actividad. Selectores objetivo:
- `.artdeco-entity-lockup__title` → nombre real
- `[data-anonymize="person-name"]` → Sales Nav
- `h1.text-heading-xlarge` → LinkedIn perfil

**1.3 Fix Analytics actions.ts**
Cambiar `action_type` → `task_type` y `completed_at` → `executed_at` en la query de `engine_queue`

**1.4 check_connection inmediato**
Además del check >1 día, agregar check >2 horas para ver si se aceptó rápido.

**1.5 RLS audit completo**
Verificar que todas las tablas tienen políticas permisivas para la extensión:
leads, conversations, messages, engine_queue, activity_log, ghost_engine_sessions

**1.6 Autopilot webhook**
Documentar en README cómo activar el Supabase webhook hacia `/api/autopilot/trigger`
y agregar `AUTOPILOT_WEBHOOK_SECRET` al `.env.example`

---

### FASE 2 — UX/UI PREMIUM NIVEL WAALAXY+ (Semana 2)

**2.1 Dashboard — Centro de control real**

KPIs en tiempo real con Supabase Realtime:
- Conexiones enviadas hoy / esta semana / este mes
- Tasa de aceptación (%)
- Leads en conversación activa
- Reuniones agendadas este mes
- Ghost Engine status prominente con indicador LIVE
- Feed de actividad en tiempo real

Gráfico de funnel visual estilo Sankey o barras progresivas
Widget "Próximas acciones" con lista de tareas pendientes del engine

**2.2 Campañas — FlowBuilder profesional**

Actualmente: wizard básico + lista simple
Objetivo (Waalaxy level):
- Vista de secuencia visual con pasos conectados (ya existe React Flow)
- Cada paso muestra: tipo de acción + delay + condición de avance
- Edición inline de mensajes con variables {{nombre}}, {{empresa}}
- A/B testing: mostrar variante A vs B con tasa de apertura
- Templates de campañas predefinidas (SDR B2B, Reclutamiento, Consultoría)
- Botón "Duplicar campaña"
- Métricas por paso: enviados / aceptados / respondidos

**2.3 CRM — Pipeline premium**

- Columnas Kanban con scroll independiente *(en fix)*
- Vista Lista completa con todas las columnas *(en fix)*
- **Quick actions en hover**: enviar mensaje, ver perfil, cambiar etapa
- **Lead score visual**: badge con color según score (0-100)
- **Días en etapa**: alerta roja si >7 días sin avance
- **Bulk actions**: seleccionar múltiples leads → cambiar etapa, asignar tag, agregar a campaña
- **Vista Timeline**: ver todo el historial de contacto de un lead
- **Forecast view**: valor en pipeline por etapa (ya existe parcialmente)

**2.4 Smart Inbox — Centro de mensajes IA**

- Dividir pantalla: lista conversaciones (izq) + chat (der) + panel lead (der)
- Respuesta rápida con IA (1 clic genera respuesta)
- Filtros: sin leer / esperando respuesta / autopilot activo / urgentes
- Badge de notificación en sidebar con mensajes no leídos
- Detección automática de replies de LinkedIn (polling o webhook)
- Templates de respuesta rápida con categorías

**2.5 Analytics — Métricas reales**

Fix BUG-08 (task_type/executed_at) y agregar:
- Gráfico de barras semanal real (datos de engine_queue)
- Funnel de conversión con porcentajes reales
- Tasa de aceptación por campaña
- Mejor día/hora para conectar (heatmap)
- Leaderboard de campañas por ROI
- Export CSV de métricas

**2.6 Popup extensión — Control total**

- Indicador en tiempo real: "Enviando conexión a [Nombre]..."
- Últimas 5 acciones completadas
- Botón Reset si motor atascado
- Mini funnel del día: N conexiones / N mensajes / N aceptadas
- Alerta visual si límite diario cercano

---

### FASE 3 — FEATURES DIFERENCIADORES vs WAALAXY/DRIPIFY (Semana 3)

**3.1 IA Autopilot — Lo que nadie tiene**

Activar el autopilot para que Claude negocie automáticamente:
- Cuando prospect responde → Claude analiza intent → genera respuesta personalizada
- 3 modos: Manual (sugerencia) / Semi-auto (aprueba antes de enviar) / Full-auto
- Personalidad configurable por agente
- Log de decisiones IA en SmartInbox

**3.2 Lead Scoring automático**

Calcular score 0-100 basado en:
- Cargo (50 pts si es decision maker: CEO/VP/Director)
- Tamaño empresa (30 pts si >50 empleados)
- Engagement (20 pts si respondió o aceptó rápido)
- Actualizar en cada cambio de crm_column

**3.3 Variables dinámicas en mensajes**

Engine que reemplaza {{nombre}}, {{empresa}}, {{cargo}}, {{ubicacion}} antes de enviar.
Ya existe en los templates, falta implementar la sustitución en background.js

**3.4 Detección de replies en LinkedIn**

Nuevo `task_type: 'check_inbox'` que:
- Navega a linkedin.com/messaging
- Extrae mensajes no leídos
- Matchea con leads existentes por nombre/URL
- Si encuentra reply → crea mensaje inbound en DB → mueve lead a `en_conversacion`
- Dispara autopilot si está activado

**3.5 Multi-campaña sin spam**

Detector de leads duplicados entre campañas:
- Antes de enviar conexión, verificar si el lead ya está en otra campaña activa
- Si ya fue contactado en los últimos 30 días → saltar

**3.6 Inbound Lead Capture**

Cuando alguien comenta en un post tuyo de LinkedIn:
- content.js captura el perfil del comentarista
- Crea lead automáticamente en CRM con tag "Inbound comentario"
- Encola follow-up personalizado

---

### FASE 4 — PRODUCCIÓN Y ESCALA (Semana 4)

**4.1 Onboarding flow (primera vez)**

Pasos guiados para nuevo usuario:
1. Instalar extensión Chrome
2. Conectar cuenta LinkedIn (desde Perfil)
3. Crear primera campaña (wizard simplificado)
4. Ver demo del engine en acción

**4.2 Integrar Backend FastAPI**

- Mover scraping pesado (Playwright) al backend
- Agregar endpoint `/api/engine/sync` que recibe heartbeats de la extensión
- Usar backend para AI message generation (ya existe, solo redirigir)

**4.3 Email sequences (plan PRO)**

Integrar con Resend o SendGrid para enviar secuencias de email coordinadas con LinkedIn:
- Si lead no acepta en 5 días → enviar email de follow-up
- Trazabilidad completa en SmartInbox

**4.4 Multi-cuenta LinkedIn**

- Permitir múltiples `linkedin_accounts` por workspace
- Round-robin de cuentas para distribuir volumen
- Cada cuenta con sus propios límites diarios

**4.5 Billing + Plan gates**

- Integrar Stripe o Lemonsqueezy
- Gates por feature: límite de conexiones/mes, número de campañas, AI credits
- Dashboard de uso actual vs plan

**4.6 Team/Equipo**

- Invitar miembros del equipo
- Asignar leads a SDRs
- Panel de rendimiento por SDR

---

## COMPARATIVA vs COMPETENCIA

| Feature | Waalaxy | Dripify | NexusAI V2.5 | NexusAI Target |
|---------|---------|---------|---------------|----------------|
| Automation LinkedIn | ✅ | ✅ | ✅ | ✅ |
| Sales Navigator | ✅ | ✅ | ✅ | ✅ |
| CRM integrado | ⚠️ básico | ⚠️ básico | ✅ completo | ✅ avanzado |
| Smart Inbox | ✅ | ✅ | ✅ | ✅ + IA |
| IA Autopilot | ❌ | ❌ | 🟡 parcial | ✅ Claude |
| A/B Testing | ✅ | ✅ | ❌ | ✅ |
| Email sequences | ✅ | ✅ | ❌ | ✅ (F4) |
| Lead scoring | ❌ | ⚠️ | ❌ | ✅ auto |
| Inbound capture | ❌ | ❌ | ✅ | ✅ avanzado |
| Multi-cuenta | ✅ | ✅ | ❌ | ✅ (F4) |
| Analytics avanzado | ✅ | ✅ | 🟡 | ✅ |
| Generador de contenido | ❌ | ❌ | ✅ | ✅ |
| **Precio** | $69/mes | $59/mes | **$49/mes** | **$49/mes** |

---

## PRÓXIMOS PROMPTS A EJECUTAR (en orden)

### PROMPT INMEDIATO #1 — Fix executeMessage + Analytics
Arregla BUG-07 y BUG-08 en un solo prompt.

### PROMPT #2 — Fix full_name en el scraper
Reescribir selectores de nombre en content.js para Sales Nav y LinkedIn normal.

### PROMPT #3 — Lead Scoring automático
Implementar función `calculateLeadScore()` en actions.ts + actualizar en cada cambio de etapa.

### PROMPT #4 — Dashboard tiempo real
Reescribir DashboardView con KPIs reales, feed live, funnel visual.

### PROMPT #5 — Campaign FlowBuilder visual
Completar el FlowBuilder de React Flow con pasos editables, variables, delays.

### PROMPT #6 — Detección de replies LinkedIn
Nuevo task_type `check_inbox` en background.js + content.js inbox reader.

### PROMPT #7 — Onboarding flow
Wizard de primera vez para nuevos usuarios.

### PROMPT #8 — A/B Testing en campañas
Variantes de mensaje con tracking de tasa de respuesta.

---

## RESUMEN EJECUTIVO

**Lo que funciona bien:**
El núcleo tecnológico está sólido — Supabase SSR, el CRM Kanban, el scraper (132 leads), el motor de conexiones y la infraestructura de la extensión son bases reales y funcionales.

**Lo que necesita fix urgente:**
El motor debe verificar que realmente envió la conexión (BUG-01), los nombres están corruptos (BUG-05), la analítica muestra zeros por queries incorrectas (BUG-08) y el layout se rompe en scroll (BUG-12/13/14).

**Ventaja competitiva real:**
NexusAI tiene algo que Waalaxy y Dripify NO tienen: **IA generativa integrada** (Claude Sonnet 4.6) que puede negociar automáticamente con prospectos. Esto es el diferenciador clave que debe priorizarse tras estabilizar el motor.

**Tiempo estimado para MVP competitivo:**
Con los prompts ya entregados aplicados + Fase 1 y 2 completadas: **2-3 semanas** para tener una plataforma que compita directamente con Waalaxy/Dripify.
