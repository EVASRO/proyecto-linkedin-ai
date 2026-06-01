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

// ── Arranque ──────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 1   });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  console.log('[NexusAI] Ghost Engine v3.0 instalado — conectado a Supabase');
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(TICK_ALARM,      { periodInMinutes: 1   });
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
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
        await chrome.storage.local.set({ engine_running: true });
        await sendHeartbeat();
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
    const profileUrl = task.payload?.profile_url;

    switch (task.task_type) {
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
          func:   (taskId, note) => window.postMessage({ type: 'NEXUSAI_TASK', task: 'connect', taskId, note }, '*'),
          args:   [task.id, task.payload?.note ?? ''],
        });
        break;

      case 'message':
        await chrome.tabs.update(tab.id, { url: profileUrl });
        await sleep(4000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   (taskId, text) => window.postMessage({ type: 'NEXUSAI_TASK', task: 'message', taskId, text }, '*'),
          args:   [task.id, task.payload?.message_text ?? ''],
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

      default:
        await supabaseFetch(`engine_queue?id=eq.${task.id}`, {
          method: 'PATCH', prefer: 'return=minimal',
          body:   JSON.stringify({ status: 'failed', last_error: `Unknown task_type: ${task.task_type}` }),
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

// ── Heartbeat ─────────────────────────────────────────────────────────────────
async function sendHeartbeat() {
  const wsId = await getWorkspaceId();
  if (!wsId) return;

  const { engine_running, daily_stats, next_task_at } =
    await chrome.storage.local.get(['engine_running', 'daily_stats', 'next_task_at']);

  try {
    await supabaseFetch('ghost_engine_sessions', {
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
  } catch (_) {}

  // Emitir estado al popup si está abierto
  const status = await getStatus();
  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: status }).catch(() => {});
}

// ── Handlers de resultados del content script ─────────────────────────────────
async function handleActionDone(taskId, result) {
  const wsId = await getWorkspaceId();

  await supabaseFetch(`engine_queue?id=eq.${taskId}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body:   JSON.stringify({ status: 'done', executed_at: new Date().toISOString() }),
  });

  // Actualizar stats diarias
  const { daily_stats } = await chrome.storage.local.get('daily_stats');
  const stats = daily_stats ?? { connections: 0, messages: 0, likes: 0, date: todayStr() };
  if (stats.date !== todayStr()) {
    Object.assign(stats, { connections: 0, messages: 0, likes: 0, date: todayStr() });
  }
  if (result.action === 'connect') stats.connections++;
  if (result.action === 'message') stats.messages++;
  if (result.action === 'like')    stats.likes++;
  await chrome.storage.local.set({ daily_stats: stats, processing: false });

  // Registrar en activity_log
  if (wsId) {
    await supabaseFetch('activity_log', {
      method: 'POST', prefer: 'return=minimal',
      body: JSON.stringify({
        workspace_id: wsId,
        lead_id:      result.lead_id     ?? null,
        campaign_id:  result.campaign_id ?? null,
        action_type:  result.action,
        description:  result.description ?? result.action,
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

  try {
    // Buscar o crear conversación
    let convs = await supabaseFetch(
      `conversations?workspace_id=eq.${wsId}&lead_id=eq.${data.lead_id}&limit=1`
    );
    let convId;
    if (!convs || convs.length === 0) {
      const newConv = await supabaseFetch('conversations', {
        method: 'POST',
        body:   JSON.stringify({ workspace_id: wsId, lead_id: data.lead_id, status: 'active', unread_count: 1 }),
      });
      convId = newConv?.[0]?.id;
    } else {
      convId = convs[0].id;
      await supabaseFetch(`conversations?id=eq.${convId}`, {
        method: 'PATCH', prefer: 'return=minimal',
        body:   JSON.stringify({ unread_count: (convs[0].unread_count ?? 0) + 1 }),
      });
    }
    if (convId) {
      await supabaseFetch('messages', {
        method: 'POST', prefer: 'return=minimal',
        body:   JSON.stringify({
          workspace_id:        wsId,
          lead_id:             data.lead_id,
          conversation_id:     convId,
          sender:              'prospect',
          message_text:        data.text,
          linkedin_message_id: data.linkedin_id ?? null,
          timestamp:           data.timestamp ?? new Date().toISOString(),
        }),
      });
    }
  } catch (_) {}
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
