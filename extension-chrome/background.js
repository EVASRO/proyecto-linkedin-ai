// ============================================================
// NEXUSAI — GHOST ENGINE v3.0 — background.js
// Service worker MV3. Sin localhost. Todo via Supabase REST.
// ============================================================

importScripts('config.js');

const TICK_ALARM      = 'nexusai-tick';
const HEARTBEAT_ALARM = 'nexusai-heartbeat';

// ── Límites anti-ban por defecto ──────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  maxConnections:   50,
  maxMessages:      50,
  maxLikes:         30,
  delayMinSec:      180,
  delayMaxSec:      480,
  ultraSafe:        false,
  pauseWeekends:    false,
  activeHoursStart: 0,
  activeHoursEnd:   24,
  timezone:         'America/Lima',
};

// ── Auto-init al despertar el service worker ──────────────────────────────────
async function ensureInitialized() {
  const { supabase_token, supabase_workspace_id } = await chrome.storage.local.get([
    'supabase_token', 'supabase_workspace_id'
  ]);
  if (!supabase_token) return;

  const wsId = supabase_workspace_id ?? await getWorkspaceId();
  if (!wsId) return;

  // Sincronizar engine_running desde DB al arrancar el service worker
  try {
    const rows = await supabaseFetch(
      `ghost_engine_sessions?workspace_id=eq.${wsId}&select=status&limit=1`
    );
    const dbStatus = rows?.[0]?.status;
    if (dbStatus === 'running') {
      await chrome.storage.local.set({ engine_running: true });
    } else if (dbStatus === 'stopped' || dbStatus === 'paused') {
      await chrome.storage.local.set({ engine_running: false });
    }
  } catch (_) {}
}

// ── Arranque ──────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clearAll();
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 0.5 });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[cazary.ai] Alarms initialized on install/update');
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.clearAll();
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 0.5 });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[cazary.ai] Alarms initialized on startup');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Self-healing: ensure alarms exist
  const allAlarms = await chrome.alarms.getAll();
  const names = allAlarms.map(a => a.name);
  if (!names.includes(TICK_ALARM))      await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 0.5 });
  if (!names.includes(HEARTBEAT_ALARM)) await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });

  await ensureInitialized();
  if (alarm.name === TICK_ALARM)      await processTick();
  if (alarm.name === HEARTBEAT_ALARM) await sendHeartbeat();
});

// ── Mensajes desde popup y content script ─────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case 'LOGIN':
        try {
          await supabaseSignIn(msg.email, msg.password);
          await loadWorkspaceSettings();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
        break;

      case 'LOGOUT':
        await chrome.storage.local.remove([
          'supabase_token', 'supabase_refresh_token',
          'supabase_user_id', 'supabase_workspace_id',
          'engine_running', 'daily_stats', 'action_counter',
        ]);
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        sendResponse(await getStatus());
        break;

      case 'START_ENGINE': {
        const token = await getStoredToken();
        if (!token) { sendResponse({ ok: false, error: 'No autenticado' }); break; }
        const wsId = await getWorkspaceId();
        if (!wsId) { sendResponse({ ok: false, error: 'No se pudo obtener workspace. Cierra sesión y vuelve a entrar.' }); break; }
        await chrome.storage.local.set({ engine_running: true });
        // Sincronizar stats al arrancar (evita contar mal desde 0)
        const freshWsId = await getWorkspaceId();
        if (freshWsId) await getTodayStats(freshWsId);
        await sendHeartbeat();
        await syncLinkedInAccount();
        sendResponse({ ok: true });
        break;
      }

      case 'STOP_ENGINE':
        await chrome.storage.local.set({ engine_running: false, processing: false });
        await sendHeartbeat();
        sendResponse({ ok: true });
        break;

      case 'toggle_engine': {
        const { engine_running: isRunning } = await chrome.storage.local.get('engine_running');
        if (isRunning) {
          // Pausar
          await chrome.storage.local.set({ engine_running: false, processing: false });
          await sendHeartbeat();
          sendResponse({ ok: true, running: false });
        } else {
          // Arrancar
          const tok = await getStoredToken();
          if (!tok) { sendResponse({ ok: false, error: 'No autenticado' }); break; }
          const wId = await getWorkspaceId();
          if (!wId) { sendResponse({ ok: false, error: 'No workspace' }); break; }
          await chrome.storage.local.set({ engine_running: true });
          await getTodayStats(wId);
          await sendHeartbeat();
          sendResponse({ ok: true, running: true });
        }
        break;
      }

      case 'ACTION_DONE':
        await handleActionDone(msg.taskId, msg.result);
        sendResponse({ ok: true });
        break;

      case 'FORCE_INBOX_CHECK': {
        const { supabase_workspace_id: wsIdForce } = await chrome.storage.local.get('supabase_workspace_id');
        if (wsIdForce) await scheduleInboxCheck(wsIdForce);
        sendResponse({ ok: true });
        break;
      }

      case 'LINKEDIN_PROFILE_DETECTED': {
        await chrome.storage.local.set({ linkedin_profile: msg.profile });
        await syncLinkedInAccount();
        sendResponse({ ok: true });
        break;
      }

      case 'PROFILE_EXTRACTED':
        await handleProfileExtracted(msg.data);
        sendResponse({ ok: true });
        break;

      case 'MESSAGE_RECEIVED':
        await handleMessageReceived(msg.data);
        sendResponse({ ok: true });
        break;

      case 'COUNT_RESULT':
        await handleCountResult(msg.campaignId, msg.segmentId, msg.count);
        sendResponse({ ok: true });
        break;

      case 'report_selector_failure': {
        // Fire-and-forget — no bloquear el engine
        (async () => {
          try {
            const wsId = await getWorkspaceId();
            if (!wsId) return;

            // Dedupe: no insertar si ya existe el mismo failure en las últimas 2h
            const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
            const existing = await supabaseFetch(
              `selector_failures?workspace_id=eq.${wsId}` +
              `&platform=eq.${encodeURIComponent(msg.platform)}` +
              `&action=eq.${encodeURIComponent(msg.selectorAction)}` +
              `&selector_key=eq.${encodeURIComponent(msg.selectorKey)}` +
              `&created_at=gte.${since}&select=id&limit=1`
            ).catch(() => null);
            if (existing?.length > 0) {
              console.log(`[cazary.ai][SelectorHealing] Failure ya registrado recientemente: ${msg.selectorKey}`);
              return;
            }

            const inserted = await supabaseFetch('selector_failures', {
              method: 'POST',
              prefer: 'return=representation',
              body: JSON.stringify({
                workspace_id:   wsId,
                platform:       msg.platform,
                action:         msg.selectorAction,
                selector_key:   msg.selectorKey,
                selector_tried: msg.selectorTried,
                html_context:   msg.htmlContext ?? null,
                page_url:       msg.pageUrl ?? null,
                status:         'pending',
              }),
            }).catch(() => null);

            const failureId = inserted?.[0]?.id;
            if (failureId) {
              console.log(`[cazary.ai][SelectorHealing] Failure registrado: ${msg.selectorKey} → ${failureId}`);
              triggerSelectorAnalysis(failureId);
            }
          } catch (err) {
            console.warn('[cazary.ai][SelectorHealing] Error registrando failure:', err?.message);
          }
        })();
        sendResponse({ ok: true });
        break;
      }

      case 'get_selector_overrides': {
        try {
          const wsId = msg.wsId ?? await getWorkspaceId();
          if (!wsId) { sendResponse([]); break; }
          const overrides = await supabaseFetch(
            `selector_overrides?workspace_id=eq.${wsId}&active=eq.true`
          ).catch(() => []);
          sendResponse(overrides ?? []);
        } catch (_) {
          sendResponse([]);
        }
        break;
      }

      case 'RESET_PROCESSING':
        await chrome.storage.local.set({
          processing:            false,
          processing_started_at: null,
          processing_task_id:    null,
        });
        sendResponse({ ok: true });
        break;

      case 'SAVE_SETTINGS': {
        await chrome.storage.local.set({ settings: msg.settings });
        // También persistir en Supabase workspace_settings
        const wsIdSave = await getWorkspaceId();
        if (wsIdSave) {
          await supabaseFetch(`workspace_settings?workspace_id=eq.${wsIdSave}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: JSON.stringify({
              daily_connections_limit: msg.settings.maxConnections,
              daily_messages_limit:    msg.settings.maxMessages,
              ultra_safe_mode:         msg.settings.ultraSafe    ?? true,
              pause_on_weekends:       msg.settings.pauseWeekends ?? true,
            }),
          });
        }
        sendResponse({ ok: true });
        break;
      }

      case 'NEXUSAI_COUNT_LEADS': {
        // Conteo rápido desde el wizard — usa tab de LinkedIn existente, sin abrir nueva
        const liTabs = await chrome.tabs.query({ url: ['*://*.linkedin.com/search/*', '*://*.linkedin.com/sales/*'] });
        if (!liTabs.length) {
          sendResponse({ count: null, needsNavigation: true });
          break;
        }
        try {
          const resp = await Promise.race([
            chrome.tabs.sendMessage(liTabs[0].id, { action: 'count_leads_quick' }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]);
          sendResponse(resp ?? { count: null, error: 'NO_RESPONSE' });
        } catch (e) {
          sendResponse({ count: null, error: e.message === 'timeout' ? 'TIMEOUT' : e.message });
        }
        break;
      }

      case 'EXTRACT_AND_GENERATE': {
        // Extraer perfil de la tab activa y generar mensaje via API Next.js
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) { sendResponse({ ok: false, error: 'Sin pestaña activa' }); break; }
        try {
          const resp = await chrome.tabs.sendMessage(tabs[0].id, { action: 'extract_profile' });
          if (!resp?.success) { sendResponse({ ok: false, error: 'No se pudo extraer el perfil' }); break; }
          const profile = resp.data;
          // Guardar lead en Supabase
          const wsId = await getWorkspaceId();
          if (wsId) {
            await supabaseFetch('leads', {
              method: 'POST',
              prefer: 'return=minimal',
              body: JSON.stringify({
                workspace_id: wsId,
                full_name:    profile.name,
                headline:     profile.headline ?? '',
                company:      profile.company  ?? '',
                linkedin_url: profile.url,
                status:       'nuevo',
                value:        0,
                score:        0,
                custom_tags:  [],
              }),
            });
          }
          // Generar mensaje via Next.js API (no backend Python)
          const leadProfile = [
            `Nombre: ${profile.name}`,
            profile.headline ? `Cargo: ${profile.headline}` : '',
            profile.company  ? `Empresa: ${profile.company}`  : '',
            profile.url      ? `URL: ${profile.url}`          : '',
          ].filter(Boolean).join('\n');

          const nexusUrl = `${DASHBOARD_URL}/api/generate-message`;
          const msgRes = await fetch(nexusUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ lead_profile: leadProfile }),
          });
          const msgData = await msgRes.json();
          sendResponse({ ok: true, profile, message: msgData.message ?? '' });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
        break;
      }

      case 'SEND_GENERATED_MESSAGE': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) { sendResponse({ ok: false, error: 'Sin pestaña activa' }); break; }
        try {
          const r = await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'send_message', payload: { messageText: msg.message },
          });
          sendResponse(r ?? { ok: false, error: 'Sin respuesta' });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
        break;
      }
    }
  })();
  return true;
});

// ── Tick principal (cada 30s) ─────────────────────────────────────────────────
async function processTick() {
  const { engine_running } = await chrome.storage.local.get('engine_running');
  if (!engine_running) return;
  // TODO: Re-enable for production
  // if (!await isActiveHour()) return;
  // TODO: Re-enable for production
  // if (await isWeekendPaused()) return;

  // Validate token before hitting Supabase — avoids "Failed to fetch" on expiry
  const token = await getStoredToken();
  if (!token) {
    console.warn('[cazary.ai] Token inválido, saltando tick');
    return;
  }

  const wsId = await getWorkspaceId();
  if (!wsId) return;

  // Check de límites desde Supabase (fuente de verdad)
  const _settings = await getSettings();
  const _stats = await getTodayStats(wsId);
  if (_stats.connections >= _settings.maxConnections &&
      _stats.messages >= _settings.maxMessages) {
    console.log('[cazary.ai] Límite diario alcanzado (Supabase), saltando tick');
    return;
  }

  const { processing } = await chrome.storage.local.get('processing');
  if (processing) {
    const { processing_started_at, processing_task_id } =
      await chrome.storage.local.get(['processing_started_at', 'processing_task_id']);
    const elapsed = processing_started_at ? Date.now() - processing_started_at : 0;
    if (elapsed > 60000) {
      console.warn('[cazary.ai] Watchdog activado: liberando processing atascado');
      await chrome.storage.local.set({ processing: false, processing_started_at: null });
      if (processing_task_id) {
        await supabaseFetch(`engine_queue?id=eq.${processing_task_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({ status: 'failed', last_error: 'Watchdog timeout 60s' }),
        }).catch(() => {});
      }
      // Continuar con el siguiente tick
    } else {
      return;
    }
  }

  // ── Cooldown adaptativo por errores consecutivos ───────────────────────────
  const consecutiveErrors = await getConsecutiveErrors();
  if (consecutiveErrors > 0) {
    const { last_error_at } = await chrome.storage.local.get('last_error_at');
    const delayMs = getAdaptiveDelay(consecutiveErrors);
    const elapsed = last_error_at ? Date.now() - last_error_at : Infinity;
    if (elapsed < delayMs) {
      const remaining = Math.round((delayMs - elapsed) / 60000);
      console.log(`[cazary.ai][Safety] Cooldown activo (${consecutiveErrors} errores) → esperando ${remaining}min más`);
      return;
    }
  }

  try {
    const now = new Date().toISOString();

    // Fetch only tasks belonging to active, non-archived campaigns
    const activeCampaigns = await supabaseFetch(
      `campaigns?workspace_id=eq.${wsId}&status=eq.active&deleted_at=is.null&select=id,priority`
    ).catch(() => []);
    const activeCampaignIds = (activeCampaigns ?? []).map(c => c.id);

    let tasks = [];
    if (activeCampaignIds.length > 0) {
      // Order by campaign priority (desc) then scheduled_at (asc)
      const sortedIds = (activeCampaigns ?? [])
        .sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5))
        .map(c => c.id);
      tasks = await supabaseFetch(
        `engine_queue?workspace_id=eq.${wsId}&status=in.(pending,scheduled)` +
        `&campaign_id=in.(${sortedIds.join(',')})` +
        `&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=1`
      ).catch(() => []) ?? [];
    }

    if (!tasks || tasks.length === 0) {
      // SIEMPRE procesar check_connection y check_inbox sin filtro de campaña activa
      const maintenanceTasks = await supabaseFetch(
        `engine_queue?workspace_id=eq.${wsId}` +
        `&action_type=in.(check_connection,check_inbox)` +
        `&status=in.(pending,scheduled)` +
        `&scheduled_at=lte.${now}` +
        `&order=scheduled_at.asc&limit=1`
      ).catch(() => []) ?? [];
      if (maintenanceTasks.length > 0) tasks = maintenanceTasks;
    }

    if (!tasks || tasks.length === 0) {
      // Sin tareas — detectar conexiones aceptadas en segundo plano
      await detectNewConnections(wsId).catch(() => {});

      // Verificar inbox cada ~15 min
      const { last_inbox_check } = await chrome.storage.local.get('last_inbox_check');
      const minsSinceCheck = last_inbox_check
        ? (Date.now() - last_inbox_check) / 60000
        : 99;
      if (minsSinceCheck >= 15) {
        await scheduleInboxCheck(wsId);
        await chrome.storage.local.set({ last_inbox_check: Date.now() });
      }

      // Procesar cola de emails pendientes
      await processEmailQueue(wsId).catch(() => {});

      return;
    }

    const task = tasks[0];
    await chrome.storage.local.set({ processing: true });
    await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body:   JSON.stringify({ status: 'processing' }),
    });
    await executeTask(task);
  } catch (err) {
    console.error('[cazary.ai] Error en tick:', err.message);
    await chrome.storage.local.set({ processing: false });
  }
}

