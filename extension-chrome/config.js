// ── Dashboard URL (para webhook autopilot) ────────────────────────────────────
const DASHBOARD_URL = 'https://proyecto-linkedin-ai.vercel.app';

// ── Supabase config — mismas keys que .env.local ─────────────────────────────
const SUPABASE_URL      = 'https://qamqcygybwrlbsylkxyo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_b38hB4jcgLsmNmu8oobz_g_MkzyacQb';

// ── Circuit breaker: evita spamear Supabase cuando está caído ────────────────
// Si hay ≥3 fallos de red en los últimos 60s, omite nuevos intentos por 30s
const _cbState = { failures: 0, lastFailAt: 0, openUntil: 0 };
function _cbRecord() {
  _cbState.failures++;
  _cbState.lastFailAt = Date.now();
  if (_cbState.failures >= 3) {
    _cbState.openUntil = Date.now() + 30000; // abrir circuito 30s
    console.warn('[cazary.ai] Circuit breaker ABIERTO — Supabase no disponible, pausa 30s');
  }
}
function _cbReset() { _cbState.failures = 0; _cbState.openUntil = 0; }
function _cbIsOpen() {
  if (_cbState.openUntil > Date.now()) return true;
  // Auto-reset después de la ventana
  if (_cbState.openUntil && _cbState.openUntil <= Date.now()) _cbReset();
  return false;
}

// ── Helper: fetch autenticado a Supabase REST API ─────────────────────────────
async function supabaseFetch(path, opts = {}) {
  // Circuit breaker: no intentar si Supabase está caído
  if (_cbIsOpen()) return null;

  const method = opts.method ?? 'GET';
  const prefer = opts.prefer ?? 'return=representation';
  const url    = `${SUPABASE_URL}/rest/v1/${path}`;

  const buildHeaders = (token) => ({
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        prefer,
    ...(opts.headers ?? {}),
  });

  const MAX_RETRIES = 2;  // reducido de 3 a 2 para menos noise en consola
  let lastError = null;
  let token = await getStoredToken();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { method, headers: buildHeaders(token), body: opts.body ?? undefined });
      const ct = res.headers.get('content-type') ?? '';
      if (res.status === 204 || !ct.includes('json')) return null;

      // ── 401: JWT expirado → intentar refresh y reintentar una vez ────────────
      if (res.status === 401) {
        console.warn('[cazary.ai] supabaseFetch 401 JWT expired → refreshing token...');
        const refreshed = await supabaseRefreshToken();
        if (refreshed) {
          const { supabase_token: newToken } = await chrome.storage.local.get('supabase_token');
          token = newToken;
          // retry inmediato con nuevo token
          const retryRes = await fetch(url, { method, headers: buildHeaders(token), body: opts.body ?? undefined });
          if (retryRes.ok) return retryRes.json();
          if (retryRes.status === 204) return null;
        }
        // refresh falló → limpiar sesión y notificar
        console.warn('[cazary.ai] supabaseFetch refresh fallido → sesión limpiada, requiere re-login');
        await chrome.storage.local.remove([
          'supabase_token', 'supabase_refresh_token',
          'supabase_token_expires_at', 'supabase_workspace_id',
        ]);
        // notificar al popup si está abierto
        chrome.runtime.sendMessage({ type: 'SESSION_EXPIRED' }).catch(() => {});
        return null;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error(`[cazary.ai] supabaseFetch ERROR ${res.status}`, path.split('?')[0], JSON.stringify(errBody));
        return null;
      }
      _cbReset(); // éxito → resetear circuit breaker
      return res.json();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 1500;
        console.warn(`[cazary.ai] supabaseFetch retry ${attempt}/${MAX_RETRIES} (${path.split('?')[0]}) en ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  _cbRecord(); // registrar fallo en el circuit breaker
  console.error('[cazary.ai] supabaseFetch NETWORK ERROR', path.split('?')[0], lastError?.message);
  return null;
}

// ── Autenticar con email/password en Supabase Auth ────────────────────────────
async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey':       SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.access_token) {
    await chrome.storage.local.set({
      supabase_token:            data.access_token,
      supabase_refresh_token:    data.refresh_token,
      supabase_user_id:          data.user?.id,
      supabase_workspace_id:     null,
      supabase_token_expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    });
    return data;
  }
  throw new Error(data.error_description ?? data.msg ?? 'Login failed');
}

// ── Refrescar token expirado ──────────────────────────────────────────────────
async function supabaseRefreshToken() {
  const { supabase_refresh_token } = await chrome.storage.local.get('supabase_refresh_token');
  if (!supabase_refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: supabase_refresh_token }),
    });
    const data = await res.json();
    if (data.access_token) {
      await chrome.storage.local.set({
        supabase_token:            data.access_token,
        supabase_refresh_token:    data.refresh_token ?? supabase_refresh_token,
        supabase_token_expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      });
      return true;
    }
  } catch (_) {}
  return false;
}

// ── Getters de storage ────────────────────────────────────────────────────────
async function getStoredToken() {
  const { supabase_token, supabase_token_expires_at } = await chrome.storage.local.get([
    'supabase_token', 'supabase_token_expires_at'
  ]);

  // Refrescar si: (a) el token ya expiró o está a menos de 5min de expirar,
  // o (b) existe token pero no hay timestamp (sesión antigua sin expiración guardada)
  const shouldRefresh = supabase_token && (
    !supabase_token_expires_at ||
    Date.now() > supabase_token_expires_at - 5 * 60 * 1000
  );

  if (shouldRefresh) {
    const refreshed = await supabaseRefreshToken();
    if (refreshed) {
      const { supabase_token: newToken } = await chrome.storage.local.get('supabase_token');
      return newToken ?? null;
    }
  }

  return supabase_token ?? null;
}

async function getWorkspaceId() {
  const { supabase_workspace_id, supabase_user_id } = await chrome.storage.local.get([
    'supabase_workspace_id', 'supabase_user_id',
  ]);

  if (supabase_workspace_id) return supabase_workspace_id;
  if (!supabase_user_id) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await supabaseFetch(
        `profiles?id=eq.${supabase_user_id}&select=workspace_id`
      );
      const wsId = data?.[0]?.workspace_id;
      if (wsId) {
        await chrome.storage.local.set({ supabase_workspace_id: wsId });
        return wsId;
      }
      if (Array.isArray(data) && data.length === 0) return null;
    } catch (err) {
      if (attempt === 0) {
        const refreshed = await supabaseRefreshToken();
        if (!refreshed) return null;
      }
    }
  }
  return null;
}
