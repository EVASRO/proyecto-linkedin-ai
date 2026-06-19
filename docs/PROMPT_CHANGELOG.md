# Prompt Changelog — Cazary.ai Engine

> Registro de cada prompt aplicado, bugs encontrados y correcciones.

---

## PROMPT #26 — Connect Flow (6 Fixes)
**Fecha**: 2026-06-18  
**Archivo**: `extension-chrome/content.js`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
1. `isSalesNavDialogOpenRobust()` → expandido a 10 selectores
2. `findDialogSendButton()` → búsqueda en container scoped, más variantes de texto
3. Safety timer 45s en `_executeConnectInner()` → elimina watchdog triggers
4. Bloque "sin dialog" → sin loop, verificación de Pendiente + late button
5. Dialog-found path usa `findDialogSendButton()` mejorado
6. Method tagging: `method: 'dom_salesnav'`, razones nuevas

### Bug original corregido
`connectViaVoyagerAPI()` mapeaba 301/302 → `already_connected` causando que
contactos 3° en SalesNav (que devuelven 301 porque el entityId `ACwAAE...` no es
aceptado por la API normInvitations) fueran marcados como `conexion_aceptada`.
→ 33 leads incorrectos + mensajes follow-up cancelados vía SQL migration.

### Pendiente mejorar (encontrado en auditoría DOM 2026-06-18)
- `isSalesNavDialogOpenRobust()`: añadir `button.connect-cta-form__send` como señal directa
- `findDialogSendButton()`: el texto real del botón SalesNav es "Enviar invitación"
  (ya cubierto por `.toLowerCase()` + match parcial)

---

## PROMPT #27 — Check Acceptance Batch (Voyager API)
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
- `executeCheckNetworkUpdates()` → 2 llamadas Voyager API
  - `GET /voyager/api/relationships/invitations?invitationType=SENT&count=40` (×2 páginas)
  - `GET /voyager/api/relationships/connections?count=40`
- `scheduleNetworkUpdateCheck(wsId)` → cada 10 ticks (~10 min)
- `handleActionDone()` → batch PATCH de leads aceptados + schedule follow-up
- Nueva tabla `network_scan_log` para tracking

### Resultado
0 page views para verificar aceptaciones. 1 API call = N CRM updates.

---

## PROMPT #28 — Like Post vía Activity Tab
**Fecha**: 2026-06-18  
**Archivo**: `content.js`  
**Estado**: ✅ Aplicado + 🔧 Patch necesario

### Qué se hizo
- Reescritura de `executeLikePost()` para navegar a `/in/username/recent-activity/all/`
- Soporte para resolver SalesNav entityId → publicIdentifier vía Voyager
- Reintentos con scroll (3 intentos)
- Detección del reaction picker como fallback

### Bug encontrado en auditoría DOM
El botón Like en español NO se llama "Me gusta" — se llama **"Recomendar"**
con `aria-pressed="false"` (no likeado) / `aria-pressed="true"` (likeado).

La página usa Ember.js con clases `artdeco-button` estables:
```
button[aria-label="Recomendar"][aria-pressed="false"]
  class: "artdeco-button artdeco-button--muted artdeco-button--3 artdeco-button--tertiary ember-view"
```

`findUnlikedButton()` busca: "me gusta", "like", "react", "reaccionar" → NINGUNO matchea "Recomendar".

### Patch aplicado (PROMPT #28-B)
Ver sección PROMPT #28-B abajo.

---

## PROMPT #28-B — Patch Like Button (Recomendar)
**Fecha**: 2026-06-18  
**Archivo**: `content.js` — función `findUnlikedButton()` dentro de `executeLikePost()`  
**Estado**: ✅ Aplicado

### Cambio exacto