// ── Detectar nuevas conexiones aceptadas ──────────────────────────────────────
async function detectNewConnections(wsId) {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // >30min
  const pendingLeads = await supabaseFetch(
    `leads?workspace_id=eq.${wsId}&crm_column=eq.conexion_enviada` +
    `&connection_sent_at=lte.${cutoff}` +
    `&select=id,linkedin_url,campaign_id,connection_sent_at&limit=20`,
    { method: 'GET' }
  ).catch(() => []);

  if (!pendingLeads?.length) return;

  for (const lead of pendingLeads) {
    const profileUrl = lead.linkedin_url ?? lead.salesnav_url;
    if (!profileUrl) continue;
    const existing = await supabaseFetch(
      `engine_queue?lead_id=eq.${lead.id}&action_type=eq.check_connection&status=eq.pending&select=id`,
      { method: 'GET' }
    ).catch(() => []);
    if (existing?.length) continue;

    await supabaseFetch('engine_queue', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id: wsId,
        campaign_id:  lead.campaign_id,
        lead_id:      lead.id,
        task_type:    'check_connection',
        action_type:  'check_connection',
        priority:     1,
        scheduled_at: new Date().toISOString(),
        payload:      { profile_url: profileUrl, lead_id: lead.id, campaign_id: lead.campaign_id },
      }),
    }).catch(() => {});
  }
}

// ── Helpers de comunicación con content script ────────────────────────────────

async function waitForTabComplete(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, timeout);
  });
}

async function sendToContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    // Content script not loaded yet — inject and retry
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await sleep(1500);
      await chrome.tabs.sendMessage(tabId, message);
    } catch (e2) {
      console.error('[cazary.ai] sendToContentScript failed:', e2.message);
      throw e2;
    }
  }
}

