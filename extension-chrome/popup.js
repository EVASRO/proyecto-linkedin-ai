// ============================================================
// NEXUSAI — POPUP CONTROLLER
// ============================================================

// ── Elementos del DOM ─────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

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

const liStatusBox    = $('li-status-box');
const liAvatar       = $('li-avatar');
const liName         = $('li-name');
const liSub          = $('li-sub');
const liBadge        = $('li-badge');
const btnConnectLi   = $('btn-connect-li');
const btnDisconnectLi= $('btn-disconnect-li');
const liError        = $('li-error');

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

// ── Tab navigation ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

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
    chrome.runtime.sendMessage(msg, (resp) => {
      resolve(resp);
    });
  });
}

const TASK_META = {
  send_connection: { emoji: '🤝', label: 'Enviar conexión',  bg: '#1e3a5f' },
  send_message:    { emoji: '💬', label: 'Enviar mensaje',    bg: '#1e1b4b' },
  like_post:       { emoji: '❤️', label: 'Like post',         bg: '#4a1942' },
  visit_profile:   { emoji: '👁️', label: 'Visitar perfil',   bg: '#1a2e1a' },
  extract_profile: { emoji: '⚡', label: 'Extraer perfil',    bg: '#2d1b4a' },
  send_inmail:     { emoji: '📧', label: 'Enviar InMail',     bg: '#1a2a4a' },
};

// ── Render state ──────────────────────────────────────────────────────────────

function renderState(state) {
  if (!state) return;
  const { engine, dailyStats, taskQueue, settings, linkedinAccount } = state;

  // Engine status bar
  engineDot.className = 'engine-dot';
  if (engine.processing) {
    engineDot.classList.add('processing');
    engineLabel.innerHTML = 'Motor <span>ejecutando acción…</span>';
  } else if (engine.running) {
    engineDot.classList.add('running');
    engineLabel.innerHTML = 'Ghost Engine <span>activo</span>';
  } else {
    engineLabel.innerHTML = 'Motor <span>detenido</span>';
  }

  // Stats
  statQueue.textContent       = taskQueue?.length ?? 0;
  statConnections.textContent = dailyStats?.connections ?? 0;
  statMessages.textContent    = dailyStats?.messages    ?? 0;
  statLikes.textContent       = dailyStats?.likes       ?? 0;

  // Next task countdown
  if (engine.nextTaskAt && engine.running) {
    const diff = engine.nextTaskAt - Date.now();
    if (diff > 0) {
      nextTaskInfo.innerHTML = `Próxima acción en: <span>${fmtMs(diff)}</span>`;
    } else {
      nextTaskInfo.innerHTML = `Próxima acción: <span>procesando…</span>`;
    }
  } else if (!engine.running) {
    nextTaskInfo.innerHTML = `Motor pausado`;
  } else {
    nextTaskInfo.innerHTML = `Sin tareas en cola`;
  }

  // Limits progress bars
  const limitsRows = $('limits-rows');
  if (settings) {
    const items = [
      { label: 'Conexiones', val: dailyStats?.connections ?? 0, max: settings.maxConnections },
      { label: 'Mensajes',   val: dailyStats?.messages    ?? 0, max: settings.maxMessages    },
      { label: 'InMails',    val: dailyStats?.inmails     ?? 0, max: settings.maxInmails     },
      { label: 'Likes',      val: dailyStats?.likes       ?? 0, max: settings.maxLikes       },
    ];
    limitsRows.innerHTML = items.map(({ label, val, max }) => {
      const pct = Math.min(100, Math.round((val / max) * 100));
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

  // Start/stop buttons
  if (engine.running) {
    btnStart.style.display = 'none';
    btnStop.style.display  = 'flex';
  } else {
    btnStart.style.display = 'flex';
    btnStop.style.display  = 'none';
  }

  // Queue tab
  renderQueue(taskQueue ?? []);

  // LinkedIn tab
  renderLinkedIn(linkedinAccount);

  // Settings tab
  if (settings) {
    slConn.value   = settings.maxConnections ?? 30;
    slMsg.value    = settings.maxMessages    ?? 50;
    slInmail.value = settings.maxInmails     ?? 10;
    slLikes.value  = settings.maxLikes       ?? 30;
    slDmin.value   = settings.delayMinSec    ?? 180;
    slDmax.value   = settings.delayMaxSec    ?? 480;
    togUltra.checked   = settings.ultraSafe    ?? true;
    togWeekend.checked = settings.pauseWeekends ?? true;

    $('val-conn').textContent   = settings.maxConnections ?? 30;
    $('val-msg').textContent    = settings.maxMessages    ?? 50;
    $('val-inmail').textContent = settings.maxInmails     ?? 10;
    $('val-likes').textContent  = settings.maxLikes       ?? 30;
    $('val-dmin').textContent   = fmtSeconds(settings.delayMinSec ?? 180);
    $('val-dmax').textContent   = fmtSeconds(settings.delayMaxSec ?? 480);
  }
}

function renderQueue(queue) {
  if (!queue || queue.length === 0) {
    queueList.innerHTML = `<div class="queue-empty">Sin tareas en cola<br><span style="font-size:10px;">Añade leads desde el dashboard NexusAI</span></div>`;
    btnClearQueue.style.display = 'none';
    return;
  }

  btnClearQueue.style.display = 'block';
  queueList.innerHTML = queue.slice(0, 15).map((task) => {
    const meta = TASK_META[task.type] ?? { emoji: '📌', label: task.type, bg: '#1e293b' };
    const name = task.leadData?.name ?? 'Lead desconocido';
    const company = task.leadData?.company ? ` · ${task.leadData.company}` : '';
    return `
      <div class="task-item">
        <div class="task-icon" style="background:${meta.bg};">${meta.emoji}</div>
        <div class="task-meta">
          <div class="name">${name}${company}</div>
          <div class="type">${meta.label}${task.attempts > 0 ? ` · intento ${task.attempts + 1}` : ''}</div>
        </div>
        <button class="btn-remove" data-id="${task.id}" title="Eliminar tarea">×</button>
      </div>`;
  }).join('');

  if (queue.length > 15) {
    queueList.innerHTML += `<div style="text-align:center;font-size:10px;color:#475569;padding:6px;">+${queue.length - 15} tareas más</div>`;
  }

  // Remove buttons
  queueList.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await sendMsg({ type: 'REMOVE_TASK', taskId: btn.dataset.id });
    });
  });
}

