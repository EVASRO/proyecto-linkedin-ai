# LinkedIn + SalesNav DOM Reference
> Auditado en vivo el 2026-06-18 con Claude in Chrome.  
> Fuente de verdad para todos los prompts de automatización.

---

## 1. ARQUITECTURAS (diferencia crítica)

| Plataforma | Motor | Clases CSS | Selectores fiables |
|---|---|---|---|
| **LinkedIn estándar** (feed, perfiles, búsqueda) | React + CSS Modules | **Hasheadas** (`_3d4c77c2 e7046641`) — INESTABLES | Solo `aria-label`, `href` patterns, texto exacto |
| **SalesNav** (todas sus páginas) | Ember.js | Semánticas (`artdeco-button`, `ember-view`, `connect-cta-form__send`) — ESTABLES | Classes + `data-*` + aria-label |
| **LI recent-activity** (`/recent-activity/all/`) | Ember.js (legado) | Semánticas (`artdeco-button--3`) | Classes + `aria-pressed` |

**Regla de oro**: En LinkedIn estándar NUNCA usar clases CSS para seleccionar. Usar solo `aria-label`, `href` y texto de botón.

---

## 2. LINKEDIN ESTÁNDAR — Mapa por página

### 2A. Página de búsqueda (`/search/results/people/`)

**Botones por card:**

| Acción | Selector | Notas |
|---|---|---|
| Conectar (2°/3°) | `a[aria-label^="Invita a"][aria-label$="a conectar"]` | Es `<A>` NO button. href=`/preload/search-custom-invite/` |
| Mensaje (1°) | `a[aria-label^="Enviar un mensaje a"]` | `<A>` con href `/messaging/compose/?profileUrn=urn:li:fsd_profile:ACoA...` |
| Link de perfil | `a[href*="/in/"]` | Aparece duplicado (foto + nombre). Limpiar con `.replace(/\?.*/,'')` |
| Badge grado | `LABEL` con texto `1er` / `2.°` / `3er y demás` | Sin aria-label propio |