// ── Ejecutar tarea ────────────────────────────────────────────────────────────
async function executeTask(task) {
  let tab = await getLinkedInTab();

  if (!tab) {
    await chrome.tabs.create({ url: 'https://www.linkedin.com', active: false });
    await sleep(5000);
    await chrome.storage.local.set({ processing: false });
    return;
  }

  try {
    // Double-check: verify campaign is still active before executing
    // EXCEPCIÓN: check_connection y check_inbox son tareas de mantenimiento que deben
    // correr siempre, independientemente del estado de la campaña
    const MAINTENANCE_TASKS = ['check_connection', 'check_inbox'];
    if (task.campaign_id && !MAINTENANCE_TASKS.includes(task.action_type)) {
      const campCheck = await supabaseFetch(
        `campaigns?id=eq.${task.campaign_id}&select=status,deleted_at&limit=1`
      ).catch(() => null);
      const camp = campCheck?.[0];
      if (!camp || camp.status !== 'active' || camp.deleted_at) {
        console.log(`[cazary.ai] Campaign ${task.campaign_id} no está activa, marcando tarea como paused`);
        await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'paused' }),
        }).catch(() => {});
        await chrome.storage.local.set({ processing: false });
        return;
      }
    }

    const profileUrl = task.payload?.profile_url ?? task.payload?.linkedin_url ?? null;

    // Cases that navigate to a profile URL need it to be present
    // check_inbox uses inboxUrl from payload, not profileUrl
    const needsProfileUrl = ['view_profile', 'connect', 'message', 'extract_profile', 'check_connection'];
    if (needsProfileUrl.includes(task.action_type) && !profileUrl) {
      await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body:   JSON.stringify({ status: 'failed', last_error: 'Missing profile_url in payload' }),
      });
      await chrome.storage.local.set({ processing: false });
      return;
    }

    // ── Blacklist check ────────────────────────────────────────────────────────
    if (['connect', 'message', 'view_profile'].includes(task.action_type) && profileUrl) {
      const wsId = await getWorkspaceId();
      if (wsId) {
        const blacklisted = await supabaseFetch(
          `blacklist?workspace_id=eq.${wsId}&linkedin_url=eq.${encodeURIComponent(profileUrl)}&select=id&limit=1`
        ).catch(() => []);
        if (blacklisted?.length) {
          console.log('[cazary.ai] Lead en blacklist, saltando:', profileUrl);
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ status: 'done', last_error: 'blacklisted' }),
          });
          await chrome.storage.local.set({ processing: false });
          return;
        }
      }
    }

    // ── Límites diarios por tipo ───────────────────────────────────────────────
    if (['connect', 'message', 'view_profile'].includes(task.action_type)) {
      const wsId = await getWorkspaceId();
      if (wsId) {
        const withinLimits = await checkDailyLimitsByType(wsId, task.action_type);
        if (!withinLimits) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              status:       'pending',
              scheduled_at: tomorrow.toISOString(),
              last_error:   'daily_limit_reached - rescheduled',
            }),
          });
          await chrome.storage.local.set({ processing: false });
          return;
        }
      }
    }

    switch (task.action_type) {
      case 'view_profile':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(2000 + Math.random() * 1000);
        await sendToContentScript(tab.id, {
          action: 'execute_task',
          task:   'view_profile',
          taskId: task.id,
        });
        break;

      case 'connect': {
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 2000);
        await chrome.tabs.update(tab.id, { active: true });
        await sleep(500);
        const connectLeadId = task.payload?.lead_id ?? null;
        const rawNote       = task.payload?.note ?? '';
        const finalNote     = await interpolateVariables(rawNote, connectLeadId);
        const connectLead   = connectLeadId
          ? await supabaseFetch(
              `leads?id=eq.${connectLeadId}&select=full_name,company,headline,location`,
              { method: 'GET' }
            ).then(r => r?.[0] ?? null).catch(() => null)
          : null;
        await sendToContentScript(tab.id, {
          action:          'execute_task',
          task:            'connect',
          taskId:          task.id,
          note:            finalNote,
          addNote:         task.payload?.add_note ?? false,
          requirePageView: task.payload?.require_page_view ?? false,
          lead:       connectLead ? (() => {
            const parts     = (connectLead.full_name || '').trim().split(/\s+/);
            const firstName = parts[0] || '';
            const lastName  = parts.slice(1).join(' ') || '';
            return {
              full_name:  connectLead.full_name || '',
              first_name: firstName,
              last_name:  lastName,
              company:    connectLead.company   || '',
              job_title:  connectLead.headline  || '',
              location:   connectLead.location  || '',
            };
          })() : null,
          leadId:     connectLeadId,
          campaignId: task.payload?.campaign_id ?? null,
        });
        break;
      }

      case 'message': {
        // Si el task requiere conexión aceptada, verificar antes de ejecutar
        if (task.payload?.require_accepted) {
          const leadCheck = await supabaseFetch(
            `leads?id=eq.${task.payload.lead_id}&select=crm_column`,
            { method: 'GET' }
          ).catch(() => null);
          const col = leadCheck?.[0]?.crm_column;
          const accepted = ['conexion_aceptada', 'en_conversacion', 'reunion_agendada', 'cliente'].includes(col);
          if (!accepted) {
            // Reschedule +4h — no dejar en 'processing' (quedaría bloqueado)
            console.log(`[cazary.ai] Mensaje pendiente — lead ${task.payload.lead_id} aún no aceptó (${col}) → reschedule +4h`);
            const reschedAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
            await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({ status: 'scheduled', scheduled_at: reschedAt }),
            }).catch(() => {});
            await chrome.storage.local.set({ processing: false });
            return;
          }
        }

        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 2000);
        await chrome.tabs.update(tab.id, { active: true });
        await sleep(500);
        const msgLeadId = task.payload?.lead_id ?? null;
        const rawText   = task.payload?.message_text ?? '';
        const finalText = await interpolateVariables(rawText, msgLeadId);
        const msgLead   = msgLeadId
          ? await supabaseFetch(
              `leads?id=eq.${msgLeadId}&select=full_name,company,headline,location`,
              { method: 'GET' }
            ).then(r => r?.[0] ?? null).catch(() => null)
          : null;
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'message',
          taskId:     task.id,
          text:       finalText,
          lead:       msgLead ? (() => {
            const parts     = (msgLead.full_name || '').trim().split(/\s+/);
            const firstName = parts[0] || '';
            const lastName  = parts.slice(1).join(' ') || '';
            return {
              full_name:  msgLead.full_name || '',
              first_name: firstName,
              last_name:  lastName,
              company:    msgLead.company   || '',
              job_title:  msgLead.headline  || '',
              location:   msgLead.location  || '',
            };
          })() : null,
          leadId:     msgLeadId,
          campaignId: task.payload?.campaign_id ?? null,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id:    task.id,
          processing_task_type:  'message',
        });
        break;
      }

      case 'count_leads':
        await chrome.tabs.update(tab.id, { url: task.payload?.search_url });
        await waitForTabComplete(tab.id);
        await sleep(4000 + Math.random() * 2000);
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'count_leads',
          taskId:     task.id,
          campaignId: task.payload?.campaign_id ?? null,
          segmentId:  task.payload?.segment_id  ?? null,
        });
        break;

      case 'extract_profile':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(2000 + Math.random() * 1000);
        await sendToContentScript(tab.id, {
          action: 'execute_task',
          task:   'extract_profile',
          taskId: task.id,
          leadId: task.payload?.lead_id ?? null,
        });
        break;

      case 'check_connection':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 1000);
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'check_connection',
          taskId:     task.id,
          leadId:     task.payload?.lead_id     ?? null,
          campaignId: task.payload?.campaign_id ?? null,
        });
        break;

      case 'check_inbox': {
        const inboxUrl = task.payload?.inbox_url ?? 'https://www.linkedin.com/messaging/';
        await chrome.tabs.update(tab.id, { url: inboxUrl });
        await waitForTabComplete(tab.id);
        await sleep(4000 + Math.random() * 1000);
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'check_inbox',
          taskId:     task.id,
          campaignId: task.payload?.campaign_id ?? null,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id:    task.id,
          processing_task_type:  'check_inbox',
        });
        break;
      }

      case 'withdraw': {
        const profileUrl = task.payload?.linkedin_url ?? task.payload?.salesnav_url;
        if (!profileUrl) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ status: 'failed', last_error: 'No profile URL' }),
          }).catch(() => {});
          await chrome.storage.local.set({ processing: false });
          return;
        }
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 1000);
        await sendToContentScript(tab.id, {
          action: 'execute_task', task: 'withdraw',
          taskId: task.id, leadId: task.payload?.lead_id ?? null,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id: task.id, processing_task_type: 'withdraw',
        });
        break;
      }

      case 'find_email': {
        const profileUrl = task.payload?.linkedin_url ?? task.payload?.salesnav_url;
        if (!profileUrl) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ status: 'failed', last_error: 'No profile URL' }),
          }).catch(() => {});
          await chrome.storage.local.set({ processing: false });
          return;
        }
        if (task.payload?.skip_if_exists) {
          const leadData = await supabaseFetch(
            `leads?id=eq.${task.payload.lead_id}&select=email`, { method: 'GET' }
          ).catch(() => null);
          if (leadData?.[0]?.email) {
            await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({ status: 'done', executed_at: new Date().toISOString(),
                                    last_error: 'skipped: already has email' }),
            }).catch(() => {});
            await chrome.storage.local.set({ processing: false });
            return;
          }
        }
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 1500);
        await sendToContentScript(tab.id, {
          action: 'execute_task', task: 'find_email',
          taskId: task.id, leadId: task.payload?.lead_id ?? null,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id: task.id, processing_task_type: 'find_email',
        });
        break;
      }

      case 'find_phone': {
        const profileUrl = task.payload?.linkedin_url ?? task.payload?.salesnav_url;
        if (!profileUrl) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ status: 'failed', last_error: 'No profile URL' }),
          }).catch(() => {});
          await chrome.storage.local.set({ processing: false });
          return;
        }
        if (task.payload?.skip_if_exists) {
          const leadData = await supabaseFetch(
            `leads?id=eq.${task.payload.lead_id}&select=phone`, { method: 'GET' }
          ).catch(() => null);
          if (leadData?.[0]?.phone) {
            await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({ status: 'done', executed_at: new Date().toISOString(),
                                    last_error: 'skipped: already has phone' }),
            }).catch(() => {});
            await chrome.storage.local.set({ processing: false });
            return;
          }
        }
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 1500);
        await sendToContentScript(tab.id, {
          action: 'execute_task', task: 'find_phone',
          taskId: task.id, leadId: task.payload?.lead_id ?? null,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id: task.id, processing_task_type: 'find_phone',
        });
        break;
      }

      case 'connect_email': {
        const leadData = await supabaseFetch(
          `leads?id=eq.${task.payload?.lead_id}&select=email,full_name`, { method: 'GET' }
        ).catch(() => null);
        const leadEmail = leadData?.[0]?.email;
        if (!leadEmail) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ status: 'failed', last_error: 'Lead has no email in DB' }),
          }).catch(() => {});
          await chrome.storage.local.set({ processing: false });
          return;
        }
        const inviteUrl = `https://www.linkedin.com/people/invite-by-email/?emailAddress=${encodeURIComponent(leadEmail)}`;
        await chrome.tabs.update(tab.id, { url: inviteUrl });
        await waitForTabComplete(tab.id);
        await sleep(3500 + Math.random() * 1500);
        let ceNote = task.payload?.connection_note ?? '';
        if (ceNote && task.payload?.lead_id) {
          ceNote = await interpolateVariables(ceNote, task.payload.lead_id);
        }
        await sendToContentScript(tab.id, {
          action: 'execute_task', task: 'connect_email',
          taskId: task.id, leadId: task.payload?.lead_id ?? null,
          addNote: task.payload?.add_note ?? false,
          note: ceNote,
          email: leadEmail,
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id: task.id, processing_task_type: 'connect_email',
        });
        break;
      }

      case 'post_linkedin': {
        const feedUrl = 'https://www.linkedin.com/feed/';
        await chrome.tabs.update(tab.id, { url: feedUrl });
        await waitForTabComplete(tab.id);
        await sleep(4000 + Math.random() * 2000);
        await sendToContentScript(tab.id, {
          action:  'execute_task',
          task:    'post_linkedin',
          taskId:  task.id,
          content: task.payload?.content ?? '',
        });
        await chrome.storage.local.set({
          processing_started_at: Date.now(),
          processing_task_id:    task.id,
          processing_task_type:  'post_linkedin',
        });
        break;
      }

      case 'start_campaign_scraping': {
        const campaignId = task.payload?.campaign_id;
        if (!campaignId) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body:   JSON.stringify({ status: 'failed', last_error: 'Missing campaign_id' }),
          });
          await chrome.storage.local.set({ processing: false });
          return;
        }

        // Check engine_running guard
        const { engine_running: er } = await chrome.storage.local.get('engine_running');
        if (!er) {
          await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body:   JSON.stringify({ status: 'failed', last_error: 'Engine not running' }),
          });
          await chrome.storage.local.set({ processing: false });
          return;
        }

        // Mark queue task done — scraping runs async
        await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'done', executed_at: new Date().toISOString() }),
        });
        await chrome.storage.local.set({ processing: false });

        const campRows = await supabaseFetch(
          `campaigns?id=eq.${campaignId}&select=id,name,workflow_json,workspace_id,ab_test_enabled,ab_variant_a,ab_variant_b,ab_winner`
        );
        const campaign = campRows?.[0];
        if (!campaign) return;

        const segments = campaign.workflow_json?.segments || [];
        for (const segment of segments) {
          if (segment.status !== 'active') continue;
          const searchUrl = segment.searchUrl || segment.url || segment.salesNavUrl;
          if (!searchUrl) continue;

          console.log(`[NexusAI Scraper] Iniciando extracción para segmento: ${segment.name}`);

          await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body:   JSON.stringify({ status: 'active' }),
          }).catch(() => {});

          scrapeSegmentProfiles(campaign, segment, searchUrl).catch((err) =>
            console.error('[NexusAI Scraper] Fatal error:', err)
          );
        }
        return; // skip normal delay scheduling
      }

      default:
        await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'failed', last_error: `Unknown action_type: ${task.action_type}` }),
        });
        await chrome.storage.local.set({ processing: false });
        return;
    }

    // Minimizar ventana del engine para no interrumpir al usuario
    // Solo si hay otra ventana disponible
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const engineWindow = windows.find(w => w.focused);
    if (windows.length > 1 && engineWindow) {
      await chrome.windows.update(engineWindow.id, { state: 'minimized' }).catch(() => {});
    }

    // Registrar timestamp e id de la tarea en curso para el watchdog
    await chrome.storage.local.set({
      processing_started_at: Date.now(),
      processing_task_id:    task.id,
    });

  } catch (err) {
    await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({
        status:     'failed',
        last_error: err.message,
        attempts:   (task.attempts ?? 0) + 1,
      }),
    });
    await chrome.storage.local.set({ processing: false });
  }
}

// ── LinkedIn account sync ─────────────────────────────────────────────────────
async function syncLinkedInAccount() {
  const wsId  = await getWorkspaceId();
  const token = await getStoredToken();
  if (!wsId || !token) return;

  const { linkedin_profile } = await chrome.storage.local.get('linkedin_profile');
  if (!linkedin_profile?.name) return;

  try {
    await supabaseFetch('linkedin_accounts?on_conflict=workspace_id', {
      method:  'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        workspace_id:            wsId,
        name:                    linkedin_profile.name,
        profile_url:             linkedin_profile.profile_url ?? '',
        headline:                linkedin_profile.headline    ?? '',
        avatar_url:              linkedin_profile.avatar_url  ?? '',
        status:                  'connected',
        connection_mode:         'extension',
        daily_connection_limit:  20,
        daily_message_limit:     30,
        last_synced_at:          new Date().toISOString(),
      }),
    });
    console.log('[cazary.ai] LinkedIn account synced:', linkedin_profile.name);
  } catch (_) {}
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
async function sendHeartbeat() {
  const wsId = await getWorkspaceId();
  if (!wsId) return;

  // Sync LinkedIn account on every heartbeat (idempotent upsert)
  await syncLinkedInAccount();

  // ── Poll settings_events: consume comandos del dashboard ─────────────────
  try {
    const events = await supabaseFetch(
      `settings_events?workspace_id=eq.${wsId}&consumed=eq.false&order=created_at.asc&limit=10`
    );
    if (Array.isArray(events) && events.length > 0) {
      for (const evt of events) {
        if (evt.event_type === 'RESUME_ENGINE') {
          await chrome.storage.local.set({ engine_running: true });
          console.log('[cazary.ai] settings_events → RESUME_ENGINE');
        } else if (evt.event_type === 'PAUSE_ENGINE') {
          await chrome.storage.local.set({ engine_running: false, processing: false });
          console.log('[cazary.ai] settings_events → PAUSE_ENGINE');
        }
        // Marcar como consumido
        await supabaseFetch(`settings_events?id=eq.${evt.id}`, {
          method:  'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body:    JSON.stringify({ consumed: true }),
        });
      }
    }
  } catch (err) {
    console.warn('[cazary.ai] settings_events poll failed:', err?.message ?? err);
  }

  const { engine_running } = await chrome.storage.local.get('engine_running');
  // Leer stats del caché (ya actualizado por getTodayStats en el último tick)
  const { daily_stats } = await chrome.storage.local.get('daily_stats');

  try {
    await supabaseFetch('ghost_engine_sessions?on_conflict=workspace_id', {
      method:  'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        workspace_id:       wsId,
        status:             engine_running ? 'running' : 'stopped',
        connections_sent:   daily_stats?.connections ?? 0,
        messages_sent:      daily_stats?.messages    ?? 0,
        actions_count:      (daily_stats?.connections ?? 0) + (daily_stats?.messages ?? 0),
        last_heartbeat_at:  new Date().toISOString(),
        metadata: {
          connections_today: daily_stats?.connections ?? 0,
          messages_today:    daily_stats?.messages    ?? 0,
          likes_today:       daily_stats?.likes       ?? 0,
        },
      }),
    });
  } catch (err) {
    console.warn('[cazary.ai] Heartbeat failed:', err?.message ?? err);
  }

  // Emitir estado al popup si está abierto
  const status = await getStatus();
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: status }).catch(() => {});
}

