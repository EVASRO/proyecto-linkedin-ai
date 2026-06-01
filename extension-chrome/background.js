// ============================================================
// NEXUSAI — GHOST ENGINE (background.js)
// Service Worker MV3 — Task Queue con retrasos humanos
// ============================================================

const BACKEND    = 'http://127.0.0.1:8000';
const ALARM      = 'nexusai-tick';
const HEARTBEAT  = 'nexusai-heartbeat'; // sync periódico al dashboard
const COUNT_POLL = 'nexusai-count-poll'; // polling para contar leads

// ── Estado por defecto ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  maxConnections:   30,
  maxMessages:      50,
  maxInmails:       10,
  maxLikes:         30,
  delayMinSec:      180,   // 3 min
  delayMaxSec:      480,   // 8 min
  ultraSafe:        true,
  pauseWeekends:    true,
  activeHoursStart: 8,
  activeHoursEnd:   20,
  timezone:         'America/Lima',
};

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getState() {
  const data = await chrome.storage.local.get([
    'taskQueue', 'dailyStats', 'settings', 'engine', 'linkedinAccount',
  ]);
  return {
    taskQueue:       data.taskQueue       ?? [],
    dailyStats:      data.dailyStats      ?? freshDailyStats(),
    settings:        data.settings        ?? { ...DEFAULT_SETTINGS },
    engine:          data.engine          ?? { running: false, processing: false, nextTaskAt: null },
    linkedinAccount: data.linkedinAccount ?? { connected: false, cookie: null, profileName: null },
  };
}

async function saveState(patch) {
  await chrome.storage.local.set(patch);
}

function freshDailyStats() {
  return {
    connections: 0, messages: 0, inmails: 0, likes: 0,
    date: todayStr(),
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Alarm-based scheduler (sobrevive al sleep del service worker) ─────────────

async function startAlarm() {
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

async function stopAlarm() {
  await chrome.alarms.clear(ALARM);
}

async function startHeartbeat() {
  // Sincroniza estado al dashboard cada 30 segundos, aunque el motor esté pausado
  await chrome.alarms.create(HEARTBEAT, { periodInMinutes: 0.5 });
}

// ── Polling: contar leads pendientes desde el backend ─────────────────────────

async function pollCountLeads() {
  try {
    const res  = await fetch(`${BACKEND}/api/count-leads/pending`);
    const data = await res.json();
    if (!data.pending || !data.url) return;

    const searchUrl = data.url;

    // Buscar o abrir tab de LinkedIn
    const liTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
    let tab = liTabs[0] ?? null;
    let createdTab = false;

    if (tab) {
      await chrome.tabs.update(tab.id, { url: searchUrl });
    } else {
      tab = await chrome.tabs.create({ url: searchUrl, active: false });
      createdTab = true;
    }

    // Esperar carga
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 10000);
    });

    // Inyectar content script
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 2500));

    // Leer conteo
    let count = null;
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { action: 'count_search_results' });
      count = r?.count ?? null;
    } catch (_) {}

    // Reportar al backend
    await fetch(`${BACKEND}/api/count-leads/result`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: searchUrl, count }),
    });

    // Cerrar tab si la creamos nosotros
    if (createdTab && tab) {
      setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 500);
    }
  } catch (_) {}
}

// ── Sync mensajes entrantes de LinkedIn al backend ────────────────────────────