**ANTES** (líneas 2727-2758):
```javascript
const findUnlikedButton = () => {
  const allButtons = ...
  const likeBtn = allButtons.find(btn => {
    ...
    return label.includes('me gusta')
      || label.includes('like')
      || label.includes('react')
      || label.includes('reaccionar');
  });
  ...
  for (const btn of reactionBtns) {
    const txt = ...
    if (txt === 'me gusta' || txt === 'like' || txt === 'reaccionar') return btn;
  }
```

**DESPUÉS**:
```javascript
const findUnlikedButton = () => {
  // Estrategia A: selector directo (más fiable, Ember.js página de actividad)
  const direct = document.querySelector(
    'button[aria-label="Recomendar"][aria-pressed="false"],' +
    'button[aria-label="Like"][aria-pressed="false"],' +
    'button[aria-label="Me gusta"][aria-pressed="false"]'
  );
  if (direct && direct.offsetParent !== null) return direct;

  // Estrategia B: búsqueda por aria-label patterns
  const allButtons = Array.from(document.querySelectorAll('button[aria-label]'));
  const likeBtn = allButtons.find(btn => {
    const label   = (btn.getAttribute('aria-label') ?? '').toLowerCase();
    const pressed = btn.getAttribute('aria-pressed');
    const isLiked = pressed === 'true'
      || label.includes('ya me gusta') || label.includes('unlike')
      || label.includes('quitar me gusta')
      || btn.classList.contains('active') || btn.classList.contains('react--active');
    if (isLiked) return false;
    return label === 'recomendar'           // ← ES: página actividad
      || label === 'me gusta'               // ← ES: otras variantes
      || label === 'like'                   // ← EN
      || label.includes('reaccionar')       // ← ES genérico
      || label.includes('react')            // ← EN genérico
      || label.includes('recomendar');      // ← ES fallback parcial
  });
  if (likeBtn) return likeBtn;

  // Estrategia C: clases artdeco (Ember.js, muy estables)
  const artdecoBtns = document.querySelectorAll(
    '.artdeco-button.artdeco-button--3:not([aria-pressed="true"])'
  );
  for (const btn of artdecoBtns) {
    const txt   = (btn.innerText || btn.textContent || '').trim().toLowerCase();
    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (txt === 'recomendar' || txt === 'me gusta' || txt === 'like'
        || label === 'recomendar' || label === 'me gusta') return btn;
  }
  return null;
};
```

---

---