// ── Helper: derivar plataforma de origen desde URL del lead ──────────────────
async function getLeadSource(leadId, wsId) {
  const lead = await supabaseFetch(
    `leads?id=eq.${leadId}&select=linkedin_url`, { method: 'GET' }
  ).catch(() => null);
  const url = lead?.[0]?.linkedin_url ?? '';
  return url.includes('sales/lead') || url.includes('salesnav') ? 'salesnav' : 'linkedin';
}

// ── Handlers de resultados del content script ─────────────────────────────────
async function handleActionDone(taskId, result) {
  const wsId = await getWorkspaceId();

  // 1. Stats diarias — siempre liberar processing en finally
  // El PATCH final a engine_queue se hace al final, solo si result.success
  try {
    const { action_counter } = await chrome.storage.local.get('action_counter');
    const newCount = (action_counter ?? 0) + 1;
    await chrome.storage.local.set({ action_counter: newCount });

    const { daily_stats } = await chrome.storage.local.get('daily_stats');
    const stats = daily_stats ?? { connections: 0, messages: 0, likes: 0, views: 0, date: todayStr() };
    if (stats.date !== todayStr())
      Object.assign(stats, { connections: 0, messages: 0, likes: 0, views: 0, date: todayStr() });
    if (result.action === 'connect' && result.success &&
        result.reason !== 'already_connected' && result.reason !== 'already_pending')
      stats.connections++;
    if (result.action === 'message'      && result.success) stats.messages++;
    if (result.action === 'like'         && result.success) stats.likes++;
    if (result.action === 'view_profile' && result.success) stats.views++;
    await chrome.storage.local.set({ daily_stats: stats });

    // Re-sync desde Supabase cada 10 acciones (corrige drift)
    if (newCount % 10 === 0) {
      const freshStats = await getTodayStats(wsId);
      console.log('[cazary.ai] Re-sync stats cada 10 acciones:', freshStats);
    }
  } finally {
    await chrome.storage.local.set({
      processing:            false,
      processing_started_at: null,
      processing_task_id:    null,
    });
  }

  // 3. Manejar fallos con lógica de reintento
  if (result.success === false) {
    if (result.reason === 'daily_limit_reached') {
      console.warn('[cazary.ai] LinkedIn daily limit → pausando engine');
      await chrome.storage.local.set({ engine_running: false });
      await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({
          status:       'pending',
          scheduled_at: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
          last_error:   'LinkedIn daily limit — requeued +18h',
        }),
      }).catch(() => {});
      return;
    }

    if (['send_button_not_found', 'button_not_found', 'modal_not_opened',
         'unconfirmed', 'dialog_send_button_not_found',
         'more_button_not_found', 'connect_item_not_found'].includes(result.reason)) {
      const taskRow = await supabaseFetch(
        `engine_queue?id=eq.${taskId}&select=attempts`, { method: 'GET' }
      ).catch(() => null);
      const attempts  = (taskRow?.[0]?.attempts ?? 0) + 1;
      const newStatus = attempts < 3 ? 'pending' : 'failed';
      await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({
          status:       newStatus,
          attempts,
          ...(attempts < 3 && {
            scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }),
          last_error: `${result.reason} (attempt ${attempts}/3)`,
        }),
      }).catch(() => {});

      // Contar errores de selector consecutivos → cooldown adaptativo
      const errorCount = await incrementConsecutiveErrors();
      await chrome.storage.local.set({ last_error_at: Date.now() });
      if (errorCount >= 5) {
        console.error('[cazary.ai][Safety] 5 errores consecutivos → pausando engine automáticamente');
        await chrome.storage.local.set({ engine_running: false });
        await supabaseFetch('activity_log', {
          method: 'POST', prefer: 'return=minimal',
          body: JSON.stringify({
            workspace_id: wsId,
            action_type:  'engine_auto_paused',
            description:  `Engine pausado automáticamente: ${errorCount} errores de selector consecutivos`,
            metadata:     { error_count: errorCount, reason: result.reason },
          }),
        }).catch(() => {});
      }
      return;
    }

    if (result.reason === 'out_of_network_locked') {
      const taskRow = await supabaseFetch(
        `engine_queue?id=eq.${taskId}&select=id,attempts`, { method: 'GET' }
      ).catch(() => null);
      const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabaseFetch(`engine_queue?id=eq.${taskRow[0].id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({
          status:       'scheduled',
          scheduled_at: retryAt,
          attempts:     (taskRow[0].attempts ?? 0) + 1,
          last_error:   'OUT_OF_NETWORK: sin botón conectar. Reprogramado para 24h.',
        }),
      }).catch(() => {});
      await chrome.storage.local.set({ processing: false });
      return;
    }

    // Catch-all: fallo sin reason específico → marcar como failed
    await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({
        status:     'failed',
        last_error: result.reason ?? 'unknown_failure',
        executed_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    // Marcar mensaje como fallido si era un task de mensaje
    if (result.action === 'message' && result.lead_id) {
      const taskRow = await supabaseFetch(
        `engine_queue?id=eq.${taskId}&select=payload`, { method: 'GET' }
      ).catch(() => null);
      const draftMsgId = taskRow?.[0]?.payload?.draft_msg_id ?? null;
      const failFilter = draftMsgId
        ? `messages?id=eq.${draftMsgId}`
        : `messages?lead_id=eq.${result.lead_id}&status=eq.sending&sender=eq.user`;
      await supabaseFetch(failFilter, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ status: 'failed' }),
      }).catch(() => null);
    }
    return;
  }

  // Reset errores consecutivos en cada éxito
  await resetConsecutiveErrors();

  // 4. Actualizar el lead en el CRM según la acción completada
  if (wsId && result.lead_id) {
    try {
      const now = new Date().toISOString();

      // ── Conexión ya existente → mover a conexion_aceptada ────────────────
      if (result.action === 'connect' && result.reason === 'already_connected') {
        await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            crm_column:             'conexion_aceptada',
            connection_accepted_at: now,
            status:                 'connected',
          }),
        }).catch(e => console.warn('[cazary.ai] PATCH already_connected:', e));

        // Obtener workspace_id real del lead (el wsId externo puede ser de otro workspace)
        const acLeadData = await supabaseFetch(
          `leads?id=eq.${result.lead_id}&select=workspace_id`,
          { method: 'GET' }
        ).catch(() => null);
        const acWsId = acLeadData?.[0]?.workspace_id ?? wsId;
        const convId = await createOrGetConversation(result.lead_id, acWsId, result.campaign_id ?? null);
        if (convId) console.log('[cazary.ai] already_connected: conversation creada/encontrada:', convId);

        if (result.campaign_id) {
          const campRows = await supabaseFetch(
            `campaigns?id=eq.${result.campaign_id}&select=workflow_json`, { method: 'GET' }
          ).catch(() => null);
          const wf          = campRows?.[0]?.workflow_json ?? {};
          const followUpMsg = wf.follow_up_message || wf.connection_message || '';
          const delayDays   = wf.follow_up_delay_days ?? 0;

          // Solo encolar follow-up manual si la campaña NO usa FlowBuilder (backward compat)
          const usesFlowBuilder = Array.isArray(wf.nodes) && wf.nodes.length > 0;
          if (!usesFlowBuilder && followUpMsg && result.lead_id) {
            const interpolatedMsg = await interpolateVariables(followUpMsg, result.lead_id);
            const leadRows = await supabaseFetch(
              `leads?id=eq.${result.lead_id}&select=linkedin_url`, { method: 'GET' }
            ).catch(() => null);
            await supabaseFetch('engine_queue', {
              method: 'POST', prefer: 'return=minimal',
              body: JSON.stringify({
                workspace_id: wsId,
                campaign_id:  result.campaign_id,
                lead_id:      result.lead_id,
                task_type:    'message',
                action_type:  'message',
                status:       'pending',
                priority:     9,
                scheduled_at: new Date(Date.now() + delayDays * 24 * 3600 * 1000).toISOString(),
                payload: {
                  profile_url:  leadRows?.[0]?.linkedin_url,
                  lead_id:      result.lead_id,
                  campaign_id:  result.campaign_id,
                  message_text: interpolatedMsg,
                  message_type: 'follow_up_existing_connection',
                },
              }),
            }).catch(() => {});
            console.log('[cazary.ai] already_connected: follow-up encolado para', result.lead_id);
          }
        }

        await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            status:      'done',
            executed_at: now,
            last_error:  'already_connected — moved to conexion_aceptada',
          }),
        }).catch(() => {});
        console.log('[cazary.ai] already_connected → conexion_aceptada:', result.lead_id);
        return;
      }

      // ── Conexión pendiente previa → mantener en conexion_enviada ─────────
      if (result.action === 'connect' && result.reason === 'already_pending') {
        const leadRow = await supabaseFetch(
          `leads?id=eq.${result.lead_id}&select=crm_column,connection_sent_at`, { method: 'GET' }
        ).catch(() => null);
        const currentColumn = leadRow?.[0]?.crm_column;
        const alreadySentAt = leadRow?.[0]?.connection_sent_at;

        if (currentColumn !== 'conexion_enviada' && currentColumn !== 'conexion_aceptada') {
          await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              crm_column:         'conexion_enviada',
              connection_sent_at: alreadySentAt ?? now,
              status:             'contacted',
            }),
          }).catch(() => {});
        }

        await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            status:      'done',
            executed_at: now,
            last_error:  'already_pending — no reenvío',
          }),
        }).catch(() => {});
        console.log('[cazary.ai] already_pending → conexion_enviada:', result.lead_id);
        return;
      }

      if (result.action === 'connect' && result.success !== false) {
        const nota = result.connection_note || result.note || result.message || null;

        await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            crm_column:         'conexion_enviada',
            connection_sent_at: now,
            status:             'contacted',
          }),
        }).catch(e => console.error('[cazary.ai] PATCH lead connect error:', e));

        // Crear conversación en Smart Inbox
        const convId = await createOrGetConversation(result.lead_id, wsId, result.campaign_id ?? null);
        if (convId) console.log('[cazary.ai] conexion_enviada: conversation creada/encontrada:', convId);

        if (convId && nota) {
          await supabaseFetch('messages', {
            method: 'POST', prefer: 'return=minimal',
            body: JSON.stringify({
              conversation_id: convId,
              lead_id:         result.lead_id,
              workspace_id:    wsId,
              sender:          'user',
              message_text:    nota,
              status:          'sent',
              is_read:         true,
              timestamp:       now,
            }),
          }).catch(() => {});
        }
        if (convId) {
          const source = result.lead_id ? await getLeadSource(result.lead_id, wsId) : 'linkedin';
          await supabaseFetch(`conversations?id=eq.${convId}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              last_message_preview: nota ? nota.slice(0, 100) : '✓ Conexión enviada',
              last_message_at:      now,
              source,
            }),
          }).catch(() => {});
        }
        console.log('[cazary.ai] conexion_enviada:', result.lead_id);

      } else if (result.action === 'connect_accepted') {
        // Manejar aceptación con follow-up automático
        await handleConnectionAccepted(result.profile_url, wsId);

        // Encolar follow-up si la campaña lo tiene configurado (solo backward compat)
        if (result.campaign_id) {
          const campRows = await supabaseFetch(
            `campaigns?id=eq.${result.campaign_id}&select=workflow_json`,
            { method: 'GET' }
          ).catch(() => null);
          const wf           = campRows?.[0]?.workflow_json ?? {};
          const followUpMsg  = wf.follow_up_message || wf.connection_message || '';
          const followUpDays = wf.follow_up_delay_days ?? 1;
          // Solo encolar follow-up manual si la campaña NO usa FlowBuilder (backward compat)
          const usesFlowBuilder = Array.isArray(wf.nodes) && wf.nodes.length > 0;
          if (!usesFlowBuilder && followUpMsg && result.lead_id) {
            const leadRows = await supabaseFetch(
              `leads?id=eq.${result.lead_id}&select=linkedin_url`,
              { method: 'GET' }
            ).catch(() => null);
            const interpolatedMsg = await interpolateVariables(followUpMsg, result.lead_id);
            await supabaseFetch('engine_queue', {
              method: 'POST', prefer: 'return=minimal',
              body: JSON.stringify({
                workspace_id: wsId,
                campaign_id:  result.campaign_id,
                lead_id:      result.lead_id,
                task_type:    'message',
                action_type:  'message',
                priority:     8,
                scheduled_at: new Date(Date.now() + followUpDays * 24 * 3600 * 1000).toISOString(),
                payload: {
                  profile_url:  leadRows?.[0]?.linkedin_url,
                  lead_id:      result.lead_id,
                  campaign_id:  result.campaign_id,
                  message_text: interpolatedMsg,
                  message_type: 'follow_up',
                },
              }),
            }).catch(() => {});
          }
        }

      } else if (result.action === 'message' && result.success !== false) {
        const msgLeadRow = await supabaseFetch(
          `leads?id=eq.${result.lead_id}&select=crm_column`, { method: 'GET' }
        ).catch(() => null);
        const currentMsgCol = msgLeadRow?.[0]?.crm_column;
        if (currentMsgCol === 'conexion_aceptada' || currentMsgCol === 'conexion_enviada') {
          await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              crm_column: 'en_conversacion',
              status:     'in_conversation',
              next_task:  'Esperar respuesta',
            }),
          }).catch(() => {});
        }

        // Registrar mensaje enviado en conversations/messages
        const existingConv2 = await supabaseFetch(
          `conversations?lead_id=eq.${result.lead_id}&workspace_id=eq.${wsId}&select=id`,
          { method: 'GET' }
        ).catch(() => []);
        let convId2 = existingConv2?.[0]?.id;
        if (!convId2) {
          const newConv2 = await supabaseFetch('conversations', {
            method: 'POST', prefer: 'return=representation',
            body: JSON.stringify({
              workspace_id:     wsId,
              lead_id:          result.lead_id,
              campaign_id:      result.campaign_id ?? null,
              status:           'active',
              autopilot_active: false,
              unread_count:     0,
            }),
          }).catch(() => null);
          convId2 = newConv2?.[0]?.id;
        }
        if (convId2 && result.message_text) {
          await supabaseFetch('messages', {
            method: 'POST', prefer: 'return=minimal',
            body: JSON.stringify({
              conversation_id: convId2,
              lead_id:         result.lead_id,
              workspace_id:    wsId,
              sender:          'user',
              message_text:    result.message_text,
              status:          'sent',
              is_read:         true,
              timestamp:       now,
            }),
          }).catch(() => {});
          await supabaseFetch(`conversations?id=eq.${convId2}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              last_message_preview: result.message_text.slice(0, 100),
              last_message_at:      now,
            }),
          }).catch(() => {});
        }
        console.log('[cazary.ai] en_conversacion:', result.lead_id);

      } else if (result.action === 'reply_received') {
        // Solo mover a en_conversacion si aún no lo estaba
        const leadRows = await supabaseFetch(
          `leads?id=eq.${result.lead_id}&select=crm_column`,
          { method: 'GET' }
        ).catch(() => null);
        if (leadRows?.[0]?.crm_column !== 'en_conversacion') {
          await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ crm_column: 'en_conversacion' }),
          }).catch(() => {});
        }
        // Registrar mensaje inbound
        const convRows = await supabaseFetch(
          `conversations?lead_id=eq.${result.lead_id}&workspace_id=eq.${wsId}&select=id`,
          { method: 'GET' }
        ).catch(() => []);
        const convId3 = convRows?.[0]?.id;
        if (convId3 && result.reply_text) {
          await supabaseFetch('messages', {
            method: 'POST', prefer: 'return=minimal',
            body: JSON.stringify({
              conversation_id: convId3,
              lead_id:         result.lead_id,
              workspace_id:    wsId,
              sender:          'prospect',
              message_text:    result.reply_text,
              status:          'received',
              is_read:         false,
              timestamp:       now,
            }),
          }).catch(() => {});
        }

      } else if (result.action === 'check_inbox') {
        const conversations = result.conversations ?? [];
        console.log(`[cazary.ai] check_inbox: ${result.unreadCount} no leídos, ${conversations.length} procesando`);

        for (const conv of conversations) {
          if (!conv.name) continue;

          const nameParts = conv.name.split(' ').filter(Boolean);
          if (nameParts.length < 1) continue;

          const searchName = nameParts.slice(0, 2).join(' ');
          const matchedLeads = await supabaseFetch(
            `leads?workspace_id=eq.${wsId}` +
            `&full_name=ilike.*${encodeURIComponent(searchName)}*` +
            `&crm_column=in.(conexion_aceptada,conexion_enviada)` +
            `&select=id,crm_column,campaign_id,unread_count&limit=1`,
            { method: 'GET' }
          ).catch(() => null);

          const lead = matchedLeads?.[0];
          if (!lead) {
            console.log(`[cazary.ai] check_inbox: Lead no encontrado para "${searchName}"`);
            continue;
          }

          const now = new Date().toISOString();

          if (lead.crm_column !== 'en_conversacion') {
            await supabaseFetch(`leads?id=eq.${lead.id}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({
                crm_column: 'en_conversacion',
                status:     'in_conversation',
                score:      35,
              }),
            }).catch(() => {});
            console.log(`[cazary.ai] check_inbox: ${searchName} → en_conversacion`);
          }

          const existingConv = await supabaseFetch(
            `conversations?lead_id=eq.${lead.id}&workspace_id=eq.${wsId}&select=id,autopilot_active,unread_count`,
            { method: 'GET' }
          ).catch(() => []);

          let convId    = existingConv?.[0]?.id;
          let autopilot = existingConv?.[0]?.autopilot_active ?? false;

          if (!convId) {
            const newConv = await supabaseFetch('conversations', {
              method: 'POST', prefer: 'return=representation',
              body: JSON.stringify({
                workspace_id:     wsId,
                lead_id:          lead.id,
                campaign_id:      lead.campaign_id ?? null,
                status:           'active',
                autopilot_active: false,
                unread_count:     1,
              }),
            }).catch(() => null);
            convId = newConv?.[0]?.id;
          } else {
            const prevUnread = existingConv?.[0]?.unread_count ?? 0;
            await supabaseFetch(`conversations?id=eq.${convId}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({ unread_count: prevUnread + 1 }),
            }).catch(() => {});
          }

          if (convId && conv.preview) {
            await supabaseFetch('messages', {
              method: 'POST', prefer: 'return=minimal',
              body: JSON.stringify({
                conversation_id: convId,
                lead_id:         lead.id,
                workspace_id:    wsId,
                sender:          'prospect',
                message_text:    conv.preview,
                  status:          'received',
                is_read:         false,
                timestamp:       conv.timestamp ?? now,
                }),
            }).catch(() => {});
          }

          if (autopilot && convId) {
            const { supabase_workspace_settings } = await chrome.storage.local.get('supabase_workspace_settings');
            const dashboardUrl = supabase_workspace_settings?.dashboard_url ?? DASHBOARD_URL;
            if (dashboardUrl) {
              fetch(`${dashboardUrl}/api/autopilot/trigger`, {
                method: 'POST',
                headers: {
                  'Content-Type':  'application/json',
                  'Authorization': `Bearer cazary-autopilot-2025`,
                },
                body: JSON.stringify({
                  record: {
                    conversation_id: convId,
                    lead_id:         lead.id,
                    workspace_id:    wsId,
                    sender:          'prospect',
                    message_text:    conv.preview,
                  }
                }),
              }).catch(() => {});
            }
          }

          await supabaseFetch('activity_log', {
            method: 'POST', prefer: 'return=minimal',
            body: JSON.stringify({
              workspace_id: wsId,
              lead_id:      lead.id,
              campaign_id:  lead.campaign_id ?? null,
              action_type:  'reply_received',
              description:  `${searchName} respondió en LinkedIn`,
              metadata:     { preview: conv.preview?.slice(0, 100) },
            }),
          }).catch(() => {});
        }

      } else if (result.action === 'meeting_booked') {
        await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            crm_column: 'reunion_agendada',
            next_task:  'Confirmar reunión',
          }),
        }).catch(() => {});
        console.log('[cazary.ai] reunion_agendada:', result.lead_id);

      } else if (result.action === 'check_connection') {
        if (result.connected === true) {
          await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              crm_column:             'conexion_aceptada',
              connection_accepted_at: now,
              status:                 'connected',
            }),
          }).catch(e => console.error('[cazary.ai] PATCH check_connection error:', e));

          // Obtener config follow-up de la campaña (solo backward compat)
          if (result.campaign_id) {
            const campRows2 = await supabaseFetch(
              `campaigns?id=eq.${result.campaign_id}&select=workflow_json`,
              { method: 'GET' }
            ).catch(() => null);
            const wf2           = campRows2?.[0]?.workflow_json ?? {};
            const followUpMsg2  = wf2.follow_up_message || wf2.connection_message || '';
            const followUpDays2 = wf2.follow_up_delay_days ?? 1;
            // Solo encolar follow-up manual si la campaña NO usa FlowBuilder (backward compat)
            const usesFlowBuilder2 = Array.isArray(wf2.nodes) && wf2.nodes.length > 0;
            if (!usesFlowBuilder2 && followUpMsg2) {
              const lead2 = await supabaseFetch(
                `leads?id=eq.${result.lead_id}&select=linkedin_url`,
                { method: 'GET' }
              ).catch(() => null);
              const interpolatedMsg2 = await interpolateVariables(followUpMsg2, result.lead_id);
              await supabaseFetch('engine_queue', {
                method: 'POST', prefer: 'return=minimal',
                body: JSON.stringify({
                  workspace_id: wsId,
                  campaign_id:  result.campaign_id,
                  lead_id:      result.lead_id,
                  task_type:    'message',
                  action_type:  'message',
                  priority:     8,
                  scheduled_at: new Date(Date.now() + followUpDays2 * 24 * 3600 * 1000).toISOString(),
                  payload: {
                    profile_url:  lead2?.[0]?.linkedin_url,
                    lead_id:      result.lead_id,
                    campaign_id:  result.campaign_id,
                    message_text: interpolatedMsg2,
                    message_type: 'follow_up',
                  },
                }),
              }).catch(() => {});
            }
          }
          const convIdAccepted = await createOrGetConversation(result.lead_id, wsId, result.campaign_id ?? null);
          if (convIdAccepted) {
            const acceptedNow = new Date().toISOString();
            await supabaseFetch('messages', {
              method: 'POST', prefer: 'return=minimal',
              body: JSON.stringify({
                conversation_id: convIdAccepted,
                lead_id:         result.lead_id,
                workspace_id:    wsId,
                sender:          'user',
                message_text:    '✓ Conexión aceptada',
                status:          'sent',
                is_read:         true,
                timestamp:       acceptedNow,
              }),
            }).catch(() => {});
            await supabaseFetch(`conversations?id=eq.${convIdAccepted}`, {
              method: 'PATCH', prefer: 'return=minimal',
              body: JSON.stringify({
                last_message_preview: '✓ Conexión aceptada',
                last_message_at:      acceptedNow,
              }),
            }).catch(() => {});
          }
          console.log('[cazary.ai] conexion_aceptada:', result.lead_id);
        }
        // Si pending: dejar en conexion_enviada, se reintentará
      }
    } catch (err) {
      console.error('[cazary.ai] Error actualizando lead:', err);
    }
  }

  // 3b. Incrementar leads_queued en la campaña al enviar conexión exitosa
  if (wsId && result.campaign_id && result.action === 'connect' && result.success !== false &&
      result.reason !== 'already_connected' && result.reason !== 'already_pending') {
    await incrementLeadsQueued(result.campaign_id);
  }

  // 5. Registrar en activity_log
  if (wsId) {
    const descriptions = {
      connect:          'Solicitud de conexión enviada',
      connect_accepted: 'Conexión aceptada',
      message:          'Mensaje enviado',
      like:             'Post likeado',
      view_profile:     'Perfil visitado',
    };
    await supabaseFetch('activity_log', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id: wsId,
        lead_id:      result.lead_id     ?? null,
        campaign_id:  result.campaign_id ?? null,
        action_type:  result.action,
        description:  descriptions[result.action] ?? result.action,
        metadata:     result,
      }),
    }).catch(() => {});
  }

  // 6. Guardar log de última acción para getStatus()
  await chrome.storage.local.set({
    last_action_log: {
      action:    result.action,
      success:   result.success !== false,
      lead_id:   result.lead_id   ?? null,
      timestamp: Date.now(),
    },
  }).catch(() => {});

  // PATCH final: marcar done solo si fue exitoso (fallos ya retornaron arriba)
  if (result.success) {
    await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({ status: 'done', executed_at: new Date().toISOString() }),
    }).catch(() => {});

    // find_email / find_phone → guardar en lead
    if (result.action === 'find_email' && result.data?.email && result.lead_id) {
      await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ email: result.data.email }),
      }).catch(() => {});
    }
    if (result.action === 'find_phone' && result.data?.phone && result.lead_id) {
      await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ phone: result.data.phone }),
      }).catch(() => {});
    }

    // connect_email → mover lead a conexion_enviada
    if (result.action === 'connect_email' && result.lead_id) {
      await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({
          crm_column:         'conexion_enviada',
          connection_sent_at: new Date().toISOString(),
          status:             'contacted',
        }),
      }).catch(() => {});
    }

    // Actualizar messages.status de 'sending' → 'sent' para mensajes del inbox
    if (result.action === 'message' && result.lead_id) {
      const taskRow = await supabaseFetch(
        `engine_queue?id=eq.${taskId}&select=payload`, { method: 'GET' }
      ).catch(() => null);
      const draftMsgId = taskRow?.[0]?.payload?.draft_msg_id ?? null;
      const msgFilter = draftMsgId
        ? `messages?id=eq.${draftMsgId}`
        : `messages?lead_id=eq.${result.lead_id}&status=eq.sending&sender=eq.user`;
      await supabaseFetch(msgFilter, {
        method: 'PATCH', prefer: 'return=minimal',
        body: JSON.stringify({ status: 'sent', is_read: true }),
      }).catch(e => console.warn('[cazary.ai] messages status update failed:', e));
    }
  }
}

async function handleProfileExtracted(data) {
  const wsId = await getWorkspaceId();
  if (!wsId || !data.lead_id) return;
  await supabaseFetch(`leads?id=eq.${data.lead_id}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: JSON.stringify({
      full_name:    data.name     ?? null,
      headline:     data.headline ?? null,
      company:      data.company  ?? null,
      linkedin_url: data.url      ?? null,
      status:       'nuevo',
    }),
  }).catch(() => {});
}