function renderLinkedIn(account) {
  if (account?.connected) {
    liStatusBox.className = 'li-status connected';
    const initials = (account.profileName || 'LI').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
    liAvatar.textContent    = initials;
    liName.textContent      = account.profileName || 'Cuenta LinkedIn';
    liSub.textContent       = 'Cookie li_at activa · Extensión sincronizada';
    liBadge.textContent     = 'ON';
    liBadge.className       = 'li-badge ok';
    btnConnectLi.style.display    = 'none';
    btnDisconnectLi.style.display = 'flex';
    liError.style.display = 'none';
  } else {
    liStatusBox.className = 'li-status disconnected';
    liAvatar.textContent      = '?';
    liName.textContent        = 'Sin conectar';
    liSub.textContent         = 'Conecta tu cuenta LinkedIn';
    liBadge.textContent       = 'OFF';
    liBadge.className         = 'li-badge off';
    btnConnectLi.style.display    = 'flex';
    btnDisconnectLi.style.display = 'none';
  }
}

// ── Live countdown actualizado cada segundo ───────────────────────────────────

let lastState = null;
setInterval(async () => {
  if (!lastState?.engine?.running || !lastState?.engine?.nextTaskAt) return;
  const diff = lastState.engine.nextTaskAt - Date.now();
  if (diff > 0) {
    nextTaskInfo.innerHTML = `Próxima acción en: <span>${fmtMs(diff)}</span>`;
  } else {
    nextTaskInfo.innerHTML = `Próxima acción: <span>procesando…</span>`;
  }
}, 1000);

// ── Event listeners ───────────────────────────────────────────────────────────

// Start engine
btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  const r = await sendMsg({ type: 'START_ENGINE' });
  btnStart.disabled = false;
  if (!r?.success) {
    alert(r?.error ?? 'Error al iniciar el motor');
  }
});

// Stop engine
btnStop.addEventListener('click', async () => {
  await sendMsg({ type: 'STOP_ENGINE' });
});

// Estado interno del mensaje generado
let generatedProfile = null;
let generatedMessage = '';

function showSendStatus(text, color = '#22c55e') {
  sendStatus.textContent     = text;
  sendStatus.style.color     = color;
  sendStatus.style.display   = 'block';
  setTimeout(() => { sendStatus.style.display = 'none'; }, 3500);
}

function resetMsgUI() {
  msgResult.style.display  = 'none';
  msgActions.style.display = 'none';
  msgEditor.style.display  = 'none';
  sendStatus.style.display = 'none';
}

// Guardar lead y generar mensaje IA
btnExtract.addEventListener('click', async () => {
  resetMsgUI();
  btnExtract.disabled   = true;
  extractText.innerHTML = '<div class="spinner"></div> Extrayendo y guardando…';

  const r = await sendMsg({ type: 'EXTRACT_AND_GENERATE' });

  btnExtract.disabled     = false;
  extractText.textContent = '💾 Guardar lead y generar mensaje IA';

  if (r?.success && r.message) {
    generatedMessage         = r.message;
    generatedProfile         = r.profile;
    msgResult.className      = 'msg-box';
    msgResult.textContent    = r.message;
    msgResult.style.display  = 'block';
    msgActions.style.display = 'flex';

    // Si guardó el lead en CRM → feedback
    if (r.profile?.name) {
      showSendStatus(`✅ Lead "${r.profile.name}" guardado en CRM`, '#22c55e');
    }
  } else {
    msgResult.className      = 'msg-box error';
    msgResult.textContent    = r?.error ?? 'Error al generar mensaje. ¿Está activo el backend?';
    msgResult.style.display  = 'block';
  }
});

