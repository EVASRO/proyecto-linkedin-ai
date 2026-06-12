# NexusAI — Fire Test Checklist v1.0

## PRE-REQUISITOS
- [ ] Chrome con extensión NexusAI cargada (extension-chrome/)
- [ ] LinkedIn abierto y sesión activa en otra pestaña
- [ ] App corriendo en localhost:3000
- [ ] Supabase studio abierto para verificar datos
- [ ] Engine encendido (verde en popup)

---

## BLOQUE 1 — AUTENTICACIÓN
- [ ] Login con email/password → redirige a /dashboard
- [ ] Refresh del token funciona (esperar 1h o simular token expirado)
- [ ] Logout → destruye sesión en extension y web

## BLOQUE 2 — EXTENSIÓN CHROME
- [ ] Popup muestra status "Conectado" con nombre de LinkedIn
- [ ] "Encender Engine" → estado cambia a verde
- [ ] queueCount muestra número correcto (incluye scheduled)
- [ ] last_action_log aparece tras una acción

## BLOQUE 3 — CAMPAÑAS + FLOW BUILDER
- [ ] Crear campaña con nombre + descripción
- [ ] Abrir FlowBuilder → agregar nodo Start → Connect → Delay (2 días) → Message
- [ ] Guardar workflow → verificar en Supabase que workflow_json.nodes tiene los 4 nodos
- [ ] Verificar que campaigns.ab_variant_a/b se sincronizaron (si A/B habilitado)
- [ ] Lanzar campaña → aparece task 'start_campaign_scraping' en engine_queue

## BLOQUE 4 — SCRAPING + COLA
- [ ] Con campaña lanzada, extensión abre pestaña de LinkedIn Search
- [ ] Al terminar scraping, leads aparecen en Supabase table leads con crm_column='extraido'
- [ ] leads.assigned_to = UUID del usuario propietario (no NULL) ← FIX 1
- [ ] engine_queue tiene tareas 'connect' con status='pending' para cada lead
- [ ] engine_queue tiene tareas 'message' con status='scheduled' para cada lead

## BLOQUE 5 — CONEXIÓN + MENSAJES
- [ ] processTick detecta task type='connect' → abre perfil LinkedIn → clic Connect
- [ ] handleActionDone recibe ACTION_DONE con reason='sent' → task→done, lead→conexion_enviada
- [ ] lead con conexion_aceptada: processTick detecta task type='message' (scheduled)
  - Si require_accepted=true y lead NO aceptó → task queda en scheduled (no done)
  - Si lead SÍ aceptó → mensaje enviado → task→done, message.status='sent'
- [ ] message.status en Smart Inbox: enviando→sent→delivered→read (íconos correctos)

## BLOQUE 6 — SMART INBOX + AUTOPILOT
- [ ] Mensaje entrante de prospect aparece en Smart Inbox
- [ ] Responder manualmente → message.status='sent' en <3s
- [ ] Activar Autopilot → agente configurado con system_prompt real del agente
- [ ] Mensaje de prospect llega → Claude genera respuesta usando knowledge base del agente
- [ ] Modo 'review': respuesta guardada como draft (message.status='draft')
- [ ] Modo 'auto': respuesta enviada automáticamente via engine_queue

## BLOQUE 7 — CRM
- [ ] Drag & drop de lead entre columnas → actualiza crm_column en Supabase
- [ ] Toggle vista lista → ver todos los leads en tabla
- [ ] Automation trigger: mover lead a 'reunion_agendada' → dispara task en engine_queue

## BLOQUE 8 — ANALYTICS
- [ ] Dashboard principal muestra KPIs reales (conexiones, mensajes, reuniones)
- [ ] Gráfico de actividad semanal refleja tasks completadas en engine_queue
- [ ] Funnel de conversión muestra % reales por etapa
- [ ] health_warnings detecta leads en múltiples campañas

## BLOQUE 9 — EQUIPO
- [ ] Página Equipo muestra miembros del workspace
- [ ] leadsAssigned = count de leads con assigned_to = ese miembro (no 0)
- [ ] meetings = count de leads con crm_column='reunion_agendada' por miembro

## BLOQUE 10 — SETTINGS
- [ ] Tab Perfil → actualizar nombre → se guarda en profiles
- [ ] Tab LinkedIn → sliders de límites diarios → se guardan en workspace_settings
- [ ] Tab Email → configurar SMTP → guardar → recibir email de prueba
- [ ] Tab Blacklist → agregar URL → verificar que extension la skipea
- [ ] Tab Webhooks → crear webhook → "Test" → endpoint recibe payload

## BLOQUE 11 — INBOUND (NUEVO)
- [ ] Generar post con IA (topic + tone + format) → contenido aparece en preview
- [ ] Clic "Publicar ahora" → task 'post_linkedin' insertada en engine_queue
- [ ] Extension detecta task → abre linkedin.com/feed → automatiza publicación
- [ ] Post publicado exitosamente → task→done en engine_queue
- [ ] En caso de error (botón no encontrado) → task→failed con last_error descriptivo

## BLOQUE 12 — TYPESCRIPT + BUILD
- [ ] npx tsc --noEmit → 0 errores
- [ ] npm run build → compilación exitosa sin errores
- [ ] No hay console.error en producción para flujos normales

---

## RESULTADO ESPERADO
- Todos los checks marcados = plataforma production-ready
- Cualquier check fallido = reportar con screenshot + log exacto de error

Fin del archivo.