async function createOrGetConversation(leadId, wsId, campaignId = null) {
  const existing = await supabaseFetch(
    `conversations?lead_id=eq.${leadId}&workspace_id=eq.${wsId}&select=id,unread_count`,
    { method: 'GET' }
  ).catch(() => null);
  if (existing?.length > 0) return existing[0].id;

  const created = await supabaseFetch('conversations', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      workspace_id:     wsId,
      lead_id:          leadId,
      campaign_id:      campaignId ?? null,
      status:           'active',
      autopilot_active: false,
      autopilot_mode:   'review',
      unread_count:     0,
    }),
  }).catch(() => null);
  return created?.[0]?.id ?? null;
}

async function handleMessageReceived(data) {
  const wsId = await getWorkspaceId();
  if (!wsId) return;
  if (!data.text?.trim()) return;

  try {
    let leadId = data.lead_id;

    // Resolver lead por linkedin_url si no viene lead_id
    if (!leadId && data.profile_url) {
      const cleanUrl = data.profile_url.replace(/\/$/, '').split('?')[0];
      const leads = await supabaseFetch(
        `leads?workspace_id=eq.${wsId}&linkedin_url=eq.${encodeURIComponent(cleanUrl)}&select=id&limit=1`
      );
      leadId = leads?.[0]?.id ?? null;
    }

    // Fallback: buscar por nombre
    if (!leadId && data.contact_name) {
      const leads = await supabaseFetch(
        `leads?workspace_id=eq.${wsId}&full_name=ilike.${encodeURIComponent(data.contact_name)}&select=id&limit=1`
      );
      leadId = leads?.[0]?.id ?? null;
    }

    // Fallback final: crear lead placeholder
    if (!leadId) {
      const newLead = await supabaseFetch('leads', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: wsId,
          full_name:    data.contact_name ?? 'Contacto LinkedIn',
          linkedin_url: data.profile_url  ?? null,
          status:       'respondio',
          source:       'inbox',
        }),
      });
      leadId = newLead?.[0]?.id ?? null;
    }

    if (!leadId) return;

    // Buscar o crear conversación
    const convs = await supabaseFetch(
      `conversations?workspace_id=eq.${wsId}&lead_id=eq.${leadId}&limit=1`
    );

    let convId;
    if (!convs || convs.length === 0) {
      const newConv = await supabaseFetch('conversations', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: wsId,
          lead_id:      leadId,
          status:       'active',
          unread_count: 1,
        }),
      });
      convId = newConv?.[0]?.id;
    } else {
      convId = convs[0].id;
      const currentUnread = convs[0].unread_count ?? 0;
      await supabaseFetch(`conversations?id=eq.${convId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body:   JSON.stringify({ unread_count: currentUnread + 1 }),
      }).catch(() => null);
    }

    if (!convId) return;

    await supabaseFetch('messages', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id:        wsId,
        lead_id:             leadId,
        conversation_id:     convId,
        sender:              'prospect',
        message_text:        data.text,
        linkedin_message_id: data.linkedin_id ?? null,
        status:              'delivered',
        is_read:             false,
        timestamp:           data.timestamp ?? new Date().toISOString(),
      }),
    }).catch(() => null);

    await supabaseFetch('activity_log', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id: wsId,
        action_type:  'message_received',
        description:  `Mensaje recibido de ${data.contact_name ?? 'contacto'}`,
        metadata:     { lead_id: leadId, conversation_id: convId },
      }),
    }).catch(() => {});

  } catch (err) {
    console.error('[cazary.ai] handleMessageReceived error:', err);
  }
}

async function handleCountResult(campaignId, segmentId, count) {
  try {
    const campaigns = await supabaseFetch(`campaigns?id=eq.${campaignId}&select=workflow_json`);
    if (!campaigns?.length) return;
    const wf = campaigns[0].workflow_json ?? {};
    const segments = (wf.segments ?? []).map((s) =>
      s.id === segmentId
        ? { ...s, metrics: { ...(s.metrics ?? {}), totalLeads: count } }
        : s
    );
    await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({
        workflow_json: { ...wf, segments },
        total_leads:   segments.reduce((a, s) => a + (s.metrics?.totalLeads ?? 0), 0),
      }),
    });
  } catch (_) {}
}

// ── Scraping de leads ─────────────────────────────────────────────────────────

const SCRAPER_MAX_PAGES      = 40;  // máx 40 páginas = 1000 leads
const SCRAPER_PAGE_DELAY_MIN = 10000;
const SCRAPER_PAGE_DELAY_MAX = 20000;

function parseWorkflowSequence(wf) {
  const nodes = wf.nodes ?? [];
  const edges = wf.edges ?? [];

  if (!nodes.length) {
    return [{
      type: 'connect',
      delayMs: 0,
      note: wf.connection_note || wf.connection_message || '',
      message: '',
    }];
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const next = new Map();
  for (const e of edges) {
    if (!next.has(e.source)) next.set(e.source, e.target);
  }

  const startNode = nodes.find(n => n.data?.nodeType === 'start' || n.type === 'start');
  if (!startNode) return [];

  const steps = [];
  let currentId = next.get(startNode.id);
  let accumulatedDelayMs = 0;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodeMap.get(currentId);
    if (!node) break;

    const data = node.data ?? {};
    const nodeType = data.nodeType || node.type;

    if (nodeType === 'connect') {
      steps.push({
        type:            'connect',
        delayMs:         accumulatedDelayMs,
        note:            data.noteA || data.note || data.bodyA || '',
        message:         '',
        requirePageView: data.requirePageView ?? false,
      });
    } else if (nodeType === 'delay') {
      const days = data.days ?? data.waitDays ?? 1;
      accumulatedDelayMs += days * 24 * 3600 * 1000;
    } else if (nodeType === 'message') {
      steps.push({
        type: 'message',
        delayMs: accumulatedDelayMs,
        note: '',
        message: data.bodyA || data.message || data.body || '',
      });
    } else if (nodeType === 'withdraw') {
      steps.push({ type: 'withdraw', delayMs: accumulatedDelayMs });
    } else if (nodeType === 'find_email') {
      steps.push({ type: 'find_email', delayMs: accumulatedDelayMs,
                   skipIfExists: data.skipIfExists ?? true });
    } else if (nodeType === 'find_phone') {
      steps.push({ type: 'find_phone', delayMs: accumulatedDelayMs,
                   skipIfExists: data.skipIfExists ?? true });
    } else if (nodeType === 'connect_email') {
      steps.push({ type: 'connect_email', delayMs: accumulatedDelayMs,
                   addNote: data.addNote ?? false,
                   connectionNote: data.connectionNote ?? '' });
    }
    currentId = next.get(currentId);
  }

  if (!steps.find(s => s.type === 'connect')) {
    steps.unshift({ type: 'connect', delayMs: 0, note: '', message: '' });
  }

  return steps;
}

async function scrapeSegmentProfiles(campaign, segment, searchUrl) {
  const wsId       = campaign.workspace_id;
  const campaignId = campaign.id;

  let tab            = null;
  let totalExtracted = 0;
  let tabCreatedByUs = false;
  let aborted        = false;

  try {
    tab = await chrome.tabs.create({ url: searchUrl, active: true });
    tabCreatedByUs = true;

    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
      setTimeout(resolve, 15000);
    });

    await sleep(10000 + Math.random() * 3000);

    for (let page = 1; page <= SCRAPER_MAX_PAGES; page++) {
      const { engine_running: er } = await chrome.storage.local.get('engine_running');
      if (!er) {
        console.log('[NexusAI Scraper] Engine detenido — abortando scraping');
        break;
      }

      if (page > 1) {
        const pageUrl = searchUrl.includes('?')
          ? `${searchUrl}&page=${page}`
          : `${searchUrl}?page=${page}`;
        await chrome.tabs.update(tab.id, { url: pageUrl });

        await new Promise((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
          setTimeout(resolve, 15000);
        });
        await sleep(5000 + Math.random() * 3000);
      }

      let profiles = [];
      try {
        profiles = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 30000);
          chrome.tabs.sendMessage(tab.id, { action: 'NEXUSAI_SCRAPE_PROFILES', page }, (resp) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              chrome.scripting.executeScript(
                { target: { tabId: tab.id }, files: ['content.js'] },
                () => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, { action: 'NEXUSAI_SCRAPE_PROFILES', page }, (resp2) => {
                      const arr2 = Array.isArray(resp2) ? resp2 : (Array.isArray(resp2?.profiles) ? resp2.profiles : []);
                      resolve(arr2);
                    });
                  }, 3000);
                }
              );
              return;
            }
            // Acepta array directo o { profiles: [...] }
            const arr = Array.isArray(resp) ? resp : (Array.isArray(resp?.profiles) ? resp.profiles : []);
            resolve(arr);
          });
        });
      } catch (e) {
        const msg = e.message ?? '';
        console.warn(`[NexusAI Scraper] Página ${page} error:`, msg);
        if (msg.includes('blocked') || msg.includes('captcha')) {
          aborted = true;
          await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body:   JSON.stringify({ status: 'paused' }),
          }).catch(() => {});
          chrome.notifications.create(`scraper-blocked-${campaignId}`, {
            type: 'basic', iconUrl: 'icon48.png',
            title: 'NexusAI — Scraping bloqueado',
            message: 'LinkedIn detectó actividad inusual. El scraping se pausó.',
          });
          return;
        }
        break;
      }

      if (!profiles || profiles.length === 0) {
        console.log(`[NexusAI Scraper] Página ${page}: sin perfiles — fin del scraping`);
        break;
      }

      console.log(`[NexusAI Scraper] Página ${page}: ${profiles.length} perfiles encontrados`);

      const { supabase_user_id: ownerId } = await chrome.storage.local.get('supabase_user_id');

      for (const profile of profiles) {
        if (!profile.url) continue;

        const existing = await supabaseFetch(
          `leads?workspace_id=eq.${wsId}&linkedin_url=eq.${encodeURIComponent(profile.url)}&select=id,crm_column`,
          { method: 'GET' }
        ).catch(() => []);

        let leadId;

        if (existing?.length > 0) {
          leadId = existing[0].id;
          const crmCol = existing[0].crm_column;

          if (crmCol && crmCol !== 'extraido') {
            // Ya procesado en otra campaña — no tocar
            console.log(`[NexusAI Scraper] Lead ya procesado (${crmCol}), saltando:`, leadId);
            continue;
          }

          // Existe en 'extraido' → solo actualizar campaign_id
          await supabaseFetch(`leads?id=eq.${leadId}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({ campaign_id: campaignId }),
          }).catch(() => {});
          console.log('[NexusAI Scraper] Lead existente reasignado:', leadId);

        } else {
          const newLead = await supabaseFetch('leads', {
            method: 'POST',
            body: JSON.stringify({
              workspace_id: wsId,
              campaign_id:  campaignId,
              linkedin_url: profile.url,
              linkedin_id:  profile.linkedinId || null,
              full_name:    profile.name     || 'Sin nombre',
              headline:     profile.headline || null,
              avatar_url:   profile.avatar   || null,
              location:     profile.location || null,
              company:      profile.company  || null,
              status:       'extraido',
              crm_column:   'extraido',
              assigned_to:  ownerId ?? null,
            }),
          }).catch(() => null);
          leadId = newLead?.[0]?.id;
        }

        if (!leadId) continue;
        totalExtracted++;

        await sleep(200 + Math.random() * 300);
      }

      // Actualizar progreso en tiempo real
      await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body:   JSON.stringify({ total_leads: totalExtracted }),
      }).catch(() => {});

      if (profiles.length < 25) break; // última página (< 25 resultados)

      const pageDelay = SCRAPER_PAGE_DELAY_MIN + Math.random() * (SCRAPER_PAGE_DELAY_MAX - SCRAPER_PAGE_DELAY_MIN);
      console.log(`[NexusAI Scraper] Página ${page} procesada. Esperando ${Math.round(pageDelay / 1000)}s…`);
      await sleep(pageDelay);
    }

  } finally {
    if (tab && tabCreatedByUs) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }

    if (!aborted) {
      console.log(`[NexusAI Scraper] Extracción completa: ${totalExtracted} leads. Encolando conexiones…`);
      await enqueueBatchedConnects(campaignId, wsId, campaign);
    }
  }
}