**Flujo connect desde búsqueda** (PROMPT #31):
```
click a[aria-label*="Invita a"][aria-label*="conectar"]
→ Navega a /preload/search-custom-invite/ → abre dialog LI estándar
```

---

### 2B. Perfil individual (`/in/username/`)

**Escenario: 2° grado (no conectado)**

| Elemento | Selector |
|---|---|
| Botón Conectar | `a[aria-label^="Invita a"][aria-label$="a conectar"]` con href `/preload/custom-invite/?vanityName=...` — `<A>` tag |
| Botón Seguir | `button[aria-label^="Seguir a"]` |
| Botón "..." | `button[aria-label="Más"]` — sin texto, texto vacío |
| Guardar en SalesNav | `button[aria-label^="Guardar a"][aria-label*="Sales Navigator"]` |

**Escenario: 1° grado (ya conectado)**

| Elemento | Selector |
|---|---|
| Botón Mensaje | `a[href*="/messaging/compose/?profileUrn="]` texto "Enviar mensaje" (aria-label vacío) |
| Botón "..." | `button[aria-label="Más"]` |

**Escenario: Pendiente (invitación enviada)**

| Elemento | Selector |
|---|---|
| Botón Pendiente | `button` con texto "Pendiente" o aria-label con "Pendiente" |
| Botón Retirar | aparece en "..." → texto "Retirar" |

**Detectar grado de conexión** (sin abrir dropdown):
```javascript
// 1° grado → tiene link a /messaging/compose/
const isConnected = !!document.querySelector('a[href*="/messaging/compose/?profileUrn="]');
// 2° grado → tiene link Invita a conectar
const is2nd = !!document.querySelector('a[aria-label*="Invita a"][aria-label*="conectar"]');
// Pendiente → buscar texto "Pendiente" en botones
const isPending = Array.from(document.querySelectorAll('button'))
  .some(b => b.innerText?.trim() === 'Pendiente');
```

---

### 2C. Actividad reciente (`/in/username/recent-activity/all/`)

> ⚠️ Esta página usa **Ember.js** — las clases son estables.

| Elemento | Selector | Notas |
|---|---|---|
| Like (SIN dar) | `button[aria-label="Recomendar"][aria-pressed="false"]` | Clase: `artdeco-button artdeco-button--muted artdeco-button--3` |
| Like (YA dado) | `button[aria-label="Recomendar"][aria-pressed="true"]` | O aria-label cambia a "Ya me gusta" |
| Abrir reaction picker | `button[aria-label="Abrir el menú de reacciones"]` | Hotkey: `data-finite-scroll-hotkey=l` |
| Like dentro del picker | `button` texto "Me gusta" dentro del picker | Si el primer click abre picker |
| Comentar | `button[aria-label="Comentar"]` | Hotkey: `data-finite-scroll-hotkey=c` |
| Compartir | `button` texto "Compartir" + `class*="artdeco-dropdown__trigger"` | Hotkey: `r` |
| Enviar DM | `button[aria-label="Enviar en un mensaje privado"]` | Hotkey: `s` |

**Algoritmo correcto para like** (PROMPT #28):
```javascript
// 1. Buscar botón NO likeado
const likeBtn = document.querySelector('button[aria-label="Recomendar"][aria-pressed="false"]');
// 2. Si no hay, buscar en inglés
  || document.querySelector('button[aria-label="Like"][aria-pressed="false"]');
// 3. Click → verificar aria-pressed="true"
// 4. Si no cambia a true → puede haberse abierto el picker → buscar "Me gusta" dentro
```

---

### 2D. Mensajería (`/messaging/`)
- Composición directa vía URL: `/messaging/compose/?profileUrn=urn:li:fsd_profile:ACoA...`
- El `profileUrn` se extrae del href del botón "Enviar mensaje" en el perfil 1° grado

---

## 3. SALES NAVIGATOR — Mapa por página

> ✅ SalesNav usa Ember.js. Las clases CSS **son estables**.

### 3A. Búsqueda de leads (`/sales/search/people`)

**Botones por card** (3 botones visibles a la derecha):

| Acción | Selector | Notas |
|---|---|---|
| "..." (overflow) | `button[aria-label^="Ver más acciones para"][data-search-overflow-trigger]` | Abre dropdown |
| Mensaje | `button[aria-label^="Enviar mensaje a"][data-anchor-send-message]` | InMail directo |
| Guardar | `button[aria-label^="Guardar a"][data-anchor-save-lead]` | Guarda en lista |

**Dentro del dropdown `...`** (después de click en "Ver más acciones"):

| Acción | Selector | Notas |
|---|---|---|
| Conectar | `button.ember-view._item_1xnv7i` con texto "Conectar" | Sin aria-label. Primer item del menú |
| Ver perfil | `a.ember-view._item_1xnv7i[data-control-name="view_profile_via_result_menu"]` | Navega al perfil completo |
| Añadir al mapa | `button.ember-view._item_1xnv7i` con texto "Añadir al mapa" | 3er item |

**IMPORTANTE**: Hacer click en "Conectar" desde la lista de búsqueda abre el dialog de conexión SIN navegar al perfil. Esto es la optimización para PROMPT #31.

---

### 3B. Perfil de lead (`/sales/lead/ACwAAE...,NAME_SEARCH,...`)

**Botones del header:**

| Acción | Selector | Notas |
|---|---|---|
| Guardar | `button[data-anchor-save-lead]` texto "Guardar" | Primario (azul) |
| Mensaje/InMail | `button[data-anchor-send-inmail]` texto "Mensaje" | Secundario |
| "..." | `button` que abre dropdown con Conectar / Ver perfil LI / Copiar URL | Sin aria-label propio estable |

**Dentro del dropdown `...`** en perfil de lead:

```javascript
// MISMO selector que en búsqueda:
button.ember-view._item_1xnv7i  // texto "Conectar" → 1er item
a.ember-view._item_1xnv7i       // texto "Ver perfil de LinkedIn" → 2do item
button.ember-view._item_1xnv7i  // texto "Copiar la URL de LinkedIn.com" → 3er item
```

---

### 3C. Dialog de conexión SalesNav ← CRÍTICO

> ⚠️ El dialog SalesNav es **DIFERENTE** al de LinkedIn estándar.

| Elemento | Selector | Valor |
|---|---|---|
| Contenedor modal | `div.artdeco-modal.artdeco-modal--layer-default[role="dialog"]` | Clase estable |
| Título | `h2` con texto "Enviar invitación" | ≠ LinkedIn que dice "Conectar" |
| Textarea nota | `textarea#connect-cta-form__invitation` | id estable |
| **Botón ENVIAR** | `button.connect-cta-form__send` | texto "**Enviar invitación**" ← NO "Enviar" |
| Botón Cancelar | `button.connect-cta-form__cancel` | texto "Cancelar" |
| Botón X cerrar | `button.artdeco-button--circle[aria-label="Descartar"]` | |

**Bug histórico identificado**: `findDialogSendButton()` buscaba texto "Enviar" pero el botón SalesNav dice "Enviar invitación". Fix en PROMPT #26 con `.toLowerCase()` ya lo cubre.

**Detectar que el dialog está abierto**:
```javascript
// Método más fiable para SalesNav:
const isOpen = !!document.querySelector('button.connect-cta-form__send');
// Fallback:
const isOpen2 = !!document.querySelector('div.artdeco-modal.artdeco-modal--layer-default');
```

---

## 4. COMPARATIVA: LinkedIn Standard vs SalesNav

| Acción | LinkedIn Estándar | Sales Navigator |
|---|---|---|
| **URL perfil** | `/in/username/` | `/sales/lead/ACwAAE...,CONTEXT` |
| **Botón conectar** | `<A>` tag con `aria-label*="Invita a"` — abre `/preload/custom-invite/` | Oculto en `...` dropdown → `button._item_1xnv7i` texto "Conectar" |
| **Dialog conectar** | Container: `[role=dialog]` o `.artdeco-modal`; Enviar: texto "Enviar" | Container: `.artdeco-modal--layer-default`; Enviar: `button.connect-cta-form__send` texto "Enviar invitación" |
| **Nota en invitación** | `textarea[name="message"]` o por placeholder | `textarea#connect-cta-form__invitation` |
| **Detectar 1° grado** | `a[href*="/messaging/compose/"]` presente | Lead ya guardado / "Mensaje" button con `data-anchor-send-inmail` |
| **Detectar pendiente** | `button` texto "Pendiente" | No existe visualmente — verificar vía Voyager API |
| **Like posts** | Navegar a `/in/user/recent-activity/all/` → `button[aria-label="Recomendar"][aria-pressed="false"]` | No aplica (no hay feed nativo en SalesNav) |
| **Enviar mensaje** | Click en `a[href*="/messaging/compose/"]` | Click en `button[data-anchor-send-inmail]` |
| **Seguir** | `button[aria-label^="Seguir a"]` | No existe en SalesNav |
| **Cancelar invitación** | Buscar `button` texto "Retirar" en perfil | No aplicable directamente |
| **ID de perfil** | `urn:li:fsd_profile:ACoAABL0...` (en href de messaging) | `ACwAAE...` (en URL del lead) |

---

## 5. FLUJOS ÓPTIMOS POR ACCIÓN (sin quemar page views)

### Conexión (más eficiente)
```
SalesNav: /sales/search/people → click "Ver más acciones" → click "Conectar"
→ dialog abierto en el contexto de búsqueda (sin navegar al perfil)
→ textarea#connect-cta-form__invitation.value = nota
→ click button.connect-cta-form__send
```

### Verificar aceptación (0 page views)
```
GET /voyager/api/relationships/invitations?invitationType=SENT → lista de pendientes
GET /voyager/api/relationships/connections?count=40 → conexiones recientes
→ cruzar con leads en "conexion_enviada" → batch update CRM
```

### Like post (sin visitar perfil del lead)
```
Navegar a /in/{username}/recent-activity/all/
→ button[aria-label="Recomendar"][aria-pressed="false"]
→ click → verificar aria-pressed="true"
→ Si abre picker → click "Me gusta" dentro del picker
```

### Mensaje a 1° grado
```
Opción A: Navegar a /messaging/compose/?profileUrn=urn:li:fsd_profile:ACoA... 
Opción B (SalesNav): click button[data-anchor-send-inmail]
```

### Detectar estado de conexión (sin navegar al perfil)
```javascript
// En /in/username/:
const state = 
  document.querySelector('a[href*="/messaging/compose/"]')  ? '1st' :
  document.querySelector('a[aria-label*="Invita a"]')       ? '2nd_3rd' :
  document.querySelector('button')?.innerText === 'Pendiente' ? 'pending' :
                                                                'unknown';
```

---

## 6. HALLAZGOS CRÍTICOS QUE AFECTAN PROMPTS ACTIVOS

| # | Hallazgo | Prompts afectados |
|---|---|---|
| 1 | Botón Conectar en LI perfil es `<A>` (no button), en LI búsqueda también es `<A>`. Solo en SalesNav dentro de dropdown es `<button>` | PROMPT #26, #31 |
| 2 | Dialog SalesNav: botón envío = `button.connect-cta-form__send` texto "Enviar invitación" | PROMPT #26 ✅ ya cubierto |
| 3 | `isSalesNavDialogOpenRobust()` debe incluir `button.connect-cta-form__send` como señal del dialog | PROMPT #26 — agregar en próxima iteración |
| 4 | Like button en activity = `button[aria-label="Recomendar"][aria-pressed="false"]` (NO "Me gusta") | PROMPT #28 — corregir |
| 5 | SalesNav search: "Conectar" está en dropdown `...` → necesita 2 clicks, no 1 | PROMPT #31 |
| 6 | URL del lead SalesNav: formato `ACwAAE...,CONTEXT_TYPE,SESSION_ID` — el ID es solo la parte antes de la primera coma | Todos los prompts SalesNav |
| 7 | Panel lateral SalesNav: click en nombre del lead abre panel RIGHT (no navega) | PROMPT #31 — usar "Ver perfil" del dropdown para navegación completa |
