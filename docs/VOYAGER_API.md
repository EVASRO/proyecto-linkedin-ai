# Voyager API — Endpoints Documentados
> LinkedIn's internal REST API. Auditado 2026-06-18.

---

## Headers requeridos (todos los endpoints)

```javascript
const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';
const headers = {
  'csrf-token':                  csrfToken,
  'x-restli-protocol-version':   '2.0.0',
  'x-li-lang':                   'es_ES',
  'accept':                      'application/vnd.linkedin.normalized+json+2.1',
};
```

---

## Conexiones

### Enviar invitación (solo LI profileId estándar)
```
POST /voyager/api/growth/normInvitations
Content-Type: application/json

body: {
  "invitee": {
    "com.linkedin.voyager.growth.invitation.InviteeProfile": {
      "profileId": "ACoAABL0tAsBsrsKcMd_AhTK"
    }
  },
  "trackingId": "<uuid-base64>"
}

Respuestas:
  201 → Conexión enviada ✅
  400 → Ya existe / otro error
  301/302 → entityId SalesNav no soportado → usar DOM
  429 → Rate limit → respetar límite diario
```

### Invitaciones enviadas pendientes
```
GET /voyager/api/relationships/invitations?invitationType=SENT&start=0&count=40

Response: {
  elements: [{
    id, invitationType, sentTime,
    toMember: {
      profileId,
      firstName, lastName,
      miniProfile: { publicIdentifier }   // ← slug /in/username
    }
  }],
  paging: { count, start, total }
}
```

### Cancelar invitación enviada (withdraw)
```
DELETE /voyager/api/relationships/invitations/{invitationId}
Headers: csrf-token, x-restli-protocol-version: 2.0.0

Respuestas:
  204 → Cancelado ✅
  200 → Cancelado ✅ (algunas versiones)
  404 → Invitación ya no existe (aceptada o cancelada antes)
  403 → No autorizado
```

### Conexiones recientes
```
GET /voyager/api/relationships/connections?count=40&start=0&sortType=RECENTLY_ADDED

Response: {
  elements: [{
    miniProfile: {
      publicIdentifier,   // ← el slug /in/username
      entityUrn,          // ← urn:li:fsd_profile:ACoA...
      firstName, lastName
    }
  }]
}
```

---

## Perfiles

### Info de contacto (email, teléfono)
```
GET /voyager/api/identity/profiles/{publicIdentifier}/profileContactInfo

Response: {
  emailAddress: "user@example.com",   // null si privado
  phoneNumbers: [{ number, type }],
  twitterHandles: [{ name }],
  websites: [{ url, type }]
}

Usar publicIdentifier (slug), NO entityId.
```

### Perfil completo
```
GET /voyager/api/identity/profiles/{publicIdentifier}?decorate=...

Nota: muy pesado, evitar si solo se necesita el contactInfo.
```

### Resolver entityId SalesNav → publicIdentifier
```
GET /voyager/api/identity/profiles?memberIdentity={entityId}&count=1

Response: {
  elements: [{
    miniProfile: { publicIdentifier, entityUrn, firstName, lastName }
  }]
}

Usar cuando: profileUrl contiene /sales/lead/ACwAAE...
```

---

## Mensajes

### Crear conversación / enviar mensaje
```
POST /voyager/api/messaging/conversations
Content-Type: application/json

body: {
  "keyVersion": "LEGACY_INBOX",
  "conversationCreate": {
    "eventCreate": {
      "value": {
        "com.linkedin.voyager.messaging.create.MessageCreate": {
          "body": "Hola, ...",
          "attachments": [],
          "attributedBody": { "text": "Hola, ...", "attributes": [] }
        }
      }
    },
    "recipients": ["urn:li:fsd_profile:ACoAABL0..."],
    "subtype": "MEMBER_TO_MEMBER"
  }
}
```

---

## Notificaciones y red

### Conteo de notificaciones (ligero)
```
GET /voyager/api/notifications/tabBadgeCounts

Response: { newNotificationCount, newInvitationCount, newMessagesCount }
```

---

## Límites conocidos

| Endpoint | Límite aprox. | Notas |
|---|---|---|
| POST normInvitations | 100/día (cuenta normal) | Respetar workspace_settings.daily_connections_limit |
| GET invitations | Sin límite conocido | Llamar máx 2-3 veces por sesión |
| GET connections | Sin límite conocido | |
| POST messaging | 150/día | Respetar workspace_settings.daily_messages_limit |
| GET profileContactInfo | ~100/día (estimado) | Solo si hay leads con enrichment pendiente |

---

## Códigos de respuesta relevantes

| Código | Significado en contexto LI |
|---|---|
| 201 | Éxito (POST) |
| 200 | Éxito (GET) |
| 400 | Bad request / ya existe invitación |
| 401 | CSRF inválido — recargar página |
| 403 | Acción no permitida (bloqueado, privacidad) |
| 429 | Rate limit — pausar 30-60s mínimo |
| 301/302 | Redirect — entityId SalesNav no soportado por este endpoint |