// ── Encolar conexiones distribuidas por días ──────────────────────────────────
async function enqueueBatchedConnects(campaignId, wsId, campaign) {
  const wf = campaign?.workflow_json ?? {};

  // Fetch full campaign data including A/B fields (may not be present in scraping campaign obj)
  const campRows = await supabaseFetch(
    `campaigns?id=eq.${campaignId}&select=ab_test_enabled,ab_variant_a,ab_variant_b,ab_winner,workflow_json`,
    { method: 'GET' }
  ).catch(() => null);
  const campData = campRows?.[0] ?? {};
  const fullWf   = campData.workflow_json ?? wf;

  const abEnabled = !!(campData.ab_test_enabled);
  const abWinner  = campData.ab_winner ?? null;

  // Parsear secuencia completa del FlowBuilder
  const sequence = parseWorkflowSequence(fullWf);
  const connectNode  = fullWf.nodes?.find(n => n.data?.nodeType === 'connect');
  const abNoteMode   = connectNode?.data?.abNoteMode ?? 'note_vs_note';

  // Obtener todos los leads 'extraido' de esta campaña sin tarea pendiente
  const leads = await supabaseFetch(
    `leads?campaign_id=eq.${campaignId}&crm_column=eq.extraido&workspace_id=eq.${wsId}&select=id,linkedin_url,full_name`,
    { method: 'GET' }
  ).catch(() => []);

  if (!leads?.length) {
    console.log('[NexusAI Scraper] Sin leads para encolar');
    await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({ scraping_status: 'done', last_scraped_at: new Date().toISOString() }),
    }).catch(() => {});
    return;
  }

  // IDs que ya tienen tarea pendiente para no duplicar
  const existingTasks = await supabaseFetch(
    `engine_queue?campaign_id=eq.${campaignId}&status=in.(pending,scheduled)&select=lead_id`,
    { method: 'GET' }
  ).catch(() => []);
  const enqueuedLeadIds = new Set((existingTasks ?? []).map((t) => t.lead_id));

  const settings   = await getSettings();
  const dailyQuota = settings.maxConnections || 20;
  const delayMin   = settings.delayMinSec    || 180;
  const delayMax   = settings.delayMaxSec    || 480;

  const pendingLeads = leads.filter((l) => !enqueuedLeadIds.has(l.id));
  console.log(`[NexusAI Scraper] Encolando ${pendingLeads.length} leads (secuencia de ${sequence.length} pasos, cuota ${dailyQuota}/día)`);

  const inserts = [];
  const variantPatches = [];

  for (let i = 0; i < pendingLeads.length; i++) {
    const lead      = pendingLeads[i];
    const dayOffset = Math.floor(i / dailyQuota);
    const jitter    = (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
    const baseTime  = Date.now() + dayOffset * 24 * 3600 * 1000 + jitter;

    // ── A/B variant assignment ──────────────────────────────────────────────
    let assignedVariant = null;
    let abVariantData = {};
    if (abEnabled && !abWinner) {
      assignedVariant = Math.random() < 0.5 ? 'a' : 'b';
      abVariantData = assignedVariant === 'a'
        ? (campData.ab_variant_a ?? {})
        : (campData.ab_variant_b ?? {});
      variantPatches.push({ leadId: lead.id, variant: assignedVariant });
    } else if (abEnabled && abWinner) {
      abVariantData = abWinner === 'a'
        ? (campData.ab_variant_a ?? {})
        : (campData.ab_variant_b ?? {});
    }
    // ───────────────────────────────────────────────────────────────────────

    for (const step of sequence) {
      const scheduledAt = new Date(baseTime + step.delayMs);

      if (step.type === 'connect') {
        // A/B note determination
        let connNote     = '';
        let connAddNote  = false;
        if (abEnabled && !abWinner) {
          const useVariantB = (assignedVariant === 'b');
          if (abNoteMode === 'note_vs_no_note') {
            connAddNote = !useVariantB;
            connNote    = !useVariantB
              ? (connectNode?.data?.connectionNote ?? connectNode?.data?.messageA ?? step.note ?? '')
              : '';
          } else {
            connNote    = useVariantB
              ? (campData.ab_variant_b?.connectionNote ?? campData.ab_variant_b?.messageB ?? step.note ?? '')
              : (campData.ab_variant_a?.connectionNote ?? campData.ab_variant_a?.messageA ?? step.note ?? '');
            connAddNote = !!connNote;
          }
        } else {
          connNote    = abVariantData.connection_note ?? step.note ?? '';
          connAddNote = !!connNote;
        }
        inserts.push({
          workspace_id: wsId,
          campaign_id:  campaignId,
          lead_id:      lead.id,
          task_type:    'connect',
          action_type:  'connect',
          payload: {
            profile_url:      lead.linkedin_url,
            linkedin_url:     lead.linkedin_url,
            lead_id:          lead.id,
            lead_name:        lead.full_name || 'Sin nombre',
            campaign_id:      campaignId,
            campaign_name:    campaign?.name || '',
            note:             connNote,
            add_note:         connAddNote,
            ab_variant:       assignedVariant,
            require_page_view: step.requirePageView ?? false,
          },
          status:       'pending',
          priority:     5,
          scheduled_at: scheduledAt.toISOString(),
        });
      } else if (step.type === 'message') {
        const msgText = abVariantData.follow_up_message ?? step.message ?? '';
        if (!msgText) continue;
        inserts.push({
          workspace_id: wsId,
          campaign_id:  campaignId,
          lead_id:      lead.id,
          task_type:    'message',
          action_type:  'message',
          payload: {
            profile_url:      lead.linkedin_url,
            lead_id:          lead.id,
            campaign_id:      campaignId,
            message_text:     msgText,
            message_type:     'sequence_followup',
            ab_variant:       assignedVariant,
            require_accepted: true,
          },
          status:       'scheduled',
          priority:     8,
          scheduled_at: scheduledAt.toISOString(),
        });
      } else if (step.type === 'withdraw') {
        inserts.push({
          workspace_id: wsId, campaign_id: campaignId, lead_id: lead.id,
          task_type: 'withdraw', action_type: 'withdraw',
          status: 'scheduled', priority: 5,
          scheduled_at: scheduledAt.toISOString(),
          payload: { lead_id: lead.id, linkedin_url: lead.linkedin_url,
                     salesnav_url: lead.salesnav_url ?? null },
        });
      } else if (step.type === 'find_email') {
        inserts.push({
          workspace_id: wsId, campaign_id: campaignId, lead_id: lead.id,
          task_type: 'find_email', action_type: 'find_email',
          status: 'scheduled', priority: 4,
          scheduled_at: scheduledAt.toISOString(),
          payload: { lead_id: lead.id,
                     linkedin_url: lead.linkedin_url ?? lead.salesnav_url,
                     skip_if_exists: step.skipIfExists ?? true },
        });
      } else if (step.type === 'find_phone') {
        inserts.push({
          workspace_id: wsId, campaign_id: campaignId, lead_id: lead.id,
          task_type: 'find_phone', action_type: 'find_phone',
          status: 'scheduled', priority: 4,
          scheduled_at: scheduledAt.toISOString(),
          payload: { lead_id: lead.id,
                     linkedin_url: lead.linkedin_url ?? lead.salesnav_url,
                     skip_if_exists: step.skipIfExists ?? true },
        });
      } else if (step.type === 'connect_email') {
        inserts.push({
          workspace_id: wsId, campaign_id: campaignId, lead_id: lead.id,
          task_type: 'connect_email', action_type: 'connect_email',
          status: 'scheduled', priority: 4,
          scheduled_at: scheduledAt.toISOString(),
          payload: { lead_id: lead.id,
                     add_note: step.addNote ?? false,
                     connection_note: step.connectionNote ?? '',
                     require_email: true },
        });
      }
    }
  }

  if (inserts.length) {
    for (let b = 0; b < inserts.length; b += 50) {
      await supabaseFetch('engine_queue', {
        method: 'POST', prefer: 'return=minimal',
        body:   JSON.stringify(inserts.slice(b, b + 50)),
      }).catch(e => console.error('[cazary.ai] Batch insert error:', e));
    }
    console.log(`[cazary.ai] Encolados ${inserts.length} tasks para ${pendingLeads.length} leads (secuencia de ${sequence.length} pasos)`);
  }

  // Persist A/B variant assignment on each lead (fire-and-forget, best-effort)
  if (variantPatches.length > 0) {
    console.log(`[NexusAI A/B] Assigning variants to ${variantPatches.length} leads`);
    for (const { leadId, variant } of variantPatches) {
      supabaseFetch(`leads?id=eq.${leadId}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body:   JSON.stringify({ ab_variant: variant }),
      }).catch(() => {});
    }
  }

  await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body:   JSON.stringify({
      total_leads:     leads.length,
      leads_total:     leads.length,
      scraping_status: 'done',
      last_scraped_at: new Date().toISOString(),
    }),
  }).catch(() => {});

  console.log(`[NexusAI Scraper] ${inserts.length} tasks encoladas para campaña ${campaignId}`);
}

// ── Conexión aceptada ─────────────────────────────────────────────────────────

async function handleConnectionAccepted(profileUrl, workspaceId) {
  if (!profileUrl || !workspaceId) return;
  const cleanUrl = profileUrl.replace(/\/$/, '').split('?')[0];

  const leads = await supabaseFetch(
    `leads?workspace_id=eq.${workspaceId}&linkedin_url=eq.${encodeURIComponent(cleanUrl)}&select=id`,
    { method: 'GET' }
  ).catch(() => []);

  if (!leads?.length) return;
  const leadId = leads[0].id;
  const now    = new Date().toISOString();

  await supabaseFetch(`leads?id=eq.${leadId}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: JSON.stringify({
      status:                  'conexion_aceptada',
      crm_column:              'conexion_aceptada',
      connection_accepted_at:  now,
      next_task:               'Enviar mensaje de seguimiento',
    }),
  }).catch(() => {});

  const convs = await supabaseFetch(
    `conversations?lead_id=eq.${leadId}&workspace_id=eq.${workspaceId}&select=id,unread_count`,
    { method: 'GET' }
  ).catch(() => []);

  if (convs?.length > 0) {
    const convId    = convs[0].id;
    const unread    = (convs[0].unread_count ?? 0) + 1;
    const preview   = '✓ Conexión aceptada';

    await supabaseFetch('messages', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({
        conversation_id: convId,
        lead_id:         leadId,
        workspace_id:    workspaceId,
        sender:          'lead',
        message_text:    preview,
        status:          'received',
        is_read:         false,
        timestamp:       now,
      }),
    }).catch(() => {});

    await supabaseFetch(`conversations?id=eq.${convId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({
        unread_count: unread,
      }),
    }).catch(() => {});
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────
// Tab dedicada para el engine — evita interferir con tabs del usuario
const ENGINE_TAB_KEY = 'engine_tab_id';

async function getOrCreateEngineTab() {
  const { engine_tab_id } = await chrome.storage.local.get(ENGINE_TAB_KEY);
  if (engine_tab_id) {
    try {
      const tab = await chrome.tabs.get(engine_tab_id);
      if (tab && tab.url?.includes('linkedin.com')) {
        console.log('[cazary.ai] Reutilizando engine tab:', tab.id);
        return tab;
      }
    } catch (_) {
      // Tab cerrada — crear nueva
    }
  }
  console.log('[cazary.ai] Creando nueva engine tab...');
  const tab = await chrome.tabs.create({
    url: 'https://www.linkedin.com/feed/',
    active: true,   // ACTIVA para que JS funcione correctamente
  });
  await chrome.storage.local.set({ [ENGINE_TAB_KEY]: tab.id });
  // Esperar que cargue completamente
  await waitForTabComplete(tab.id, 10000);
  await sleep(2000);
  return tab;
}

// Alias para compatibilidad
async function getLinkedInTab() {
  return getOrCreateEngineTab();
}

// TODO: Re-enable for production
async function isActiveHour() { return true; }

// TODO: Re-enable for production
async function isWeekendPaused() { return false; }

async function getTodayStats(wsId) {
  try {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const rows = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&status=eq.done` +
      `&executed_at=gte.${today}T00:00:00Z&select=action_type`
    ).catch(() => []);

    const stats = { connections: 0, messages: 0, likes: 0, views: 0, date: today };
    for (const row of (rows ?? [])) {
      if (row.action_type === 'connect')       stats.connections++;
      if (row.action_type === 'message')       stats.messages++;
      if (row.action_type === 'like')          stats.likes++;
      if (row.action_type === 'view_profile')  stats.views++;
    }

    // Actualizar caché local (solo para sesión actual)
    await chrome.storage.local.set({ daily_stats: stats });
    console.log('[cazary.ai] Stats sincronizadas desde Supabase:', stats);
    return stats;
  } catch (err) {
    console.warn('[cazary.ai] getTodayStats error:', err.message);
    // Fallback a caché local si Supabase falla
    const { daily_stats } = await chrome.storage.local.get('daily_stats');
    return daily_stats ?? { connections: 0, messages: 0, likes: 0, views: 0, date: todayStr() };
  }
}

