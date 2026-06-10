// ============================================================
// NEXUSAI — POPUP CONTROLLER v3.0 (Supabase direct)
// ============================================================

const $ = (id) => document.getElementById(id);

// ── Elementos ─────────────────────────────────────────────────────────────────

const loginPanel     = $('login-panel');
const mainUI         = $('main-ui');
const loginEmail     = $('login-email');
const loginPassword  = $('login-password');
const btnLogin       = $('btn-login');
const loginError     = $('login-error');
const btnLogout      = $('btn-logout');
const userEmailLabel = $('user-email-label');

const engineDot    = $('engine-dot');
const engineLabel  = $('engine-label');
const btnStart     = $('btn-start');
const btnStop      = $('btn-stop');
const btnExtract   = $('btn-extract-msg');
const extractText  = $('extract-text');
const msgResult    = $('msg-result');
const msgActions   = $('msg-actions');
const btnApproveSend = $('btn-approve-send');
const btnEditMsg   = $('btn-edit-msg');
const btnCopyMsg   = $('btn-copy-msg');
const msgEditor    = $('msg-editor');
const msgEditArea  = $('msg-edit-area');
const btnSendEdited = $('btn-send-edited');
const btnCancelEdit = $('btn-cancel-edit');
const sendStatus   = $('send-status');
const nextTaskInfo = $('next-task-info');

const statQueue       = $('stat-queue');
const statConnections = $('stat-connections');
const statMessages    = $('stat-messages');
const statLikes       = $('stat-likes');

const queueList     = $('queue-list');
const btnClearQueue = $('btn-clear-queue');

