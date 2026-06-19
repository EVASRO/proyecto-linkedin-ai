# Selector Patterns — Cheat Sheet
> Referencia rápida. Auditado en vivo 2026-06-18.

---

## LinkedIn Estándar — Regla de oro
> ⚠️ Clases CSS son hasheadas (React CSS Modules). NUNCA usar clase como selector.
> Solo usar: `aria-label`, `href` patterns, texto exacto, `aria-pressed`, `data-finite-scroll-hotkey`.

---

## PERFIL `/in/username/`

```javascript
// Detectar estado de conexión (sin navegar, sin quemar views)
const is1st     = !!document.querySelector('a[href*="/messaging/compose/?profileUrn="]');
const is2nd3rd  = !!document.querySelector('a[aria-label*="Invita a"][aria-label*="conectar"]');
const isPending = Array.from(document.querySelectorAll('button'))
                    .some(b => b.innerText?.trim() === 'Pendiente');

// Botones de acción
const connectBtn = document.querySelector('a[aria-label*="Invita a"][aria-label*="conectar"]');
// → href="/preload/custom-invite/?vanityName=username"  (es <A> no <button>)

const messageBtn = document.querySelector('a[href*="/messaging/compose/?profileUrn="]');
// → texto "Enviar mensaje", aria-label vacío

const followBtn  = document.querySelector('button[aria-label^="Seguir a"]');
const moreBtn    = document.querySelector('button[aria-label="Más"]');  // "..."
```

---

## BÚSQUEDA `/search/results/people/`

```javascript
// Botón Conectar en card (2°/3°) — es <A> no <button>
const connectInSearch = document.querySelector('a[aria-label*="Invita a"][aria-label*="conectar"]');
// → href="/preload/search-custom-invite/?vanit..."

// Botón Mensaje en card (1°) — también es <A>
const msgInSearch = document.querySelector('a[aria-label^="Enviar un mensaje a"]');
// → href="/messaging/compose/?profileUrn=urn:li:fsd_profile:ACoA..."

// Extraer profileUrn del href
const profileUrn = msgInSearch?.href?.match(/profileUrn=([^&]+)/)?.[1];

// Links de perfil (extraer username)
const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'))
  .map(a => a.href.replace(/\?.*/,''))
  .filter((v,i,arr) => arr.indexOf(v) === i);
```

---

## ACTIVIDAD RECIENTE `/in/username/recent-activity/all/`
> ✅ Ember.js — clases artdeco ESTABLES

```javascript
// Like button NO likeado (selector más fiable)
const likeBtn = document.querySelector(
  'button[aria-label="Recomendar"][aria-pressed="false"],' +
  'button[aria-label="Like"][aria-pressed="false"],' +
  'button[aria-label="Me gusta"][aria-pressed="false"]'
);

// Verificar si fue likeado
const isLiked = likeBtn?.getAttribute('aria-pressed') === 'true';

// Si se abre el reaction picker en vez de likear directamente
const picker  = document.querySelector('.reactions-menu, [class*="reactions-picker"]');
const likeInPicker = Array.from(picker?.querySelectorAll('button') ?? [])
  .find(b => ['recomendar','me gusta','like'].includes(b.getAttribute('aria-label')?.toLowerCase()));

// Otros botones del post
const commentBtn = document.querySelector('button[aria-label="Comentar"]');
const sendDMBtn  = document.querySelector('button[aria-label="Enviar en un mensaje privado"]');
```

---

## SALES NAVIGATOR — Búsqueda `/sales/search/people`
> ✅ Ember.js — clases semánticas ESTABLES

```javascript
// "..." de cada card
const moreBtn = document.querySelector('button[aria-label^="Ver más acciones para"][data-search-overflow-trigger]');

// Mensaje directo (InMail) de cada card
const msgBtn  = document.querySelector('button[aria-label^="Enviar mensaje a"][data-anchor-send-message]');

// Guardar como posible cliente
const saveBtn = document.querySelector('button[aria-label^="Guardar a"][data-anchor-save-lead]');

// Dentro del dropdown ... (después de click en moreBtn):
const connectItem = Array.from(document.querySelectorAll('button.ember-view._item_1xnv7i'))
  .find(b => b.innerText?.trim() === 'Conectar');

const viewProfileItem = document.querySelector('a._item_1xnv7i[data-control-name="view_profile_via_result_menu"]');

// Link al perfil completo del lead
const leadUrl = document.querySelector('a[href*="/sales/lead/"]')?.href;
// → "https://www.linkedin.com/sales/lead/ACwAAE...,NAME_SEARCH,..."
// Extraer ID: leadUrl.match(/\/sales\/lead\/([^,?]+)/)?.[1]
```

---

## SALES NAVIGATOR — Perfil `/sales/lead/ACwAAE...,NAME_SEARCH,...`
> ✅ Ember.js

```javascript
// Botones del header
const saveBtn    = document.querySelector('button[data-anchor-save-lead]');
const inMailBtn  = document.querySelector('button[data-anchor-send-inmail]');

// "..." del perfil — buscar por texto del dropdown (no tiene aria-label propio estable)
// → Click en el tercer botón del header (después de Guardar y Mensaje)

// Dentro del dropdown del perfil:
const connectItem = Array.from(document.querySelectorAll('button.ember-view._item_1xnv7i'))
  .find(b => b.innerText?.trim() === 'Conectar');
// (mismo selector que en búsqueda)

// Detectar si ya es 1° grado (no aparece "Conectar" en dropdown)
// → El dropdown solo tiene "Ver perfil de LinkedIn" y "Copiar la URL"
```

---

## DIALOG DE CONEXIÓN SALES NAVIGATOR
> ✅ Clases ESTABLES (`connect-cta-form__*`)

```javascript
// Detectar dialog abierto
const dialogOpen = !!document.querySelector('button.connect-cta-form__send');

// Escribir nota de conexión
const textarea = document.querySelector('textarea#connect-cta-form__invitation');
if (textarea && note) {
  textarea.focus();
  textarea.value = note;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// Click en Enviar
const sendBtn   = document.querySelector('button.connect-cta-form__send');
// → texto "Enviar invitación" (NO "Enviar")

// Cerrar dialog
const cancelBtn = document.querySelector('button.connect-cta-form__cancel');
const closeBtn  = document.querySelector('button.artdeco-button--circle[aria-label="Descartar"]');

// Verificar éxito (el dialog desaparece)
const dialogGone = !document.querySelector('button.connect-cta-form__send');
```

---

## VOYAGER API — Headers requeridos

```javascript
const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';
const headers = {
  'csrf-token': csrfToken,
  'x-restli-protocol-version': '2.0.0',
  'accept': 'application/vnd.linkedin.normalized+json+2.1',
};
```

---

## Extraer IDs de perfil

```javascript
// LinkedIn standard → publicIdentifier (slug)
const liSlug = url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1]?.replace(/\/$/, '');

// SalesNav → entityId (ACwAAE... antes de la coma)
const snId   = url.match(/\/sales\/lead\/([^,?]+)/)?.[1];

// Voyager profileId (fsd_profile URN) desde messaging href
const urn    = href.match(/profileUrn=([^&]+)/)?.[1];
// → "urn%3Ali%3Afsd_profile%3AACoAABL0..." (URL-encoded)
const decoded = decodeURIComponent(urn); // → "urn:li:fsd_profile:ACoAABL0..."
```
