// ============================================================
// NEXUSAI — GHOST ENGINE v3.0 — background.js
// Service worker MV3. Sin localhost. Todo via Supabase REST.
// ============================================================

importScripts('config.js');

const TICK_ALARM      = 'nexusai-tick';
const HEARTBEAT_ALARM = 'nexusai-heartbeat';

// ── Límites anti-ban por defecto ──────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  maxConnections:   20,
  maxMessages:      30,
  maxLikes:         20,
  delayMinSec:      180,
  delayMaxSec:      480,
  ultraSafe:        true,
  pauseWeekends:    true,
  activeHoursStart: 8,
  activeHoursEnd:   20,
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
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 1   });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[NexusAI] Alarms initialized on install/update');
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.clearAll();
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 1   });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[NexusAI] Alarms initialized on startup');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Self-healing: ensure alarms exist
  const allAlarms = await chrome.alarms.getAll();
  const names = allAlarms.map(a => a.name);
  if (!names.includes(TICK_ALARM))      await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 1   });
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

      case 'SAVE_SETTINGS':
        await chrome.storage.local.set({ settings: msg.settings });
        sendResponse({ ok: true });
        break;

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

// ── Tick principal ────────────────────────────────────────────────────────────
async function processTick() {
  const { engine_running } = await chrome.storage.local.get('engine_running');
  if (!engine_running) return;
  if (!await isActiveHour()) return;
  if (await isWeekendPaused()) return;
  if (!await checkDailyLimits()) return;

  // Validate token before hitting Supabase — avoids "Failed to fetch" on expiry
  const token = await getStoredToken();
  if (!token) {
    console.warn('[NexusAI] Token inválido, saltando tick');
    return;
  }

  const wsId = await getWorkspaceId();
  if (!wsId) return;

  const { processing, next_task_at } = await chrome.storage.local.get(['processing', 'next_task_at']);
  if (processing) return;
  if (next_task_at && Date.now() < next_task_at) return;

  try {
    const tasks = await supabaseFetch(
      `engine_queue?workspace_id=eq.${wsId}&status=eq.pending&order=priority.asc,scheduled_at.asc&limit=1`
    );
    if (!tasks || tasks.length === 0) return;

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
    const needsProfileUrl = ['view_profile', 'connect', 'message', 'extract_profile'];
    if (needsProfileUrl.includes(task.action_type) && !profileUrl) {
      await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body:   JSON.stringify({ status: 'failed', last_error: 'Missing profile_url in payload' }),
      });
      await chrome.storage.local.set({ processing: false });
      return;
    }

    switch (task.action_type) {
      case 'view_profile':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await sleep(3000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId) => window.postMessage({ type: 'NEXUSAI_TASK', task: 'view_profile', taskId }, '*'),
          args:   [task.id],
        });
        break;

      case 'connect':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await sleep(4000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId, note, leadId, campaignId) => window.postMessage(
            { type: 'NEXUSAI_TASK', task: 'connect', taskId, note, leadId, campaignId }, '*'
          ),
          args:   [task.id, task.payload?.note ?? '', task.payload?.lead_id ?? null, task.payload?.campaign_id ?? null],
        });
        break;

      case 'message':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await sleep(4000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId, text, leadId, campaignId) => window.postMessage(
            { type: 'NEXUSAI_TASK', task: 'message', taskId, text, leadId, campaignId }, '*'
          ),
          args:   [task.id, task.payload?.message_text ?? '', task.payload?.lead_id ?? null, task.payload?.campaign_id ?? null],
        });
        break;

      case 'count_leads':
        await chrome.tabs.update(tab.id, { url: task.payload?.search_url });
        await sleep(5000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId, cId, sId) => window.postMessage({ type: 'NEXUSAI_TASK', task: 'count_leads', taskId, campaignId: cId, segmentId: sId }, '*'),
          args:   [task.id, task.payload?.campaign_id, task.payload?.segment_id],
        });
        break;

      case 'extract_profile':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await sleep(4000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId, leadId) => window.postMessage({ type: 'NEXUSAI_TASK', task: 'extract_profile', taskId, leadId }, '*'),
          args:   [task.id, task.payload?.lead_id],
        });
        break;

      case 'start_campaign_scraping': {
        // Mark done immediately — scraping runs async in background
        await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'done', executed_at: new Date().toISOString() }),
        });
        await chrome.storage.local.set({ processing: false });
        const campRows = await supabaseFetch(
          `campaigns?id=eq.${task.payload?.campaign_id}&select=*`
        );
        if (campRows?.[0]) {
          startCampaignScraping(campRows[0]).catch((err) =>
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

    const settings = await getSettings();
    const delay    = randomDelay(settings.delayMinSec, settings.delayMaxSec);
    await chrome.storage.local.set({ next_task_at: Date.now() + delay * 1000 });

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

  const { engine_running, daily_stats, next_task_at } =
    await chrome.storage.local.get(['engine_running', 'daily_stats', 'next_task_at']);

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
          next_task_at:      next_task_at ?? null,
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

  // 2. Actualizar stats diarias
  const { daily_stats } = await chrome.storage.local.get('daily_stats');
  const stats = daily_stats ?? { connections: 0, messages: 0, likes: 0, date: todayStr() };
  if (stats.date !== todayStr()) {
    Object.assign(stats, { connections: 0, messages: 0, likes: 0, date: todayStr() });
  }
  if (result.action === 'connect') stats.connections++;
  if (result.action === 'message') stats.messages++;
  if (result.action === 'like')    stats.likes++;
  await chrome.storage.local.set({ daily_stats: stats, processing: false });

  // 3. Actualizar el lead en el CRM según la acción completada
  if (wsId && result.lead_id) {
    try {
      if (result.action === 'connect') {
        await supabaseFetch(`leads?id=eq.${result.lead_id}&workspace_id=eq.${wsId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            status:    'contactado',
            next_task: 'Esperar aceptación de conexión',
          }),
        });
      } else if (result.action === 'connect_accepted') {
        await supabaseFetch(`leads?id=eq.${result.lead_id}&workspace_id=eq.${wsId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            status:    'conectado',
            next_task: 'Enviar mensaje de seguimiento',
          }),
        });
      } else if (result.action === 'message') {
        await supabaseFetch(`leads?id=eq.${result.lead_id}&workspace_id=eq.${wsId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body: JSON.stringify({
            next_task: 'Esperar respuesta',
          }),
        });
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

  // 4. Registrar en activity_log
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

const SCRAPER_MAX_TOTAL      = 500;
const SCRAPER_PAGE_DELAY_MIN = 8000;
const SCRAPER_PAGE_DELAY_MAX = 15000;
const SCRAPER_TASK_STAGGER   = 4 * 60 * 1000; // 4 min entre tareas en cola

async function startCampaignScraping(campaign) {
  const segments    = campaign.workflow_json?.segments ?? [];
  const workspaceId = campaign.workspace_id;

  for (const segment of segments) {
    if (segment.status !== 'active') continue;
    const searchUrl = segment.searchUrl || segment.url || segment.salesNavUrl;
    if (!searchUrl) continue;

    await supabaseFetch(`campaigns?id=eq.${campaign.id}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({
        scraping_status:     'running',
        scraping_started_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    await scrapeAndQueueLeads(campaign.id, workspaceId, searchUrl, campaign.workflow_json);
  }
}

async function scrapeAndQueueLeads(campaignId, workspaceId, searchUrl, workflowJson) {
  let page         = 1;
  let totalQueued  = 0;
  let keepGoing    = true;

  // Determine first action from workflow nodes
  const firstNode     = workflowJson?.nodes?.[0]?.data;
  const actionType    = firstNode?.nodeType === 'connect' ? 'send_connection' : (firstNode?.nodeType ?? 'send_connection');
  const noteMessage   = firstNode?.messageA ?? firstNode?.note ?? '';

  while (keepGoing && totalQueued < SCRAPER_MAX_TOTAL) {
    const pageUrl = `${searchUrl}&page=${page}`;
    console.log(`[NexusAI Scraper] Page ${page}: navigating…`);

    let profiles = [];
    try {
      profiles = await sendToLinkedInTab(pageUrl, 'scrape_profiles');
    } catch (err) {
      console.warn(`[NexusAI Scraper] Page ${page} error:`, err.message);
      // Check for captcha / block
      if (err.message?.includes('blocked') || err.message?.includes('captcha')) {
        await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ scraping_status: 'blocked' }),
        }).catch(() => {});
        chrome.notifications.create(`scraper-blocked-${campaignId}`, {
          type:    'basic',
          iconUrl: 'icons/icon48.png',
          title:   'NexusAI — Scraping bloqueado',
          message: 'LinkedIn detectó actividad inusual. El scraping se pausó.',
        });
        return;
      }
      break;
    }

    console.log(`[NexusAI Scraper] Page ${page}: ${profiles.length} profiles found`);

    if (!profiles || profiles.length === 0) break;

    for (const profile of profiles) {
      if (totalQueued >= SCRAPER_MAX_TOTAL) break;
      const executeAt = new Date(Date.now() + totalQueued * SCRAPER_TASK_STAGGER);

      await supabaseFetch('engine_queue', {
        method: 'POST', prefer: 'return=minimal',
        body:   JSON.stringify({
          workspace_id: workspaceId,
          action_type:  actionType,
          payload: {
            profile_url:  profile.url,
            linkedin_url: profile.url,
            full_name:    profile.name  ?? '',
            headline:     profile.headline ?? '',
            campaign_id:  campaignId,
            note:         noteMessage,
            message_text: noteMessage,
          },
          status:      'pending',
          priority:    5,
          execute_at:  executeAt.toISOString(),
          scheduled_at: executeAt.toISOString(),
        }),
      }).catch((err) => console.warn('[NexusAI Scraper] Insert queue error:', err.message));

      totalQueued++;
    }

    // Update progress in real-time
    await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body:   JSON.stringify({ leads_total: totalQueued }),
    }).catch(() => {});

    // Last page if fewer than 25 results
    if (profiles.length < 25) keepGoing = false;

    // Anti-ban delay between pages
    const delay = SCRAPER_PAGE_DELAY_MIN + Math.random() * (SCRAPER_PAGE_DELAY_MAX - SCRAPER_PAGE_DELAY_MIN);
    await sleep(delay);
    page++;
  }

  await supabaseFetch(`campaigns?id=eq.${campaignId}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body:   JSON.stringify({ scraping_status: 'completed', leads_total: totalQueued }),
  }).catch(() => {});

  console.log(`[NexusAI Scraper] Done. Total queued: ${totalQueued}`);
}

// Navigate a LinkedIn tab to the given URL and ask the content script to run an action.
// Reuses an existing LinkedIn tab if available; never opens more than 1 scraping tab.
async function sendToLinkedInTab(url, action) {
  let tab = await getLinkedInTab();

  if (tab) {
    // Only navigate if we're not already on the right URL
    if (!tab.url?.startsWith(url.split('&page=')[0])) {
      await chrome.tabs.update(tab.id, { url });
      await sleep(6000 + Math.random() * 3000); // wait for page load
    }
  } else {
    const newTab = await chrome.tabs.create({ url, active: false });
    tab = newTab;
    await sleep(8000 + Math.random() * 4000);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.profiles) {
        resolve(response.profiles);
      } else {
        resolve([]);
      }
    });
  });
}

// ── Utilidades ────────────────────────────────────────────────────────────────
async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  return tabs[0] ?? null;
}

async function isActiveHour() {
  const s = await getSettings();
  const h = new Date().getHours();
  return h >= s.activeHoursStart && h < s.activeHoursEnd;
}

async function isWeekendPaused() {
  const s = await getSettings();
  if (!s.pauseWeekends) return false;
  const d = new Date().getDay();
  return d === 0 || d === 6;
}

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
    'engine_running', 'daily_stats', 'next_task_at',
    'supabase_token', 'processing',
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
    nextTaskAt: data.next_task_at ?? null,
    queueCount,
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
