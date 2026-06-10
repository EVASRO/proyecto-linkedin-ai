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
  if (supabase_token && !supabase_workspace_id) {
    await getWorkspaceId();
  }
}

// ── Arranque ──────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clearAll();
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 0.5 });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[NexusAI] Alarms initialized on install/update');
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.clearAll();
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 0.5 });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[NexusAI] Alarms initialized on startup');
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
          'engine_running',
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

      case 'ACTION_DONE':
        await handleActionDone(msg.taskId, msg.result);
        sendResponse({ ok: true });
        break;

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

          const nexusUrl = 'https://proyecto-linkedin-ai.vercel.app/api/generate-message';
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

  // Verificar cuota diaria antes de cualquier tarea
  if (!await checkDailyLimits()) {
    console.log('[NexusAI] Límite diario alcanzado, saltando tick');
    return;
  }

  // Validate token before hitting Supabase — avoids "Failed to fetch" on expiry
  const token = await getStoredToken();
  if (!token) {
    console.warn('[NexusAI] Token inválido, saltando tick');
    return;
  }

  const wsId = await getWorkspaceId();
  if (!wsId) return;

  const { processing } = await chrome.storage.local.get('processing');
  if (processing) {
    const { processing_started_at, processing_task_id } =
      await chrome.storage.local.get(['processing_started_at', 'processing_task_id']);
    const elapsed = processing_started_at ? Date.now() - processing_started_at : 0;
    if (elapsed > 60000) {
      console.warn('[NexusAI] Watchdog activado: liberando processing atascado');
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

  try {
    const now = new Date().toISOString();
    const tasks = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&status=eq.pending&scheduled_at=lte.${now}&order=priority.desc,scheduled_at.asc&limit=1`
    );
    if (!tasks || tasks.length === 0) {
      // Sin tareas de alta prioridad — detectar conexiones aceptadas en segundo plano
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
    console.error('[NexusAI] Error en tick:', err.message);
    await chrome.storage.local.set({ processing: false });
  }
}

// ── Detectar nuevas conexiones aceptadas ──────────────────────────────────────
async function detectNewConnections(wsId) {
  const cutoff = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // >2h
  const pendingLeads = await supabaseFetch(
    `leads?workspace_id=eq.${wsId}&crm_column=eq.conexion_enviada` +
    `&connection_sent_at=lte.${cutoff}` +
    `&select=id,linkedin_url,campaign_id,connection_sent_at&limit=20`,
    { method: 'GET' }
  ).catch(() => []);

  if (!pendingLeads?.length) return;

  for (const lead of pendingLeads) {
    if (!lead.linkedin_url) continue;
    const existing = await supabaseFetch(
      `engine_queue?lead_id=eq.${lead.id}&task_type=eq.check_connection&status=eq.pending&select=id`,
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
        payload:      { profile_url: lead.linkedin_url, lead_id: lead.id, campaign_id: lead.campaign_id },
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
      console.error('[NexusAI] sendToContentScript failed:', e2.message);
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
          console.log('[NexusAI] Lead en blacklist, saltando:', profileUrl);
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

      case 'connect':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 2000);
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'connect',
          taskId:     task.id,
          note:       task.payload?.note        ?? '',
          leadId:     task.payload?.lead_id     ?? null,
          campaignId: task.payload?.campaign_id ?? null,
        });
        break;

      case 'message': {
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await waitForTabComplete(tab.id);
        await sleep(3000 + Math.random() * 2000);
        const rawText   = task.payload?.message_text ?? '';
        const finalText = await interpolateVariables(rawText, task.payload?.lead_id ?? null);
        await sendToContentScript(tab.id, {
          action:     'execute_task',
          task:       'message',
          taskId:     task.id,
          text:       finalText,
          leadId:     task.payload?.lead_id     ?? null,
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
        status:                  'active',
        connection_mode:         'extension',
        daily_connection_limit:  20,
        daily_message_limit:     30,
      }),
    });
    console.log('[NexusAI] LinkedIn account synced:', linkedin_profile.name);
  } catch (_) {}
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
async function sendHeartbeat() {
  const wsId = await getWorkspaceId();
  if (!wsId) return;

  // Sync LinkedIn account on every heartbeat (idempotent upsert)
  await syncLinkedInAccount();

  const { engine_running, daily_stats } =
    await chrome.storage.local.get(['engine_running', 'daily_stats']);

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
    console.warn('[NexusAI] Heartbeat failed:', err?.message ?? err);
  }

  // Emitir estado al popup si está abierto
  const status = await getStatus();
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: status }).catch(() => {});
}

// ── Handlers de resultados del content script ─────────────────────────────────
async function handleActionDone(taskId, result) {
  const wsId = await getWorkspaceId();

  // 1. Marcar tarea como done en engine_queue
  await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body:   JSON.stringify({ status: 'done', executed_at: new Date().toISOString() }),
  });

  // 2. Actualizar stats diarias — siempre liberar processing en finally
  try {
    const { daily_stats } = await chrome.storage.local.get('daily_stats');
    const stats = daily_stats ?? { connections: 0, messages: 0, likes: 0, date: todayStr() };
    if (stats.date !== todayStr())
      Object.assign(stats, { connections: 0, messages: 0, likes: 0, date: todayStr() });
    if (result.action === 'connect') stats.connections++;
    if (result.action === 'message') stats.messages++;
    if (result.action === 'like')    stats.likes++;
    await chrome.storage.local.set({ daily_stats: stats });
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
      console.warn('[NexusAI] LinkedIn daily limit → pausando engine');
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

    if (result.reason === 'send_button_not_found' || result.reason === 'button_not_found') {
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
          last_error: `Button not found (attempt ${attempts}/3)`,
        }),
      }).catch(() => {});
      return;
    }
  }

  // 4. Actualizar el lead en el CRM según la acción completada
  if (wsId && result.lead_id) {
    try {
      const now = new Date().toISOString();

      if (result.action === 'connect' && result.success !== false) {
        const nota = result.connection_note || result.note || result.message || null;

        await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            crm_column:         'conexion_enviada',
            connection_sent_at: now,
            status:             'contacted',
          }),
        }).catch(e => console.error('[NexusAI] PATCH lead connect error:', e));

        // Crear conversación en Smart Inbox
        const existingConv = await supabaseFetch(
          `conversations?lead_id=eq.${result.lead_id}&workspace_id=eq.${wsId}&select=id`,
          { method: 'GET' }
        ).catch(() => []);

        let convId = existingConv?.[0]?.id;
        if (!convId) {
          const newConv = await supabaseFetch('conversations', {
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
          convId = newConv?.[0]?.id;
        }
        if (convId && nota) {
          await supabaseFetch('messages', {
            method: 'POST', prefer: 'return=minimal',
            body: JSON.stringify({
              conversation_id: convId,
              lead_id:         result.lead_id,
              workspace_id:    wsId,
              sender:          'user',
              message_text:    nota,
              event:           'connection_sent',
              status:          'sent',
              is_read:         true,
              timestamp:       now,
              inserted_at:     now,
            }),
          }).catch(() => {});
        }
        console.log('[NexusAI] conexion_enviada:', result.lead_id);

      } else if (result.action === 'connect_accepted') {
        // Manejar aceptación con follow-up automático
        await handleConnectionAccepted(result.profile_url, wsId);

        // Encolar follow-up si la campaña lo tiene configurado
        if (result.campaign_id) {
          const campRows = await supabaseFetch(
            `campaigns?id=eq.${result.campaign_id}&select=workflow_json`,
            { method: 'GET' }
          ).catch(() => null);
          const wf           = campRows?.[0]?.workflow_json ?? {};
          const followUpMsg  = wf.follow_up_message || wf.connection_message || '';
          const followUpDays = wf.follow_up_delay_days ?? 1;
          if (followUpMsg && result.lead_id) {
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
        await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            crm_column: 'en_conversacion',
            status:     'in_conversation',
            next_task:  'Esperar respuesta',
          }),
        }).catch(() => {});

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
              event:           'message_sent',
              status:          'sent',
              is_read:         true,
              timestamp:       now,
              inserted_at:     now,
            }),
          }).catch(() => {});
        }
        console.log('[NexusAI] en_conversacion:', result.lead_id);

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
              event:           'reply_received',
              status:          'received',
              is_read:         false,
              timestamp:       now,
              inserted_at:     now,
            }),
          }).catch(() => {});
        }

      } else if (result.action === 'check_inbox') {
        const conversations = result.conversations ?? [];
        console.log(`[NexusAI] check_inbox: ${result.unreadCount} no leídos, ${conversations.length} procesando`);

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
            console.log(`[NexusAI] check_inbox: Lead no encontrado para "${searchName}"`);
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
            console.log(`[NexusAI] check_inbox: ${searchName} → en_conversacion`);
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
                event:           'reply_received',
                status:          'received',
                is_read:         false,
                timestamp:       conv.timestamp ?? now,
                inserted_at:     now,
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
                  'Authorization': `Bearer nexusai-autopilot-2024`,
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
        console.log('[NexusAI] reunion_agendada:', result.lead_id);

      } else if (result.action === 'check_connection') {
        if (result.connected === true) {
          await supabaseFetch(`leads?id=eq.${result.lead_id}`, {
            method: 'PATCH', prefer: 'return=minimal',
            body: JSON.stringify({
              crm_column:             'conexion_aceptada',
              connection_accepted_at: now,
              status:                 'connected',
            }),
          }).catch(e => console.error('[NexusAI] PATCH check_connection error:', e));

          // Obtener config follow-up de la campaña
          if (result.campaign_id) {
            const campRows2 = await supabaseFetch(
              `campaigns?id=eq.${result.campaign_id}&select=workflow_json`,
              { method: 'GET' }
            ).catch(() => null);
            const wf2          = campRows2?.[0]?.workflow_json ?? {};
            const followUpMsg2 = wf2.follow_up_message || wf2.connection_message || '';
            const followUpDays2 = wf2.follow_up_delay_days ?? 1;
            if (followUpMsg2) {
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
          console.log('[NexusAI] conexion_aceptada:', result.lead_id);
        }
        // Si pending: dejar en conexion_enviada, se reintentará
      }
    } catch (err) {
      console.error('[NexusAI] Error actualizando lead:', err);
    }
  }

  // 3b. Incrementar leads_queued en la campaña al enviar conexión exitosa
  if (wsId && result.campaign_id && result.action === 'connect' && result.success !== false) {
    try {
      await supabaseFetch('rpc/increment_leads_queued', {
        method: 'POST',
        body:   JSON.stringify({ campaign_id: result.campaign_id }),
      });
    } catch (_) {}
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
      await supabaseFetch(`conversations?id=eq.${convId}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body:   JSON.stringify({ unread_count: (convs[0].unread_count ?? 0) + 1 }),
      });
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
        timestamp:           data.timestamp ?? new Date().toISOString(),
      }),
    });

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
    console.error('[NexusAI] handleMessageReceived error:', err);
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

  // Base note/message from workflow (fallback when A/B is off or winner declared)
  const baseNote = fullWf.connection_note    || fullWf.connection_message || '';
  const baseMsg  = fullWf.follow_up_message  || fullWf.connection_message || '';

  const abEnabled = !!(campData.ab_test_enabled);
  const abWinner  = campData.ab_winner ?? null;

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
    `engine_queue?campaign_id=eq.${campaignId}&status=eq.pending&select=lead_id`,
    { method: 'GET' }
  ).catch(() => []);
  const enqueuedLeadIds = new Set((existingTasks ?? []).map((t) => t.lead_id));

  const settings   = await getSettings();
  const dailyQuota = settings.maxConnections || 20;
  const delayMin   = settings.delayMinSec    || 180;
  const delayMax   = settings.delayMaxSec    || 480;

  const pendingLeads = leads.filter((l) => !enqueuedLeadIds.has(l.id));
  console.log(`[NexusAI Scraper] Encolando ${pendingLeads.length} conexiones (cuota ${dailyQuota}/día)`);

  const inserts = [];
  const variantPatches = []; // { leadId, variant } to PATCH after insert batch

  for (let i = 0; i < pendingLeads.length; i++) {
    const lead      = pendingLeads[i];
    const dayOffset = Math.floor(i / dailyQuota);
    const jitter    = (delayMin + Math.random() * (delayMax - delayMin)) * 1000;
    const scheduledAt = new Date(Date.now() + dayOffset * 24 * 3600 * 1000 + jitter);

    // ── A/B variant assignment ──────────────────────────────────────────────
    let connNote       = baseNote;
    let followUpMsg    = baseMsg;
    let assignedVariant = null;

    if (abEnabled && !abWinner) {
      // Random 50/50 assignment
      assignedVariant = Math.random() < 0.5 ? 'a' : 'b';
      const variantData = assignedVariant === 'a'
        ? (campData.ab_variant_a ?? {})
        : (campData.ab_variant_b ?? {});
      connNote    = variantData.connection_note    ?? baseNote;
      followUpMsg = variantData.follow_up_message  ?? baseMsg;
      variantPatches.push({ leadId: lead.id, variant: assignedVariant });
    } else if (abEnabled && abWinner) {
      // Use the declared winner exclusively
      const variantData = abWinner === 'a'
        ? (campData.ab_variant_a ?? {})
        : (campData.ab_variant_b ?? {});
      connNote    = variantData.connection_note    ?? baseNote;
      followUpMsg = variantData.follow_up_message  ?? baseMsg;
    }
    // ───────────────────────────────────────────────────────────────────────

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
        message_text:     followUpMsg,
        ab_variant:       assignedVariant,
      },
      status:       'pending',
      priority:     5,
      scheduled_at: scheduledAt.toISOString(),
    });
  }

  // INSERT en lotes de 50 para no sobrepasar límites de payload
  const BATCH_SIZE = 50;
  for (let b = 0; b < inserts.length; b += BATCH_SIZE) {
    const batch = inserts.slice(b, b + BATCH_SIZE);
    await supabaseFetch('engine_queue', {
      method: 'POST', prefer: 'return=minimal',
      body:   JSON.stringify(batch),
    }).catch((err) => console.warn('[NexusAI Scraper] Insert queue batch error:', err.message));
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

  console.log(`[NexusAI Scraper] ${inserts.length} conexiones encoladas para campaña ${campaignId}`);
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
        event:           'connection_accepted',
        status:          'received',
        is_read:         false,
        timestamp:       now,
        inserted_at:     now,
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
async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  return tabs[0] ?? null;
}