## PROMPT #29 — Find Email vía Voyager API
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js` + `supabase/migrations/20260618_leads_enrichment_columns.sql`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
- `executeFindEmail()` reescrita con lógica 3 etapas:
  1. Extraer `publicIdentifier` de URL (soporta `/in/username/` y SalesNav con resolver Voyager)
  2. Hit `GET /voyager/api/identity/profiles/{slug}/profileContactInfo` → si hay email, retorna inmediato
  3. Fallback DOM (click overlay) solo si API no devolvió email — ahora también captura `tel:` y cierra modal
- `handleActionDone()` en background.js guarda: `enrichment_source`, `enriched_at`, `phone`, `twitter`, `website`
- `case 'find_email'` en processTick(): sleep reducido de 3000+1500ms a 2500+1000ms
- Migration SQL ejecutada en Supabase: columnas `enrichment_source`, `enriched_at`, `twitter`, `website` en tabla `leads`

### Campos nuevos en tabla leads
```
enrichment_source  TEXT   → 'voyager_api' | 'dom_contact_overlay' | 'manual' | 'unknown'
enriched_at        TIMESTAMPTZ
twitter            TEXT
website            TEXT
```

---

---

## PROMPT #30 — Stealth & Humanización
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
**content.js:**
- `sleep()` reemplazada con guard contra valores negativos
- `sleepGaussian(mean, stdDev, min)` — Box-Muller, distribución realista
- `sleepMicro()` — ~120ms, para micro-acciones (hover, keypress)
- `sleepHuman()` — ~1.8s, entre acciones de una misma tarea
- `sleepNav()` — ~3.5s, entre navegaciones
- `simulateCursorMove(el)` — 3-5 mousemove eased hacia el target
- `typeHuman(el, text)` — ~220 CPM con jitter + 8% pausa de "pensar"
- `scrollHuman(targetY, duration)` — ease-in-out con steps variables
- `simulateClick()` — ahora llama `simulateCursorMove()` non-blockingly

**background.js:**
- `sleepGaussian()` — misma impl Box-Muller en el service worker
- `_wsSettingsCachedAt` + `refreshWsSettingsCache()` — refresca `ws_settings` en chrome.storage máx 1x cada 15min
- `processTick()` — llama `refreshWsSettingsCache(wsId)` en cada ciclo
- `processTick()` — inter-task delay gaussiano `sleepGaussian(4500, 1200, 2000)` (~2-7s, media ~4.5s)

### Nota del agente
- Change 5 (isWithinActiveHours) no aplicado: `background.js` ya tiene
  `isActiveHour()`, `isWeekendPaused()`, `isActiveDayOfWeek()` en líneas ~366-377
- Change 3 no-op: no existía función `typeText` previa

### Impacto
- Delays ya no son intervalos uniformes detectables
- El engine no actúa fuera de horario laboral (ya existía)
- `typeHuman()` disponible para PROMPT #32 (mensajes) y notas de conexión

---

## Próximos prompts

| # | Acción | Prioridad | Estado |
|---|---|---|---|
| #30 | Stealth: gaussian delays, humanización | ✅ | Aplicado |
---

## PROMPT #31 — Connect desde lista SalesNav (flujo "..." → dropdown → dialog)
**Fecha**: 2026-06-18  
**Archivo**: `content.js` + `background.js`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
**content.js — 2 nuevos helpers antes de `executeConnectFast()`:**
- `handleSalesNavConnectDialog(note)` — espera hasta 4s por `button.connect-cta-form__send`, escribe nota con `typeHuman()`, click send, retorna `true/false/'limit'`
- `executeSalesNavConnectFromProfile(...)` — encuentra "..." en perfil SalesNav, abre dropdown, click "Conectar", delega a `handleSalesNavConnectDialog()`

**content.js — rama SalesNav de `executeConnectFast()` reemplazada:**
- Detección de perfil → rutea a `executeSalesNavConnectFromProfile()` (no más a `executeConnect()` directo)
- Card lookup usa `snIdRaw` (entityId ACwAAE del URL) para matching más confiable
- Flujo: "..." (`data-search-overflow-trigger`) → loop espera dropdown → `button.ember-view._item_1xnv7i` texto "Conectar" → `handleSalesNavConnectDialog()`
- Todos los fallbacks llaman `executeConnect()` para garantía de entrega

**background.js — `case 'connect'`:**
- Navegación usa `task.payload.search_url ?? profileUrl` → si viene URL de búsqueda, el tab aterriza ahí y content.js maneja el card lookup
- Delay post-navegación cambiado a `sleepGaussian(3000, 800, 2000)`

### Selectores estables usados (Ember.js, auditados en vivo)
```
button[data-search-overflow-trigger]           → "..." en card de search
button.ember-view._item_1xnv7i texto "Conectar" → item del dropdown
textarea#connect-cta-form__invitation           → nota de conexión
button.connect-cta-form__send                   → "Enviar invitación"
```

| #31 | Connect desde lista SalesNav | ✅ | Aplicado |
---

## PROMPT #32 — Mensajes directos (LI + SalesNav InMail)
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js` + `supabase/migrations/20260618_leads_message_method.sql`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
**content.js:**
- `typeHumanContenteditable(el, text)` — nuevo helper para div contenteditable de React LI. Escribe char a char con Selection/Range API + InputEvent(inputType='insertText'). Fallback a execCommand si no hay selection.
- `executeMessage()` reescrita con 3 etapas:
  - **Etapa A (Voyager API)**: extrae `profileUrn` del href del botón "Enviar mensaje", POST a `/voyager/api/messaging/conversations` → 201=done, 429=rate_limit
  - **Etapa B (DOM LI)**: `typeHumanContenteditable()` en `.msg-form__contenteditable`
  - **Etapa C (DOM SalesNav)**: `typeHuman()` en `textarea.message-anywhere-compose-box__msg-body`
  - Verificación de envío: campo vacío tras click = éxito
  - Result incluye `method: 'voyager_api'` o `method: 'dom'`