async function syncLinkedInMessages() {
  // Solo ejecutar si hay una pestaña de LinkedIn abierta
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  const msgTab = tabs.find((t) => t.url && (t.url.includes('/messaging/') || t.url.includes('/in/')));
  if (!msgTab) return;

  try {
    const response = await chrome.tabs.sendMessage(msgTab.id, { action: 'extract_inbox' });
    if (!response?.success || !response.data?.length) return;

    const messages = response.data;
    // Enviar al backend para guardar y mostrar en Smart Inbox
    await fetch(`${BACKEND}/api/messages/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        tab_url: msgTab.url,
      }),
    });
  } catch (_) {
    // content.js no inyectado en esa pestaña — ignorar
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM)     { await tick(); return; }
  if (alarm.name === HEARTBEAT) {
    await broadcastStatus();
    await syncLinkedInMessages();
    return;
  }
  if (alarm.name === COUNT_POLL) {
    await pollCountLeads();
    return;
  }
});

// ── Tick: se ejecuta cada minuto ──────────────────────────────────────────────

async function tick() {
  const state = await getState();

  // Reset stats si cambió el día
  if (state.dailyStats.date !== todayStr()) {
    await saveState({ dailyStats: freshDailyStats() });
    state.dailyStats = freshDailyStats();
  }

  if (!state.engine.running || state.engine.processing) return;

  // Guardrails de tiempo
  if (!isWithinAllowedTime(state.settings)) {
    console.log('[NexusAI] Fuera del horario permitido — esperando');
    return;
  }

  // ¿Hay tareas en cola?
  if (state.taskQueue.length === 0) return;

  // ¿Es momento de ejecutar la próxima tarea?
  const now = Date.now();
  if (state.engine.nextTaskAt && now < state.engine.nextTaskAt) return;

  // Procesar tarea
  await processNextTask(state);
}

// ── Guardrails ────────────────────────────────────────────────────────────────

function isWithinAllowedTime(settings) {
  const tz   = settings.timezone || 'America/Lima';
  const now  = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const day   = local.getDay(); // 0=Dom, 6=Sáb
  const hour  = local.getHours();

  if (settings.pauseWeekends && (day === 0 || day === 6)) return false;
  if (settings.ultraSafe) {
    if (hour < settings.activeHoursStart || hour >= settings.activeHoursEnd) return false;
  }
  return true;
}

function hasCapacity(type, stats, settings) {
  const limits = {
    send_connection: { key: 'connections', max: settings.maxConnections },
    send_message:    { key: 'messages',    max: settings.maxMessages    },
    send_inmail:     { key: 'inmails',     max: settings.maxInmails     },
    like_post:       { key: 'likes',       max: settings.maxLikes       },
    visit_profile:   { key: null,          max: Infinity                },
    extract_profile: { key: null,          max: Infinity                },
  };
  const rule = limits[type];
  if (!rule || !rule.key) return true;
  return (stats[rule.key] ?? 0) < rule.max;
}

function incrementStat(type, stats) {
  const map = {
    send_connection: 'connections',
    send_message:    'messages',
    send_inmail:     'inmails',
    like_post:       'likes',
  };
  const key = map[type];
  if (key) stats[key] = (stats[key] ?? 0) + 1;
  return stats;
}

// ── Task Queue ────────────────────────────────────────────────────────────────

async function enqueueTask(task) {
  const state = await getState();
  const newTask = {
    id:          `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type:        task.type,        // send_connection | send_message | like_post | visit_profile | extract_profile
    leadData:    task.leadData,    // { name, profileUrl, company, headline }
    payload:     task.payload,     // { note, messageText, etc. }
    campaignId:  task.campaignId,
    attempts:    0,
    createdAt:   Date.now(),
    status:      'pending',
  };
  state.taskQueue.push(newTask);

  // Si el motor no está corriendo y no hay nextTaskAt, arrancar
  if (!state.engine.nextTaskAt) {
    state.engine.nextTaskAt = Date.now() + randomDelay(state.settings);
  }

  await saveState({ taskQueue: state.taskQueue, engine: state.engine });
  broadcastStatus();
  return newTask.id;
}

async function dequeueTask(taskId) {
  const state = await getState();
  state.taskQueue = state.taskQueue.filter((t) => t.id !== taskId);
  await saveState({ taskQueue: state.taskQueue });
}

function randomDelay(settings) {
  const min = (settings.delayMinSec ?? 180) * 1000;
  const max = (settings.delayMaxSec ?? 480) * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Process task ──────────────────────────────────────────────────────────────

async function processNextTask(state) {
  const task = state.taskQueue[0];
  if (!task) return;

  // Verificar límites diarios
  if (!hasCapacity(task.type, state.dailyStats, state.settings)) {
    console.log(`[NexusAI] Límite diario alcanzado para: ${task.type}`);
    await saveState({
      engine: { ...state.engine, running: false, processing: false },
    });
    broadcastStatus();
    notify('NexusAI — Límite alcanzado', `Límite diario de ${task.type} alcanzado. El motor se pausó.`);
    return;
  }

  // Marcar como procesando
  await saveState({ engine: { ...state.engine, processing: true, currentTask: task } });
  broadcastStatus();

  console.log(`[NexusAI] Procesando: ${task.type} → ${task.leadData?.name}`);

  let success = false;
  try {
    success = await executeTask(task, state);
  } catch (err) {
    console.error('[NexusAI] Error ejecutando tarea:', err);
  }

  // Actualizar stats y cola
  if (success) {
    state.dailyStats = incrementStat(task.type, state.dailyStats);
    await dequeueTask(task.id);
    console.log(`[NexusAI] ✅ Completado: ${task.type} → ${task.leadData?.name}`);

    // Notificar al backend
    await logActivityToBackend(task, state.linkedinAccount);
  } else {
    // Reintentar hasta 3 veces, luego descartar
    if ((task.attempts ?? 0) >= 2) {
      await dequeueTask(task.id);
      console.log(`[NexusAI] ❌ Descartado después de 3 intentos: ${task.id}`);
    } else {
      const updated = state.taskQueue.map((t) =>
        t.id === task.id ? { ...t, attempts: (t.attempts ?? 0) + 1 } : t
      );
      await saveState({ taskQueue: updated });
    }
  }

  // Calcular próximo delay
  const nextDelay = randomDelay(state.settings);
  const nextAt    = Date.now() + nextDelay;
  const nextState = await getState();

  await saveState({
    dailyStats: state.dailyStats,
    engine: {
      ...nextState.engine,
      processing: false,
      currentTask: null,
      nextTaskAt: nextState.taskQueue.length > 0 ? nextAt : null,
    },
  });

  console.log(`[NexusAI] Próxima acción en ${Math.round(nextDelay / 60000)}m ${Math.round((nextDelay % 60000) / 1000)}s`);
  broadcastStatus();
}

// ── Execute task: inyecta content.js en la pestaña de LinkedIn ────────────────

async function executeTask(task, state) {
  // Encontrar pestaña LinkedIn abierta
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });

  let tab = tabs.find((t) => t.url && t.url.includes('linkedin.com'));

  if (!tab && task.leadData?.profileUrl) {
    // Abrir la URL en una nueva pestaña si es necesario
    tab = await chrome.tabs.create({ url: task.leadData.profileUrl, active: false });
    await sleep(3000); // esperar carga inicial
  }

  if (!tab) {
    console.warn('[NexusAI] No hay pestaña LinkedIn disponible');
    return false;
  }

  // Navegar al perfil si la tarea lo requiere
  if (task.leadData?.profileUrl && !tab.url.includes(task.leadData.profileUrl)) {
    await chrome.tabs.update(tab.id, { url: task.leadData.profileUrl });
    await sleep(4000);
  }

  // Enviar mensaje al content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action:  task.type,
      payload: task.payload ?? {},
      lead:    task.leadData,
    });
    return response?.success === true;
  } catch (err) {
    // content.js no está inyectado aún, inyectarlo manualmente
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files:  ['content.js'],
      });
      await sleep(1000);
      const response = await chrome.tabs.sendMessage(tab.id, {
        action:  task.type,
        payload: task.payload ?? {},
        lead:    task.leadData,
      });
      return response?.success === true;
    } catch (e) {
      console.error('[NexusAI] No se pudo inyectar content.js:', e);
      return false;
    }
  }
}

