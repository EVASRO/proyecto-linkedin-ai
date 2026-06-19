# Automation Flows — Flujos Óptimos por Acción
> Basado en auditoría DOM en vivo 2026-06-18.  
> "Óptimo" = mínimas page views + máximo stealth.

---

## 0. Visita de Perfil (Page View)

| Plataforma | URL | Costo |
|---|---|---|
| LinkedIn | `/in/username/` | 1 view visible para el lead |
| SalesNav | `/sales/lead/ACwAAE...,NAME_SEARCH,...` | 1 view visible, SalesNav lo registra |

**Estrategia stealth**: Evitar visitar perfiles solo para verificar estado.  
Usar Voyager API o la info ya disponible en la búsqueda.

---

## 1. Envío de Conexión

### LinkedIn Estándar (2°/3° grado)

**Desde búsqueda** (sin visitar perfil — ÓPTIMO):
```
1. /search/results/people/
2. click a[aria-label*="Invita a"][aria-label*="conectar"]
3. Navega a /preload/search-custom-invite/ → abre dialog LI
4. Si hay nota: llenar textarea[name="message"] o similar
5. Click botón "Enviar" (texto "Enviar" o "Enviar invitación")
```

**Desde perfil** (gasta 1 page view):
```
1. Navegar a /in/username/
2. click a[aria-label*="Invita a"][aria-label*="conectar"]
3. → href="/preload/custom-invite/?vanityName=..."
4. Dialog → textarea → send
```

**Vía Voyager API** (0 page views, solo funciona con LI profileId estándar):
```
POST /voyager/api/growth/normInvitations
body: { invitee: { ..., memberID: "ACoAABL0..." }, ... }
→ 201 = enviado | 301/302 = entityId SalesNav, usar DOM
```

### Sales Navigator

**Desde búsqueda** (ÓPTIMO — PROMPT #31):
```
1. /sales/search/people → cards de resultados
2. click button[aria-label^="Ver más acciones para"][data-search-overflow-trigger]
3. Dropdown abre: click button._item_1xnv7i texto "Conectar"
4. Dialog "Enviar invitación" abre:
   - textarea#connect-cta-form__invitation ← nota
   - click button.connect-cta-form__send ("Enviar invitación")
```

**Desde perfil lead** (gasta 1 view):
```
1. /sales/lead/ACwAAE...,NAME_SEARCH,...
2. Click botón "..." (tercer botón del header)
3. Dropdown: click "Conectar" (button._item_1xnv7i)
4. Dialog → nota → "Enviar invitación"
```

---

## 2. Verificación de Aceptación

**SIN quemar page views** (ÓPTIMO — PROMPT #27):
```
GET /voyager/api/relationships/invitations?invitationType=SENT&count=40
→ Lista de invitaciones PENDIENTES
GET /voyager/api/relationships/connections?count=40
→ Lista de conexiones recientes (confirmación positiva)

Cruzar con leads en crm_column='conexion_enviada'
→ No está en SENT + está en connections → aceptó
→ Batch PATCH a conexion_aceptada + schedule follow-up
```

---

## 3. Envío de Mensajes Directos

### LinkedIn Estándar (1° grado)
```
Opción A — URL directa (sin navegar al perfil):
  /messaging/compose/?profileUrn=urn:li:fsd_profile:ACoAABL0...
  → El profileUrn se extrae del href del botón "Enviar mensaje" del perfil
  → O desde el href del botón "Enviar un mensaje a X" en búsqueda

Opción B — Desde perfil:
  /in/username/ → click a[href*="/messaging/compose/"]
```

### Sales Navigator (InMail)
```
Desde perfil lead:
  click button[data-anchor-send-inmail]  (texto "Mensaje")

Desde búsqueda:
  click button[aria-label^="Enviar mensaje a"][data-anchor-send-message]
```

---

## 4. Like a Posts

**Flujo óptimo** (sin visitar perfil, activity tab no es page view visible):
```
1. Construir URL: /in/{username}/recent-activity/all/
   (Para SalesNav: resolver ACwAAE → publicIdentifier vía Voyager primero)
2. Navegar a la URL
3. Esperar carga (Ember.js — más lento que React)
4. Scroll suave 300px para simular comportamiento humano
5. Buscar: button[aria-label="Recomendar"][aria-pressed="false"]
   Fallback: button[aria-label="Like"][aria-pressed="false"]
6. scrollIntoView → click
7. Verificar aria-pressed="true"
8. Si no: verificar si se abrió reaction picker
   → button dentro del picker con texto/label "Me gusta" o "Recomendar"
9. Actualizar leads.last_liked_at
```

**Selectores confirmados** (Ember.js, estables):
- No likeado: `button[aria-label="Recomendar"][aria-pressed="false"]`
- Likeado: `button[aria-label="Recomendar"][aria-pressed="true"]`
- Reaction picker: `button[aria-label="Abrir el menú de reacciones"]`

---

## 5. Seguir / Dejar de Seguir

```
Seguir:
  /in/username/ → button[aria-label^="Seguir a"] → click
  
Dejar de seguir:
  /in/username/ → button[aria-label^="Dejar de seguir"] → click
  O vía "..." → dropdown → "Dejar de seguir"
```

---

## 6. Cancelar Conexión Pendiente

```
Desde perfil:
  /in/username/ → buscar button texto "Pendiente" o "Retirar"
  Si no visible → click button[aria-label="Más"] → dropdown → "Retirar invitación"
  
Bulk via Voyager API (más eficiente):
  GET /voyager/api/relationships/invitations?invitationType=SENT
  → Obtener invitationId
  DELETE /voyager/api/relationships/invitations/{invitationId}
```

---

## 7. Búsqueda de Email y Teléfono (PROMPT #29)

**Flujo óptimo** (Voyager API primero, DOM solo como fallback):
```
Opción 1 — Voyager API (ÓPTIMO, 0 page views):
  GET /voyager/api/identity/profiles/{publicIdentifier}/profileContactInfo
  → email, phone, twitter, websites
  → Actualizar leads.email, leads.phone, leads.enrichment_source='voyager_api'

Opción 2 — Overlay de contacto (fallback DOM):
  /in/username/ → click "Información de contacto"
  → Dialog: scrape email/phone/links
  → leads.enrichment_source='dom_contact_overlay'
```

---

## 8. Email Outreach (módulo separado)

```
Via email_queue → email_connections (SMTP/OAuth)
No depende de LinkedIn DOM.
Ver módulo email en el backend.
```

---

## 9. Optimización de Sigilo (PROMPT #30)

**Delays gaussian** (más humano que Math.random()):
```javascript
function gaussianDelay(mean, stdDev) {
  // Box-Muller transform
  const u1 = Math.random(), u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(500, mean + z * stdDev);
}
// Uso: await sleep(gaussianDelay(3000, 800));  // ~3s ± 0.8s
```

**Mejores horarios por acción**:
| Acción | Mejor ventana | Evitar |
|---|---|---|
| Conexiones | 09:00-11:00, 15:00-17:00 | Lunes AM, Viernes PM |
| Mensajes | 08:30-10:00, 16:00-18:00 | Fines de semana |
| Likes | Cualquier hora activa | Madrugada |
| Visitas | Con acción adjunta | Solo para spy |

**Variables de humanización** (ya en DB):
- `leads.profile_viewed_at` — cuándo se visitó el perfil por última vez
- `leads.last_liked_at` — cuándo se dio el último like
- `leads.last_message_sent_at` — cuándo se envió el último mensaje