**background.js:**
- `handleActionDone()`: PATCH a lead con `last_message_sent_at` + `last_message_method` tras mensaje exitoso

**Supabase migration ejecutada:**
- `leads.last_message_method TEXT` — `'voyager_api' | 'dom'`

| #32 | Mensajes directos LI + SalesNav | ✅ | Aplicado |
---

## PROMPT #33 — Follow / Unfollow
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js` + `supabase/migrations/20260618_leads_follow_columns.sql`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
**content.js — `executeFollow()` reescrita:**
- `sleepHuman()` en vez de `sleep(2000)` fijo
- Pre-check `already_following` (evita doble click)
- Selectores en cascada: `aria-label^="Seguir a"` → texto visible → `clickMoreButton()` + `_item_1xnv7i` (SalesNav) / `findMenuItemByText` (LI)
- Verificación post-click: botón cambió a "Siguiendo"/"Dejar de seguir"
- try/catch completo con error reporting

**content.js — `executeUnfollow()` reescrita:**
- `sleepHuman()` en vez de `sleep(2000)` fijo
- Check directo `aria-label^="Dejar de seguir"` primero (sin abrir menú)
- Fallback a `clickMoreButton()` + selectores Ember/LI
- Path `already_not_following` cuando ya no seguimos

**background.js:**
- `case 'follow'` y `case 'unfollow'` añadidos — navegaban a URL y dispatching a content script. **Fix crítico: estas tareas no se procesaban antes (no existía el case)**
- `handleActionDone()`: PATCH `last_followed_at` junto al bloque `last_liked_at`

**Supabase migration ejecutada:**
- `leads.last_followed_at TIMESTAMPTZ`

| #33 | Follow / Unfollow | ✅ | Aplicado |

---

## PROMPT #34 — Cancelar Conexión Pendiente (Withdraw)
**Fecha**: 2026-06-18  
**Archivos**: `content.js` + `background.js` + `supabase/migrations/20260618_leads_withdraw_columns.sql`  
**Estado**: ✅ Aplicado y confirmado

### Qué se hizo
**content.js — `executeWithdraw()` reescrita completa:**
- **Etapa A (Voyager API)**: `GET /voyager/api/relationships/invitations?invitationType=SENT` (hasta 2 páginas × 40). Busca el `invitationId` comparando por `publicIdentifier` (LI slug) o `entityId` (SalesNav). Si lo encuentra → `DELETE /voyager/api/relationships/invitations/{id}`. 204/200 = éxito, 404 = ya retirada, otro → fallback DOM.
- **Etapa B (DOM fallback)**: Loop 4×600ms buscando `button[aria-label="Pendiente"]` o texto exacto. Fallback `clickMoreButton()` + `findMenuItemByText('retirar')`. Confirm dialog con loop 8×400ms buscando botón "Retirar"/"Withdraw". Verificación final de que el botón desapareció.
- Detecta `already_connected` (si el lead ya aceptó la invitación) y retorna `success:false, reason:'already_connected'` sin error.

**background.js:**
- `handleActionDone()`: bloque `withdraw` hace PATCH con `crm_column='nuevo'`, `connection_status='none'`, `connection_sent_at=null`, `withdraw_method`, `last_withdrawn_at` (solo si `reason !== 'already_connected'`)
- `case 'withdraw'`: `sleep(3000 + Math.random()*1000)` → `sleepGaussian(3000, 700, 2000)`

**Supabase migration ejecutada:**
- `leads.connection_status TEXT` — `'none' | 'pending' | 'connected'`
- `leads.connection_sent_at TIMESTAMPTZ`
- `leads.withdraw_method TEXT` — `'voyager_api' | 'dom'`
- `leads.last_withdrawn_at TIMESTAMPTZ`

### Flujo completo post-PROMPT #34

```
withdraw task → background.js case 'withdraw'
  → sleepGaussian(3000, 700, 2000)
  → content.js executeWithdraw()
    → Etapa A: GET invitations → find invitationId → DELETE
    → Etapa B: DOM click Pendiente → confirm Retirar → verify
  → ACTION_DONE { action:'withdraw', success:true, method:'voyager_api'|'dom' }
  → handleActionDone() → PATCH leads: crm_column='nuevo', connection_status='none'