// TODO: Re-enable for production
async function isActiveHour() { return true; }

// TODO: Re-enable for production
async function isWeekendPaused() { return false; }

async function checkDailyLimits() {
  const { daily_stats } = await chrome.storage.local.get('daily_stats');
  const stats = daily_stats ?? { connections: 0, messages: 0, likes: 0, date: todayStr() };
  if (stats.date !== todayStr()) {
    await chrome.storage.local.set({ daily_stats: { connections: 0, messages: 0, likes: 0, date: todayStr() } });
    return true;
  }
  const s = await getSettings();
  return stats.connections < s.maxConnections && stats.messages < s.maxMessages;
}

// Per-type daily limit check against Supabase engine_queue + workspace limits
async function checkDailyLimitsByType(wsId, taskType) {
  try {
    const ws = await supabaseFetch(
      `workspaces?id=eq.${wsId}&select=daily_connect_limit,daily_message_limit,daily_view_limit&limit=1`
    );
    const limits = ws?.[0] ?? { daily_connect_limit: 20, daily_message_limit: 50, daily_view_limit: 100 };

    const today = new Date().toISOString().split('T')[0];
    const typeMap = { connect: 'daily_connect_limit', message: 'daily_message_limit', view_profile: 'daily_view_limit' };
    const limitKey = typeMap[taskType];
    if (!limitKey) return true;

    const rows = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&task_type=eq.${taskType}&status=eq.done` +
      `&executed_at=gte.${today}T00:00:00Z&select=id`
    ).catch(() => []);

    const count = rows?.length ?? 0;
    const limit = limits[limitKey] ?? 999;
    if (count >= limit) {
      console.log(`[NexusAI] Límite diario de ${taskType} alcanzado (${count}/${limit})`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[NexusAI] checkDailyLimitsByType error:', err.message);
    return true; // Fail open to avoid blocking the engine on network errors
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
        `engine_queue?workspace_id=eq.${wsId}&status=eq.pending&select=id`,
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
        console.log(`[NexusAI] Email enviado: ${job.id}`);
      } else {
        console.warn(`[NexusAI] Error enviando email ${job.id}: ${res.status}`);
      }
    } catch (e) {
      console.error(`[NexusAI] Error enviando email ${job.id}:`, e.message);
    }
  }
}
