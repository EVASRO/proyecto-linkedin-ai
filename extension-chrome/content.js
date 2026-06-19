// ============================================================
// NEXUSAI — CONTENT SCRIPT
// Extractor de perfiles LinkedIn/SalesNav + ejecutor de acciones
// ============================================================

(function () {
  'use strict';

  // ── Evitar doble inyección ────────────────────────────────────────────────
  if (window.__nexusai_loaded__) return;
  window.__nexusai_loaded__ = true;

  // ── Wrappers seguros para APIs de extensión ───────────────────────────────
  // Evitan crash por "Extension context invalidated" tras reload/update

  // safeSendMessage con retry: si el service worker está dormido, lo despierta
  // y reintenta hasta 4 veces con backoff exponencial.
  async function safeSendMessage(msg) {
    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await chrome.runtime.sendMessage(msg);
        return; // éxito
      } catch (err) {
        const isLast = attempt === MAX_RETRIES - 1;
        if (isLast) {
          // Último intento fallido — loguear y salir
          console.warn(`[cazary.ai] safeSendMessage: no se pudo entregar mensaje ${msg.type} tras ${MAX_RETRIES} intentos:`, err?.message);
          return;
        }
        // Esperar antes de reintentar (100ms, 300ms, 700ms)
        await new Promise(r => setTimeout(r, 100 * Math.pow(3, attempt)));
      }
    }
  }

  // fetchWithTimeout: fetch con AbortController para evitar colgarse indefinidamente
  function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  async function safeStorageSet(data) {
    try {
      await chrome.storage.local.set(data);
    } catch (_) {
      // Extension context invalidated — ignorar
    }
  }

  // ── Selector Healing System ───────────────────────────────────────────────
  // Auto-detección y reporte de selectores CSS rotos + carga de overrides IA

  const SELECTOR_OVERRIDES = new Map(); // key: 'platform:action:selectorKey' → selector

  async function loadSelectorOverrides(wsId) {
    try {
      const resp = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ action: 'get_selector_overrides', wsId }, (r) => {
            resolve(r ?? null);
          });
        } catch (_) { resolve(null); }
      });
      if (Array.isArray(resp)) {
        for (const row of resp) {
          const key = `${row.platform}:${row.action}:${row.selector_key}`;
          SELECTOR_OVERRIDES.set(key, row.selector_value);
        }
        console.log(`[cazary.ai][SelectorHealing] ${resp.length} overrides cargados`);
      }
    } catch (_) {
      // No bloquear el engine si Supabase no responde
    }
  }

  function getSelector(platform, action, selectorKey, defaultValue) {
    const key = `${platform}:${action}:${selectorKey}`;
    const override = SELECTOR_OVERRIDES.get(key);
    if (override && override.trim()) return override;
    return defaultValue;
  }

  function reportSelectorFailure(platform, action, selectorKey, selectorTried, htmlContext) {
    try {
      chrome.runtime.sendMessage({
        action:        'report_selector_failure',
        platform,
        selectorAction: action,
        selectorKey,
        selectorTried,
        htmlContext:   (htmlContext ?? '').substring(0, 5000),
        pageUrl:       window.location.pathname,
      }).catch(() => {});
    } catch (_) {
      // fire-and-forget — nunca bloquear el engine
    }
  }

  // ── Utilidades DOM ────────────────────────────────────────────────────────

  function getText(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        const t  = el && (el.innerText || el.textContent || '').trim();
        if (t) return t;
      } catch (_) {}
    }
    return null;
  }

  function getAll(selector) {
    try { return Array.from(document.querySelectorAll(selector)); }
    catch (_) { return []; }
  }

  // ─── Utilidades de humanización ──────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, Math.max(0, ms)));
  }

  function sleepGaussian(mean, stdDev, min = 300) {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const ms = Math.round(mean + z * stdDev);
    return sleep(Math.max(min, ms));
  }

  function sleepMicro() { return sleepGaussian(120, 40, 50); }
  function sleepHuman() { return sleepGaussian(1800, 600, 800); }
  function sleepNav()   { return sleepGaussian(3500, 900, 1500); }

  async function simulateCursorMove(targetEl) {
    if (!targetEl) return;
    const rect   = targetEl.getBoundingClientRect();
    const destX  = rect.left + rect.width  * (0.3 + Math.random() * 0.4);
    const destY  = rect.top  + rect.height * (0.3 + Math.random() * 0.4);
    const startX = destX + (Math.random() - 0.5) * 300;
    const startY = destY + (Math.random() - 0.5) * 200;
    const steps  = 3 + Math.floor(Math.random() * 3);

    for (let i = 1; i <= steps; i++) {
      const t    = i / steps;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = startX + (destX - startX) * ease + (Math.random() - 0.5) * 8;
      const y = startY + (destY - startY) * ease + (Math.random() - 0.5) * 8;
      document.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, cancelable: true,
        clientX: Math.round(x), clientY: Math.round(y),
      }));
      await sleep(30 + Math.random() * 40);
    }
  }

  async function typeHuman(el, text, clear = true) {
    if (!el || !text) return;
    el.focus();
    await sleepMicro();

    if (clear) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await sleepMicro();
    }

    for (const char of text) {
      const delay = sleepGaussian(270, 80, 60);
      el.value += char;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
      el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: char }));
      el.dispatchEvent(new KeyboardEvent('keyup',    { bubbles: true, key: char }));
      if (Math.random() < 0.08) await sleepGaussian(600, 200, 300);
      await delay;
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function typeHumanContenteditable(el, text) {
    if (!el || !text) return;
    el.focus();
    await sleepMicro();

    el.innerHTML = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleepMicro();

    for (const char of text) {
      const sel   = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;

      if (range) {
        range.deleteContents();
        range.insertNode(document.createTextNode(char));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        document.execCommand('insertText', false, char);
      }

      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, data: char, inputType: 'insertText',
      }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));

      if (Math.random() < 0.08) await sleepGaussian(500, 180, 250);
      await sleepGaussian(260, 75, 60);
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function scrollHuman(targetY, duration = 1200) {
    const startY = window.scrollY;
    const dist   = targetY - startY;
    if (Math.abs(dist) < 10) return;
    const steps  = Math.max(8, Math.round(duration / 60));
    const stepMs = duration / steps;

    for (let i = 1; i <= steps; i++) {
      const t    = i / steps;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      window.scrollTo(0, Math.round(startY + dist * ease));
      await sleep(stepMs * (0.7 + Math.random() * 0.6));
    }
  }

  // ─── Fin utilidades de humanización ──────────────────────────────────────────

  function personalizeMessage(template, lead) {
    if (!template || !lead) return template || '';

    const fullName  = (lead.full_name || lead.name || '').trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = lead.first_name || nameParts[0] || '';
    const lastName  = lead.last_name  || nameParts.slice(1).join(' ') || '';

    const vars = {
      '{{nombre}}':          firstName,
      '{{apellido}}':        lastName,
      '{{nombre_completo}}': fullName,
      '{{empresa}}':         lead.company   || '',
      '{{cargo}}':           lead.job_title || '',
      '{{ubicacion}}':       lead.location  || '',
      '{{first_name}}':      firstName,
      '{{last_name}}':       lastName,
      '{{full_name}}':       fullName,
      '{{company}}':         lead.company   || '',
      '{{job_title}}':       lead.job_title || '',
      '{{location}}':        lead.location  || '',
      '{nombre}':            firstName,
      '{empresa}':           lead.company   || '',
      '{cargo}':             lead.job_title || '',
    };

    let result = template;
    for (const [variable, value] of Object.entries(vars)) {
      result = result.replaceAll(variable, value);
    }
    result = result.replace(/\{\{[^}]+\}\}/g, '').replace(/\{[^}]+\}/g, '');
    console.log(`[cazary.ai] personalizeMessage: "${template.slice(0, 40)}..." → "${result.slice(0, 40)}..."`);
    return result.trim();
  }

  function simulateClick(el) {
    if (!el) return false;
    simulateCursorMove(el).catch(() => {});
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width  / 2;
    const y = rect.top  + rect.height / 2;

    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y,
      screenX: x + window.screenX, screenY: y + window.screenY,
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
    };

    el.dispatchEvent(new PointerEvent('pointerover',  opts));
    el.dispatchEvent(new PointerEvent('pointerenter', opts));
    el.dispatchEvent(new MouseEvent('mouseover',      { ...opts }));
    el.dispatchEvent(new MouseEvent('mouseenter',     { ...opts }));
    el.dispatchEvent(new PointerEvent('pointerdown',  opts));
    el.dispatchEvent(new MouseEvent('mousedown',      { ...opts }));
    el.dispatchEvent(new PointerEvent('pointerup',    opts));
    el.dispatchEvent(new MouseEvent('mouseup',        { ...opts }));
    el.dispatchEvent(new MouseEvent('click',          { ...opts }));
    el.click();
    return true;
  }

  function isConnectModalOpen() {
    const dialogs = Array.from(document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], ' +
      '.artdeco-modal, .send-invite, [class*="send-invite"], ' +
      '[class*="connect-modal"], [class*="invitation"]'
    )).filter(el => el.offsetParent);

    return dialogs.some(el => {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      return txt.includes('enviar sin nota')    || txt.includes('send without') ||
             txt.includes('añadir una nota')    || txt.includes('add a note') ||
             txt.includes('conectar con')       || txt.includes('connect with') ||
             txt.includes('invitar a conectar') || txt.includes('invite to connect') ||
             txt.includes('enviar invitación')  || txt.includes('send invitation') ||
             txt.includes('invitar');
    });
  }

  async function forceClick(el) {
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 300));

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top  + rect.height / 2;
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y,
      screenX: x + (window.screenX || 0),
      screenY: y + (window.screenY || 0),
      pointerId: 1, pointerType: 'mouse', isPrimary: true,
    };

    // Intento 1: simulateClick estándar
    simulateClick(el);
    await new Promise(r => setTimeout(r, 500));

    const modalAfter1 = isConnectModalOpen();
    if (modalAfter1) return true;

    // Intento 2: focus + Enter
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    const modalAfter2 = isConnectModalOpen();
    if (modalAfter2) return true;

    // Intento 3: click nativo via el.click() con trusted flag workaround
    el.dispatchEvent(new MouseEvent('click', { ...opts, bubbles: true }));
    el.click();
    await new Promise(r => setTimeout(r, 500));

    return isConnectModalOpen();
  }

  function typeIntoField(el, text) {
    if (!el) return false;
    el.focus();
    el.value = '';
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // ── Detección de plataforma ───────────────────────────────────────────────

  function getPlatform() {
    const url = window.location.href;
    if (url.includes('linkedin.com/sales/')) return 'salesnav';
    if (url.includes('linkedin.com/in/'))    return 'linkedin';
    if (url.includes('linkedin.com/feed'))   return 'linkedin_feed';
    return 'linkedin';
  }

  // Mantener alias legacy para compatibilidad interna
  function isSalesNavigator() {
    return window.location.hostname.includes('linkedin.com') &&
           window.location.pathname.startsWith('/sales');
  }

  // ── Detección de grado de conexión por plataforma ────────────────────────

  function isFirstDegreeConnection() {
    const platform = getPlatform();

    if (platform === 'salesnav') {
      // PASO 1: Selectores específicos del topcard de SalesNav
      // Buscar SOLO en el área del topcard, no en toda la página
      const topcardSelectors = [
        '[data-anonymize="person-degree"]',
        '.profile-topcard-person-entity__degree-distance',
        '.profile-topcard__distance',
        '[class*="degree-distance"]',
        '[class*="topcard"] [class*="degree"]',
      ];

      for (const sel of topcardSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const text = (el.textContent || el.innerText || '').trim();
        if (!text) continue;
        // Solo 1er grado: "1st", "1er", "1°", "1º" — NO .startsWith('1') (falso positivo)
        const is1st = /^\s*[·•]?\s*1\s*(st|er|°|º)\b/i.test(text) ||
                      /\b1\s*(st|er|°|º)\b/i.test(text);
        console.log(`[cazary.ai] SalesNav degree badge "${sel}": "${text}" → is1st=${is1st}`);
        return is1st;
      }

      // PASO 2: Fallback ESTRICTO — buscar SOLO en el topcard hero,
      // NO en toda la página (evita falsos positivos de contactos en común)
      const heroSelectors = [
        '.profile-topcard-person-entity__name',
        '.profile-topcard__person-name',
        '.profile-topcard',
        '[class*="profile-topcard-person-entity"]',
      ];
      let heroEl = null;
      for (const sel of heroSelectors) {
        heroEl = document.querySelector(sel);
        if (heroEl) break;
      }

      if (heroEl) {
        // Buscar dentro del hero SOLAMENTE span/div de máx 6 chars que sean exactamente "1st"/"1er"/"1°"
        const candidates = Array.from(heroEl.querySelectorAll('span, div, abbr'))
          .map(el => (el.textContent || el.innerText || '').trim())
          .filter(t => t.length <= 6);
        const has1st = candidates.some(t => /^1\s*(st|er|°|º)$/i.test(t));
        if (has1st) {
          console.log('[cazary.ai] SalesNav hero fallback: 1st degree confirmed');
          return true;
        }
      }

      // PASO 3: Búsqueda ampliada de texto "1er"/"1st"/"1°" en el topcard completo
      // (cubre casos donde el badge CSS no matchea pero el texto sí está en el DOM)
      const topcardAreaSelectors = [
        '.profile-topcard', '[class*="profile-topcard"]',
        'section[class*="profile"]', '.lead-profile', 'main article',
        '[data-x--lead-header]', '[class*="lead-header"]',
      ];
      let topcardArea = null;
      for (const sel of topcardAreaSelectors) {
        topcardArea = document.querySelector(sel);
        if (topcardArea) break;
      }
      if (topcardArea) {
        // Buscar elementos hoja (pocas hijos) que contengan exactamente "1er"/"1st"/"1°"
        const candidates = Array.from(topcardArea.querySelectorAll('span,abbr,div,p,small'))
          .filter(el => el.children.length <= 2)
          .map(el => (el.textContent || el.innerText || '').trim());
        const has1er = candidates.some(t =>
          /^[·•\s]*1\s*(er|st|°|º)[·•\s]*$/i.test(t) ||  // exactamente "1er", "• 1er", etc.
          /·\s*1\s*(er|st|°|º)/i.test(t)                  // "· 1er" dentro de texto más largo
        );
        if (has1er) {
          console.log('[cazary.ai] SalesNav: topcard text search → "1er" encontrado → 1er grado');
          return true;
        }
      }

      // Sin evidencia clara de 1er grado → asumir NO conectado (fail-safe para 2°/3°)
      console.log('[cazary.ai] SalesNav: sin badge 1er grado → NOT connected (proceder a conectar)');
      return false;
    }

    // LinkedIn estándar (sin cambios)
    const degreeSelectors = [
      '.dist-value',
      '[data-anonymize="person-degree"]',
      '.pv-text-details__connection-info .t-14',
      'span.pv-member-badge__text',
    ];
    for (const sel of degreeSelectors) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const text = (el.innerText || el.textContent || '').trim();
        if (/[·•]\s*1(st|er|\.°|°|º|\s*er\s*grado)/i.test(text)) {
          console.log(`[cazary.ai] LI degree badge: "${text}" → 1st degree`);
          return true;
        }
      }
    }
    console.log('[cazary.ai] LI: no degree badge found → assuming NOT 1st degree');
    return false;
  }

  function isPendingConnection() {
    // Solo buscar en BOTONES de acción, no en spans/texto general
    const actionBtns = Array.from(document.querySelectorAll('button,[role="button"]'))
      .filter(el => el.offsetParent);
    return actionBtns.some(el => {
      const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      return t === 'pendiente'    || t === 'pending'  ||
             t.includes('retirar invitación') || t.includes('withdraw') ||
             label.includes('retirar')        || label.includes('withdraw') ||
             label.includes('pendiente')      || label.includes('pending');
    });
  }

  // ── Shadow DOM helpers ───────────────────────────────────────────────────

  // Busca elementos en todo el DOM incluyendo shadow roots
  function deepQueryAll(selector, root = document) {
    const results = [];
    try {
      results.push(...Array.from(root.querySelectorAll(selector)));
    } catch (_) {}
    const allElements = Array.from(root.querySelectorAll('*'));
    for (const el of allElements) {
      if (el.shadowRoot) {
        results.push(...deepQueryAll(selector, el.shadowRoot));
      }
    }
    return results;
  }

  // Busca UN elemento en todo el DOM incluyendo shadow roots
  function deepQuery(selector, root = document) {
    return deepQueryAll(selector, root)[0] || null;
  }

  // ── Helpers de menú overflow ──────────────────────────────────────────────

  async function clickMoreButton() {
    // PASO 0: Hover sobre el área de acciones — en SalesNav el botón "..." solo
    // aparece cuando hay hover sobre la zona de acciones del contacto
    const actionBarSelectors = [
      '[data-x--lead-actions-bar]',
      '[class*="lead-actions-bar"]',
      '[class*="action-bar"]',
      '.profile-topcard__actions',
    ];
    for (const sel of actionBarSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        break;
      }
    }
    // Hover también en botones visibles cercanos (Guardar / Mensaje)
    const visibleButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const txt   = (btn.innerText || '').toLowerCase().trim();
      return label.includes('guardar') || label.includes('mensaje') ||
             txt === 'guardar' || txt === 'mensaje' || txt === 'guardado';
    });
    if (visibleButtons.length > 0) {
      const last = visibleButtons[visibleButtons.length - 1];
      last.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      last.parentElement?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }
    await sleep(400);

    // PASO 1: Buscar el botón overflow
    let btn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');

    if (!btn) {
      btn = Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(el => {
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          const cls   = (el.className || '').toLowerCase();
          return label.includes('exceso de acciones') ||
                 label.includes('más acciones') ||
                 label.includes('more actions') ||
                 label.includes('overflow') ||
                 cls.includes('overflow-menu--trigger') ||
                 cls.includes('overflow__trigger') ||
                 cls.includes('artdeco-dropdown__trigger') ||
                 (el.getAttribute('aria-haspopup') === 'true' &&
                  el.getAttribute('aria-expanded') !== null &&
                  (el.innerText || el.textContent || '').trim() === '');
        });
    }

    // Segundo intento con hover más agresivo si aún no aparece
    if (!btn) {
      document.body.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, clientX: 400, clientY: 450,
      }));
      await sleep(600);
      btn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]') ||
        Array.from(document.querySelectorAll('button')).find(el =>
          (el.getAttribute('aria-label') || '').toLowerCase().includes('exceso de acciones')
        ) || null;
    }

    // Tercer intento: buscar botón con texto "..." o icono-only en la barra de acciones
    // SalesNav 2025 puede no tener los atributos data/aria esperados
    if (!btn) {
      // Primero: buscar en el área de acciones del topcard
      const actionContainers = [
        '[data-x--lead-actions-bar]', '[class*="lead-actions-bar"]',
        '.profile-topcard__actions', '[class*="profile-topcard__actions"]',
        '[class*="profile-topcard"]', '.artdeco-dropdown',
      ];
      for (const containerSel of actionContainers) {
        const container = document.querySelector(containerSel);
        if (!container) continue;
        // Último botón icono-only visible en el área de acciones
        const iconBtns = Array.from(container.querySelectorAll('button,[role="button"]'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const txt = (el.innerText || el.textContent || '').trim();
            // Botones sin texto, con "...", "•••", o icono SVG solo
            return txt === '' || txt === '...' || txt === '•••' || txt === '…' ||
                   (txt.length <= 3 && el.querySelector('svg'));
          });
        if (iconBtns.length > 0) {
          btn = iconBtns[iconBtns.length - 1]; // el último icono-botón (más a la derecha = "...")
          console.log('[cazary.ai] clickMoreButton: fallback icono-only en', containerSel, '→', btn.className?.slice(0,50));
          break;
        }
      }
    }

    // Cuarto intento: cualquier botón con aria-label que incluya "opciones", "acción", "action"
    if (!btn) {
      btn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('opciones') || label.includes('option') ||
               label.includes('acciones') || label.includes('acción') ||
               label.includes('action') || label.includes('menú') || label.includes('menu');
      }) || null;
      if (btn) console.log('[cazary.ai] clickMoreButton: fallback aria-label acciones →', btn.getAttribute('aria-label'));
    }

    if (!btn) {
      const allBtns = Array.from(document.querySelectorAll('button,[role="button"]'))
        .filter(b => b.offsetParent || b.getBoundingClientRect().width > 0);
      const moreOptSel = getSelector(getPlatform(), 'more_options', 'more_options_btn',
        '[data-x--lead-actions-bar-overflow-menu], button[aria-label*="exceso de acciones"], button[aria-label*="más acciones"], button[aria-label*="more actions"]');
      reportSelectorFailure(getPlatform(), 'more_options', 'more_options_btn', moreOptSel,
        document.querySelector('[data-x--lead-actions-bar], .pvs-profile-actions, .profile-topcard__actions')?.innerHTML
        ?? document.body.innerHTML.substring(0, 3000));
      console.warn('[cazary.ai][SelectorHealing] selector_failure: more_options_btn');
      console.warn('[cazary.ai] clickMoreButton: no encontrado tras hover. Botones disponibles:',
        allBtns.map(b => ({
          label: b.getAttribute('aria-label') || '',
          text:  (b.innerText || b.textContent || '').trim().slice(0, 30),
          cls:   b.className.slice(0, 50),
          data:  b.getAttributeNames().filter(a => a.startsWith('data-')).join(','),
        }))
      );
      return false;
    }

    console.log('[cazary.ai] clickMoreButton: encontrado →',
      btn.getAttribute('aria-label') || btn.className.slice(0, 60));
    const rect = btn.getBoundingClientRect();
    console.log(`[cazary.ai] clickMoreButton: botón en pos (${Math.round(rect.left)}, ${Math.round(rect.top)}) del viewport`);

    btn.scrollIntoView({ block: 'center' });
    await sleep(400);
    btn.focus();
    btn.click();
    await sleep(1500);

    // Verificar que abrió: aria-expanded cambia a "true"
    if (btn.getAttribute('aria-expanded') === 'true') {
      console.log('[cazary.ai] clickMoreButton: dropdown abierto (aria-expanded=true)');
      return true;
    }

    // Verificar por presencia de items en el DOM
    const menuItems = document.querySelectorAll(
      '.eah-menu-content__list-item, .eah-menu-item__action, ' +
      '[role="menuitem"], .artdeco-dropdown__item'
    );
    if (menuItems.length > 0) {
      console.log(`[cazary.ai] clickMoreButton: ${menuItems.length} menu items visibles`);
      return true;
    }

    // Segundo intento si no abrió
    console.warn('[cazary.ai] clickMoreButton: primer click no abrió — reintentando');
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    await sleep(100);
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await sleep(100);
    btn.click();
    await sleep(1500);

    const opened = btn.getAttribute('aria-expanded') === 'true' ||
      document.querySelectorAll('.eah-menu-content__list-item, .eah-menu-item__action').length > 0;

    console.log(`[cazary.ai] clickMoreButton: resultado final opened=${opened}`);
    return opened;
  }

  function getDropdownContainer() {
    // Intento 1: aria-controls del botón overflow específico
    const overflowBtn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');
    if (overflowBtn) {
      const controlsId = overflowBtn.getAttribute('aria-controls');
      if (controlsId) {
        const byId = document.getElementById(controlsId);
        if (byId) {
          const itemCount = byId.querySelectorAll('li, a, button').length;
          console.log(`[cazary.ai] getDropdownContainer: ✅ aria-controls #${controlsId} (${itemCount} items)`);
          return byId;
        }
      }
    }

    // Intento 2: Buscar cualquier menú dropdown visible que acabe de aparecer
    const visibleMenuSelectors = [
      '.eah-dropdown-menu',
      '.eah-menu-content',
      '[role="menu"]',
      '[role="listbox"]',
      '.artdeco-dropdown__content-inner',
      '[class*="dropdown-content"]',
      '[class*="dropdown__content"]',
      '[class*="overflow-menu"]',
    ];
    for (const sel of visibleMenuSelectors) {
      const candidates = Array.from(document.querySelectorAll(sel));
      const visible = candidates.find(el => {
        const rect = el.getBoundingClientRect();
        return rect.height > 0 && rect.width > 0 && el.offsetParent !== null;
      });
      if (visible) {
        const itemCount = visible.querySelectorAll('li, a, button, [role="menuitem"]').length;
        console.log(`[cazary.ai] getDropdownContainer: ✅ fallback "${sel}" (${itemCount} items)`);
        return visible;
      }
    }

    // Intento 3: Buscar por posición — any UL/DIV que apareció cerca del botón overflow
    const allMenuLists = Array.from(document.querySelectorAll('ul, div[role="presentation"]'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.height < 30 || rect.width < 80) return false;
        const children = el.querySelectorAll('li, button, a');
        return children.length >= 2 && children.length <= 15;
      });
    if (allMenuLists.length > 0) {
      const candidate = allMenuLists[allMenuLists.length - 1];
      console.log(`[cazary.ai] getDropdownContainer: ✅ DOM fallback ul/div con ${candidate.children.length} hijos`);
      return candidate;
    }

    console.warn('[cazary.ai] getDropdownContainer: botón overflow no encontrado');
    return null;
  }

  function findMenuItemByText(...keywords) {
    // Buscar primero en el container del dropdown activo (evita falsos positivos de nav global)
    const container = getDropdownContainer();
    const searchRoot = container || document;

    const dropdownSelectors = [
      '.eah-menu-item__action',
      'li.eah-menu-content__list-item a',
      'li.eah-menu-content__list-item button',
      'li.eah-menu-content__list-item [role="menuitem"]',
      '[role="menuitem"]',
      '[role="option"]',
      '.artdeco-dropdown__item',
      'li[class*="artdeco-dropdown"]',
      '[data-control-name]',
      'li[class*="dropdown"]',
      'div[class*="dropdown-option"]',
    ];

    for (const sel of dropdownSelectors) {
      const items = Array.from(searchRoot.querySelectorAll(sel));
      const found = items.find(el => {
        if (!el.offsetParent && el.getBoundingClientRect().height === 0) return false;
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        return keywords.some(kw => t === kw.toLowerCase() || t.startsWith(kw.toLowerCase()));
      });
      if (found) {
        console.log(`[cazary.ai] findMenuItemByText("${keywords[0]}"): encontrado via "${sel}" → "${(found.innerText||'').trim().slice(0,40)}"`);
        return found;
      }
    }

    if (container) {
      const allItems = Array.from(container.querySelectorAll(
        '.eah-menu-item__action, li, button, a, [role="menuitem"]'
      ));
      const visibleItems = allItems.filter(el =>
        el.offsetParent !== null || el.getBoundingClientRect().height > 0
      );

      // Intentar match antes de rendirse — el contact overflow puede no usar .eah-menu-item__action
      const searchText = keywords[0].toLowerCase();
      const fallbackMatch = visibleItems.find(el => {
        const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
        return keywords.some(kw => txt === kw.toLowerCase() || txt.startsWith(kw.toLowerCase()));
      });
      if (fallbackMatch) {
        const innerClickable = fallbackMatch.querySelector('a, button, [role="menuitem"]');
        const target = innerClickable || fallbackMatch;
        console.log(`[cazary.ai] findMenuItemByText FALLBACK: "${keywords[0]}" → "${target.innerText?.trim()}"`);
        return target;
      }

      const visibleTexts = visibleItems
        .map(el => (el.innerText || el.textContent || '').trim())
        .filter(t => t.length > 0 && t.length < 60);
      console.warn(`[cazary.ai] findMenuItemByText("${keywords[0]}"): NO en dropdown (${visibleTexts.length} items):`, visibleTexts);
      return null;
    }

    // Nuclear: sin container, escanear elementos de menú excluyendo nav global
    const NAV_BLACKLIST = ['inicio', 'cuentas', 'posibles clientes', 'mensajes', 'buscar',
      'filtros', 'búsquedas guardadas', 'perfiles ideales', 'recomendaciones'];

    const allVisible = Array.from(document.querySelectorAll(
      '[role="menuitem"], [role="option"], .artdeco-dropdown__item, button[type="button"]'
    )).filter(el => {
      if (!el.offsetParent && el.getBoundingClientRect().height === 0) return false;
      const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
      return !NAV_BLACKLIST.some(b => txt === b);
    });

    const nuclear = allVisible.find(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      return keywords.some(kw => t === kw.toLowerCase());
    });

    if (nuclear) {
      console.log(`[cazary.ai] findMenuItemByText NUCLEAR: "${(nuclear.innerText||'').trim().slice(0,40)}"`);
      return nuclear;
    }

    const visibleTexts = allVisible
      .map(el => (el.innerText || '').trim())
      .filter(t => t.length > 0 && t.length < 30)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 20);
    console.warn(`[cazary.ai] findMenuItemByText("${keywords[0]}"): NO encontrado. Textos visibles:`, visibleTexts);
    return null;
  }

  // ── Extraer perfil LinkedIn estándar ─────────────────────────────────────

  function extractLinkedInProfile() {
    // name: h1 en la página (siempre es el nombre del perfil)
    let name = null;
    const h1s = Array.from(document.querySelectorAll('h1')).filter(h => h.offsetParent);
    if (h1s.length) name = h1s[0].innerText?.trim();
    if (!name) {
      const m = document.title.replace(/^\(\d+\)\s*/, '').match(/^(.+?)\s*[|\-–]/);
      if (m) name = m[1].trim();
    }

    // headline: primer div/span con texto debajo del h1, no en nav
    let headline = null;
    const mainContent = document.querySelector('main') || document.body;
    const allTexts = Array.from(mainContent.querySelectorAll('div,span'))
      .filter(el => {
        if (!el.offsetParent) return false;
        const t = (el.innerText || '').trim();
        return t.length > 10 && t.length < 200 && !t.includes('\n');
      });
    headline = allTexts.find(el => {
      const t = el.innerText?.trim() || '';
      return t !== name && t.length > 5 && el.closest('nav') === null;
    })?.innerText?.trim() || '';

    // location: texto que menciona ciudad/país (heurística)
    const location = allTexts.find(el => {
      const t = el.innerText?.trim() || '';
      return /,\s*\w+/.test(t) && t.length < 80 && t !== name && t !== headline;
    })?.innerText?.trim() || '';

    // connections: buscar texto con número + "contactos"
    const connEl = Array.from(document.querySelectorAll('span,a'))
      .find(el => /[\d,]+\s*(contacto|connection|follower)/i.test(el.innerText || ''));
    const connections = connEl?.innerText?.trim() || '';

    // about: sección con id="about" o aria-label="Acerca de"
    const aboutSection =
      document.querySelector('#about')?.closest('section') ||
      document.querySelector('[aria-label*="Acerca"], [aria-label*="About"]');
    const about = aboutSection
      ? Array.from(aboutSection.querySelectorAll('span'))
          .find(s => s.offsetParent && (s.innerText||'').length > 30)
          ?.innerText?.trim() || ''
      : '';

    return {
      name:        name       || 'No encontrado',
      headline:    headline   || '',
      company:     '',
      location:    location   || '',
      about:       about      || '',
      connections: connections || '',
      experience:  [],
      url:         window.location.href,
      source:      'linkedin',
      extractedAt: new Date().toISOString(),
    };
  }

  // ── Extraer perfil Sales Navigator ───────────────────────────────────────

  function extractSalesNavProfile() {
    const name = getText([
      '[data-anonymize="person-name"]',
      '.profile-topcard-person-entity__name',
      'h1',
    ]);
    const headline = getText([
      '[data-anonymize="headline"]',
      '.profile-topcard__summary-position .profile-topcard__job-title',
      '.profile-topcard__summary-position',
    ]);
    const company = getText([
      '[data-anonymize="company-name"]',
      '.profile-topcard__current-positions .profile-topcard__company-name',
    ]);
    const location = getText([
      '[data-anonymize="location"]',
      '.profile-topcard__location',
    ]);

    // Número de conexiones en SalesNav
    const connEl = Array.from(document.querySelectorAll('span,div'))
      .find(el => /[\d,]+\s*(contacto|connection)/i.test(el.innerText || ''));
    const connections = connEl?.innerText?.trim() || '';

    return {
      name:        name     || 'No encontrado',
      headline:    headline || '',
      company:     company  || '',
      location:    location || '',
      about:       '',
      connections,
      experience:  [],
      url:         window.location.href,
      source:      'sales_navigator',
      extractedAt: new Date().toISOString(),
    };
  }

  // ── Extraer mensajes del inbox de LinkedIn ────────────────────────────────

  function extractInboxMessages() {
    const messages = getAll('.msg-s-message-list__event');
    return messages.map((el) => {
      const sender  = el.querySelector('.msg-s-message-group__name')?.innerText?.trim() ?? '';
      const text    = el.querySelector('.msg-s-event-listitem__body')?.innerText?.trim() ?? '';
      const time    = el.querySelector('time')?.getAttribute('datetime') ?? '';
      return { sender, text, time };
    }).filter((m) => m.text);
  }

  // ── Extraer conteo de resultados de búsqueda ─────────────────────────────

  function extractSearchCount() {
    const selectors = [
      '.search-results-container .pb2 h2',
      '.search-results__total',
      '[data-total-count]',
      '.artdeco-card h2',
      '.search-results-container h2',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent || '';
        const m = text.match(/([\d,.]+)/);
        if (m) {
          const n = parseInt(m[1].replace(/[,.]/g, ''), 10);
          if (!isNaN(n) && n > 0) return n;
        }
      }
    }

    const snSelectors = [
      '.search-results__total-results',
      '.list-header-count',
      '[data-anonymize="result-count"]',
      '.artdeco-pill-choice__count',
    ];
    for (const sel of snSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent || '';
        const m = text.match(/([\d,.]+)/);
        if (m) {
          const n = parseInt(m[1].replace(/[,.]/g, ''), 10);
          if (!isNaN(n) && n > 0) return n;
        }
      }
    }

    const bodyText = document.body.innerText || '';
    const patterns = [
      /Aproximadamente\s+([\d,.]+)\s+resultado/i,
      /About\s+([\d,.]+)\s+result/i,
      /([\d,.]+)\s+resultado/i,
      /([\d,.]+)\s+result/i,
    ];
    for (const pat of patterns) {
      const m = bodyText.match(pat);
      if (m) {
        const n = parseInt(m[1].replace(/[,.]/g, ''), 10);
        if (!isNaN(n) && n > 0) return n;
      }
    }

    return null;
  }

  // ── Detectar perfil propio vía LinkedIn Voyager API (más confiable que DOM) ──

  async function detectOwnProfileFromVoyager() {
    try {
      // Leer CSRF token de la cookie JSESSIONID (LinkedIn lo requiere)
      const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      if (!csrf) return false;

      const res = await fetchWithTimeout(
        'https://www.linkedin.com/voyager/api/me',
        {
          headers: {
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'csrf-token': csrf,
            'x-restli-protocol-version': '2.0.0',
            'x-li-lang': 'es_ES',
          },
          credentials: 'include',
        },
        10000  // 10s timeout
      );

      if (!res.ok) return false;
      const data = await res.json();

      // El perfil puede estar en data.included o data.data
      const included = data?.included ?? [];
      const miniProfile = included.find(
        (item) => item?.$type?.includes('MiniProfile') || item?.$type?.includes('com.linkedin.voyager.identity.shared.MiniProfile')
      );

      // Fallback: buscar directo en data si included está vacío
      const profileData = miniProfile ?? data?.data;
      if (!profileData) return false;

      const firstName = profileData.firstName ?? profileData.localizedFirstName ?? '';
      const lastName  = profileData.lastName  ?? profileData.localizedLastName  ?? '';
      const name      = `${firstName} ${lastName}`.trim();
      if (!name || name.length < 2) return false;

      const vanityName = profileData.publicIdentifier ?? profileData.vanityName ?? 'me';
      const headline   = profileData.occupation ?? profileData.localizedHeadline ?? '';

      // Extraer avatar — múltiples estructuras posibles en la respuesta de LinkedIn
      let avatar_url = '';
      try {
        const pic = profileData.picture ?? profileData.profilePicture ?? profileData.miniProfile?.picture;
        if (pic) {
          // Estructura 1: vectorImage con rootUrl + artifacts (más común en Voyager /me)
          const vectorImg = pic?.displayImageReference?.vectorImage
            ?? pic?.['com.linkedin.voyager.dash.common.image.ImageViewModel']?.vectorImage
            ?? pic;
          if (vectorImg?.rootUrl && Array.isArray(vectorImg?.artifacts)) {
            const art = vectorImg.artifacts[vectorImg.artifacts.length - 1];
            avatar_url = vectorImg.rootUrl + (art?.fileIdentifyingUrlPathSegment ?? '');
          }
          // Estructura 2: rootUrl directo
          if (!avatar_url && typeof pic?.rootUrl === 'string') {
            avatar_url = pic.rootUrl;
          }
        }
        // Fallback DOM: usar el alt del global-nav__me-photo para confirmar nombre y src para avatar
        if (!avatar_url) {
          const navImg = document.querySelector('.global-nav__me-photo');
          if (navImg?.src) avatar_url = navImg.src;
        }
      } catch (_) {}

      const profile = {
        name,
        profile_url: `https://www.linkedin.com/in/${vanityName}/`,
        headline,
        avatar_url,
        detected_at: new Date().toISOString(),
      };

      safeStorageSet({ linkedin_profile: profile });
      safeSendMessage({ type: 'LINKEDIN_PROFILE_DETECTED', profile });
      console.log('[cazary.ai] Perfil detectado vía Voyager API:', name);
      return true;
    } catch (err) {
      console.warn('[cazary.ai] Voyager API falló, intentando DOM scraping:', err?.message);
      return false;
    }
  }

  // Detectar perfil: Voyager API primero, DOM scraping como fallback
  async function detectOwnProfileAuto() {
    const ok = await detectOwnProfileFromVoyager();
    if (!ok) detectOwnProfile();
  }

  // ── Detectar perfil propio (DOM scraping - fallback) ──────────────────────
  // APRENDIZAJE DE WAALAXY: usan el atributo `alt` de `.global-nav__me-photo`
  // para obtener el nombre — es el más confiable porque LinkedIn siempre lo pone ahí

  function detectOwnProfile() {
    // ── Nombre: estrategia Waalaxy primero ────────────────────────────────
    // `.global-nav__me-photo` tiene alt="Nombre Completo" — siempre presente en el nav
    const navPhoto = document.querySelector('.global-nav__me-photo');
    const nameFromAlt = navPhoto?.getAttribute('alt')?.trim();

    // Fallbacks progresivos si el alt no está disponible
    const nameEl =
      document.querySelector('.profile-nav-card-mini__title') ||
      document.querySelector('.scaffold-layout-toolbar__profile-details-title') ||
      document.querySelector('.feed-identity-module__actor-meta .t-bold') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] .t-bold') ||
      document.querySelector('.profile-rail-card .t-bold');

    const name = nameFromAlt || nameEl?.textContent?.trim() || nameEl?.innerText?.trim();
    if (!name || name.length < 2) return false;

    // ── Avatar: la misma imagen del nav (Waalaxy: PROFILE_PICTURE_SELECTOR) ─
    const imgEl =
      navPhoto ||
      document.querySelector('.pv-top-card-profile-picture__container > img') ||
      document.querySelector('.profile-nav-card-mini__profile-picture img') ||
      document.querySelector('.feed-identity-module__actor-meta img') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] img');

    // ── Headline ──────────────────────────────────────────────────────────
    const headlineEl =
      document.querySelector('.profile-nav-card-mini__headline') ||
      document.querySelector('.scaffold-layout-toolbar__profile-details-headline') ||
      document.querySelector('.feed-identity-module__actor-meta .t-14') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] .t-14');

    // Intentar obtener la URL real del perfil desde los links del nav
    let profile_url = 'https://www.linkedin.com/in/me/';
    const meLink = document.querySelector('a[href*="/in/"]');
    if (meLink) {
      const match = meLink.href.match(/linkedin\.com(\/in\/[^/?#]+)/);
      if (match) profile_url = `https://www.linkedin.com${match[1]}`;
    }

    const profile = {
      name,
      profile_url,
      headline:     headlineEl?.textContent?.trim() ?? '',
      avatar_url:   imgEl?.src ?? '',
      detected_at:  new Date().toISOString(),
    };

    safeStorageSet({ linkedin_profile: profile });
    safeSendMessage({ type: 'LINKEDIN_PROFILE_DETECTED', profile });
    console.log('[cazary.ai] Perfil detectado:', name);
    return true;
  }

  // Ejecutar en CUALQUIER página de LinkedIn (Voyager API + DOM scraping como fallback)
  if (window.location.hostname === 'www.linkedin.com') {
    // Primer intento inmediato con Voyager API (no depende del DOM)
    setTimeout(() => detectOwnProfileAuto(), 800);
    // Reintentos escalonados por si el primer intento falla (e.g. sesión aún cargando)
    setTimeout(() => detectOwnProfileAuto(), 3000);
    setTimeout(() => detectOwnProfileAuto(), 8000);
  }

  // ── Auto-extracción al cargar un perfil ───────────────────────────────────

  function onProfilePageLoad() {
    const isProfile =
      /linkedin\.com\/in\//.test(window.location.href) ||
      /linkedin\.com\/sales\/people\//.test(window.location.href);

    if (!isProfile) return;

    setTimeout(() => {
      const profile = isSalesNavigator()
        ? extractSalesNavProfile()
        : extractLinkedInProfile();

      if (profile.name && profile.name !== 'No encontrado') {
        safeSendMessage({ type: 'PROFILE_LOADED', profile });
      }
    }, 2000);
  }

  onProfilePageLoad();

  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      onProfilePageLoad();
    }
  }).observe(document.body, { subtree: true, childList: true });

  // ── Observer de inbox para mensajes recibidos ─────────────────────────────

  const isLiMessaging = window.location.pathname.startsWith('/messaging');
  const isSnInbox     = window.location.href.includes('/sales/inbox') ||
                        window.location.href.includes('/sales/messaging');

  if (isLiMessaging || isSnInbox) {
    function getActiveContact() {
      if (isSnInbox) {
        const nameEl = document.querySelector(
          '.conversation-header [data-anonymize="person-name"], ' +
          '.thread-detail__header-name, ' +
          '[class*="conversation-header"] [class*="name"]'
        );
        const linkEl = document.querySelector('a[href*="/sales/lead/"]');
        return {
          name:       nameEl?.innerText?.trim() ?? null,
          profileUrl: linkEl?.href?.split('?')[0] ?? null,
        };
      } else {
        const nameEl = document.querySelector(
          '.msg-thread__link-to-profile, .msg-entity-lockup__entity-title, ' +
          'h2.msg-entity-lockup__entity-title'
        );
        const linkEl = document.querySelector(
          '.msg-thread__link-to-profile[href], a.msg-entity-lockup__entity-title[href]'
        );
        return {
          name:       nameEl?.innerText?.trim() ?? null,
          profileUrl: linkEl?.href?.split('?')[0].replace(/\/$/, '') ?? null,
        };
      }
    }

    const observedMessages = new Set();

    const msgObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          const msgEl =
            node.querySelector?.('.msg-s-event-listitem__body') ??
            (node.matches?.('.msg-s-event-listitem__body') ? node : null) ??
            node.querySelector?.('[class*="message-body"]') ??
            node.querySelector?.('.conversation-item__message-content');

          if (!msgEl) continue;

          const text = msgEl.innerText?.trim();
          if (!text || text.length < 1) continue;

          const msgKey = text.substring(0, 50) + '_' + Date.now().toString().slice(0, -3);
          if (observedMessages.has(msgKey)) continue;

          const listItem   = msgEl.closest('.msg-s-event-listitem, [class*="message-item"]');
          const isOutgoing =
            listItem?.querySelector('.msg-s-message-group__meta')?.innerText?.includes('Tú') ||
            listItem?.classList?.toString().includes('outgoing') ||
            listItem?.querySelector('[class*="outgoing"]');

          if (isOutgoing) continue;

          observedMessages.add(msgKey);
          setTimeout(() => observedMessages.delete(msgKey), 30000);

          const contact = getActiveContact();
          safeSendMessage({
            type: 'MESSAGE_RECEIVED',
            data: {
              text,
              timestamp:    new Date().toISOString(),
              contact_name: contact.name,
              profile_url:  contact.profileUrl,
              source:       isSnInbox ? 'salesnav' : 'linkedin',
              lead_id:      null,
            },
          });
        }
      }
    });

    msgObserver.observe(document.body, { childList: true, subtree: true });
    console.log(`[cazary.ai] Inbox observer activo para ${isSnInbox ? 'SalesNav' : 'LinkedIn'}`);
  }

  // ══════════════════════════════════════════════════════════
  // ACCIONES DEL GHOST ENGINE
  // ══════════════════════════════════════════════════════════

  // ── ACCIÓN 1: VIEW PROFILE ────────────────────────────────────────────────

  async function executeViewProfile(taskId) {
    const totalHeight = document.body.scrollHeight;
    let pos = 0;
    while (pos < totalHeight * 0.7) {
      pos += 150 + Math.random() * 100;
      window.scrollTo({ top: pos, behavior: 'smooth' });
      await sleep(300 + Math.random() * 400);
    }
    await sleep(3000 + Math.random() * 4000);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: { action: 'view_profile', success: true } });
  }

  function isSalesNavDialogOpen() {
    return isSalesNavDialogOpenRobust();
  }

  // ── ACCIÓN 2: CONNECT ─────────────────────────────────────────────────────

  // ── Extraer memberId de la página actual (múltiples métodos) ─────────────
  function extractMemberIdFromPage(profileUrl) {
    // LinkedIn member IDs empiezan con "AC" + caracteres alfanuméricos (longitud ~30-40 chars)
    // Pueden ser ACoA, ACwA, ACgA, etc. — NO solo ACoA
    const isLinkedInMemberId = (s) => /^AC[A-Za-z0-9_-]{15,}$/.test(s);

    // Método 1: URL de SalesNav → /sales/lead/<memberId>,<instanceId>
    // La URL puede tener comas, ej: /sales/lead/ACwAACJi9LA...,NAME_SEARCH,4u-Z
    const url = profileUrl || window.location.href;
    const snMatch = url.match(/\/sales\/(?:lead|people)\/([A-Za-z0-9_,%:-]+)/);
    if (snMatch) {
      const raw = decodeURIComponent(snMatch[1]).split(',')[0];
      if (isLinkedInMemberId(raw)) return raw;
    }

    // Método 2: Atributos data-entity-urn en el DOM (Waalaxy: getMemberIdByProfileUrn)
    const urnEls = document.querySelectorAll('[data-entity-urn*="fsd_profile"],[data-urn*="fsd_profile"],[data-member-urn*="fsd_profile"]');
    for (const el of urnEls) {
      const urn = el.getAttribute('data-entity-urn') || el.getAttribute('data-urn') || el.getAttribute('data-member-urn') || '';
      const m = urn.match(/fsd_profile:([A-Za-z0-9_-]+)/);
      if (m && isLinkedInMemberId(m[1])) return m[1];
    }

    // Método 3: Links con profileUrn (técnica Waalaxy)
    for (const link of document.querySelectorAll('a[href*="profileUrn"]')) {
      const m = (link.getAttribute('href') || '').match(/profileUrn=urn%3Ali%3Afsd_profile%3A([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }

    // Método 4: Link "Ver todas las conexiones" en perfil LinkedIn estándar
    const connLink = document.querySelector('a[href*="facetConnectionOf"]');
    if (connLink) {
      const m = (connLink.getAttribute('href') || '').match(/facetConnectionOf=%22([^%]+)%22/);
      if (m) return m[1];
    }

    return null;
  }

  // ── Enviar conexión via Voyager API (no requiere DOM — más fiable) ────────
  async function connectViaVoyagerAPI(profileUrl, note) {
    try {
      const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      if (!csrf) return { ok: false, reason: 'no_csrf' };

      const memberId = extractMemberIdFromPage(profileUrl);
      if (!memberId) return { ok: false, reason: 'no_member_id' };

      // trackingId aleatorio requerido por la API
      const trackingId = btoa(
        Array.from({ length: 16 }, () => String.fromCharCode(Math.floor(Math.random() * 256))).join('')
      );

      const body = {
        trackingId,
        invitee: {
          'com.linkedin.voyager.growth.invitation.InviteeProfile': { profileId: memberId }
        }
      };
      if (note && note.trim()) body.message = note.trim().slice(0, 300);

      const res = await fetchWithTimeout(
        'https://www.linkedin.com/voyager/api/growth/normInvitations',
        {
          method:      'POST',
          credentials: 'include',
          headers: {
            'accept':                    'application/vnd.linkedin.normalized+json+2.1',
            'content-type':              'application/json',
            'csrf-token':                csrf,
            'x-restli-protocol-version': '2.0.0',
            'x-li-lang':                 'es_ES',
          },
          body: JSON.stringify(body),
        },
        15000  // 15s timeout — evita que el motor se cuelgue
      );

      console.log(`[cazary.ai] connectViaVoyagerAPI: status=${res.status} memberId=${memberId.slice(0,8)}...`);

      if (res.status === 201 || res.status === 200) return { ok: true, reason: 'sent' };
      if (res.status === 429 || res.status === 403) return { ok: false, reason: 'daily_limit_reached' };
      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        const msg  = JSON.stringify(data || '').toLowerCase();
        if (msg.includes('pending') || msg.includes('already') || msg.includes('pendiente'))
          return { ok: false, reason: 'already_pending' };
        if (msg.includes('connected') || msg.includes('conectado'))
          return { ok: false, reason: 'already_connected' };
        return { ok: false, reason: 'api_400', raw: msg.slice(0, 200) };
      }
      // 301/302 = redirect inesperado (SalesNav entity IDs "ACwAAE..." no son aceptados
      // por la API normInvitations — LinkedIn redirige). NO indica "ya conectado".
      // Dejar caer al fallback DOM que SÍ funciona.
      if (res.status === 301 || res.status === 302) {
        console.log('[cazary.ai] connectViaVoyagerAPI: 301/302 → redirect de API (memberId format), usar DOM');
        return { ok: false, reason: 'api_redirect' };
      }
      return { ok: false, reason: `api_${res.status}` };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[cazary.ai] connectViaVoyagerAPI: timeout 15s — LinkedIn API no respondió');
        return { ok: false, reason: 'timeout' };
      }
      console.warn('[cazary.ai] connectViaVoyagerAPI error:', err.message);
      return { ok: false, reason: 'exception' };
    }
  }

  // ── isSalesNavDialogOpen con selectores actualizados ─────────────────────
  function isSalesNavDialogOpenRobust() {
    const dialogSelectors = [
      '[data-test-modal]',
      '[data-x-dialog]',
      '.artdeco-modal',
      '[role="dialog"]',
      '[class*="modal"][class*="connect"]',
      '[class*="invite"][class*="modal"]',
      '[class*="connect-modal"]',
      '[data-x--invite-to-connect-modal]',
      '[class*="invite-to-connect"]',
      '[class*="invitation-modal"]',
    ];

    for (const sel of dialogSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }

    const sendBtn = findDialogSendButton();
    if (sendBtn && sendBtn.offsetParent !== null) return true;

    return false;
  }

  // ── Buscar botón Send en cualquier dialog de invitación ──────────────────
  function findDialogSendButton() {
    const containers = [
      document.querySelector('[data-test-modal], [role="dialog"], .artdeco-modal, [data-x-dialog]'),
      document.body,
    ].filter(Boolean);

    for (const container of containers) {
      const btns = Array.from(container.querySelectorAll('button, [role="button"]'));
      const sendBtn = btns.find(btn => {
        if (btn.disabled) return false;
        if (btn.offsetParent === null && container === document.body) return false;
        const txt   = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return txt === 'enviar' || txt === 'send' ||
               txt === 'enviar invitación' || txt === 'send invitation' ||
               txt === 'conectar' || txt === 'connect' ||
               label.includes('enviar') || label.includes('send invitation');
      });
      if (sendBtn) return sendBtn;
    }
    return null;
  }

  async function detectConnectionState() {
    const platform = getPlatform();
    await sleep(1000);

    if (platform === 'salesnav') {
      // PASO 1: Badge de grado (rápido, no requiere abrir dropdown)
      if (isFirstDegreeConnection()) {
        console.log('[cazary.ai] detectConnectionState SalesNav: 1er grado → connected');
        return 'connected';
      }

      // PASO 2: Verificar botones VISIBLES en la topcard
      // "Pendiente"/"Retirar" aparece como botón directo cuando ya enviaste una invitación
      // NO abrimos el dropdown aquí — eso se hace en _executeConnectInner cuando realmente
      // queremos conectar. Abrir y cerrar el dropdown causa falsos positivos ("Añadir nota"
      // aparece en el dropdown de TODOS los contactos SalesNav, no solo 1er grado).
      if (isPendingConnection()) {
        console.log('[cazary.ai] detectConnectionState SalesNav: botón Pendiente/Retirar visible → pending');
        return 'pending';
      }

      // Sin evidencia de conexión o pendiente → asumir 'none', intentar conectar
      console.log('[cazary.ai] detectConnectionState SalesNav: sin evidencia → none (proceder a conectar)');
      return 'none';
    }

    // LinkedIn estándar
    if (isFirstDegreeConnection()) return 'connected';
    if (isPendingConnection())      return 'pending';
    return 'none';
  }

  async function executeConnect(taskId, note, leadId, campaignId, lead) {
    const platform = getPlatform();
    console.log(`[cazary.ai] executeConnect platform=${platform} leadId=${leadId}`);
    // Wrap global: cualquier excepción no catcheada envía un ACTION_DONE con failure
    // para que el background nunca se quede esperando indefinidamente
    try {
      return await _executeConnectInner(taskId, note, leadId, campaignId, lead, platform);
    } catch (err) {
      console.error('[cazary.ai] executeConnect: excepción no catcheada →', err?.message);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'exception',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }
  }

  async function _executeConnectInner(taskId, note, leadId, campaignId, lead, platform) {
    note = personalizeMessage(note, lead);
    // Cargar overrides de selectores antes de ejecutar (fail-safe: no bloquea si falla)
    try {
      const { supabase_workspace_id: wsId } = await chrome.storage.local.get('supabase_workspace_id');
      if (wsId) await loadSelectorOverrides(wsId);
    } catch (_) {}
    await sleep(1500 + Math.random() * 1000);

    // ── Detectar OUT_OF_NETWORK (perfil bloqueado) ────────────────────────────
    const isOutOfNetwork = window.location.href.includes('OUT_OF_NETWORK');
    if (isOutOfNetwork) {
      console.log('[cazary.ai] SalesNav: perfil OUT_OF_NETWORK detectado → búsqueda extendida de botón Conectar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(1500);
    }

    // ── TIMEOUT DE SEGURIDAD: Si la función tarda más de 45s, forzar ACTION_DONE ──
    let _connectTimeoutFired = false;
    const _connectSafetyTimer = setTimeout(() => {
      _connectTimeoutFired = true;
      console.warn('[cazary.ai] _executeConnectInner: timeout de seguridad 45s → forzando ACTION_DONE');
      safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'safety_timeout_45s',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }, 45000);

    // ── SMART STATE DETECTION ─────────────────────────────────────────────────
    const connectionState = await detectConnectionState();
    console.log(`[cazary.ai] ConnectionState: ${connectionState} | platform=${platform}`);

    if (connectionState === 'connected') {
      clearTimeout(_connectSafetyTimer);
      if (_connectTimeoutFired) return;
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action:     'connect',
        success:    true,
        reason:     'already_connected',
        crm_target: 'conexion_aceptada',
        lead_id:    leadId,
        campaign_id: campaignId,
      }});
    }

    if (connectionState === 'pending') {
      clearTimeout(_connectSafetyTimer);
      if (_connectTimeoutFired) return;
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action:     'connect',
        success:    true,
        reason:     'already_pending',
        crm_target: 'conexion_enviada',
        lead_id:    leadId,
        campaign_id: campaignId,
      }});
    }

    // connectionState === 'none' → proceder a conectar

    if (platform === 'salesnav') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(800);

      // ── PASO 0: Voyager API (más fiable que DOM, no depende de selectores UI) ──
      console.log('[cazary.ai] SalesNav: intentando Voyager API para:', window.location.href.slice(0, 80));
      const apiResult = await connectViaVoyagerAPI(window.location.href, note);
      console.log('[cazary.ai] SalesNav Voyager API connect result:', apiResult);

      if (apiResult.ok) {
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: true, reason: 'sent', method: 'voyager_api',
          lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
        }});
      }
      if (apiResult.reason === 'daily_limit_reached') {
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }
      if (apiResult.reason === 'already_pending') {
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: true, reason: 'already_pending',
          crm_target: 'conexion_enviada', lead_id: leadId, campaign_id: campaignId,
        }});
      }
      if (apiResult.reason === 'already_connected') {
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: true, reason: 'already_connected',
          crm_target: 'conexion_aceptada', lead_id: leadId, campaign_id: campaignId,
        }});
      }
      // Si API falla (no_member_id, no_csrf, exception, api_400) → continuar con DOM como fallback
      console.warn(`[cazary.ai] SalesNav: Voyager API falló (${apiResult.reason}) → fallback DOM`);
      await sleep(500);

      // ── HELPER: botón "Conectar" directo en topcard (no en dropdown) ────────
      function findDirectConnectBtn() {
        const connectSelectors = [
          '[data-x--lead-actions-bar] button',
          '[class*="lead-actions-bar"] button',
          '[class*="profile-topcard__actions"] button',
          '.profile-topcard__actions button',
          // Para OUT_OF_NETWORK:
          '[class*="locked-profile"] button',
          '[class*="out-of-network"] button',
          '.profile-topcard-actions button',
          '[data-x--lead-cta-top-card] button',
          // Cualquier botón prominente en el header del perfil
          'header button',
          'section button',
        ];
        for (const sel of connectSelectors) {
          const found = Array.from(document.querySelectorAll(sel)).find(btn => {
            if (!btn.offsetParent && btn.getBoundingClientRect().width === 0) return false;
            const txt   = (btn.innerText || btn.textContent || '').toLowerCase().trim();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            return txt === 'conectar' || txt === 'connect' ||
                   label.includes('conectar') || label.includes('connect to');
          });
          if (found) return found;
        }
        return null;
      }

      // ── PASO 1: Intentar botón directo en topcard (sin abrir dropdown) ──────
      let directBtn = findDirectConnectBtn();
      if (directBtn) {
        console.log('[cazary.ai] SalesNav: ✅ botón "Conectar" directo en topcard → clickeando');
        directBtn.focus();
        directBtn.click();
      } else {
        // ── PASO 2: Abrir overflow dropdown para buscar "Conectar" ──────────
        let opened = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          opened = await clickMoreButton();
          if (opened) break;
          console.warn(`[cazary.ai] SalesNav: reintentando dropdown (${attempt + 1}/3)`);
          await sleep(1000);
        }

        if (opened) {
          let connectItem = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            connectItem = findMenuItemByText('conectar', 'connect', 'invitar', 'invite');
            if (connectItem) break;
            console.warn(`[cazary.ai] SalesNav: esperando "Conectar" en dropdown (${attempt + 1}/4)`);
            await sleep(600);
          }

          if (!connectItem) {
            // "Conectar" no está en el dropdown — cerrar y buscar botón directo
            const overflowBtn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');
            if (overflowBtn) { overflowBtn.click(); await sleep(500); }

            directBtn = findDirectConnectBtn();
            if (directBtn) {
              console.log('[cazary.ai] SalesNav: "Conectar" directo encontrado tras cerrar dropdown');
              directBtn.focus();
              directBtn.click();
            } else if (isOutOfNetwork) {
              console.log('[cazary.ai] SalesNav OUT_OF_NETWORK: esperando 2s adicionales y buscando con scroll...');
              window.scrollTo({ top: 200, behavior: 'smooth' });
              await sleep(2000);
              directBtn = findDirectConnectBtn();
              if (directBtn) {
                console.log('[cazary.ai] SalesNav OUT_OF_NETWORK: ✅ botón Conectar encontrado tras scroll');
                directBtn.focus();
                directBtn.click();
                // Continuar al PASO 3 normalmente — no hacer return aquí
              } else {
                // Para OUT_OF_NETWORK sin botón: marcar como scheduled para reintentar en 24h
                console.warn('[cazary.ai] SalesNav OUT_OF_NETWORK: sin botón Conectar visible → rescheduled');
                clearTimeout(_connectSafetyTimer);
                if (_connectTimeoutFired) return;
                return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
                  action: 'connect', success: false,
                  reason: 'out_of_network_locked',
                  lead_id: leadId, campaign_id: campaignId,
                }});
              }
            } else {
              console.warn('[cazary.ai] SalesNav: "Conectar" no encontrado ni en dropdown ni en topcard');
              clearTimeout(_connectSafetyTimer);
              if (_connectTimeoutFired) return;
              return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
                action: 'connect', success: false, reason: 'connect_item_not_found',
                lead_id: leadId, campaign_id: campaignId,
              }});
            }
          } else {
            console.log('[cazary.ai] SalesNav: "Conectar" en dropdown → clickeando');
            console.log('[cazary.ai] SalesNav: simulateClick en connectItem:', connectItem.tagName, connectItem.className?.slice(0, 50));
            simulateClick(connectItem);
            await sleep(300);
            connectItem.focus();
            connectItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
            connectItem.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
          }
        } else {
          console.warn('[cazary.ai] SalesNav: no se pudo abrir dropdown → more_button_not_found');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'more_button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
      }

      // ── PASO 3: Esperar dialog de invitación (máx 3 segundos) ───────────────
      let dialogFound = false;
      for (let i = 0; i < 6; i++) {
        await sleep(500);
        if (isSalesNavDialogOpen()) { dialogFound = true; break; }
      }

      if (!dialogFound) {
        // Sin dialog — puede que SalesNav envió sin modal (ej. sin nota),
        // o que el click no registró. Verificar una sola vez, sin loops.
        console.warn('[cazary.ai] SalesNav: dialog no apareció tras click en Conectar');
        await sleep(1500);

        // Comprobar si el botón "Conectar" desapareció del dropdown (señal de éxito)
        // No volvemos a abrir el dropdown — solo verificamos estado del DOM actual
        const pendingBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
          const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
          return (txt === 'pendiente' || txt === 'pending' || txt === 'retirar' || txt === 'withdraw');
        });

        if (pendingBtn) {
          console.log('[cazary.ai] SalesNav: ✅ botón Pendiente visible → conexión enviada sin dialog');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'sent_no_dialog', method: 'dom_salesnav',
            lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
          }});
        }

        // También intentar buscar el send button directamente (puede que dialog apareció tarde)
        const lateSendBtn = findDialogSendButton();
        if (lateSendBtn) {
          console.log('[cazary.ai] SalesNav: dialog apareció tarde → clickeando Enviar');
          simulateClick(lateSendBtn);
          await sleep(1500);
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'sent_late_dialog', method: 'dom_salesnav',
            lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
          }});
        }

        console.warn('[cazary.ai] SalesNav: no se pudo confirmar envío → modal_not_opened');
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'modal_not_opened',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      // ── PASO 4: Enviar invitación via dialog ─────────────────────────────────
      console.log('[cazary.ai] SalesNav: dialog detectado → buscando botón enviar');
      const sendBtn = findDialogSendButton();
      if (!sendBtn) {
        console.warn('[cazary.ai] SalesNav: botón send no encontrado en dialog');
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'dialog_send_button_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      // ── Escribir nota si está configurada (A/B: Variante A con nota) ────────
      if (note && note.trim()) {
        const noteBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
          const t = (el.innerText || el.textContent || '').toLowerCase();
          return t.includes('nota') || t.includes('note') || t.includes('agregar') ||
                 t.includes('add a') || t.includes('añadir') || t.includes('optional');
        });
        if (noteBtn) {
          simulateClick(noteBtn);
          await sleep(700);
        }
        const noteField = document.querySelector(
          'textarea#custom-message, textarea[name="message"], ' +
          'textarea[placeholder*="nota"], textarea[placeholder*="note"], ' +
          '.connect-cta-form textarea, [data-test-modal] textarea'
        );
        if (noteField) {
          noteField.focus();
          noteField.value = '';
          document.execCommand('insertText', false, note.trim().slice(0, 300));
          noteField.dispatchEvent(new Event('input',  { bubbles: true }));
          noteField.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(400);
          console.log('[cazary.ai] SalesNav: ✅ nota escrita en dialog:', note.trim().slice(0, 40) + '...');
        } else {
          console.warn('[cazary.ai] SalesNav: ⚠️ textarea de nota no encontrado — enviando sin nota');
        }
      }

      sendBtn.click();
      await sleep(2000);

      if (!isSalesNavDialogOpen()) {
        console.log('[cazary.ai] SalesNav: ✅ conexión enviada (dialog cerrado)');
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: true, reason: 'sent', method: 'dom_salesnav',
          lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
        }});
      }

      // Reintento único
      const sendBtn2 = findDialogSendButton();
      if (sendBtn2) {
        sendBtn2.click();
        await sleep(2000);
        if (!isSalesNavDialogOpen()) {
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'sent', method: 'dom_salesnav',
            lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
          }});
        }
      }

      const limitHit = document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);
      if (limitHit) {
        clearTimeout(_connectSafetyTimer);
        if (_connectTimeoutFired) return;
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }
      clearTimeout(_connectSafetyTimer);
      if (_connectTimeoutFired) return;
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'dialog_send_failed',
        lead_id: leadId, campaign_id: campaignId,
      }});

    } else {
      // LinkedIn estándar
      window.scrollTo({ top: 200, behavior: 'smooth' });
      await sleep(1200);
      console.log('[cazary.ai] LI connect: buscando botón Conectar directo...');

      const connectBtnSel = getSelector('linkedin', 'connect', 'connect_btn',
        'button[aria-label*="Conectar"], button[aria-label*="Connect"], button[aria-label*="Invitar a conectar"]');

      let connectBtn = null;
      for (let i = 0; i < 4; i++) {
        connectBtn = Array.from(document.querySelectorAll(
          'button, div[role="button"], a[role="button"]'
        )).find(el => {
          if (!el.offsetParent || el.disabled) return false;
          const t     = (el.innerText || el.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'conectar' || t === 'connect' ||
                 (label.includes('conectar') && !label.includes('seguir') && !label.includes('mensaje')) ||
                 (label.includes('connect')  && !label.includes('follow') && !label.includes('message')) ||
                 (label.includes('invitar a conectar')) || (label.includes('invite') && label.includes('connect'));
        }) || document.querySelector(connectBtnSel);
        if (connectBtn) {
          console.log(`[cazary.ai] LI connect: botón directo encontrado intento ${i+1}`);
          break;
        }
        if (i === 0) {
          const allBtns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent);
          console.log('[cazary.ai] LI connect: botones visibles:', allBtns.map(b => (b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean));
        }
        await sleep(800);
      }

      if (!connectBtn) {
        reportSelectorFailure('linkedin', 'connect', 'connect_btn', connectBtnSel,
          document.querySelector('.pvs-profile-actions, .pv-top-card-v2-ctas, .artdeco-card')?.innerHTML
          ?? document.body.innerHTML.substring(0, 3000));
        console.warn('[cazary.ai][SelectorHealing] selector_failure: connect_btn');
        console.log('[cazary.ai] LI connect: no directo, intentando dropdown "..."');
        const opened = await clickMoreButton();
        if (!opened) {
          console.warn('[cazary.ai] LI connect: FALLO — no se encontró botón "..."');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        await sleep(500);
        const item = findMenuItemByText('conectar', 'connect', 'invitar', 'invite');
        if (!item) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          console.warn('[cazary.ai] LI connect: FALLO — "Conectar" no encontrado en dropdown');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.log('[cazary.ai] LI connect: encontrado en dropdown, clickeando...');
        const modalOpened = await forceClick(item);
        if (!modalOpened) {
          console.warn('[cazary.ai] forceClick: modal no abrió tras 3 intentos');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'modal_not_opened',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.log('[cazary.ai] connect: modal abierto correctamente');
      } else {
        console.log('[cazary.ai] LI connect: clickeando botón directo');
        const modalOpened = await forceClick(connectBtn);
        if (!modalOpened) {
          console.warn('[cazary.ai] forceClick: modal no abrió tras 3 intentos');
          clearTimeout(_connectSafetyTimer);
          if (_connectTimeoutFired) return;
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'modal_not_opened',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.log('[cazary.ai] connect: modal abierto correctamente');
      }
    }

    // Modal de confirmación (igual en ambas plataformas)
    await sleep(1500);

    if (note) {
      const noteBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
        const t = (el.innerText || el.textContent || '').toLowerCase();
        return t.includes('nota') || t.includes('note') || t.includes('agregar') || t.includes('add a');
      });
      if (noteBtn) {
        simulateClick(noteBtn);
        await sleep(700);
        const noteFieldSel = getSelector('linkedin', 'connect', 'note_field',
          'textarea#custom-message, textarea[name="message"], textarea[placeholder*="nota"], textarea[placeholder*="note"]');
        const field = document.querySelector(noteFieldSel);
        if (field) {
          field.focus();
          field.value = '';
          document.execCommand('insertText', false, note.slice(0, 300));
          field.dispatchEvent(new Event('input',  { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(400);
        } else {
          reportSelectorFailure('linkedin', 'connect', 'note_field', noteFieldSel,
            document.querySelector('[role="dialog"], .artdeco-modal')?.innerHTML?.substring(0, 3000) ?? '');
          console.warn('[cazary.ai][SelectorHealing] selector_failure: note_field');
        }
      }
    }

    const sendBtnSel = getSelector('linkedin', 'connect', 'send_btn',
      'button[aria-label*="Enviar"], button[aria-label*="Send"]');
    let sendBtn = null;
    for (let i = 0; i < 8; i++) {
      sendBtn = Array.from(document.querySelectorAll(
        'button, [role="button"]'
      )).find(el => {
        if (!el.offsetParent || el.disabled) return false;
        const t = (el.innerText || el.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return t === 'enviar'            || t === 'send'               ||
               t.includes('enviar sin') || t.includes('send without') ||
               t.includes('enviar invit')|| t.includes('send invit')  ||
               t.includes('enviar ahora')|| t.includes('send now')    ||
               t === 'conectar'         || t === 'connect';
      }) || document.querySelector(sendBtnSel);
      if (sendBtn) {
        console.log(`[cazary.ai] sendBtn encontrado intento ${i+1}: "${(sendBtn.innerText||'').trim()}"`);
        break;
      }
      await sleep(500);
    }

    if (!sendBtn) {
      const modal = document.querySelector('[role="dialog"],.artdeco-modal,.send-invite');
      reportSelectorFailure('linkedin', 'connect', 'send_btn', sendBtnSel,
        modal?.innerHTML?.substring(0, 3000) ?? document.body.innerHTML.substring(0, 2000));
      console.warn('[cazary.ai][SelectorHealing] selector_failure: send_btn');
      console.warn('[cazary.ai] Send btn not found. Modal:',
        modal ? modal.innerHTML.slice(0, 800) : 'NO MODAL');
      clearTimeout(_connectSafetyTimer);
      if (_connectTimeoutFired) return;
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'send_button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    sendBtn.focus();
    sendBtn.click();
    await sleep(2000);

    const modalOpen = !!document.querySelector(
      '.send-invite, .artdeco-modal--layer-default, [role="dialog"][aria-modal="true"]'
    );
    const limitHit = modalOpen &&
      document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);

    if (limitHit) {
      clearTimeout(_connectSafetyTimer);
      if (_connectTimeoutFired) return;
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'daily_limit_reached',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    console.log(`[cazary.ai] connect done: success=${!modalOpen}`);
    clearTimeout(_connectSafetyTimer);
    if (_connectTimeoutFired) return;
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'connect', success: !modalOpen,
      lead_id: leadId, campaign_id: campaignId,
      connection_note: note || '',
    }});
  }

  // ── Helper: manejar el dialog connect-cta-form de SalesNav ─────────────────
  // Selectores estables Ember.js (auditados en vivo 2026-06-18).
  // Retorna: true=enviado | false=falló | 'limit'=límite alcanzado
  async function handleSalesNavConnectDialog(note) {
    let dialogFound = false;
    for (let i = 0; i < 8; i++) {
      if (document.querySelector('button.connect-cta-form__send')) {
        dialogFound = true;
        break;
      }
      await sleep(500);
    }

    if (!dialogFound) {
      console.warn('[cazary.ai] handleSalesNavConnectDialog: dialog no apareció');
      return false;
    }

    if (note && note.trim()) {
      const noteField = document.querySelector(
        'textarea#connect-cta-form__invitation,' +
        '.connect-cta-form textarea,' +
        'textarea[placeholder*="nota"],' +
        'textarea[placeholder*="note"]'
      );
      if (noteField) {
        console.log('[cazary.ai] handleSalesNavConnectDialog: escribiendo nota humanizada');
        await typeHuman(noteField, note.trim().slice(0, 300), true);
        await sleepMicro();
      } else {
        console.warn('[cazary.ai] handleSalesNavConnectDialog: campo de nota no encontrado');
      }
    }

    const sendBtn = document.querySelector('button.connect-cta-form__send') ??
      Array.from(document.querySelectorAll('button')).find(b => {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        return txt === 'enviar invitación' || txt === 'send invitation' ||
               txt === 'enviar' || txt === 'send';
      });

    if (!sendBtn || sendBtn.disabled) {
      console.warn('[cazary.ai] handleSalesNavConnectDialog: botón enviar no encontrado/disabled');
      return false;
    }

    console.log('[cazary.ai] handleSalesNavConnectDialog: clickeando "Enviar invitación"');
    simulateClick(sendBtn);
    await sleepHuman();

    const limitHit = document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);
    if (limitHit) return 'limit';

    const dialogGone = !document.querySelector('button.connect-cta-form__send');
    return dialogGone;
  }

  // ── Helper: connect desde perfil SalesNav usando menú "..." → dropdown ────────
  async function executeSalesNavConnectFromProfile(taskId, note, leadId, campaignId, lead) {
    console.log('[cazary.ai] executeSalesNavConnectFromProfile: buscando botón "..."');
    await sleepHuman();

    let moreBtn = null;
    for (let i = 0; i < 4; i++) {
      moreBtn =
        document.querySelector('button[aria-label*="Más acciones"], button[aria-label*="More actions"]') ??
        Array.from(document.querySelectorAll(
          '.profile-topcard__actions button, [class*="profile-topcard"] button'
        )).find(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          const txt   = (b.innerText || b.textContent || '').trim();
          return label.includes('accion') || label.includes('action') || txt === '···' || txt === '•••';
        }) ?? null;
      if (moreBtn) break;
      await sleep(600);
    }

    if (!moreBtn) {
      console.warn('[cazary.ai] executeSalesNavConnectFromProfile: "..." no encontrado → fallback');
      return executeConnect(taskId, note, leadId, campaignId, lead);
    }

    simulateClick(moreBtn);
    await sleepHuman();

    let connectItem = null;
    for (let i = 0; i < 5; i++) {
      connectItem = Array.from(
        document.querySelectorAll('button.ember-view._item_1xnv7i, li._item_1xnv7i button, [role="menuitem"]')
      ).find(b => {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        return txt === 'conectar' || txt === 'connect';
      });
      if (connectItem) break;
      await sleep(400);
    }

    if (!connectItem) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      console.warn('[cazary.ai] executeSalesNavConnectFromProfile: "Conectar" no en dropdown → fallback');
      return executeConnect(taskId, note, leadId, campaignId, lead);
    }

    simulateClick(connectItem);
    await sleepHuman();

    const sent = await handleSalesNavConnectDialog(note);

    if (sent === 'limit') {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'daily_limit_reached',
        lead_id: leadId, campaign_id: campaignId, method: 'salesnav_profile_dropdown',
      }});
    }
    if (!sent) {
      console.warn('[cazary.ai] executeSalesNavConnectFromProfile: dialog falló → fallback');
      return executeConnect(taskId, note, leadId, campaignId, lead);
    }

    console.log('[cazary.ai] executeSalesNavConnectFromProfile: ✅ conexión enviada desde perfil');
    return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'connect', success: true, reason: 'sent',
      lead_id: leadId, campaign_id: campaignId,
      connection_note: note || '', method: 'salesnav_profile_dropdown',
    }});
  }

  // ── ACCIÓN 2b: CONNECT FAST (sin navegar al perfil) ──────────────────────

  async function executeConnectFast(taskId, note, leadId, campaignId, lead) {
    const platform = getPlatform();
    console.log(`[cazary.ai] connect mode=fast platform=${platform} leadId=${leadId}`);
    note = personalizeMessage(note, lead);

    // ── Helper: escribir nota en modal/dialog estándar de LinkedIn ────────────
    async function writeNoteAndSend() {
      await sleep(1500);
      if (note && note.trim()) {
        const noteBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
          const t = (el.innerText || el.textContent || '').toLowerCase();
          return t.includes('nota') || t.includes('note') || t.includes('agregar') || t.includes('add a');
        });
        if (noteBtn) {
          simulateClick(noteBtn);
          await sleep(700);
        }
        const field = document.querySelector(
          'textarea#custom-message, textarea[name="message"], ' +
          'textarea[placeholder*="nota"], textarea[placeholder*="note"]'
        );
        if (field) {
          field.focus();
          field.value = '';
          document.execCommand('insertText', false, note.trim().slice(0, 300));
          field.dispatchEvent(new Event('input',  { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(400);
        }
      }
      let sendBtn = null;
      for (let i = 0; i < 8; i++) {
        sendBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
          if (!el.offsetParent || el.disabled) return false;
          const t = (el.innerText || el.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
          return t === 'enviar' || t === 'send' || t.includes('enviar sin') ||
                 t.includes('send without') || t.includes('enviar invit') ||
                 t.includes('send invit') || t === 'conectar' || t === 'connect';
        });
        if (sendBtn) break;
        await sleep(500);
      }
      if (!sendBtn) return false;
      sendBtn.focus();
      sendBtn.click();
      await sleep(2000);
      const limitHit = document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);
      if (limitHit) return 'limit';
      const modalStillOpen = !!document.querySelector(
        '.send-invite, .artdeco-modal--layer-default, [role="dialog"][aria-modal="true"]'
      );
      return !modalStillOpen;
    }

    // ── Helper: extraer slug de perfil desde URL ──────────────────────────────
    function profileSlug(url) {
      if (!url) return null;
      const m = String(url).match(/linkedin\.com\/in\/([^/?#]+)/);
      return m ? m[1].toLowerCase() : null;
    }

    if (platform === 'linkedin') {
      // ── Buscar card del lead en la página actual ──────────────────────────
      const slug = profileSlug(lead?.linkedinUrl ?? lead?.linkedin_url ?? '');
      let connectBtn = null;

      if (slug) {
        const anchors = Array.from(document.querySelectorAll('a[href*="/in/"]'));
        const cardAnchor = anchors.find(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          return href.includes(`/in/${slug}`);
        });
        if (cardAnchor) {
          // Buscar botón Conectar dentro de la card contenedora
          const card = cardAnchor.closest('li, [data-urn], .entity-result, .search-result__wrapper') || cardAnchor.parentElement;
          if (card) {
            connectBtn = Array.from(card.querySelectorAll('button,[role="button"]')).find(el => {
              if (!el.offsetParent) return false;
              const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
              const label = (el.getAttribute('aria-label') || '').toLowerCase();
              return t === 'conectar' || t === 'connect' ||
                     label.includes('conectar') || label.includes('connect to');
            }) || null;
          }
        }
      }

      // ── Si no está en pantalla: navegar a búsqueda de personas ───────────
      if (!connectBtn && lead) {
        const searchName = encodeURIComponent((lead.full_name || lead.name || '').trim());
        if (searchName) {
          window.location.href = `https://www.linkedin.com/search/results/people/?keywords=${searchName}`;
          await sleep(3000);
          // Reintentar búsqueda de card tras navegación
          if (slug) {
            const anchors2 = Array.from(document.querySelectorAll('a[href*="/in/"]'));
            const cardAnchor2 = anchors2.find(a => (a.getAttribute('href') || '').toLowerCase().includes(`/in/${slug}`));
            if (cardAnchor2) {
              const card2 = cardAnchor2.closest('li, [data-urn], .entity-result, .search-result__wrapper') || cardAnchor2.parentElement;
              if (card2) {
                connectBtn = Array.from(card2.querySelectorAll('button,[role="button"]')).find(el => {
                  if (!el.offsetParent) return false;
                  const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
                  const label = (el.getAttribute('aria-label') || '').toLowerCase();
                  return t === 'conectar' || t === 'connect' ||
                         label.includes('conectar') || label.includes('connect to');
                }) || null;
              }
            }
          }
        }
      }

      if (!connectBtn) {
        // Fallback silencioso al modo perfil completo
        console.log('[cazary.ai] connect mode=fast → fallback mode=profile (card no encontrada)');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      console.log('[cazary.ai] connect mode=fast LI: card encontrada → clickeando Conectar');
      const modalOpened = await forceClick(connectBtn);
      if (!modalOpened) {
        console.log('[cazary.ai] connect mode=fast → fallback mode=profile (modal no abrió)');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      const sent = await writeNoteAndSend();
      if (sent === 'limit') {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId, method: 'fast',
        }});
      }
      if (sent === false) {
        console.log('[cazary.ai] connect mode=fast → fallback mode=profile (send falló)');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: true, reason: 'sent',
        lead_id: leadId, campaign_id: campaignId,
        connection_note: note || '', method: 'fast',
      }});

    } else {
      // ── SalesNav MODO RÁPIDO ──────────────────────────────────────────────
      // Flujo: "..." → dropdown → "Conectar" (_item_1xnv7i) → dialog connect-cta-form

      // ⚡ Si ya estamos en perfil SalesNav: usar flujo "..." dropdown del perfil
      const currentHref = window.location.href;
      const onSalesNavProfile = currentHref.includes('/sales/lead/') ||
                                currentHref.includes('/sales/people/');
      if (onSalesNavProfile) {
        console.log('[cazary.ai] connect mode=fast SalesNav: en perfil → usando flujo "..." dropdown');
        return executeSalesNavConnectFromProfile(taskId, note, leadId, campaignId, lead);
      }

      // ── PASO 0: Intentar Voyager API (solo funciona con LI profileId estándar) ──
      const leadProfileUrl = lead?.salesnav_url ?? lead?.linkedin_url ?? '';
      if (leadProfileUrl) {
        const apiRes = await connectViaVoyagerAPI(leadProfileUrl, note);
        console.log('[cazary.ai] connect mode=fast SalesNav Voyager API:', apiRes.reason);
        if (apiRes.ok) {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'sent', method: 'voyager_api_fast',
            lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
          }});
        }
        if (apiRes.reason === 'daily_limit_reached') {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'daily_limit_reached',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        if (apiRes.reason === 'already_connected') {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'already_connected',
            crm_target: 'conexion_aceptada', lead_id: leadId, campaign_id: campaignId,
          }});
        }
        if (apiRes.reason === 'already_pending') {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'already_pending',
            crm_target: 'conexion_enviada', lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.warn(`[cazary.ai] connect mode=fast SalesNav: API falló (${apiRes.reason}) → DOM`);
      }

      // ── PASO 1: Localizar la card del lead en la lista de búsqueda ───────────
      const snUrl    = leadProfileUrl;
      const snIdRaw  = snUrl ? String(snUrl).match(/\/sales\/lead\/([^,?#]+)/)?.[1] : null;
      const leadName = (lead?.full_name || lead?.name || '').trim().toLowerCase();

      let snCard = null;
      if (snIdRaw) {
        const anchors = Array.from(document.querySelectorAll('a[href*="/sales/lead/"]'));
        const match   = anchors.find(a => (a.getAttribute('href') || '').includes(snIdRaw));
        snCard = match?.closest('li, [data-id], .artdeco-list__item, [class*="result-item"]')
               ?? match?.parentElement ?? null;
      }
      if (!snCard && leadName) {
        const nameEls = Array.from(document.querySelectorAll(
          '[data-anonymize="person-name"], .result-lockup__name, [class*="result-lockup__name"]'
        ));
        const matched = nameEls.find(el => (el.textContent || '').trim().toLowerCase() === leadName);
        snCard = matched?.closest('li, [data-id], .artdeco-list__item') ?? null;
      }

      if (!snCard) {
        console.log('[cazary.ai] connect mode=fast SalesNav: card no encontrada → fallback perfil');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      // ── PASO 2: Click en botón "..." de la card ──────────────────────────────
      let moreBtn =
        snCard.querySelector('button[data-search-overflow-trigger]') ??
        Array.from(snCard.querySelectorAll('button[aria-label]')).find(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('ver más acciones') || label.includes('more actions');
        }) ?? null;

      if (!moreBtn) {
        console.log('[cazary.ai] connect mode=fast SalesNav: botón "..." no encontrado → fallback');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      console.log('[cazary.ai] connect mode=fast SalesNav: clickeando "..."');
      simulateClick(moreBtn);
      await sleepHuman();

      // ── PASO 3: Click en "Conectar" dentro del dropdown ──────────────────────
      let connectDropdownItem = null;
      for (let i = 0; i < 5; i++) {
        connectDropdownItem = Array.from(
          document.querySelectorAll('button.ember-view._item_1xnv7i, li._item_1xnv7i button')
        ).find(b => {
          const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
          return txt === 'conectar' || txt === 'connect';
        });
        if (!connectDropdownItem) {
          connectDropdownItem = Array.from(document.querySelectorAll(
            '[role="menuitem"], [role="option"], .dropdown-item, [class*="dropdown"] li button'
          )).find(b => {
            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return txt === 'conectar' || txt === 'connect';
          });
        }
        if (connectDropdownItem) break;
        await sleep(400);
      }

      if (!connectDropdownItem) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        console.log('[cazary.ai] connect mode=fast SalesNav: "Conectar" no en dropdown → fallback');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      console.log('[cazary.ai] connect mode=fast SalesNav: clickeando "Conectar" en dropdown');
      simulateClick(connectDropdownItem);
      await sleepHuman();

      // ── PASO 4: Interactuar con el dialog connect-cta-form ───────────────────
      const sentFromDialog = await handleSalesNavConnectDialog(note);

      if (sentFromDialog === 'limit') {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId, method: 'fast_salesnav_search',
        }});
      }
      if (!sentFromDialog) {
        console.log('[cazary.ai] connect mode=fast SalesNav: dialog no cerró → fallback');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      console.log('[cazary.ai] connect mode=fast SalesNav: ✅ conexión enviada desde lista');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: true, reason: 'sent',
        lead_id: leadId, campaign_id: campaignId,
        connection_note: note || '', method: 'fast_salesnav_search',
      }});
    }
  }

  // ── ACCIÓN 3: SEND MESSAGE ────────────────────────────────────────────────

  async function executeMessage(taskId, text, leadId, campaignId, lead) {
    const platform = getPlatform();
    console.log(`[cazary.ai] executeMessage platform=${platform} leadId=${leadId}`);
    text = personalizeMessage(text, lead);
    try {
      const { supabase_workspace_id: wsId } = await chrome.storage.local.get('supabase_workspace_id');
      if (wsId) await loadSelectorOverrides(wsId);
    } catch (_) {}

    await sleepHuman();

    // ── ETAPA A: Voyager Messaging API (solo LinkedIn, 1er grado) ────────────
    if (platform === 'linkedin') {
      const profileUrn = (() => {
        const msgLink = document.querySelector('a[href*="/messaging/compose/?profileUrn="]');
        const raw     = msgLink?.href?.match(/profileUrn=([^&]+)/)?.[1];
        return raw ? decodeURIComponent(raw) : null;
      })();

      if (profileUrn) {
        console.log(`[cazary.ai] executeMessage: intentando Voyager API, urn=${profileUrn}`);
        try {
          const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';
          const body = {
            keyVersion: 'LEGACY_INBOX',
            conversationCreate: {
              eventCreate: {
                value: {
                  'com.linkedin.voyager.messaging.create.MessageCreate': {
                    body: text,
                    attachments: [],
                    attributedBody: { text, attributes: [] },
                  },
                },
              },
              recipients: [profileUrn],
              subtype: 'MEMBER_TO_MEMBER',
            },
          };

          const resp = await fetch('/voyager/api/messaging/conversations', {
            method:  'POST',
            headers: {
              'csrf-token':                csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'content-type':              'application/json',
              'accept':                    'application/vnd.linkedin.normalized+json+2.1',
            },
            credentials: 'include',
            body: JSON.stringify(body),
          });

          if (resp.status === 201) {
            console.log('[cazary.ai] executeMessage: ✅ enviado vía Voyager API');
            return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
              action: 'message', success: true, method: 'voyager_api',
              lead_id: leadId, campaign_id: campaignId, message_text: text,
            }});
          }
          if (resp.status === 429) {
            console.warn('[cazary.ai] executeMessage: Voyager API rate limit');
            return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
              action: 'message', success: false, reason: 'rate_limit',
              lead_id: leadId, campaign_id: campaignId,
            }});
          }
          console.warn(`[cazary.ai] executeMessage: Voyager API ${resp.status} → fallback DOM`);
        } catch (apiErr) {
          console.warn('[cazary.ai] executeMessage: Voyager API excepción → fallback DOM', apiErr.message);
        }
      }
    }

    // ── ETAPA B/C: DOM (LinkedIn o SalesNav) ─────────────────────────────────
    window.scrollTo({ top: 200, behavior: 'smooth' });
    await sleepMicro();

    const msgBtnSel = getSelector(platform, 'message', 'message_btn',
      'button[aria-label*="Mensaje"], button[aria-label*="Message"], button[aria-label*="InMail"]');
    let msgBtn = null;
    for (let i = 0; i < 4; i++) {
      msgBtn = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .filter(el => el.offsetParent !== null)
        .find(el => {
          const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'mensaje'   || t === 'message'  || t === 'inmail' ||
                 t.includes('enviar mensaje') || t.includes('send message') ||
                 label.includes('mensaje')   || label.includes('message') ||
                 label.includes('inmail');
        }) ?? document.querySelector(msgBtnSel) ?? null;
      if (msgBtn) break;
      await sleep(700);
    }

    if (!msgBtn) {
      reportSelectorFailure(platform, 'message', 'message_btn', msgBtnSel,
        document.querySelector('.pvs-profile-actions, .profile-topcard__actions')?.innerHTML
        ?? document.body.innerHTML.substring(0, 3000));
      console.warn('[cazary.ai][SelectorHealing] selector_failure: message_btn');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'message', success: false, reason: 'button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(msgBtn);
    await sleepNav();

    // ── Localizar el campo de escritura ──────────────────────────────────────
    let inputEl = null;
    let isContentEditable = false;

    const msgFieldSel = platform === 'salesnav'
      ? getSelector('salesnav', 'message', 'message_field',
          'textarea.message-anywhere-compose-box__msg-body, .compose-message__textarea, [data-test-compose-message-textarea], textarea[placeholder*="mensaje"], textarea[placeholder*="message"]')
      : getSelector('linkedin', 'message', 'message_field',
          '.msg-form__contenteditable[contenteditable="true"], [role="textbox"][data-placeholder], [data-artdeco-is-focused][contenteditable="true"]');

    for (let i = 0; i < 6; i++) {
      if (platform === 'linkedin') {
        inputEl = document.querySelector(
          '.msg-form__contenteditable[contenteditable="true"],' +
          '[role="textbox"][contenteditable="true"],' +
          '[data-artdeco-is-focused][contenteditable="true"],' +
          '.msg-form__msg-content-container [contenteditable="true"]'
        ) ?? document.querySelector(msgFieldSel) ?? null;
        if (inputEl) { isContentEditable = true; break; }
      } else {
        inputEl = document.querySelector(
          'textarea.message-anywhere-compose-box__msg-body,' +
          '.compose-message__textarea,' +
          '[data-test-compose-message-textarea],' +
          '.inmail-compose-form textarea,' +
          'textarea[placeholder*="mensaje"],' +
          'textarea[placeholder*="message"]'
        ) ?? document.querySelector(msgFieldSel)
          ?? document.querySelector('textarea:not([disabled])') ?? null;
        if (inputEl) break;
      }
      await sleep(600);
    }

    if (!inputEl) {
      reportSelectorFailure(platform, 'message', 'message_field', msgFieldSel,
        document.querySelector('.msg-overlay-conversation-bubble, .compose-message, [class*="compose"]')?.innerHTML
        ?? document.body.innerHTML.substring(0, 3000));
      console.warn('[cazary.ai][SelectorHealing] selector_failure: message_field');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'message', success: false, reason: 'input_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    // ── Escribir el mensaje humanizado ───────────────────────────────────────
    if (isContentEditable) {
      await typeHumanContenteditable(inputEl, text);
    } else {
      await typeHuman(inputEl, text, true);
    }
    await sleepHuman();

    // ── Buscar y clickar el botón Enviar ─────────────────────────────────────
    const msgSendBtnSel = getSelector(platform, 'message', 'message_send_btn',
      'button[aria-label*="Enviar"], button[aria-label*="Send message"]');
    let sendBtn = null;
    for (let i = 0; i < 5; i++) {
      sendBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(el => el.offsetParent !== null && !el.disabled)
        .find(el => {
          const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'enviar' || t === 'send' ||
                 label.includes('enviar') || label.includes('send message');
        }) ?? document.querySelector(msgSendBtnSel) ?? null;
      if (sendBtn) break;
      await sleep(400);
    }

    if (sendBtn && !sendBtn.disabled) {
      simulateClick(sendBtn);
    } else {
      if (!sendBtn) {
        reportSelectorFailure(platform, 'message', 'message_send_btn', msgSendBtnSel,
          document.querySelector('.msg-overlay-conversation-bubble, .compose-message')?.innerHTML
          ?? document.body.innerHTML.substring(0, 2000));
        console.warn('[cazary.ai][SelectorHealing] selector_failure: message_send_btn — fallback Enter');
      }
      inputEl.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', keyCode: 13, bubbles: true,
        metaKey: platform === 'salesnav',
      }));
    }

    await sleepHuman();

    // ── Verificar envío: el campo debe quedar vacío ───────────────────────────
    const sentOk = isContentEditable
      ? (inputEl.innerText || inputEl.textContent || '').trim() === ''
      : inputEl.value.trim() === '';

    if (!sentOk) {
      console.warn('[cazary.ai] executeMessage: campo no vacío tras send → reintentando Enter');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', keyCode: 13, bubbles: true,
      }));
      await sleep(1200);
    }

    console.log(`[cazary.ai] executeMessage: ✅ mensaje enviado platform=${platform}`);
    return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'message', success: true, method: 'dom',
      lead_id: leadId, campaign_id: campaignId, message_text: text,
    }});
  }

  // ── ACCIÓN 3b: CHECK NETWORK UPDATES (batch via Voyager API) ────────────

  async function executeCheckNetworkUpdates(taskId, workspaceId) {
    console.log('[cazary.ai] executeCheckNetworkUpdates: inicio batch check vía Voyager API');
    await sleep(1500 + Math.random() * 1000);

    try {
      const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)/);
      const csrf = csrfMatch ? csrfMatch[1] : '';
      if (!csrf) {
        console.warn('[cazary.ai] checkNetworkUpdates: sin CSRF token');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'check_network_updates', success: false, reason: 'no_csrf',
        }});
      }

      const headers = {
        'csrf-token':                csrf,
        'x-restli-protocol-version': '2.0.0',
        'x-li-lang':                 'es_ES',
        'accept':                    'application/vnd.linkedin.normalized+json+2.1',
      };

      // ── LLAMADA 1: Invitaciones enviadas pendientes ──────────────────────────
      let pendingProfileIds = new Set();
      let pendingUrns = new Set();

      for (let start = 0; start <= 40; start += 40) {
        const sentUrl = `https://www.linkedin.com/voyager/api/relationships/invitations` +
          `?invitationType=SENT&start=${start}&count=40`;

        const sentRes = await fetchWithTimeout(sentUrl, { headers }, 10000).catch(() => null);
        if (!sentRes || !sentRes.ok) break;

        const sentData = await sentRes.json().catch(() => null);
        if (!sentData) break;

        const elements = sentData?.elements ?? sentData?.data?.elements ?? [];
        const included = sentData?.included ?? [];

        for (const el of elements) {
          const toMember = el.toMember ?? el.invitee;
          const profileId = toMember?.profileId ??
            (toMember?.['com.linkedin.voyager.growth.invitation.InviteeProfile']?.profileId);
          if (profileId) pendingProfileIds.add(profileId);

          const urn = el.entityUrn ?? toMember?.entityUrn ?? '';
          if (urn) pendingUrns.add(urn);
        }

        for (const inc of included) {
          if (inc.entityUrn && inc.entityUrn.includes('fsd_profile')) {
            const m = inc.entityUrn.match(/fsd_profile:([A-Za-z0-9_-]+)/);
            if (m) pendingProfileIds.add(m[1]);
          }
          if (inc.profileId) pendingProfileIds.add(inc.profileId);
        }

        if (elements.length < 40) break;
      }

      console.log(`[cazary.ai] checkNetworkUpdates: ${pendingProfileIds.size} invitaciones pendientes`);

      // ── LLAMADA 2: Conexiones recientes ─────────────────────────────────────
      let recentConnectionIds = new Set();
      let recentConnectionNames = [];

      const connUrl = `https://www.linkedin.com/voyager/api/relationships/connections` +
        `?count=40&start=0&sortType=RECENTLY_ADDED`;

      const connRes = await fetchWithTimeout(connUrl, { headers }, 10000).catch(() => null);
      if (connRes && connRes.ok) {
        const connData = await connRes.json().catch(() => null);
        const connElements = connData?.elements ?? connData?.data?.elements ?? [];
        const connIncluded = connData?.included ?? [];

        for (const el of connElements) {
          const profileId = el.miniProfile?.publicIdentifier ?? el.profileId;
          if (profileId) recentConnectionIds.add(profileId);
          if (el.miniProfile) {
            recentConnectionNames.push({
              profileId: el.miniProfile.publicIdentifier ?? '',
              entityUrn: el.miniProfile.entityUrn ?? '',
              firstName: el.miniProfile.firstName ?? '',
              lastName:  el.miniProfile.lastName ?? '',
            });
          }
        }
        for (const inc of connIncluded) {
          if (inc.entityUrn && inc.entityUrn.includes('fsd_profile')) {
            const m = inc.entityUrn.match(/fsd_profile:([A-Za-z0-9_-]+)/);
            if (m) recentConnectionIds.add(m[1]);
          }
          if (inc.publicIdentifier) recentConnectionIds.add(inc.publicIdentifier);
        }
      }

      console.log(`[cazary.ai] checkNetworkUpdates: ${recentConnectionIds.size} conexiones recientes`);

      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action:              'check_network_updates',
        success:             true,
        pendingProfileIds:   Array.from(pendingProfileIds),
        pendingUrns:         Array.from(pendingUrns),
        recentConnectionIds: Array.from(recentConnectionIds),
        recentConnections:   recentConnectionNames,
        workspace_id:        workspaceId,
      }});

    } catch (err) {
      console.error('[cazary.ai] checkNetworkUpdates error:', err);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'check_network_updates', success: false, reason: err.message,
      }});
    }
  }

  // ── ACCIÓN 4: CHECK CONNECTION STATUS ────────────────────────────────────

  async function executeCheckConnection(taskId, leadId, campaignId) {
    const platform = getPlatform();
    await sleep(2000);

    const connected = isFirstDegreeConnection();
    const pending   = isPendingConnection();

    console.log(`[cazary.ai] checkConnection platform=${platform} connected=${connected} pending=${pending}`);
    safeSendMessage({
      type: 'ACTION_DONE', taskId,
      result: {
        action: 'check_connection', success: true,
        connected, pending,
        lead_id: leadId, campaign_id: campaignId,
      },
    });
  }

  // ── ACCIÓN 5: FOLLOW ──────────────────────────────────────────────────────

  async function executeFollow(taskId, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[cazary.ai] executeFollow platform=${platform} leadId=${leadId}`);

    try {
      await sleepHuman();

      // ── Verificar si ya seguimos (evitar doble follow) ────────────────────
      const alreadyFollowing =
        !!document.querySelector('button[aria-label^="Dejar de seguir"]') ||
        !!Array.from(document.querySelectorAll('button, [role="button"]')).find(el => {
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return t === 'siguiendo' || t === 'following';
        });

      if (alreadyFollowing) {
        console.log('[cazary.ai] executeFollow: ya seguimos a este contacto → skip');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'follow', success: true, reason: 'already_following',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      // ── Estrategia A: botón directo en el perfil (aria-label estable) ────
      let followBtn =
        document.querySelector('button[aria-label^="Seguir a"]') ??
        document.querySelector('button[aria-label^="Follow "]') ??
        null;

      // ── Estrategia B: buscar por texto en botones visibles ───────────────
      if (!followBtn) {
        followBtn = Array.from(document.querySelectorAll('button, [role="button"]'))
          .filter(el => el.offsetParent !== null)
          .find(el => {
            const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            return t === 'seguir' || t === 'follow' ||
                   label.startsWith('seguir a') || label.startsWith('follow ');
          }) ?? null;
      }

      // ── Estrategia C: menú "..." ──────────────────────────────────────────
      if (!followBtn) {
        const opened = await clickMoreButton();
        if (opened) {
          await sleepHuman();
          if (platform === 'salesnav') {
            followBtn =
              Array.from(document.querySelectorAll('button.ember-view._item_1xnv7i'))
                .find(b => {
                  const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                  return t === 'seguir' || t === 'follow';
                }) ??
              findMenuItemByText('seguir', 'follow');
          } else {
            followBtn = findMenuItemByText('seguir', 'follow');
          }
        }
      }

      if (!followBtn) {
        console.warn('[cazary.ai] executeFollow: botón no encontrado');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'follow', success: false, reason: 'button_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      simulateClick(followBtn);
      await sleepHuman();

      const nowFollowing =
        !!document.querySelector('button[aria-label^="Dejar de seguir"]') ||
        !!Array.from(document.querySelectorAll('button, [role="button"]')).find(el => {
          const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'siguiendo' || t === 'following' ||
                 label.startsWith('dejar de seguir') || label.startsWith('unfollow');
        });

      if (!nowFollowing) {
        console.warn('[cazary.ai] executeFollow: botón no cambió a "Siguiendo" tras click');
      }

      console.log('[cazary.ai] executeFollow: ✅ follow completado');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'follow', success: true, reason: 'followed',
        lead_id: leadId, campaign_id: campaignId,
      }});

    } catch (err) {
      console.error('[cazary.ai] executeFollow error:', err);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'follow', success: false, reason: err.message ?? 'unknown_error',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }
  }

  // ── ACCIÓN 5b: UNFOLLOW ───────────────────────────────────────────────────

  async function executeUnfollow(taskId, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[cazary.ai] executeUnfollow platform=${platform} leadId=${leadId}`);

    try {
      await sleepHuman();

      // ── Estrategia A: botón directo "Dejar de seguir" (aria-label estable) ──
      let unfollowBtn =
        document.querySelector('button[aria-label^="Dejar de seguir"]') ??
        document.querySelector('button[aria-label^="Unfollow "]') ??
        null;

      // ── Estrategia B: menú "..." → "Dejar de seguir" ─────────────────────
      if (!unfollowBtn) {
        const opened = await clickMoreButton();
        if (!opened) {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'unfollow', success: false, reason: 'more_button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        await sleepHuman();

        if (platform === 'salesnav') {
          unfollowBtn =
            Array.from(document.querySelectorAll('button.ember-view._item_1xnv7i'))
              .find(b => {
                const t = (b.innerText || b.textContent || '').trim().toLowerCase();
                return t === 'dejar de seguir' || t === 'unfollow' || t === 'stop following';
              }) ??
            findMenuItemByText('dejar de seguir', 'unfollow', 'stop following');
        } else {
          unfollowBtn = findMenuItemByText('dejar de seguir', 'unfollow', 'stop following');
        }
      }

      if (!unfollowBtn) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const notFollowing =
          !!document.querySelector('button[aria-label^="Seguir a"]') ||
          !!document.querySelector('button[aria-label^="Follow "]');
        if (notFollowing) {
          console.log('[cazary.ai] executeUnfollow: no seguíamos a este contacto → skip');
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'unfollow', success: true, reason: 'already_not_following',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.warn('[cazary.ai] executeUnfollow: botón no encontrado');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'unfollow', success: false, reason: 'button_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      simulateClick(unfollowBtn);
      await sleepHuman();

      const nowNotFollowing =
        !!document.querySelector('button[aria-label^="Seguir a"]') ||
        !!document.querySelector('button[aria-label^="Follow "]') ||
        !!Array.from(document.querySelectorAll('button')).find(el => {
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return t === 'seguir' || t === 'follow';
        });

      console.log(`[cazary.ai] executeUnfollow: ✅ unfollow completado, verificado=${nowNotFollowing}`);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'unfollow', success: true, reason: 'unfollowed',
        lead_id: leadId, campaign_id: campaignId,
      }});

    } catch (err) {
      console.error('[cazary.ai] executeUnfollow error:', err);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'unfollow', success: false, reason: err.message ?? 'unknown_error',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }
  }

  // ── ACCIÓN 6: DISCONNECT ──────────────────────────────────────────────────

  async function executeDisconnect(taskId, leadId, campaignId) {
    console.log('[cazary.ai] executeDisconnect');
    await sleep(2000);

    const opened = await clickMoreButton();
    if (!opened) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'disconnect', success: false, reason: 'more_button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    const disconnectItem = findMenuItemByText(
      'eliminar conexión', 'remove connection', 'desconectar', 'disconnect'
    );
    if (!disconnectItem) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'disconnect', success: false, reason: 'item_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(disconnectItem);
    await sleep(800);

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.innerText || '').trim().toLowerCase();
      return t.includes('eliminar') || t.includes('remove') || t.includes('confirmar');
    });
    if (confirmBtn) {
      simulateClick(confirmBtn);
      await sleep(600);
    }

    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'disconnect', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
  }

  // ── ACCIÓN 7: LIKE POST ───────────────────────────────────────────────────

  async function executeLikePost(taskId, leadId, campaignId, profileUrl) {
    console.log('[cazary.ai] executeLikePost: inicio', { leadId, profileUrl });

    // ── 1. Construir URL de actividad reciente ────────────────────────────────
    let activityUrl = null;

    const liMatch = (profileUrl ?? '').match(/linkedin\.com\/in\/([^/?#]+)/);
    if (liMatch) {
      const username = liMatch[1].replace(/\/$/, '');
      activityUrl = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
    }

    if (!activityUrl) {
      const snMatch = (profileUrl ?? '').match(
        /linkedin\.com\/sales\/(?:lead|people)\/([A-Za-z0-9_-]+)/
      );
      if (snMatch) {
        const entityId = snMatch[1].split(',')[0];
        const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)/);
        const csrf = csrfMatch ? csrfMatch[1] : '';

        if (csrf && entityId.startsWith('ACw')) {
          try {
            const resolveUrl = `https://www.linkedin.com/voyager/api/identity/profiles` +
              `?memberIdentity=${entityId}&count=1`;
            const res = await fetchWithTimeout(resolveUrl, {
              headers: {
                'csrf-token':                csrf,
                'x-restli-protocol-version': '2.0.0',
                'accept':                    'application/vnd.linkedin.normalized+json+2.1',
              },
            }, 8000).catch(() => null);
            if (res && res.ok) {
              const data = await res.json().catch(() => null);
              const pi = data?.elements?.[0]?.miniProfile?.publicIdentifier
                ?? data?.included?.[0]?.publicIdentifier;
              if (pi) activityUrl = `https://www.linkedin.com/in/${pi}/recent-activity/all/`;
            }
          } catch (_) { /* continuar sin resolución */ }
        }
      }
    }

    if (!activityUrl) {
      console.warn('[cazary.ai] executeLikePost: no se pudo construir activityUrl', profileUrl);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'like', success: false, reason: 'cannot_build_activity_url',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    // ── 2. Navegar a la página de actividad reciente ──────────────────────────
    console.log('[cazary.ai] executeLikePost: navegando a', activityUrl);
    window.location.href = activityUrl;

    let pageReady = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (window.location.href.includes('/recent-activity/')) {
        pageReady = true;
        break;
      }
    }
    if (!pageReady) {
      console.warn('[cazary.ai] executeLikePost: página no cargó en 15s');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'like', success: false, reason: 'page_load_timeout',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    await sleep(2500 + Math.random() * 1000);

    // ── 3. Scroll suave para simular comportamiento humano ────────────────────
    window.scrollTo({ top: 300, behavior: 'smooth' });
    await sleep(800 + Math.random() * 400);

    // ── 4. Buscar el primer post NO likeado ──────────────────────────────────
    const findUnlikedButton = () => {
      // Estrategia A: selector directo (más fiable — Ember.js, página de actividad)
      // "Recomendar" es el nombre real del botón Like en español (auditado 2026-06-18)
      const direct = document.querySelector(
        'button[aria-label="Recomendar"][aria-pressed="false"],' +
        'button[aria-label="Like"][aria-pressed="false"],' +
        'button[aria-label="Me gusta"][aria-pressed="false"]'
      );
      if (direct && direct.offsetParent !== null) return direct;

      // Estrategia B: búsqueda amplia por aria-label
      const allButtons = Array.from(document.querySelectorAll(
        'button[aria-label], [role="button"][aria-label]'
      ));
      const likeBtn = allButtons.find(btn => {
        const label   = (btn.getAttribute('aria-label') ?? '').toLowerCase();
        const pressed = btn.getAttribute('aria-pressed');
        const isLiked = pressed === 'true'
          || label.includes('ya me gusta')
          || label.includes('unlike')
          || label.includes('quitar me gusta')
          || btn.classList.contains('active')
          || btn.classList.contains('react--active');
        if (isLiked) return false;
        return label === 'recomendar'       // ← ES: nombre real en actividad
          || label === 'me gusta'           // ← ES: variante
          || label === 'like'               // ← EN
          || label.includes('recomendar')   // ← ES: coincidencia parcial
          || label.includes('me gusta')
          || label.includes('like')
          || label.includes('react')
          || label.includes('reaccionar');
      });
      if (likeBtn) return likeBtn;

      // Estrategia C: clases artdeco estables (Ember.js — muy confiables)
      const artdecoBtns = document.querySelectorAll(
        '.artdeco-button.artdeco-button--3:not([aria-pressed="true"]),' +
        '.react-button__trigger:not(.active),' +
        '[class*="react-button"]:not([aria-pressed="true"]),' +
        '[data-test-id*="social-action"]:not([aria-pressed="true"])'
      );
      for (const btn of artdecoBtns) {
        const txt   = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (txt === 'recomendar' || txt === 'me gusta' || txt === 'like'
            || txt === 'reaccionar'
            || label === 'recomendar' || label === 'me gusta') return btn;
      }
      return null;
    };

    let likeButton = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      likeButton = findUnlikedButton();
      if (likeButton) break;
      console.log(`[cazary.ai] executeLikePost: intento ${attempt + 1} sin botón, scrolling...`);
      window.scrollTo({ top: 400 + attempt * 300, behavior: 'smooth' });
      await sleep(1500 + Math.random() * 500);
    }

    if (!likeButton) {
      console.warn('[cazary.ai] executeLikePost: no se encontró botón de Like en actividad reciente');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'like', success: false, reason: 'no_like_button_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    // ── 5. Scroll al botón y click humanizado ─────────────────────────────────
    likeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(600 + Math.random() * 300);

    console.log('[cazary.ai] executeLikePost: haciendo click en Like');
    simulateClick(likeButton);
    await sleep(1200 + Math.random() * 500);

    // ── 6. Verificar efectividad ──────────────────────────────────────────────
    const likeConfirmed = (() => {
      const pressed = likeButton.getAttribute('aria-pressed');
      const label   = (likeButton.getAttribute('aria-label') ?? '').toLowerCase();
      return pressed === 'true'
        || label.includes('ya me gusta')
        || label.includes('unlike')
        || likeButton.classList.contains('active')
        || likeButton.classList.contains('react--active');
    })();

    if (!likeConfirmed) {
      console.log('[cazary.ai] executeLikePost: like no confirmado, reintentando...');
      const picker = document.querySelector(
        '[class*="reactions-picker"], [class*="reaction-picker"], [class*="emoji-picker"]'
      );
      if (picker) {
        const likeInPicker = Array.from(picker.querySelectorAll('button, [role="button"]'))
          .find(b => {
            const label = (b.getAttribute('aria-label') ?? '').toLowerCase();
            return label === 'me gusta' || label === 'like';
          });
        if (likeInPicker) {
          simulateClick(likeInPicker);
          await sleep(1000);
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(500);
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'like', success: false, reason: 'like_not_confirmed',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
      } else {
        simulateClick(likeButton);
        await sleep(1000);
      }
    }

    console.log('[cazary.ai] executeLikePost: ✅ Like exitoso');
    return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action:      'like',
      success:     true,
      reason:      'liked_from_activity_tab',
      lead_id:     leadId,
      campaign_id: campaignId,
    }});
  }

  // ── ACCIÓN 8: COMMENT ON POST ─────────────────────────────────────────────

  async function executeCommentPost(taskId, text, leadId, campaignId) {
    console.log('[cazary.ai] executeCommentPost');
    await sleep(2000);

    const commentBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const t     = (b.innerText || '').trim().toLowerCase();
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('comentar') || t.includes('comment') ||
             label.includes('comentar') || label.includes('comment');
    });

    if (!commentBtn) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'comment', success: false, reason: 'comment_button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(commentBtn);
    await sleep(1200);

    const commentBox = document.querySelector(
      '.comments-comment-texteditor [contenteditable="true"], ' +
      '.ql-editor[contenteditable="true"], ' +
      '[data-placeholder*="comentario"], [data-placeholder*="comment"]'
    );

    if (!commentBox) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'comment', success: false, reason: 'comment_box_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    commentBox.focus();
    document.execCommand('insertText', false, text);
    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(600);

    const submitBtn = document.querySelector(
      'button.comments-comment-texteditor__submitButton, ' +
      'button[type="submit"][class*="comment"]'
    );
    if (submitBtn && !submitBtn.disabled) {
      simulateClick(submitBtn);
    } else {
      commentBox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })
      );
    }

    await sleep(800);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'comment', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
  }

  // ── ACCIONES AUXILIARES ───────────────────────────────────────────────────

  async function executeCheckInbox(taskId, campaignId) {
    await sleep(2500);

    const isSalesNav = window.location.href.includes('/sales/inbox') ||
                       window.location.href.includes('/sales/messaging');

    console.log(`[cazary.ai] checkInbox isSalesNav=${isSalesNav}`);

    if (isSalesNav) {
      return await checkSalesNavInbox(taskId, campaignId);
    } else {
      return await checkLinkedInInbox(taskId, campaignId);
    }
  }

  async function checkLinkedInInbox(taskId, campaignId) {
    const container = document.querySelector('.msg-conversations-container__conversations-list');
    if (container) {
      container.scrollTop = 0;
      await sleep(500);
    }

    const convSelectors = [
      '.msg-conversations-container__convo-item',
      '[data-test-li="msg-conversation-list-item"]',
      '.msg-conversation-list__list-item',
      'li[class*="conversation-list"]',
    ];

    let convItems = [];
    for (const sel of convSelectors) {
      convItems = Array.from(document.querySelectorAll(sel));
      if (convItems.length) { console.log(`[cazary.ai] LI inbox selector: ${sel} → ${convItems.length} convs`); break; }
    }

    const unreadConvs = convItems.filter(el =>
      el.querySelector('.notification-badge, .msg-conversation-listitem__unread-count, [data-test-unread-count], .artdeco-notification-badge') !== null ||
      el.classList.contains('msg-conversation-list__list-item--is-unread') ||
      el.querySelector('[aria-label*="unread"], [aria-label*="no leído"]') !== null
    );

    const results = [];
    for (const conv of unreadConvs.slice(0, 8)) {
      const name = (
        conv.querySelector('.msg-conversation-listitem__participant-names, .artdeco-entity-lockup__title')
      )?.innerText?.trim() ?? '';
      const preview = (
        conv.querySelector('.msg-conversation-listitem__message-snippet, [data-test-message-snippet]')
      )?.innerText?.trim() ?? '';
      const profileLink = conv.querySelector('a[href*="/in/"]');
      const profileUrl  = profileLink?.href?.split('?')[0] ?? null;
      const timeEl = conv.querySelector('time');
      const timestamp = timeEl?.getAttribute('datetime') ?? new Date().toISOString();
      if (name) results.push({ name, preview, profileUrl, timestamp, source: 'linkedin' });
    }

    console.log(`[cazary.ai] LI inbox: ${unreadConvs.length} unread, ${results.length} procesando`);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'check_inbox', success: true,
      unreadCount: unreadConvs.length,
      conversations: results,
      campaign_id: campaignId,
      source: 'linkedin',
    }});
  }

  async function checkSalesNavInbox(taskId, campaignId) {
    await sleep(1000);

    const convSelectors = [
      // SalesNav Ember.js — selectores reales
      '[data-view-name*="conversation"]',
      '[data-x--conversation-list-item]',
      '.conversation-list-item',
      '[class*="conversation-list__item"]',
      '[class*="msg-list__item"]',
      // Fallback genérico
      'li[class*="conversation"]',
      'li[class*="thread"]',
    ];

    let convItems = [];
    for (const sel of convSelectors) {
      convItems = Array.from(document.querySelectorAll(sel));
      if (convItems.length) { console.log(`[cazary.ai] SN inbox selector: ${sel} → ${convItems.length}`); break; }
    }

    if (!convItems.length) {
      console.warn('[cazary.ai] SalesNav inbox: no conversations found. DOM sample:',
        document.body.innerHTML.slice(0, 400));
    }

    const unreadConvs = convItems.filter(el => {
      const cls = el.className || '';
      const hasUnreadClass = cls.includes('unread') || cls.includes('is-new');
      const hasUnreadBadge = !!el.querySelector(
        '[class*="unread"], [class*="badge"], [class*="notification"], ' +
        '[aria-label*="no leído"], [aria-label*="unread"], [aria-label*="new message"]'
      );
      return hasUnreadClass || hasUnreadBadge;
    });

    const results = [];
    for (const conv of (unreadConvs.length ? unreadConvs : convItems).slice(0, 8)) {
      const nameEl = conv.querySelector(
        '[data-anonymize="person-name"], .conversation-list-item__title, ' +
        '.artdeco-entity-lockup__title, [class*="sender-name"]'
      );
      const previewEl = conv.querySelector(
        '[class*="message-preview"], [class*="snippet"], .conversation-list-item__message, ' +
        '[data-test-message-snippet]'
      );
      const profileLink = conv.querySelector('a[href*="/sales/lead/"]');

      const name       = nameEl?.innerText?.trim() ?? '';
      const preview    = previewEl?.innerText?.trim() ?? '';
      const profileUrl = profileLink?.href?.split('?')[0] ?? null;
      const timestamp  = new Date().toISOString();

      if (name) results.push({ name, preview, profileUrl, timestamp, source: 'salesnav' });
    }

    console.log(`[cazary.ai] SN inbox: ${unreadConvs.length} unread, ${results.length} procesando`);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'check_inbox', success: true,
      unreadCount: unreadConvs.length,
      conversations: results,
      campaign_id: campaignId,
      source: 'salesnav',
    }});
  }

  async function executeCountLeads(taskId, campaignId, segmentId) {
    await sleep(3000);

    let count = 0;
    const selectors = [
      '.search-results-container .pb2 h2',
      '.search-results__total',
      '[data-total-count]',
      '.artdeco-card h2',
      '.search-results__total-results',
      '.list-header-count',
      '[data-anonymize="result-count"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const m = (el.innerText || el.textContent || '').match(/([\d,.]+)/);
        if (m) { count = parseInt(m[1].replace(/[,.]/g, ''), 10); break; }
      }
    }

    if (!count) {
      const bodyText = document.body.innerText || '';
      const patterns = [/Aproximadamente\s+([\d,.]+)/i, /About\s+([\d,.]+)/i, /([\d,.]+)\s+resultado/i, /([\d,.]+)\s+result/i];
      for (const pat of patterns) {
        const m = bodyText.match(pat);
        if (m) { count = parseInt(m[1].replace(/[,.]/g, ''), 10); break; }
      }
    }

    safeSendMessage({ type: 'COUNT_RESULT', campaignId, segmentId, count });
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: { action: 'count_leads', count, campaign_id: campaignId } });
  }

  async function executeExtractProfile(taskId, leadId) {
    await sleep(3000 + Math.random() * 2000);
    window.scrollTo({ top: 400, behavior: 'smooth' });
    await sleep(1500);

    const profile = isSalesNavigator() ? extractSalesNavProfile() : extractLinkedInProfile();

    safeSendMessage({ type: 'PROFILE_EXTRACTED', data: { ...profile, lead_id: leadId } });
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: { action: 'extract_profile', success: true, lead_id: leadId } });
  }

  async function executePostLinkedIn(taskId, content) {
    if (!content) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'post_linkedin', success: false, reason: 'empty_content' } });
      return;
    }

    try {
      // 1. Click "Comenzar una publicación"
      const startSelectors = [
        'button.share-box-feed-entry__trigger',
        '[data-control-name="share.feedshare_native_share_button"]',
        'button[class*="share-box"][class*="trigger"]',
        '.share-box-feed-entry__top-bar button',
      ];
      let startBtn = null;
      for (const sel of startSelectors) {
        startBtn = document.querySelector(sel);
        if (startBtn) break;
      }
      if (!startBtn) {
        const btns = Array.from(document.querySelectorAll('button'));
        startBtn = btns.find(b => {
          const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
          return txt.includes('publicación') || txt.includes('publicar') ||
                 txt.includes('empezar') || txt.includes('start a post') ||
                 txt.includes('create a post');
        });
      }
      if (!startBtn) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'post_linkedin', success: false, reason: 'start_button_not_found' } });
        return;
      }
      simulateClick(startBtn);
      await sleep(2500);

      // 2. Esperar el editor
      const editorSelectors = [
        '.ql-editor[contenteditable="true"]',
        '.share-creation-state__text-editor .ql-editor',
        '[data-placeholder][contenteditable="true"]',
        '.mentions-texteditor__contenteditable',
        '[contenteditable="true"][class*="editor"]',
      ];
      let editor = null;
      for (let i = 0; i < 10; i++) {
        for (const sel of editorSelectors) {
          editor = document.querySelector(sel);
          if (editor && editor.offsetParent) break;
        }
        if (editor && editor.offsetParent) break;
        await sleep(500);
      }
      if (!editor) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'post_linkedin', success: false, reason: 'editor_not_found' } });
        return;
      }

      // 3. Escribir el contenido
      editor.focus();
      editor.click();
      await sleep(300);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) document.execCommand('insertText', false, lines[i]);
        if (i < lines.length - 1) document.execCommand('insertParagraph', false, null);
      }
      editor.dispatchEvent(new Event('input',  { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(1500);

      // 4. Click "Publicar"
      const publishSelectors = [
        'button.share-actions__primary-action',
        'button[class*="share-actions__primary"]',
        '.share-box__actions button.primary',
        '.share-creation-state__footer button[class*="primary"]',
      ];
      let publishBtn = null;
      for (const sel of publishSelectors) {
        publishBtn = document.querySelector(sel);
        if (publishBtn && publishBtn.offsetParent && !publishBtn.disabled) break;
      }
      if (!publishBtn) {
        const modal = document.querySelector(
          '.share-creation-state, .share-box, [class*="share-modal"], [role="dialog"]'
        );
        if (modal) {
          const btns = Array.from(modal.querySelectorAll('button'));
          publishBtn = btns.find(b => {
            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return (txt === 'publicar' || txt === 'post' || txt === 'siguiente' ||
                    txt === 'publish') && !b.disabled;
          });
        }
      }
      if (!publishBtn) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'post_linkedin', success: false, reason: 'publish_button_not_found' } });
        return;
      }
      simulateClick(publishBtn);
      await sleep(3000);

      // 5. Verificar que el modal se cerró
      const modalStillOpen = document.querySelector(
        '.share-creation-state, [class*="share-box"][class*="open"]'
      );
      const success = !modalStillOpen;
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'post_linkedin', success, reason: success ? 'published' : 'modal_still_open' } });

    } catch (err) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'post_linkedin', success: false, reason: err.message ?? 'unknown_error' } });
    }
  }

  async function executeWithdraw(taskId, leadId) {
    try {
      await sleepHuman();
      const platform = getPlatform();
      console.log(`[cazary.ai] executeWithdraw platform=${platform} leadId=${leadId}`);

      // ── ETAPA A: Voyager API DELETE (0 page views) ────────────────────────
      const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';

      const currentUrl  = window.location.href;
      const liSlug      = currentUrl.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1]?.replace(/\/$/, '');
      const snEntityId  = currentUrl.match(/\/sales\/lead\/([^,?#]+)/)?.[1] ?? null;

      let invitationId = null;

      if (liSlug || snEntityId) {
        try {
          const pages = [
            `/voyager/api/relationships/invitations?invitationType=SENT&start=0&count=40`,
            `/voyager/api/relationships/invitations?invitationType=SENT&start=40&count=40`,
          ];

          for (const url of pages) {
            const resp = await fetch(url, {
              headers: {
                'csrf-token':                csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'accept':                    'application/vnd.linkedin.normalized+json+2.1',
              },
              credentials: 'include',
            });
            if (!resp.ok) break;

            const data     = await resp.json();
            const elements = data?.elements ?? [];

            for (const inv of elements) {
              const toId   = inv.toMember?.profileId ?? '';
              const toSlug = inv.toMember?.miniProfile?.publicIdentifier ?? '';

              const matchLI = liSlug && (toSlug === liSlug || toId === liSlug);
              const matchSN = snEntityId && (toId === snEntityId || toSlug === snEntityId);

              if (matchLI || matchSN) {
                invitationId = inv.id;
                console.log(`[cazary.ai] executeWithdraw: invitationId encontrado: ${invitationId}`);
                break;
              }
            }
            if (invitationId) break;

            const total = data?.paging?.total ?? 0;
            if (elements.length < 40 || total <= 40) break;
          }
        } catch (apiErr) {
          console.warn('[cazary.ai] executeWithdraw: error buscando invitations →', apiErr.message);
        }
      }

      if (invitationId) {
        try {
          await sleepMicro();
          const delResp = await fetch(
            `/voyager/api/relationships/invitations/${encodeURIComponent(invitationId)}`,
            {
              method:  'DELETE',
              headers: {
                'csrf-token':                csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'accept':                    'application/vnd.linkedin.normalized+json+2.1',
              },
              credentials: 'include',
            }
          );

          if (delResp.status === 204 || delResp.status === 200) {
            console.log('[cazary.ai] executeWithdraw: ✅ cancelado vía Voyager API');
            return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
              action: 'withdraw', success: true, reason: 'withdrawn',
              method: 'voyager_api', lead_id: leadId,
            }});
          }
          if (delResp.status === 404) {
            console.log('[cazary.ai] executeWithdraw: invitation ya no existe (404) → success');
            return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
              action: 'withdraw', success: true, reason: 'already_withdrawn',
              method: 'voyager_api', lead_id: leadId,
            }});
          }
          console.warn(`[cazary.ai] executeWithdraw: DELETE devolvió ${delResp.status} → fallback DOM`);
        } catch (delErr) {
          console.warn('[cazary.ai] executeWithdraw: excepción en DELETE →', delErr.message);
        }
      } else {
        console.log('[cazary.ai] executeWithdraw: invitationId no encontrado → fallback DOM');
      }

      // ── ETAPA B: DOM fallback ─────────────────────────────────────────────
      let pendingBtn = null;
      for (let i = 0; i < 4; i++) {
        pendingBtn =
          document.querySelector('button[aria-label="Pendiente"]') ??
          document.querySelector('button[aria-label="Pending"]') ??
          Array.from(document.querySelectorAll('button, [role="button"]'))
            .filter(el => el.offsetParent !== null)
            .find(el => {
              const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
              const label = (el.getAttribute('aria-label') || '').toLowerCase();
              return t === 'pendiente' || t === 'pending' ||
                     label === 'pendiente' || label === 'pending';
            }) ?? null;

        if (pendingBtn) break;
        await sleep(600);
      }

      if (!pendingBtn) {
        const opened = await clickMoreButton();
        if (opened) {
          await sleepHuman();
          pendingBtn = findMenuItemByText(
            'retirar invitación', 'withdraw invitation',
            'retirar', 'withdraw', 'cancelar invitación'
          );
        }
      }

      if (!pendingBtn) {
        const isConnected = !!document.querySelector('a[href*="/messaging/compose/?profileUrn="]') ||
          Array.from(document.querySelectorAll('button')).some(b =>
            (b.innerText || '').trim().toLowerCase() === 'mensaje'
          );
        if (isConnected) {
          console.log('[cazary.ai] executeWithdraw: ya es 1er grado (aceptó) → skip withdraw');
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'withdraw', success: false, reason: 'already_connected',
            lead_id: leadId,
          }});
        }
        console.warn('[cazary.ai] executeWithdraw: botón "Pendiente" no encontrado');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'withdraw', success: false, reason: 'button_not_found',
          method: 'dom', lead_id: leadId,
        }});
      }

      simulateClick(pendingBtn);
      await sleepHuman();

      // Confirm dialog — esperar hasta 4s
      let confirmBtn = null;
      for (let i = 0; i < 8; i++) {
        confirmBtn = Array.from(document.querySelectorAll(
          'button, [role="button"], [role="menuitem"]'
        )).find(b => {
          if (b.disabled || b.offsetParent === null) return false;
          const t     = (b.innerText || b.textContent || '').trim().toLowerCase();
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return t === 'retirar' || t === 'withdraw' ||
                 t === 'confirmar' || t === 'confirm' ||
                 t.includes('retirar invitación') || t.includes('withdraw invitation') ||
                 label.includes('retirar') || label.includes('withdraw');
        }) ?? null;
        if (confirmBtn) break;
        await sleep(400);
      }

      if (confirmBtn) {
        simulateClick(confirmBtn);
        await sleepHuman();
        console.log('[cazary.ai] executeWithdraw: ✅ confirmado vía DOM');
      } else {
        console.log('[cazary.ai] executeWithdraw: sin confirm dialog — asumiendo éxito');
      }

      // Verificar que desapareció el botón "Pendiente"
      await sleep(800);
      const stillPending = !!document.querySelector(
        'button[aria-label="Pendiente"], button[aria-label="Pending"]'
      ) || Array.from(document.querySelectorAll('button')).some(b =>
        ['pendiente', 'pending'].includes((b.innerText || '').trim().toLowerCase())
      );
      if (stillPending) {
        console.warn('[cazary.ai] executeWithdraw: botón "Pendiente" aún visible — posible fallo');
      }

      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'withdraw', success: true, reason: 'withdrawn',
        method: 'dom', lead_id: leadId,
      }});

    } catch (err) {
      console.error('[cazary.ai] executeWithdraw error:', err);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'withdraw', success: false, reason: err.message ?? 'unknown_error',
        lead_id: leadId,
      }});
    }
  }

  async function executeFindEmail(taskId, leadId) {
    try {
      await sleep(1000 + Math.random() * 500);

      // ── 1. Extraer publicIdentifier desde la URL actual ───────────────────
      const currentUrl = window.location.href;
      let publicIdentifier = null;

      const liMatch = currentUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
      if (liMatch) {
        publicIdentifier = liMatch[1].replace(/\/$/, '');
      }

      if (!publicIdentifier) {
        const snMatch = currentUrl.match(/\/sales\/lead\/([^,?#]+)/);
        if (snMatch) {
          const entityId = snMatch[1];
          const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';
          const resolveResp = await fetch(
            `/voyager/api/identity/profiles?memberIdentity=${encodeURIComponent(entityId)}&count=1`,
            {
              headers: {
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
              },
              credentials: 'include',
            }
          );
          if (resolveResp.ok) {
            const resolveData = await resolveResp.json();
            publicIdentifier = resolveData?.elements?.[0]?.miniProfile?.publicIdentifier ?? null;
          }
        }
      }

      // ── 2. Intentar Voyager API profileContactInfo ────────────────────────
      if (publicIdentifier) {
        await sleep(800 + Math.random() * 400);
        const csrfToken = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';
        const apiResp = await fetch(
          `/voyager/api/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileContactInfo`,
          {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/vnd.linkedin.normalized+json+2.1',
            },
            credentials: 'include',
          }
        );

        if (apiResp.ok) {
          const contactData = await apiResp.json();
          const email   = contactData?.emailAddress ?? null;
          const phones  = contactData?.phoneNumbers ?? [];
          const sites   = (contactData?.websites ?? []).map(w => w.url).filter(Boolean);
          const twitter = (contactData?.twitterHandles ?? []).map(t => t.name).filter(Boolean);

          if (email) {
            console.log(`[cazary.ai] executeFindEmail: encontrado vía Voyager API → ${email}`);
            safeSendMessage({
              type: 'ACTION_DONE', taskId,
              result: {
                action: 'find_email',
                success: true,
                lead_id: leadId,
                enrichment_source: 'voyager_api',
                data: {
                  email,
                  phone:    phones[0]?.number ?? null,
                  websites: sites,
                  twitter:  twitter[0] ?? null,
                },
              },
            });
            return;
          }
          console.log('[cazary.ai] executeFindEmail: Voyager API no devolvió email, intentando DOM...');
        } else {
          console.warn(`[cazary.ai] executeFindEmail: Voyager API error ${apiResp.status}, intentando DOM...`);
        }
      }

      // ── 3. Fallback DOM: click en "Información de contacto" ──────────────
      await sleep(1500 + Math.random() * 500);

      const contactLink =
        document.querySelector('a[href*="overlay/contact-info"]') ||
        document.querySelector('a[href*="contact-info"]') ||
        Array.from(document.querySelectorAll('a, button')).find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt === 'información de contacto' || txt === 'contact info';
        });

      if (!contactLink) {
        safeSendMessage({
          type: 'ACTION_DONE', taskId,
          result: {
            action: 'find_email', success: false,
            reason: 'contact_link_not_found',
            enrichment_source: 'dom_contact_overlay',
            lead_id: leadId,
          },
        });
        return;
      }

      simulateClick(contactLink);
      await sleep(2000 + Math.random() * 500);

      const mailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      const foundEmail = mailLinks.length > 0
        ? mailLinks[0].href.replace('mailto:', '').split('?')[0].trim()
        : null;

      const phoneSections = Array.from(document.querySelectorAll(
        'section.pv-contact-info__contact-type, [class*="contact-info"] li'
      ));
      let foundPhone = null;
      for (const sec of phoneSections) {
        const phoneLink = sec.querySelector('a[href^="tel:"]');
        if (phoneLink) {
          foundPhone = phoneLink.href.replace('tel:', '').trim();
          break;
        }
      }

      const closeBtn = document.querySelector(
        'button[aria-label="Descartar"], button[aria-label="Dismiss"],' +
        'button.artdeco-modal__dismiss, [data-test-modal-close-btn]'
      );
      if (closeBtn) simulateClick(closeBtn);

      if (!foundEmail) {
        safeSendMessage({
          type: 'ACTION_DONE', taskId,
          result: {
            action: 'find_email', success: false,
            reason: 'email_not_in_overlay',
            enrichment_source: 'dom_contact_overlay',
            lead_id: leadId,
          },
        });
        return;
      }

      console.log(`[cazary.ai] executeFindEmail: encontrado vía DOM overlay → ${foundEmail}`);
      safeSendMessage({
        type: 'ACTION_DONE', taskId,
        result: {
          action: 'find_email',
          success: true,
          lead_id: leadId,
          enrichment_source: 'dom_contact_overlay',
          data: {
            email: foundEmail,
            phone: foundPhone ?? null,
            websites: [],
            twitter: null,
          },
        },
      });

    } catch (err) {
      console.error('[cazary.ai] executeFindEmail error:', err);
      safeSendMessage({
        type: 'ACTION_DONE', taskId,
        result: {
          action: 'find_email', success: false,
          reason: err.message ?? 'unknown_error',
          enrichment_source: 'error',
          lead_id: leadId,
        },
      });
    }
  }

  async function executeFindPhone(taskId, leadId) {
    try {
      await sleepHuman();
      const platform = getPlatform();
      console.log(`[cazary.ai] executeFindPhone platform=${platform} leadId=${leadId}`);

      // ── ETAPA A: Voyager API ──────────────────────────────────────────────
      const currentUrl = window.location.href;
      const liSlug     = currentUrl.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1]?.replace(/\/$/, '');
      const snEntityId = currentUrl.match(/\/sales\/lead\/([^,?#]+)/)?.[1] ?? null;
      const csrfToken  = document.cookie.match(/JSESSIONID="?([^";]+)/)?.[1] ?? '';

      let publicIdentifier = liSlug ?? null;

      if (!publicIdentifier && snEntityId) {
        try {
          const resolveResp = await fetch(
            `/voyager/api/identity/profiles?memberIdentity=${encodeURIComponent(snEntityId)}&count=1`,
            {
              headers: {
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
              },
              credentials: 'include',
            }
          );
          if (resolveResp.ok) {
            const rData = await resolveResp.json();
            publicIdentifier = rData?.elements?.[0]?.miniProfile?.publicIdentifier ?? null;
          }
        } catch (_) {}
      }

      if (publicIdentifier) {
        try {
          await sleepMicro();
          const apiResp = await fetch(
            `/voyager/api/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileContactInfo`,
            {
              headers: {
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0',
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
              },
              credentials: 'include',
            }
          );
          if (apiResp.ok) {
            const contactData = await apiResp.json();
            const phones = contactData?.phoneNumbers ?? [];
            if (phones.length > 0) {
              const foundPhone = phones[0].number;
              console.log(`[cazary.ai] executeFindPhone: ✅ encontrado vía Voyager API → ${foundPhone}`);
              return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
                action: 'find_phone', success: true, lead_id: leadId,
                method: 'voyager_api', data: { phone: foundPhone },
              }});
            }
            console.log('[cazary.ai] executeFindPhone: Voyager API sin teléfono → fallback DOM');
          }
        } catch (_) {}
      }

      // ── ETAPA B: DOM fallback — overlay "Información de contacto" ─────────
      await sleepHuman();

      const contactLink =
        document.querySelector('a[href*="overlay/contact-info"]') ??
        Array.from(document.querySelectorAll('a, button')).find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt === 'información de contacto' || txt === 'contact info';
        }) ?? null;

      if (!contactLink) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'find_phone', success: false,
          reason: 'contact_link_not_found', lead_id: leadId,
        }});
      }

      simulateClick(contactLink);
      await sleep(2000 + Math.random() * 500);

      const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
      const foundPhone = telLinks.length > 0
        ? telLinks[0].href.replace('tel:', '').trim()
        : null;

      const closeBtn = document.querySelector(
        'button[aria-label="Descartar"], button[aria-label="Dismiss"],' +
        'button.artdeco-modal__dismiss, [data-test-modal-close-btn]'
      );
      if (closeBtn) simulateClick(closeBtn);

      if (!foundPhone) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'find_phone', success: false,
          reason: 'phone_not_found', lead_id: leadId,
        }});
      }

      console.log(`[cazary.ai] executeFindPhone: ✅ encontrado vía DOM → ${foundPhone}`);
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'find_phone', success: true, lead_id: leadId,
        method: 'dom', data: { phone: foundPhone },
      }});

    } catch (err) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'find_phone', success: false,
        reason: err.message ?? 'unknown_error', lead_id: leadId,
      }});
    }
  }

  async function executeConnectEmail(taskId, leadId, addNote, note) {
    try {
      await sleep(2000);
      const isInvitePage = window.location.href.includes('invite-by-email') ||
                           window.location.href.includes('invite?');
      const isProfilePage = window.location.pathname.startsWith('/in/');

      if (isInvitePage) {
        // Fill email if input is empty
        const emailInput = document.querySelector('input[type="email"], input[name="email"]');
        if (emailInput && !emailInput.value.trim()) {
          const params = new URLSearchParams(window.location.search);
          const emailVal = params.get('emailAddress') ?? '';
          emailInput.focus();
          document.execCommand('insertText', false, emailVal);
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(800);
        }
        // Click connect/send button
        const allBtns = Array.from(document.querySelectorAll('button'));
        const connectBtn = allBtns.find(b => {
          const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
          return (txt === 'conectar' || txt === 'connect' || txt === 'enviar' || txt === 'send' ||
                  txt.includes('enviar invitación') || txt.includes('send invitation')) && !b.disabled;
        });
        if (!connectBtn) {
          safeSendMessage({ type: 'ACTION_DONE', taskId,
            result: { action: 'connect_email', success: false, reason: 'connect_button_not_found', lead_id: leadId } });
          return;
        }
        simulateClick(connectBtn);
        await sleep(1500);
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'connect_email', success: true, reason: 'sent', lead_id: leadId } });
      } else if (isProfilePage) {
        // Fall back to normal connect flow on the profile
        await executeConnect(taskId, note, leadId, null, null);
      } else {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'connect_email', success: false, reason: 'email_invite_not_supported', lead_id: leadId } });
      }
    } catch (err) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'connect_email', success: false, reason: err.message ?? 'unknown_error', lead_id: leadId } });
    }
  }

  // ── Escuchar tareas inyectadas por background via postMessage ────────────

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data) return;

    if (event.data.type === 'NEXUSAI_FORCE_INBOX_CHECK') {
      safeSendMessage({ type: 'FORCE_INBOX_CHECK' });
      return;
    }

    if (event.data.type !== 'NEXUSAI_TASK') return;

    const { task, taskId, ...params } = event.data;

    switch (task) {
      case 'view_profile':     await executeViewProfile(taskId);                                                     break;
      case 'connect':
        if (params.requirePageView === true) {
          console.log('[cazary.ai] connect mode=profile (requirePageView=true)');
          await executeConnect(taskId, params.note, params.leadId, params.campaignId, params.lead ?? null);
        } else {
          await executeConnectFast(taskId, params.note, params.leadId, params.campaignId, params.lead ?? null);
        }
        break;
      case 'message':          await executeMessage(taskId, params.text, params.leadId, params.campaignId);         break;
      case 'count_leads':      await executeCountLeads(taskId, params.campaignId, params.segmentId);                break;
      case 'extract_profile':  await executeExtractProfile(taskId, params.leadId);                                  break;
      case 'check_connection':      await executeCheckConnection(taskId, params.leadId, params.campaignId);              break;
      case 'check_inbox':           await executeCheckInbox(taskId, params.campaignId);                                  break;
      case 'check_network_updates': await executeCheckNetworkUpdates(taskId, params.workspaceId ?? null);              break;
      case 'follow':           await executeFollow(taskId, params.leadId, params.campaignId);                       break;
      case 'unfollow':         await executeUnfollow(taskId, params.leadId, params.campaignId);                     break;
      case 'disconnect':       await executeDisconnect(taskId, params.leadId, params.campaignId);                   break;
      case 'like':             await executeLikePost(taskId, params.leadId, params.campaignId, params.profileUrl ?? null); break;
      case 'comment':          await executeCommentPost(taskId, params.text ?? '', params.leadId, params.campaignId); break;
      case 'post_linkedin':    await executePostLinkedIn(taskId, params.content ?? '');                              break;
      case 'withdraw':         await executeWithdraw(taskId, params.leadId ?? null);                                 break;
      case 'find_email':       await executeFindEmail(taskId, params.leadId ?? null);                                break;
      case 'find_phone':       await executeFindPhone(taskId, params.leadId ?? null);                                break;
      case 'connect_email':    await executeConnectEmail(taskId, params.leadId ?? null, params.addNote ?? false, params.note ?? ''); break;
    }
  });

  // ── Listener de mensajes desde background.js ──────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        let result;
        switch (msg.action) {

          case 'execute_task': {
            sendResponse({ received: true });
            console.log(`[cazary.ai] execute_task recibido: ${msg.task} | taskId: ${msg.taskId}`);
            (async () => {
              switch (msg.task) {
                case 'view_profile':
                  await executeViewProfile(msg.taskId);
                  break;
                case 'connect':
                  if (msg.requirePageView === true) {
                    console.log('[cazary.ai] connect mode=profile (requirePageView=true)');
                    await executeConnect(msg.taskId, msg.note ?? '', msg.leadId, msg.campaignId, msg.lead ?? null);
                  } else {
                    await executeConnectFast(msg.taskId, msg.note ?? '', msg.leadId, msg.campaignId, msg.lead ?? null);
                  }
                  break;
                case 'message':
                  await executeMessage(msg.taskId, msg.text ?? '', msg.leadId, msg.campaignId, msg.lead ?? null);
                  break;
                case 'extract_profile':
                  await executeExtractProfile(msg.taskId, msg.leadId);
                  break;
                case 'check_connection':
                  await executeCheckConnection(msg.taskId, msg.leadId, msg.campaignId);
                  break;
                case 'check_network_updates':
                  await executeCheckNetworkUpdates(msg.taskId, msg.workspaceId ?? null);
                  break;
                case 'count_leads':
                  await executeCountLeads(msg.taskId, msg.campaignId, msg.segmentId);
                  break;
                case 'check_inbox':
                  await executeCheckInbox(msg.taskId, msg.campaignId);
                  break;
                case 'follow':
                  await executeFollow(msg.taskId, msg.leadId, msg.campaignId);
                  break;
                case 'unfollow':
                  await executeUnfollow(msg.taskId, msg.leadId, msg.campaignId);
                  break;
                case 'disconnect':
                  await executeDisconnect(msg.taskId, msg.leadId, msg.campaignId);
                  break;
                case 'like':
                  await executeLikePost(msg.taskId, msg.leadId, msg.campaignId, msg.profileUrl ?? null);
                  break;
                case 'comment':
                  await executeCommentPost(msg.taskId, msg.text ?? '', msg.leadId, msg.campaignId);
                  break;
                case 'post_linkedin':
                  await executePostLinkedIn(msg.taskId, msg.content ?? '');
                  break;
                case 'withdraw':
                  await executeWithdraw(msg.taskId, msg.leadId ?? null);
                  break;
                case 'find_email':
                  await executeFindEmail(msg.taskId, msg.leadId ?? null);
                  break;
                case 'find_phone':
                  await executeFindPhone(msg.taskId, msg.leadId ?? null);
                  break;
                case 'connect_email':
                  await executeConnectEmail(msg.taskId, msg.leadId ?? null, msg.addNote ?? false, msg.note ?? '');
                  break;
                default:
                  console.warn('[cazary.ai] execute_task desconocido:', msg.task);
              }
            })();
            break;
          }

          case 'extract_profile':
            result = isSalesNavigator()
              ? extractSalesNavProfile()
              : extractLinkedInProfile();
            sendResponse({ success: true, data: result });
            break;

          case 'extract_inbox':
            sendResponse({ success: true, data: extractInboxMessages() });
            break;

          case 'count_search_results':
            await sleep(2500);
            result = extractSearchCount();
            sendResponse({ success: true, count: result, url: window.location.href });
            break;

          case 'count_leads_quick': {
            const href = window.location.href;
            const onLinkedIn = href.includes('linkedin.com/sales') || href.includes('linkedin.com/search');
            if (!onLinkedIn) {
              sendResponse({ count: null, error: 'NOT_ON_LINKEDIN', needsNavigation: true });
              break;
            }
            await sleep(500 + Math.random() * 1000);
            const snEl = document.querySelector('.search-results__total-results')
              || document.querySelector('[data-view-name="search-results-header"] span')
              || document.querySelector('.list-header-count')
              || document.querySelector('[data-anonymize="result-count"]');
            const liEl = document.querySelector('.search-results-container .pb2 h2')
              || document.querySelector('.search-results-container h2')
              || document.querySelector('.artdeco-card h2');
            const raw = (snEl || liEl)?.textContent?.trim() ?? '';
            const count = parseInt(raw.replace(/[^0-9]/g, ''), 10) || null;
            sendResponse({ count, error: count ? null : 'COUNT_NOT_FOUND' });
            break;
          }

          case 'scrape_profiles': {
            await sleep(500 + Math.random() * 1000);
            const profiles = [];
            document.querySelectorAll(
              '.artdeco-entity-lockup__title a, [data-view-name="search-result-entity-lockup"] a'
            ).forEach((el) => {
              const url = el.href?.split('?')[0];
              const name = el.textContent?.trim();
              if (url && (url.includes('/in/') || url.includes('/sales/lead/'))) {
                const container = el.closest('[data-view-name]') || el.closest('li');
                const headline = container?.querySelector(
                  '.artdeco-entity-lockup__subtitle, [data-anonymize="headline"]'
                )?.textContent?.trim() ?? '';
                profiles.push({ url, name, headline });
              }
            });
            if (profiles.length === 0) {
              document.querySelectorAll('.entity-result__title-text a').forEach((el) => {
                const url = el.href?.split('?')[0];
                const name = el.querySelector('.visually-hidden')?.textContent?.trim()
                  ?? el.textContent?.trim();
                if (url && url.includes('/in/')) {
                  const card = el.closest('.entity-result');
                  const headline = card?.querySelector('.entity-result__primary-subtitle')?.textContent?.trim() ?? '';
                  profiles.push({ url, name, headline });
                }
              });
            }
            sendResponse({ profiles });
            break;
          }

          case 'NEXUSAI_SCRAPE_PROFILES': {
            function extractRealName(container) {
              const salNavName = container.querySelector(
                '.artdeco-entity-lockup__title, ' +
                '[data-anonymize="person-name"], ' +
                '.result-lockup__name, ' +
                '.artdeco-entity-lockup__subtitle ~ .artdeco-entity-lockup__title'
              );
              if (salNavName) {
                const t = salNavName.innerText?.trim();
                if (t && t.split(' ').length <= 6 && !t.includes(' fue ') &&
                    !t.includes(' está ') && !t.includes(' conexión')) return t;
              }
              const linkedinName = container.querySelector(
                'h1.text-heading-xlarge, ' +
                '.pv-text-details__left-panel h1, ' +
                '.entity-result__title-text a span[aria-hidden="true"], ' +
                '.app-aware-link span[aria-hidden="true"]'
              );
              if (linkedinName) {
                const t = linkedinName.innerText?.trim();
                if (t && t.split(' ').length <= 6) return t;
              }
              const allSpans = Array.from(container.querySelectorAll('span, a'))
                .map(el => el.innerText?.trim())
                .filter(t => t && t.length > 2 && t.length < 60 &&
                             t.split(' ').length <= 5 &&
                             !t.includes('conexión') && !t.includes('disponible') &&
                             !t.includes('activo') && !t.includes('hace '));
              return allSpans[0] ?? 'Sin nombre';
            }

            function cleanLinkedInName(raw) {
              if (!raw) return 'Sin nombre';
              const patterns = [
                /^la (?:última|ultima) conexión de (.+?) fue .+$/i,
                /^(.+?) está disponible$/i,
                /^(.+?) estuvo activo.+$/i,
                /^(.+?) (?:ha compartido|publicado|comentado).+$/i,
                /^(.+?) responded.+$/i,
              ];
              for (const p of patterns) {
                const m = raw.match(p);
                if (m?.[1]) return m[1].trim();
              }
              if (raw.split(' ').length > 6) return raw.split(' ').slice(0, 3).join(' ');
              return raw;
            }

            const results = [];

            async function scrollToLoadAll() {
              const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));

              const scroller =
                document.querySelector('div.overflow-x-hidden.overflow-y-auto') ||
                document.querySelector('[class*="overflow-y-auto"]') ||
                Array.from(document.querySelectorAll('div, main, section')).find(el => {
                  const s = getComputedStyle(el);
                  return ['scroll', 'auto'].includes(s.overflowY) &&
                         el.scrollHeight > el.clientHeight * 1.5 &&
                         el.scrollHeight > 500;
                }) ||
                document.documentElement;

              console.log('[NexusAI Content] Scroller encontrado:',
                scroller.tagName, scroller.className?.slice(0, 60),
                'scrollH:', scroller.scrollHeight, 'clientH:', scroller.clientHeight);

              let lastCount = 0;
              let stableRounds = 0;
              const totalHeight = scroller.scrollHeight;
              const steps = 20;

              for (let i = 0; i < 30; i++) {
                const targetTop = Math.min(scroller.scrollTop + (totalHeight / steps), scroller.scrollHeight);
                scroller.scrollTop = targetTop;

                window.scrollTo({ top: window.scrollY + 300, behavior: 'auto' });

                await sleepMs(700);

                const currentLinks = document.querySelectorAll('a[href*="/sales/lead/"]').length;
                console.log('[NexusAI Content] Scroll ronda', i + 1,
                  '- scrollTop:', Math.round(scroller.scrollTop),
                  '- links:', currentLinks);

                if (currentLinks === lastCount) {
                  stableRounds++;
                  if (stableRounds >= 4) break;
                } else {
                  stableRounds = 0;
                }
                lastCount = currentLinks;

                if (scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 50) {
                  console.log('[NexusAI Content] Llegamos al fondo del scroller');
                  break;
                }
              }

              scroller.scrollTop = 0;
              await sleepMs(500);
            }

            await scrollToLoadAll();

            const profileLinks = Array.from(document.querySelectorAll(
              'a[href*="/sales/lead/"], a[href*="/in/"]'
            )).filter((a) => {
              const href = a.href || '';
              return (href.includes('/sales/lead/') || href.includes('/in/')) &&
                     !href.includes('/feed') &&
                     !href.includes('/company') &&
                     !href.includes('/school') &&
                     !href.includes('/settings') &&
                     !href.includes('/sales/home') &&
                     !href.includes('linkedin.com/in/undefined');
            });

            const seenUrls = new Set();
            profileLinks.forEach((linkEl) => {
              const url = linkEl.href?.split('?')[0];
              if (!url || seenUrls.has(url)) return;
              seenUrls.add(url);

              const card = linkEl.closest(
                'li.artdeco-list__item, li[class*="result"], article, ' +
                '[data-view-name="search-result-entity-lockup"], ' +
                '.artdeco-entity-lockup, [class*="result-item"]'
              ) || linkEl.parentElement?.parentElement;

              if (!card) return;

              const rawName = extractRealName(card) ||
                             linkEl.querySelector('span:not(.visually-hidden)')?.textContent?.trim() ||
                             linkEl.textContent?.trim() || '';
              const name = cleanLinkedInName(rawName);
              if (!name || name.length < 2 || name === 'Sin nombre') return;

              const headlineEl = card.querySelector(
                '[data-anonymize="headline"], .artdeco-entity-lockup__subtitle, ' +
                '[class*="headline"], [class*="subtitle"]'
              );
              const companyEl = card.querySelector(
                '[data-anonymize="company-name"], .result-lockup__position-company, ' +
                '[class*="company"]'
              );
              const avatarEl = card.querySelector('img[class*="profile"], img[class*="ghost"], img[alt]');

              const idMatch      = url.match(/\/in\/([^/?]+)/);
              const salesIdMatch = url.match(/\/sales\/lead\/([^,/?]+)/);

              results.push({
                url,
                name,
                headline:   headlineEl?.textContent?.trim() || null,
                avatar:     avatarEl?.src || null,
                company:    companyEl?.textContent?.trim() || null,
                location:   null,
                linkedinId: salesIdMatch?.[1] || idMatch?.[1] || null,
              });
            });

            console.log('[NexusAI Content] Total perfiles extraídos:', results.length);
            sendResponse({ profiles: results });
            break;
          }

          case 'detect_own_profile': {
            // Intentar Voyager API primero, DOM scraping como fallback
            detectOwnProfileFromVoyager().then((ok) => {
              if (!ok) detectOwnProfile();
              sendResponse({ success: true });
            }).catch(() => {
              const ok = detectOwnProfile();
              sendResponse({ success: !!ok });
            });
            return true; // Mantener canal abierto para respuesta async
          }

          default:
            sendResponse({ success: false, error: `Acción desconocida: ${msg.action}` });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // async
  });

})();