// Per-type daily limit check against Supabase engine_queue + user-configured settings
async function checkDailyLimitsByType(wsId, taskType) {
  try {
    const settings = await getSettings();
    const limitMap = {
      connect:      settings.maxConnections ?? 20,
      message:      settings.maxMessages    ?? 30,
      view_profile: settings.maxLikes       ?? 50,
      like:         settings.maxLikes       ?? 20,
      follow:       settings.maxConnections ?? 20,
    };
    const limit = limitMap[taskType] ?? 999;

    const today = new Date().toISOString().split('T')[0];
    // action_type is the correct column name in engine_queue (not task_type)
    const rows = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&action_type=eq.${taskType}&status=eq.done` +
      `&executed_at=gte.${today}T00:00:00Z&select=id`
    ).catch(() => []);

    const count = rows?.length ?? 0;
    if (count >= limit) {
      console.log(`[cazary.ai] Límite diario de ${taskType} alcanzado (${count}/${limit})`);
      return false;
    }
    console.log(`[cazary.ai] Daily ${taskType}: ${count}/${limit} ✓`);
    return true;
  } catch (err) {
    console.warn('[cazary.ai] checkDailyLimitsByType error:', err.message);
    return true; // Fail open para no bloquear el engine
  }
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

async function loadWorkspaceSettings() {
  const wsId = await getWorkspaceId();
  if (!wsId) return;
  try {
    const data = await supabaseFetch(
      `workspace_settings?workspace_id=eq.${wsId}&select=*&limit=1`
    );
    if (data?.length) {
      await chrome.storage.local.set({
        settings: {
          maxConnections:   data[0].daily_connections_limit ?? 20,
          maxMessages:      data[0].daily_messages_limit    ?? 30,
          maxLikes:         20,
          ultraSafe:        data[0].ultra_safe_mode         ?? true,
          pauseWeekends:    data[0].pause_on_weekends       ?? true,
          activeHoursStart: data[0].active_hours_start      ?? 8,
          activeHoursEnd:   data[0].active_hours_end        ?? 20,
          delayMinSec:      180,
          delayMaxSec:      480,
          timezone:         'America/Lima',
        },
      });
    }
  } catch (_) {}
}

async function getStatus() {
  const data = await chrome.storage.local.get([
    'engine_running', 'daily_stats', 'supabase_token', 'processing',
    'processing_task_type', 'processing_task_id', 'processing_started_at',
    'last_action_log',
  ]);
  const wsId = await getWorkspaceId();

  let queueCount = 0;
  if (wsId) {
    try {
      const q = await supabaseFetch(
        `engine_queue?workspace_id=eq.${wsId}&status=in.(pending,scheduled)&select=id`,
        { headers: { 'Prefer': 'count=exact' } }
      );
      queueCount = q?.length ?? 0;
    } catch (_) {}
  }

  return {
    connected:  !!data.supabase_token,
    running:    !!data.engine_running,
    processing: !!data.processing,
    stats:      data.daily_stats ?? { connections: 0, messages: 0, likes: 0 },
    queueCount,
    currentTask: data.processing ? {
      type:    data.processing_task_type ?? 'unknown',
      taskId:  data.processing_task_id  ?? null,
      elapsed: data.processing_started_at
               ? Math.round((Date.now() - data.processing_started_at) / 1000)
               : 0,
    } : null,
    lastAction: data.last_action_log ?? null,
    settings:   await getSettings(),
  };
}

async function incrementLeadsQueued(campaignId) {
  try {
    let campData;
    try {
      campData = await supabaseFetch(
        `campaigns?id=eq.${campaignId}&select=leads_queued`, { method: 'GET' }
      );
    } catch (_) {
      return; // columna no existe aún
    }
    if (!campData || campData.length === 0) return;
    const currentCount = campData[0].leads_queued;
    if (currentCount === undefined || currentCount === null) return;
    await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ leads_queued: currentCount + 1 }),
    });
  } catch (e) {
    console.warn('[cazary.ai] incrementLeadsQueued omitido:', e.message);
  }
}

function randomDelay(minSec, maxSec) {
  return Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function interpolateVariables(template, leadId) {
  if (!template || !leadId) return template ?? '';
  if (!template.includes('{{')) return template;

  const leadRows = await supabaseFetch(
    `leads?id=eq.${leadId}&select=full_name,company,headline,location,email`,
    { method: 'GET' }
  ).catch(() => null);
  const lead = leadRows?.[0];
  if (!lead) return template;

  const firstName = (lead.full_name ?? '').split(' ')[0] || 'Hola';

  const headlineRaw = lead.headline ?? '';
  const cargoMatch  = headlineRaw.match(/^([^|@\n]+?)(?:\s+(?:en|at|@|·)\s+|$)/i);
  const cargo       = cargoMatch?.[1]?.trim() || headlineRaw.split(' ').slice(0, 3).join(' ');

  const vars = {
    '{{nombre}}':          firstName,
    '{{nombre_completo}}': lead.full_name ?? firstName,
    '{{empresa}}':         lead.company   ?? 'su empresa',
    '{{cargo}}':           cargo          || 'tu área',
    '{{ubicacion}}':       lead.location  ?? '',
    '{{email}}':           lead.email     ?? '',
  };

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

async function scheduleInboxCheck(wsId) {
  const snTabs  = await chrome.tabs.query({ url: '*://*.linkedin.com/sales/*' });
  const hasSNav = snTabs.length > 0;

  const inboxUrls = [
    'https://www.linkedin.com/messaging/',
    ...(hasSNav ? ['https://www.linkedin.com/sales/inbox/'] : []),
  ];

  for (const inboxUrl of inboxUrls) {
    const platform = inboxUrl.includes('/sales/') ? 'salesnav' : 'linkedin';
    const existing = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&task_type=eq.check_inbox` +
      `&status=eq.pending&select=id&limit=1`,
      { method: 'GET' }
    ).catch(() => []);
    if (existing?.length) continue;

    await supabaseFetch('engine_queue', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id: wsId,
        task_type:    'check_inbox',
        action_type:  'check_inbox',
        priority:     3,
        scheduled_at: new Date().toISOString(),
        payload: {
          inbox_url: inboxUrl,
          platform,
        },
      }),
    }).catch(() => {});
  }
}