```

| #34 | Cancelar conexión pendiente | ✅ | Aplicado |
| #34 | Cancelar conexión pendiente | ✅ | Aplicado |
| #35 | Email Outreach | ✅ | Aplicado |

---

## PROMPT #35 — Email Outreach (4 gaps cerrados)
**Fecha**: 2026-06-18  
**Archivos**: `background.js` + `src/app/api/send-email/route.ts` + `supabase/migrations/20260618_leads_email_columns.sql`  
**Estado**: ✅ Aplicado y confirmado

### Qué existía (intacto)
- Tablas `email_queue` + `email_providers` con RLS
- `/api/send-email/route.ts` — envía SMTP/Resend/Mailgun/SendGrid
- `processEmailQueue()` — corre en cada tick

### Los 4 gaps cerrados

**GAP 1 — case 'send_email' en executeTask() (background.js:1253)**
- Lee lead de Supabase (email, full_name, company, job_title)
- Aplica tokens `{{nombre}}`, `{{nombre_completo}}`, `{{empresa}}`, `{{cargo}}`
- INSERT en `email_queue` con `metadata: { company, job_title }`
- Marca tarea engine_queue como `done`
- Llama `processEmailQueue()` inmediatamente si no hay `scheduled_delay_ms`
- Si lead sin email → `done, reason:'no_email'` (sin error)

**GAP 2 — processEmailQueue(): marca failed**
- Antes: `!res.ok` → solo console.warn → job queda en 'pending' para siempre
- Ahora: PATCH `email_queue.status='failed', last_error` en fallo HTTP o excepción
- También: en éxito PATCH `leads.last_email_sent_at` directamente

**GAP 3 — daily_emails_limit**
- Lee `ws_settings.daily_emails_limit` (default 50)
- Cuenta emails `sent` de hoy con `sent_at=gte.${todayStart}`
- Si `sentCount >= dailyLimit` → return sin enviar
- `remaining = min(5, dailyLimit - sentCount)` → límite dinámico en el query

**GAP 4 — route.ts fixes**
- `email_queue_id` con `let` antes del try (accesible en catch)
- catch block: UPDATE `status='failed'` antes de return 500
- `interpolate()` generalizado a `Record<string,string>` con replaceAll
- Tokens `{{empresa}}` y `{{cargo}}` desde `emailJob.metadata`

### Campos nuevos en Supabase
```
leads.last_email_sent_at  TIMESTAMPTZ
leads.email_opt_out       BOOLEAN DEFAULT false
email_queue.metadata      JSONB DEFAULT '{}'
```

### Flujo completo email outreach
```
engine_queue task send_email
  → background.js case 'send_email'
    → GET leads (email, name, company, job_title)
    → applyTokens(subject, body_html)
    → INSERT email_queue { status:'pending', scheduled_at }
    → processEmailQueue() inmediato
      → check daily limit (sentCount vs daily_emails_limit)
      → GET pending jobs (con lead_id)
      → POST /api/send-email { email_queue_id }
        → route.ts: interpolate + SMTP/Resend/Mailgun/SendGrid
        → UPDATE email_queue { status:'sent', sent_at, message_id }
      → PATCH leads { last_email_sent_at }
  → engine_queue { status:'done', result: { email_queue_id } }
```
