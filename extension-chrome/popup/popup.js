// cazary.ai — Popup Controller v4.0
// Communicates with background.js via chrome.runtime.sendMessage

'use strict';

// -- Helpers -----------------------------------------------------------------

const $ = (id) => document.getElementById(id);

function sendMsg(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(resp);
      });
    } catch {
      resolve(null);
    }
  });
}

function fmtSeconds(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec > 0 ? ' ' + sec + 's' : ''}` : `${sec}s`;
}

function fmtMs(ms) {
  return fmtSeconds(Math.round(ms / 1000));
}

// -- Elements ----------------------------------------------------------------

const loginPanel      = $('login-panel');
const mainUI          = $('main-ui');
const loginEmail      = $('login-email');
const loginPassword   = $('login-password');
const btnLogin        = $('btn-login');
const loginError      = $('login-error');
const btnLogout       = $('btn-logout');

const indicator       = $('indicator');
const engineStatusTxt = $('engine-status-text');
const engineSub       = $('engine-sub');
const nextActionTxt   = $('next-action-text');

const statConnections = $('stat-connections');
const statMessages    = $('stat-messages');
const statQueue       = $('stat-queue');
const statErrors      = $('stat-errors');

const limitsRows      = $('limits-rows');
const currentTaskBanner = $('current-task-banner');

const btnDashboard    = $('btn-dashboard');
const btnToggle       = $('btn-toggle');
const toggleLabel     = $('toggle-label');
const toggleIcon      = $('toggle-icon');

const extVersion      = $('ext-version');
const footerVersion   = $('footer-version');

// -- State -------------------------------------------------------------------

let lastState = null;
let engineRunning = false;

// -- Logo fallback -----------------------------------------------------------
// Try navy logo first; if not found fall back to icon128
const logoImg = $('logo-img');
if (logoImg) {
  logoImg.onerror = () => {
    logoImg.src = '../icons/icon128.png';
    logoImg.style.width = '32px';
    logoImg.style.borderRadius = '8px';
  };
}

// -- Version -----------------------------------------------------------------

try {
  const manifest = chrome.runtime.getManifest();
  if (manifest?.version) {
    const v = `v${manifest.version}`;
    if (extVersion)    extVersion.textContent    = v;
    if (footerVersion) footerVersion.textContent = `Ghost Engine ${v}`;
  }
} catch {}

// -- Auth: show / hide -------------------------------------------------------

function showLogin() {
  loginPanel.style.display = 'block';
  mainUI.style.display     = 'none';
  if (btnLogout) btnLogout.classList.add('hidden');
}

function showMain() {
  loginPanel.style.display = 'none';
  mainUI.style.display     = 'block';
  if (btnLogout) btnLogout.classList.remove('hidden');
}

// -- Render engine state -----------------------------------------------------

const TASK_LABELS = {
  connect:                 'Enviando conexión…',
  message:                 'Enviando mensaje…',
  check_connection:        'Verificando conexión…',
  view_profile:            'Visitando perfil…',
  start_campaign_scraping: 'Extrayendo leads…',
  check_inbox:             'Revisando inbox…',
};

function renderState(state) {
  if (!state) return;

  engineRunning = Boolean(state.running);

  // -- Indicator dot --
  indicator.className = 'indicator';
  if (state.processing) {
    indicator.classList.add('processing');
    engineStatusTxt.textContent = 'Ejecutando acción…';
  } else if (state.running) {
    indicator.classList.add('active');
    engineStatusTxt.textContent = 'Motor activo';
  } else if (state.error) {
    indicator.classList.add('error');
    engineStatusTxt.textContent = 'Error del motor';
  } else {
    indicator.classList.add('paused');
    engineStatusTxt.textContent = 'Motor pausado';
  }

  // -- Sub label (last sync) --
  const lastSync = state.lastSync ?? state.lastAction?.timestamp;
  if (lastSync) {
    const ago = Math.round((Date.now() - lastSync) / 1000);
    engineSub.textContent = ago < 60
      ? `Última sync hace ${ago}s`
      : `Última sync hace ${Math.round(ago / 60)}min`;
  } else {
    engineSub.textContent = state.running ? 'En ejecución' : 'Sin sincronizaciones recientes';
  }

  // -- Next action countdown --
  if (state.nextTaskAt && state.running) {
    const diff = state.nextTaskAt - Date.now();
    nextActionTxt.classList.remove('hidden');
    nextActionTxt.textContent = diff > 0 ? `en ${fmtMs(diff)}` : 'procesando…';
  } else {
    nextActionTxt.classList.add('hidden');
  }

  // -- Stats --
  const s = state.stats ?? {};
  if (statConnections) statConnections.textContent = s.connections ?? 0;
  if (statMessages)    statMessages.textContent    = s.messages    ?? 0;
  if (statQueue)       statQueue.textContent       = state.queueCount ?? 0;

  const errCount = s.errors ?? 0;
  if (statErrors) {
    statErrors.textContent = errCount;
    statErrors.classList.toggle('error-val', errCount > 0);
  }

  // -- Daily limits bars --
  if (limitsRows) {
    const cfg = state.settings ?? {};
    const items = [
      { name: 'Conexiones', val: s.connections ?? 0, max: cfg.maxConnections ?? 20 },
      { name: 'Mensajes',   val: s.messages    ?? 0, max: cfg.maxMessages    ?? 30 },
      { name: 'Likes',      val: s.likes       ?? 0, max: cfg.maxLikes       ?? 20 },
    ];
    limitsRows.innerHTML = items.map(({ name, val, max }) => {
      const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
      const cls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      return `
        <div class="limit-row">
          <span class="limit-name">${name}</span>
          <div class="limit-bar-wrap">
            <div class="limit-bar ${cls}" style="width:${pct}%"></div>
          </div>
          <span class="limit-count">${val}/${max}</span>
        </div>`;
    }).join('');
  }

  // -- Current task banner --
  if (currentTaskBanner) {
    if (state.currentTask) {
      const label = TASK_LABELS[state.currentTask.type] ?? state.currentTask.type;
      const elapsed = state.currentTask.elapsed ?? 0;
      currentTaskBanner.textContent = `${label} · ${elapsed}s`;
      currentTaskBanner.classList.add('visible');
    } else {
      currentTaskBanner.classList.remove('visible');
    }
  }

  // -- Toggle button state --
  updateToggleButton(state.running);
}

function updateToggleButton(running) {
  if (!btnToggle || !toggleLabel || !toggleIcon) return;

  btnToggle.classList.remove('pausing', 'paused-state');

  // Pause icon (two bars)
  const pauseIcon = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
  // Play icon (triangle)
  const playIcon  = `<polygon points="5,3 19,12 5,21"/>`;

  if (running) {
    toggleLabel.textContent  = 'Pausar motor';
    toggleIcon.innerHTML     = pauseIcon;
    btnToggle.classList.add('pausing');
  } else {
    toggleLabel.textContent  = 'Reanudar motor';
    toggleIcon.innerHTML     = playIcon;
    btnToggle.classList.add('paused-state');
  }
}

// -- Refresh status ----------------------------------------------------------

async function refreshStatus() {
  const r = await sendMsg({ type: 'GET_STATUS' });
  if (!r) return;

  if (!r.connected) {
    showLogin();
    return;
  }

  showMain();
  renderState(r);
  lastState = r;
}

// -- Countdown ticker --------------------------------------------------------

setInterval(() => {
  if (!lastState?.running || !lastState?.nextTaskAt) return;
  const diff = lastState.nextTaskAt - Date.now();
  if (nextActionTxt) {
    nextActionTxt.classList.remove('hidden');
    nextActionTxt.textContent = diff > 0 ? `en ${fmtMs(diff)}` : 'procesando…';
  }
}, 1000);

// -- Login -------------------------------------------------------------------

btnLogin.addEventListener('click', async () => {
  const email    = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return;

  btnLogin.disabled = true;
  btnLogin.innerHTML = '<div class="spinner"></div>';
  loginError.style.display = 'none';

  const r = await sendMsg({ type: 'LOGIN', email, password });

  btnLogin.disabled     = false;
  btnLogin.textContent  = 'Entrar';

  if (r?.ok) {
    showMain();
    await refreshStatus();
  } else {
    loginError.textContent   = r?.error ?? 'Error de autenticación';
    loginError.style.display = 'block';
  }
});

loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

// -- Logout ------------------------------------------------------------------

btnLogout.addEventListener('click', async () => {
  await sendMsg({ type: 'LOGOUT' });
  showLogin();
});

// -- Open Dashboard ----------------------------------------------------------

btnDashboard.addEventListener('click', () => {
  // Read the dashboard URL from storage (set by background.js) or fall back to config
  chrome.storage.local.get(['dashboard_url', 'DASHBOARD_URL'], (data) => {
    const url = data.dashboard_url ?? data.DASHBOARD_URL ?? 'https://app.cazary.ai/dashboard';
    chrome.tabs.create({ url });
    window.close();
  });
});

// -- Toggle engine (pause / resume) — optimistic UI -------------------------

btnToggle.addEventListener('click', async () => {
  btnToggle.disabled = true;

  // Optimistic: flip UI immediately
  const willRun = !engineRunning;
  updateToggleButton(willRun);
  engineRunning = willRun;

  const r = await sendMsg({ type: 'toggle_engine' });

  btnToggle.disabled = false;

  if (r?.ok === false || r?.error) {
    // Revert on failure
    engineRunning = !willRun;
    updateToggleButton(engineRunning);
  }

  // Refresh real state from background
  await refreshStatus();
});

// -- Listen for real-time updates from background ----------------------------

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE' && msg.state) {
    lastState = msg.state;
    renderState(msg.state);
  }
});

// -- Init --------------------------------------------------------------------

(async () => {
  showLogin();
  await refreshStatus();
})();