// Aprobar y enviar directamente en LinkedIn
btnApproveSend.addEventListener('click', async () => {
  if (!generatedMessage) return;
  btnApproveSend.disabled     = true;
  btnApproveSend.textContent  = '📤 Enviando…';
  const r = await sendMsg({ type: 'SEND_GENERATED_MESSAGE', message: generatedMessage });
  btnApproveSend.disabled     = false;
  btnApproveSend.innerHTML    = '✅ Aprobar y enviar';
  if (r?.success) {
    showSendStatus('✅ Mensaje enviado en LinkedIn', '#22c55e');
    resetMsgUI();
  } else {
    showSendStatus(r?.error ?? '❌ No se pudo enviar — abre el perfil en LinkedIn primero', '#f87171');
  }
});

// Abrir editor
btnEditMsg.addEventListener('click', () => {
  msgEditArea.value        = generatedMessage;
  msgEditor.style.display  = 'block';
  msgEditArea.focus();
});

// Enviar mensaje editado
btnSendEdited.addEventListener('click', async () => {
  const editedText = msgEditArea.value.trim();
  if (!editedText) return;
  btnSendEdited.disabled     = true;
  btnSendEdited.textContent  = 'Enviando…';
  const r = await sendMsg({ type: 'SEND_GENERATED_MESSAGE', message: editedText });
  btnSendEdited.disabled     = false;
  btnSendEdited.textContent  = '📤 Enviar editado';
  if (r?.success) {
    generatedMessage         = editedText;
    msgResult.textContent    = editedText;
    msgEditor.style.display  = 'none';
    showSendStatus('✅ Mensaje editado enviado', '#22c55e');
    resetMsgUI();
  } else {
    showSendStatus(r?.error ?? '❌ No se pudo enviar', '#f87171');
  }
});

// Cancelar edición
btnCancelEdit.addEventListener('click', () => {
  msgEditor.style.display = 'none';
});

// Solo copiar
btnCopyMsg.addEventListener('click', () => {
  navigator.clipboard.writeText(generatedMessage).then(() => {
    btnCopyMsg.textContent = '✓ ¡Copiado!';
    setTimeout(() => { btnCopyMsg.textContent = '📋 Solo copiar'; }, 2000);
  });
});

// Connect LinkedIn
btnConnectLi.addEventListener('click', async () => {
  btnConnectLi.disabled    = true;
  btnConnectLi.textContent = 'Conectando…';
  liError.style.display    = 'none';

  const r = await sendMsg({ type: 'CONNECT_LINKEDIN' });
  btnConnectLi.disabled    = false;
  btnConnectLi.textContent = '🔗 Conectar LinkedIn (cookie automática)';

  if (!r?.success) {
    liError.textContent    = r?.error ?? 'No se pudo conectar. Abre LinkedIn primero.';
    liError.style.display  = 'block';
  }
});

// Disconnect
btnDisconnectLi.addEventListener('click', async () => {
  if (!confirm('¿Desconectar la cuenta de LinkedIn? El motor se pausará.')) return;
  await sendMsg({ type: 'DISCONNECT_LINKEDIN' });
});

// Clear queue
btnClearQueue.addEventListener('click', async () => {
  if (!confirm('¿Vaciar toda la cola de tareas?')) return;
  await sendMsg({ type: 'CLEAR_QUEUE' });
});

// Sliders — actualizar labels en tiempo real
[
  [slConn,   'val-conn',   (v) => v],
  [slMsg,    'val-msg',    (v) => v],
  [slInmail, 'val-inmail', (v) => v],
  [slLikes,  'val-likes',  (v) => v],
  [slDmin,   'val-dmin',   (v) => fmtSeconds(+v)],
  [slDmax,   'val-dmax',   (v) => fmtSeconds(+v)],
].forEach(([el, labelId, fmt]) => {
  el.addEventListener('input', () => {
    $(labelId).textContent = fmt(el.value);
  });
});

// Save settings
btnSaveSettings.addEventListener('click', async () => {
  const settings = {
    maxConnections:   +slConn.value,
    maxMessages:      +slMsg.value,
    maxInmails:       +slInmail.value,
    maxLikes:         +slLikes.value,
    delayMinSec:      +slDmin.value,
    delayMaxSec:      +slDmax.value,
    ultraSafe:        togUltra.checked,
    pauseWeekends:    togWeekend.checked,
    activeHoursStart: 8,
    activeHoursEnd:   20,
    timezone:         'America/Lima',
  };
  await sendMsg({ type: 'SAVE_SETTINGS', settings });
  savedBadge.style.display = 'block';
  setTimeout(() => { savedBadge.style.display = 'none'; }, 2500);
});

// ── Escuchar actualizaciones del background ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    lastState = msg.state;
    renderState(msg.state);
  }
  if (msg.type === 'PROFILE_LOADED') {
    // Perfil detectado — badge en tab LinkedIn (opcional)
  }
});

// ── Cargar estado inicial al abrir el popup ───────────────────────────────────

(async () => {
  const r = await sendMsg({ type: 'GET_STATUS' });
  if (r?.state) {
    lastState = r.state;
    renderState(r.state);
  }
})();
