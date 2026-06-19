# 📚 Cazary.ai — Documentación de Referencia

Carpeta de conocimiento técnico auditado en vivo. Toda la inteligencia sobre
selectores, flujos y comportamientos de LinkedIn y Sales Navigator que alimenta
los prompts de automatización.

## Índice de documentos

| Archivo | Contenido |
|---|---|
| [`LINKEDIN_DOM_REFERENCE.md`](./LINKEDIN_DOM_REFERENCE.md) | Selectores DOM completos LI + SalesNav por página |
| [`AUTOMATION_FLOWS.md`](./AUTOMATION_FLOWS.md) | Flujos óptimos para cada una de las 10 acciones |
| [`PROMPT_CHANGELOG.md`](./PROMPT_CHANGELOG.md) | Historial de prompts aplicados, bugs encontrados y estado |
| [`SELECTOR_PATTERNS.md`](./SELECTOR_PATTERNS.md) | Cheat sheet rápido de selectores por plataforma |
| [`VOYAGER_API.md`](./VOYAGER_API.md) | Endpoints Voyager documentados con ejemplos de respuesta |

## Estado actual del motor (2026-06-18)

- ✅ PROMPT #26 — Connect flow (6 fixes: dialog, safety timer, fallbacks)
- ✅ PROMPT #27 — Check acceptance vía Voyager API (batch, 0 page views)
- ✅ PROMPT #28 — Like post vía activity tab
- ✅ PROMPT #28-B — Patch `findUnlikedButton()`: selector "Recomendar" como estrategia A
- ✅ PROMPT #29 — Find email vía Voyager profileContactInfo (+ fallback DOM, + enrichment_source)
- ✅ PROMPT #30 — Stealth: sleepGaussian, typeHuman, simulateCursorMove, inter-task delay
- ✅ PROMPT #31 — Connect SalesNav: "..." → dropdown → dialog connect-cta-form + typeHuman()
- ✅ PROMPT #32 — Mensajes: Voyager API + typeHumanContenteditable + verificación envío
- ✅ PROMPT #33 — Follow/Unfollow: aria-label estable + verificación + case bg.js (fix crítico)
- ✅ PROMPT #34 — Cancelar conexión pendiente (withdraw) — Voyager DELETE + DOM fallback + CRM reset
- ✅ PROMPT #35 — Email Outreach — case send_email + daily limit + failed marking + tokens empresa/cargo