// ── Seguridad adaptativa ──────────────────────────────────────────────────────

async function getConsecutiveErrors() {
  const { consecutive_errors } = await chrome.storage.local.get('consecutive_errors');
  return consecutive_errors ?? 0;
}

async function incrementConsecutiveErrors() {
  const current = await getConsecutiveErrors();
  const next = current + 1;
  await chrome.storage.local.set({ consecutive_errors: next });
  console.warn(`[cazary.ai][Safety] consecutive_errors: ${next}`);
  return next;
}

async function resetConsecutiveErrors() {
  await chrome.storage.local.set({ consecutive_errors: 0 });
}

// Calcula el delay extra según errores consecutivos (exponential backoff)
function getAdaptiveDelay(errors) {
  if (errors === 0) return 0;
  if (errors === 1) return 2  * 60 * 1000;  // 2 min
  if (errors === 2) return 5  * 60 * 1000;  // 5 min
  if (errors === 3) return 15 * 60 * 1000;  // 15 min
  if (errors === 4) return 30 * 60 * 1000;  // 30 min
  return 60 * 60 * 1000;                    // 1 hora — máximo
}

// ── Selector Healing: disparar análisis IA via Next.js API ───────────────────
async function triggerSelectorAnalysis(failureId) {
  try {
    const { supabase_workspace_settings } = await chrome.storage.local.get('supabase_workspace_settings');
    const dashboardUrl = supabase_workspace_settings?.dashboard_url ?? DASHBOARD_URL;
    fetch(`${dashboardUrl}/api/selector-healing`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ failure_id: failureId }),
    }).catch(() => {});
    console.log(`[cazary.ai][SelectorHealing] triggerSelectorAnalysis → ${failureId}`);
  } catch (_) {
    // fire-and-forget
  }
}

// ── Procesar cola de emails pendientes ───────────────────────────────────────
async function processEmailQueue(wsId) {
  const now = new Date().toISOString();
  const pending = await supabaseFetch(
    `email_queue?workspace_id=eq.${wsId}` +
    `&status=eq.pending` +
    `&scheduled_at=lte.${now}` +
    `&select=id&limit=5`,
    { method: 'GET' }
  ).catch(() => []);

  if (!pending?.length) return;

  const { supabase_workspace_settings } = await chrome.storage.local.get('supabase_workspace_settings');
  const baseUrl = supabase_workspace_settings?.dashboard_url ?? DASHBOARD_URL;

  for (const job of pending) {
    try {
      const res = await fetch(`${baseUrl}/api/send-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email_queue_id: job.id }),
      });
      if (res.ok) {
        console.log(`[cazary.ai] Email enviado: ${job.id}`);
      } else {
        console.warn(`[cazary.ai] Error enviando email ${job.id}: ${res.status}`);
      }
    } catch (e) {
      console.error(`[cazary.ai] Error enviando email ${job.id}:`, e.message);
    }
  }
}