// ── Backend sync ──────────────────────────────────────────────────────────────

async function logActivityToBackend(task, account) {
  try {
    await fetch(`${BACKEND}/api/activity`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action_type:  task.type,
        lead_name:    task.leadData?.name,
        lead_url:     task.leadData?.profileUrl,
        campaign_id:  task.campaignId,
        li_account:   account?.profileName,
      }),
    });
  } catch (_) {
    // Backend no disponible — continuar sin log
  }
}

async function extractAndSendProfile(tabId) {
  try {
    // content.js es event-driven — usar sendMessage en vez de executeScript+return
    const profile = await chrome.tabs.sendMessage(tabId, { action: 'extract_profile' })
      .then((r) => r?.success ? r.data : null)
      .catch(() => null);
    if (!profile?.name) return null;

    const res = await fetch(`${BACKEND}/api/generate-message`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        lead_profile: `Nombre: ${profile.name}\nTitular: ${profile.headline}\nEmpresa: ${profile.company}\nURL: ${profile.url}`,
      }),
    });
    const data = await res.json();
    return { profile, message: data.message };
  } catch (err) {
    return null;
  }
}

// ── Cookie li_at ──────────────────────────────────────────────────────────────

async function extractLinkedInCookie() {
  try {
    const cookie = await chrome.cookies.get({
      url:  'https://www.linkedin.com',
      name: 'li_at',
    });
    return cookie?.value ?? null;
  } catch (_) {
    return null;
  }
}