const slConn   = $('sl-conn');
const slMsg    = $('sl-msg');
const slInmail = $('sl-inmail');
const slLikes  = $('sl-likes');
const slDmin   = $('sl-dmin');
const slDmax   = $('sl-dmax');
const togUltra   = $('tog-ultra');
const togWeekend = $('tog-weekend');
const btnSaveSettings = $('btn-save-settings');
const savedBadge      = $('saved-badge');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec > 0 ? sec + 's' : ''}`.trim() : `${sec}s`;
}

function fmtMs(ms) {
  return fmtSeconds(Math.round(ms / 1000));
}

function sendMsg(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
  });
}

// ── Tab navigation ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Auth: show/hide panels ────────────────────────────────────────────────────

function showLogin() {
  loginPanel.style.display = 'block';
  mainUI.style.display     = 'none';
}

function showMain(email) {
  loginPanel.style.display = 'none';
  mainUI.style.display     = 'block';
  if (email && userEmailLabel) userEmailLabel.textContent = email;
}

// ── Login ─────────────────────────────────────────────────────────────────────

btnLogin.addEventListener('click', async () => {
  const email    = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return;

  btnLogin.disabled     = true;
  btnLogin.textContent  = 'Entrando…';
  loginError.style.display = 'none';

  const r = await sendMsg({ type: 'LOGIN', email, password });

  btnLogin.disabled    = false;
  btnLogin.textContent = 'Entrar';

  if (r?.ok) {
    showMain(email);
    await refreshStatus();
    await loadSettingsUI();
  } else {
    loginError.textContent    = r?.error ?? 'Error de autenticación';
    loginError.style.display  = 'block';
  }
});

// Allow Enter key on password field
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

// ── Logout ────────────────────────────────────────────────────────────────────

btnLogout.addEventListener('click', async () => {
  await sendMsg({ type: 'LOGOUT' });
  showLogin();
});

// ── Render state ──────────────────────────────────────────────────────────────
// background.js GET_STATUS returns: { connected, running, processing, stats, nextTaskAt, queueCount }

function renderState(state) {
  if (!state) return;

  // Engine status bar
  engineDot.className = 'engine-dot';
  if (state.processing) {
    engineDot.classList.add('processing');
    engineLabel.innerHTML = 'Motor <span>ejecutando acción…</span>';
  } else if (state.running) {
    engineDot.classList.add('running');
    engineLabel.innerHTML = 'Ghost Engine <span>activo</span>';
  } else {
    engineLabel.innerHTML = 'Motor <span>detenido</span>';
  }

  // Stats
  if (statQueue)       statQueue.textContent       = state.queueCount       ?? 0;
  if (statConnections) statConnections.textContent = state.stats?.connections ?? 0;
  if (statMessages)    statMessages.textContent    = state.stats?.messages    ?? 0;
  if (statLikes)       statLikes.textContent       = state.stats?.likes       ?? 0;

  // Countdown
  if (state.nextTaskAt && state.running) {
    const diff = state.nextTaskAt - Date.now();
    if (diff > 0) {
      nextTaskInfo.innerHTML = `Próxima acción en: <span>${fmtMs(diff)}</span>`;
    } else {
      nextTaskInfo.innerHTML = `Próxima acción: <span>procesando…</span>`;
    }
  } else if (!state.running) {
    nextTaskInfo.innerHTML = `Motor pausado`;
  } else {
    nextTaskInfo.innerHTML = `Sin tareas en cola`;
  }

  // Limits bars
  const limitsRows = $('limits-rows');
  if (limitsRows) {
    const cfg = state.settings ?? {};
    const items = [
      { label: 'Conexiones', val: state.stats?.connections ?? 0, max: cfg.maxConnections ?? 20 },
      { label: 'Mensajes',   val: state.stats?.messages    ?? 0, max: cfg.maxMessages    ?? 30 },
      { label: 'Likes',      val: state.stats?.likes       ?? 0, max: cfg.maxLikes       ?? 20 },
    ];
    limitsRows.innerHTML = items.map(({ label, val, max }) => {
      const pct   = Math.min(100, Math.round((val / max) * 100));
      const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#6366f1';
      return `
        <div class="limits-row">
          <span class="label">${label}</span>
          <div class="limits-bar-wrap">
            <div class="limits-bar" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="limits-val">${val}/${max}</span>
        </div>`;
    }).join('');
  }

  // Tarea actual
  const currentTaskEl = document.getElementById('current-task');
  if (currentTaskEl) {
    if (state.currentTask) {
      const taskLabels = {
        connect:                 '🔗 Enviando conexión...',
        message:                 '💬 Enviando mensaje...',
        check_connection:        '🔍 Verificando conexión...',
        view_profile:            '👁 Visitando perfil...',
        start_campaign_scraping: '⚙️ Extrayendo leads...',
      };
      const elapsed = state.currentTask.elapsed ?? 0;
      currentTaskEl.innerHTML = `
        <div style="background:#EEF2FF;border-radius:8px;padding:8px 10px;margin-top:8px;">
          <div style="font-size:11px;font-weight:600;color:#4F46E5;">
            ${taskLabels[state.currentTask.type] ?? state.currentTask.type}
          </div>
          <div style="font-size:10px;color:#6B7280;margin-top:2px;">
            ${elapsed}s transcurridos
          </div>
        </div>
      `;
    } else {
      currentTaskEl.innerHTML = '';
    }
  }

  // Última acción
  const lastActionEl = document.getElementById('last-action');
  if (lastActionEl && state.lastAction) {
    const la = state.lastAction;
    const timeAgo = Math.round((Date.now() - la.timestamp) / 1000);
    const successIcon = la.success ? '✅' : '❌';
    const actionLabel = ({
      connect:          'Conexión',
      message:          'Mensaje',
      check_connection: 'Verificación',
    })[la.action] ?? la.action;
    lastActionEl.innerHTML = `
      <div style="font-size:10px;color:#6B7280;margin-top:6px;">
        ${successIcon} Última: ${actionLabel} • hace ${timeAgo}s
      </div>
    `;
  }

  // Botón reset si motor atascado
  const btnReset = document.getElementById('btn-reset-engine');
  if (btnReset) {
    const isStuck = state.currentTask && state.currentTask.elapsed > 60;
    btnReset.style.display = isStuck ? 'block' : 'none';
    btnReset.onclick = () => {
      chrome.runtime.sendMessage({ type: 'RESET_PROCESSING' });
      btnReset.style.display = 'none';
    };
  }

  // Start/stop buttons
  if (state.running) {
    btnStart.style.display = 'none';
    btnStop.style.display  = 'flex';
  } else {
    btnStart.style.display = 'flex';
    btnStop.style.display  = 'none';
  }

  // Queue tab — show count; actual task list not available from GET_STATUS
  if (queueList && state.queueCount === 0) {
    queueList.innerHTML = `<div class="queue-empty">Sin tareas en cola<br><span style="font-size:10px;">Añade leads desde el dashboard NexusAI</span></div>`;
    btnClearQueue.style.display = 'none';
  } else if (queueList && state.queueCount > 0) {
    queueList.innerHTML = `<div class="queue-empty" style="color:#a5b4fc;">${state.queueCount} tarea${state.queueCount > 1 ? 's' : ''} pendiente${state.queueCount > 1 ? 's' : ''}</div>`;
    btnClearQueue.style.display = 'none';
  }
}

// ── Refresh status ────────────────────────────────────────────────────────────

async function refreshStatus() {
  const r = await sendMsg({ type: 'GET_STATUS' });
  if (!r) return;

  if (!r.connected) {
    showLogin();
    return;
  }

  // Show stored email if available
  const { supabase_user_id } = await chrome.storage.local.get('supabase_user_id');
  showMain('');

  renderState(r);
  lastState = r;
}

// ── Countdown cada segundo ────────────────────────────────────────────────────

let lastState = null;
setInterval(() => {
  if (!lastState?.running || !lastState?.nextTaskAt) return;
  const diff = lastState.nextTaskAt - Date.now();
  if (diff > 0) {
    nextTaskInfo.innerHTML = `Próxima acción en: <span>${fmtMs(diff)}</span>`;
  } else {
    nextTaskInfo.innerHTML = `Próxima acción: <span>procesando…</span>`;
  }
}, 1000);

// ── Engine controls ───────────────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  const r = await sendMsg({ type: 'START_ENGINE' });
  btnStart.disabled = false;
  if (!r?.ok) {
    alert(r?.error ?? 'Error al iniciar el motor');
  } else {
    await refreshStatus();
  }
});

btnStop.addEventListener('click', async () => {
  await sendMsg({ type: 'STOP_ENGINE' });
  await refreshStatus();
});

// ── Generar mensaje IA ────────────────────────────────────────────────────────

let generatedMessage = '';

function showSendStatus(text, color = '#22c55e') {
  sendStatus.textContent   = text;
  sendStatus.style.color   = color;
  sendStatus.style.display = 'block';
  setTimeout(() => { sendStatus.style.display = 'none'; }, 3500);
}

function resetMsgUI() {
  msgResult.style.display  = 'none';
  msgActions.style.display = 'none';
  msgEditor.style.display  = 'none';
  sendStatus.style.display = 'none';
}

btnExtract.addEventListener('click', async () => {
  resetMsgUI();
  btnExtract.disabled   = true;
  extractText.innerHTML = '<div class="spinner"></div> Extrayendo y guardando…';

  const r = await sendMsg({ type: 'EXTRACT_AND_GENERATE' });

  btnExtract.disabled     = false;
  extractText.textContent = 'Guardar lead y generar mensaje IA';

  if (r?.ok && r.message) {
    generatedMessage         = r.message;
    msgResult.className      = 'msg-box';
    msgResult.textContent    = r.message;
    msgResult.style.display  = 'block';
    msgActions.style.display = 'flex';
    if (r.profile?.name) showSendStatus(`Lead "${r.profile.name}" guardado en CRM`, '#22c55e');
  } else {
    msgResult.className      = 'msg-box error';
    msgResult.textContent    = r?.error ?? 'Error al generar mensaje';
    msgResult.style.display  = 'block';
  }
});

btnApproveSend.addEventListener('click', async () => {
  if (!generatedMessage) return;
  btnApproveSend.disabled    = true;
  btnApproveSend.textContent = 'Enviando…';
  const r = await sendMsg({ type: 'SEND_GENERATED_MESSAGE', message: generatedMessage });
  btnApproveSend.disabled    = false;
  btnApproveSend.textContent = 'Aprobar y enviar';
  if (r?.success) {
    showSendStatus('Mensaje enviado en LinkedIn', '#22c55e');
    resetMsgUI();
  } else {
    showSendStatus(r?.error ?? 'No se pudo enviar — abre el perfil en LinkedIn primero', '#f87171');
  }
});

btnEditMsg.addEventListener('click', () => {
  msgEditArea.value       = generatedMessage;
  msgEditor.style.display = 'block';
  msgEditArea.focus();
});

btnSendEdited.addEventListener('click', async () => {
  const editedText = msgEditArea.value.trim();
  if (!editedText) return;
  btnSendEdited.disabled    = true;
  btnSendEdited.textContent = 'Enviando…';
  const r = await sendMsg({ type: 'SEND_GENERATED_MESSAGE', message: editedText });
  btnSendEdited.disabled    = false;
  btnSendEdited.textContent = 'Enviar editado';
  if (r?.success) {
    generatedMessage         = editedText;
    msgResult.textContent    = editedText;
    msgEditor.style.display  = 'none';
    showSendStatus('Mensaje editado enviado', '#22c55e');
    resetMsgUI();
  } else {
    showSendStatus(r?.error ?? 'No se pudo enviar', '#f87171');
  }
});

btnCancelEdit.addEventListener('click', () => { msgEditor.style.display = 'none'; });

btnCopyMsg.addEventListener('click', () => {
  navigator.clipboard.writeText(generatedMessage).then(() => {
    btnCopyMsg.textContent = 'Copiado!';
    setTimeout(() => { btnCopyMsg.textContent = 'Solo copiar'; }, 2000);
  });
});

// ── loadSettingsUI ────────────────────────────────────────────────────────────
// Reads chrome.storage.local 'settings' and populates all slider/toggle controls.
// Called on init and after login so the UI always reflects persisted values.

async function loadSettingsUI() {
  try {
    const { settings } = await new Promise((resolve) => {
      chrome.storage.local.get('settings', resolve);
    });

    if (!settings) return;

    if (slConn   && settings.maxConnections !== undefined) {
      slConn.value = settings.maxConnections;
      const el = $('val-conn');   if (el) el.textContent = settings.maxConnections;
    }
    if (slMsg    && settings.maxMessages !== undefined) {
      slMsg.value = settings.maxMessages;
      const el = $('val-msg');    if (el) el.textContent = settings.maxMessages;
    }
    if (slInmail && settings.maxInmails !== undefined) {
      slInmail.value = settings.maxInmails;
      const el = $('val-inmail'); if (el) el.textContent = settings.maxInmails;
    }
    if (slLikes  && settings.maxLikes !== undefined) {
      slLikes.value = settings.maxLikes;
      const el = $('val-likes');  if (el) el.textContent = settings.maxLikes;
    }
    if (slDmin   && settings.delayMinSec !== undefined) {
      slDmin.value = settings.delayMinSec;
      const el = $('val-dmin');   if (el) el.textContent = fmtSeconds(settings.delayMinSec);
    }
    if (slDmax   && settings.delayMaxSec !== undefined) {
      slDmax.value = settings.delayMaxSec;
      const el = $('val-dmax');   if (el) el.textContent = fmtSeconds(settings.delayMaxSec);
    }

    if (togUltra   && settings.ultraSafe    !== undefined) togUltra.checked   = settings.ultraSafe;
    if (togWeekend && settings.pauseWeekends !== undefined) togWeekend.checked = settings.pauseWeekends;

  } catch (err) {
    console.warn('[NexusAI Popup] Error loading settings UI:', err);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

[
  [slConn,   'val-conn',   (v) => v],
  [slMsg,    'val-msg',    (v) => v],
  [slInmail, 'val-inmail', (v) => v],
  [slLikes,  'val-likes',  (v) => v],
  [slDmin,   'val-dmin',   (v) => fmtSeconds(+v)],
  [slDmax,   'val-dmax',   (v) => fmtSeconds(+v)],
].forEach(([el, labelId, fmt]) => {
  if (el) el.addEventListener('input', () => { $(labelId).textContent = fmt(el.value); });
});

btnSaveSettings.addEventListener('click', async () => {
  const settings = {
    maxConnections:   +(slConn?.value   ?? 20),
    maxMessages:      +(slMsg?.value    ?? 30),
    maxInmails:       +(slInmail?.value ?? 10),
    maxLikes:         +(slLikes?.value  ?? 20),
    delayMinSec:      +(slDmin?.value   ?? 180),
    delayMaxSec:      +(slDmax?.value   ?? 480),
    ultraSafe:        togUltra?.checked  ?? true,
    pauseWeekends:    togWeekend?.checked ?? true,
    activeHoursStart: 8,
    activeHoursEnd:   20,
    timezone:         'America/Lima',
  };
  await sendMsg({ type: 'SAVE_SETTINGS', settings });
  savedBadge.style.display = 'block';
  setTimeout(() => { savedBadge.style.display = 'none'; }, 2500);
});

// ── Escuchar actualizaciones en tiempo real del background ────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    lastState = msg.state;
    renderState(msg.state);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  showLogin();
  await refreshStatus();
  await loadSettingsUI();
})();