async function connectLinkedIn() {
  const cookie = await extractLinkedInCookie();
  if (!cookie) return { success: false, error: 'Cookie li_at no encontrada. Asegúrate de estar logueado en LinkedIn.' };

  // Obtener nombre del perfil desde la pestaña activa
  const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
  let profileName = null;
  if (tabs.length > 0) {
    try {
      const res = await chrome.tabs.sendMessage(tabs[0].id, { action: 'extract_profile' });
      profileName = res?.success ? (res.data?.name ?? null) : null;
    } catch (_) {}
  }

  const account = { connected: true, cookie, profileName: profileName ?? 'Cuenta LinkedIn' };
  await saveState({ linkedinAccount: account });
  broadcastStatus();
  return { success: true, account };
}

// ── Engine controls ───────────────────────────────────────────────────────────

async function startEngine() {
  const state = await getState();
  if (!state.linkedinAccount.connected) {
    return { success: false, error: 'Conecta tu cuenta de LinkedIn primero.' };
  }
  state.engine.running = true;
  if (!state.engine.nextTaskAt && state.taskQueue.length > 0) {
    state.engine.nextTaskAt = Date.now() + randomDelay(state.settings);
  }
  await saveState({ engine: state.engine });
  await startAlarm();
  broadcastStatus();
  notify('NexusAI — Ghost Engine activo', `${state.taskQueue.length} tareas en cola.`);
  return { success: true };
}

async function stopEngine() {
  const state = await getState();
  state.engine.running    = false;
  state.engine.processing = false;
  await saveState({ engine: state.engine });
  await stopAlarm();
  broadcastStatus();
  return { success: true };
}

async function clearQueue() {
  await saveState({ taskQueue: [] });
  broadcastStatus();
}

// ── Broadcast estado al popup ─────────────────────────────────────────────────

async function broadcastStatus() {
  const state = await getState();

  // Notificar al popup (puede estar cerrado)
  try { chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state }); } catch (_) {}

  // Sincronizar estado con el backend para que el dashboard lo muestre en tiempo real
  const queueByType = state.taskQueue.reduce((acc, t) => {
    acc[t.type] = (acc[t.type] ?? 0) + 1;
    return acc;
  }, {});

  // Sync al backend — await para que el SW no se duerma antes de completar
  try {
    await fetch(`${BACKEND}/api/engine/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engine:          state.engine,
        taskQueue:       state.taskQueue,
        byType:          queueByType,
        dailyStats: {
          send_connection: state.dailyStats.connections ?? 0,
          send_message:    state.dailyStats.messages    ?? 0,
          visit_profile:   state.dailyStats.visits      ?? 0,
          like_post:       state.dailyStats.likes       ?? 0,
        },
        linkedinAccount: state.linkedinAccount,
      }),
    });
  } catch (_) {} // backend puede no estar disponible
}

// ── Notifications ─────────────────────────────────────────────────────────────

function notify(title, message) {
  chrome.notifications.create({
    type:    'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  });
}

// ── Util ──────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Message handler (desde popup y content.js) ────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      case 'GET_STATUS': {
        const state = await getState();
        sendResponse({ state });
        break;
      }

      case 'START_ENGINE': {
        const result = await startEngine();
        sendResponse(result);
        break;
      }

      case 'STOP_ENGINE': {
        const result = await stopEngine();
        sendResponse(result);
        break;
      }

      case 'CONNECT_LINKEDIN': {
        const result = await connectLinkedIn();
        sendResponse(result);
        break;
      }

      case 'DISCONNECT_LINKEDIN': {
        await saveState({ linkedinAccount: { connected: false, cookie: null, profileName: null } });
        await stopEngine();
        sendResponse({ success: true });
        break;
      }

      case 'ENQUEUE_TASK': {
        const taskId = await enqueueTask(msg.task);
        sendResponse({ success: true, taskId });
        break;
      }

      case 'REMOVE_TASK': {
        await dequeueTask(msg.taskId);
        broadcastStatus();
        sendResponse({ success: true });
        break;
      }

      case 'CLEAR_QUEUE': {
        await clearQueue();
        sendResponse({ success: true });
        break;
      }

      case 'SAVE_SETTINGS': {
        await saveState({ settings: msg.settings });
        broadcastStatus();
        sendResponse({ success: true });
        break;
      }

      case 'COUNT_SEARCH_LEADS': {
        // Abre la URL de búsqueda en una tab de LinkedIn y lee el conteo del DOM
        const { url: searchUrl } = msg;
        if (!searchUrl) { sendResponse({ success: false, count: null }); break; }

        let tab = null;
        let createdTab = false;
        try {
          // Buscar tab de LinkedIn existente para no crear una nueva visible
          const liTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
          if (liTabs.length > 0) {
            tab = liTabs[0];
            await chrome.tabs.update(tab.id, { url: searchUrl });
          } else {
            tab = await chrome.tabs.create({ url: searchUrl, active: false });
            createdTab = true;
          }

          // Esperar a que cargue la página
          await new Promise((resolve) => {
            const listener = (tabId, info) => {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(resolve, 8000); // timeout máximo
          });

          // Inyectar content script si no está cargado
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files:  ['content.js'],
            });
          } catch (_) { /* ya inyectado */ }

          await new Promise((r) => setTimeout(r, 2000)); // esperar render

          const response = await chrome.tabs.sendMessage(tab.id, { action: 'count_search_results' });
          sendResponse({ success: true, count: response?.count ?? null });
        } catch (err) {
          sendResponse({ success: false, count: null, error: err.message });
        } finally {
          if (createdTab && tab) {
            setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 1000);
          }
        }
        break;
      }

      case 'EXTRACT_PROFILE_URL': {
        // Extrae perfil desde una URL — usa la pestaña activa de LinkedIn si coincide,
        // o navega silenciosamente. NUNCA usa Playwright (riesgo de ban).
        const { url: profileUrl } = msg;
        if (!profileUrl) { sendResponse({ success: false, error: 'Sin URL' }); break; }

        // Buscar pestaña LinkedIn ya abierta con esa URL
        const allTabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
        let targetTab = allTabs.find((t) => t.url && t.url.includes(profileUrl.split('?')[0]));

        if (!targetTab && allTabs.length > 0) {
          // Navegar una pestaña existente de LinkedIn a la URL del perfil
          targetTab = allTabs[0];
          await chrome.tabs.update(targetTab.id, { url: profileUrl });
          await new Promise((r) => setTimeout(r, 4000)); // esperar carga
        }

        if (!targetTab) {
          // Como último recurso, extraer nombre del slug sin abrir LinkedIn
          sendResponse({ success: false, error: 'Abre LinkedIn en una pestaña primero' });
          break;
        }

        try {
          const r = await chrome.tabs.sendMessage(targetTab.id, { action: 'extract_profile' });
          if (r?.success && r.data?.name) {
            sendResponse({ success: true, data: r.data });
          } else {
            sendResponse({ success: false, error: 'No se pudo extraer el perfil' });
          }
        } catch {
          sendResponse({ success: false, error: 'Error de comunicación con la pestaña' });
        }
        break;
      }

      case 'EXTRACT_AND_GENERATE': {
        // Extraer perfil + guardar en CRM + generar mensaje con Claude
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) { sendResponse({ success: false, error: 'Sin pestaña activa' }); break; }
        const result = await extractAndSendProfile(tabs[0].id);
        if (result?.profile) {
          // Guardar lead en CRM via backend
          fetch(`${BACKEND}/api/leads`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name:    result.profile.name,
              headline:     result.profile.headline ?? '',
              company:      result.profile.company ?? '',
              linkedin_url: result.profile.url ?? tabs[0].url,
              status:       'nuevo',
              value:        0,
            }),
          }).catch(() => {});
          // Registrar actividad
          logActivityToBackend({ type: 'lead_created', leadData: { name: result.profile.name, profileUrl: result.profile.url } }, null);
        }
        sendResponse(result ? { success: true, ...result } : { success: false, error: 'No se pudo extraer perfil. Abre un perfil de LinkedIn primero.' });
        break;
      }

      case 'SEND_GENERATED_MESSAGE': {
        // Enviar el mensaje directamente en el chat de LinkedIn abierto
        const { message } = msg;
        if (!message) { sendResponse({ success: false, error: 'Sin mensaje' }); break; }
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) { sendResponse({ success: false, error: 'Sin pestaña activa' }); break; }
        try {
          const r = await chrome.tabs.sendMessage(tabs[0].id, {
            action:  'send_message',
            payload: { messageText: message },
          });
          if (r?.success) {
            // Registrar en activity log
            logActivityToBackend({ type: 'message_sent', leadData: { name: 'Perfil activo', profileUrl: tabs[0].url } }, null);
          }
          sendResponse(r ?? { success: false, error: 'Sin respuesta del content script' });
        } catch (err) {
          sendResponse({ success: false, error: 'No se pudo enviar — asegúrate de estar en un chat de LinkedIn abierto' });
        }
        break;
      }

      default:
        sendResponse({ success: false, error: `Acción desconocida: ${msg.type}` });
    }
  })();
  return true; // mantener canal abierto para async
});

// ── Instalación / startup ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[NexusAI] Extensión instalada v2.0');
  await chrome.storage.local.set({
    settings:        { ...DEFAULT_SETTINGS },
    taskQueue:       [],
    dailyStats:      freshDailyStats(),
    engine:          { running: false, processing: false, nextTaskAt: null, currentTask: null },
    linkedinAccount: { connected: false, cookie: null, profileName: null },
  });
  await startHeartbeat();
  await chrome.alarms.create(COUNT_POLL, { periodInMinutes: 0.1 }); // cada ~6s
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await startHeartbeat();
  await chrome.alarms.create(COUNT_POLL, { periodInMinutes: 0.1 }); // cada ~6s
  if (state.engine.running) {
    await startAlarm();
    console.log('[NexusAI] Motor reanudado al iniciar Chrome');
  }
  await broadcastStatus(); // sync inmediato al arrancar
});
