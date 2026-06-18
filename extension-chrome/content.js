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

  function safeSendMessage(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch (_) {
      // Extension context invalidated — ignorar
    }
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

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

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

      // Sin evidencia clara de 1er grado → asumir NO conectado (fail-safe)
      console.log('[cazary.ai] SalesNav: no 1st degree badge found → assuming NOT connected');
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

  // ── Detectar perfil propio ────────────────────────────────────────────────

  function detectOwnProfile() {
    // Multi-selector para el nombre del usuario logueado (nav sidebar + feed + global nav)
    const nameEl =
      document.querySelector('.profile-nav-card-mini__title') ||
      document.querySelector('.scaffold-layout-toolbar__profile-details-title') ||
      document.querySelector('.feed-identity-module__actor-meta .t-bold') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] .t-bold') ||
      document.querySelector('.global-nav__primary-link--active .artdeco-entity-lockup__title') ||
      document.querySelector('.artdeco-entity-lockup__title.ember-view') ||
      document.querySelector('a[data-control-name="identity_welcome_message"] .t-bold') ||
      document.querySelector('.profile-rail-card .t-bold') ||
      // Fallback: buscar en la navegación superior el nombre del usuario
      (() => {
        const navItems = document.querySelectorAll('.global-nav__secondary-items .global-nav__secondary-link span');
        for (const el of navItems) {
          const txt = el.textContent?.trim();
          if (txt && txt.length > 2 && txt.length < 60 && !txt.includes('Notif') && !txt.includes('Jobs')) return el;
        }
        return null;
      })();

    const imgEl =
      document.querySelector('.profile-nav-card-mini__profile-picture img') ||
      document.querySelector('.feed-identity-module__actor-meta img') ||
      document.querySelector('.global-nav__me-photo') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] img') ||
      document.querySelector('.scaffold-layout-toolbar__profile-details img');

    const headlineEl =
      document.querySelector('.profile-nav-card-mini__headline') ||
      document.querySelector('.scaffold-layout-toolbar__profile-details-headline') ||
      document.querySelector('.feed-identity-module__actor-meta .t-14') ||
      document.querySelector('[data-test-id="nav-settings__profile-info"] .t-14');

    const name = nameEl?.textContent?.trim() || nameEl?.innerText?.trim();
    if (!name || name.length < 2) return false;

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

  // Ejecutar en CUALQUIER página de LinkedIn (el nav con perfil siempre está visible)
  if (window.location.hostname === 'www.linkedin.com') {
    // Intentos escalonados para esperar a que el DOM cargue
    setTimeout(() => detectOwnProfile(), 1500);
    setTimeout(() => detectOwnProfile(), 4000);
    setTimeout(() => detectOwnProfile(), 8000);
  }

  // También en Sales Navigator
  if (window.location.hostname === 'www.linkedin.com' && isSalesNavigator()) {
    setTimeout(() => detectOwnProfile(), 2000);
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
    if (document.querySelector('.connect-cta-form__send')) return true;
    if (document.querySelector('[data-test-modal-container][aria-hidden="false"]')) return true;
    const dialog = document.querySelector('[data-test-modal][role="dialog"]');
    if (dialog && dialog.getBoundingClientRect().height > 0) return true;
    return false;
  }

  // ── ACCIÓN 2: CONNECT ─────────────────────────────────────────────────────

  async function detectConnectionState() {
    const platform = getPlatform();
    await sleep(1000);

    if (platform === 'salesnav') {
      // PASO 1: Badge de grado (el más fiable — no requiere abrir dropdown)
      if (isFirstDegreeConnection()) {
        console.log('[cazary.ai] detectConnectionState: 1st degree badge → connected');
        return 'connected';
      }

      // PASO 2: Abrir overflow y leer items DIRECTAMENTE del container
      let menuOpened = false;
      try { menuOpened = await clickMoreButton(); } catch(_) {}

      if (menuOpened) {
        await sleep(700);

        const container = getDropdownContainer();

        if (!container) {
          console.warn('[cazary.ai] detectConnectionState: no se encontró dropdown container → SAFE DEFAULT none');
          const btn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');
          if (btn) btn.click();
          return 'none';
        }

        const menuItems = Array.from(container.querySelectorAll(
          'li, a, button, .eah-menu-item__action, [role="menuitem"]'
        )).filter(el =>
          el.offsetParent !== null || el.getBoundingClientRect().height > 0
        );
        const menuTexts = menuItems
          .map(el => (el.innerText || el.textContent || '').trim())
          .filter(t => t.length > 0);

        const containerRect = container.getBoundingClientRect();
        console.log(
          `[cazary.ai] detectConnectionState: container en (${Math.round(containerRect.left)},${Math.round(containerRect.top)}), ` +
          `items: ${menuTexts.length}:`, menuTexts
        );

        const hasWithdraw = menuTexts.some(t => {
          const lower = t.toLowerCase();
          return lower.includes('retirar') ||
                 lower.includes('withdraw') ||
                 lower.includes('cancelar invitación') ||
                 lower.includes('pendiente');
        });
        const hasConnect = menuTexts.some(t => {
          const lower = t.toLowerCase().trim();
          return (lower === 'conectar' || lower === 'connect') && !lower.includes('pendiente');
        });

        // Cerrar dropdown ANTES de retornar
        const overflowBtn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');
        if (overflowBtn && overflowBtn.getAttribute('aria-expanded') === 'true') {
          overflowBtn.click();
          await sleep(400);
        }

        if (hasWithdraw) {
          console.log('[cazary.ai] detectConnectionState: "Retirar" encontrado → pending');
          return 'pending';
        }
        if (hasConnect) {
          console.log('[cazary.ai] detectConnectionState: "Conectar" encontrado → none');
          return 'none';
        }

        // Dropdown correcto sin Conectar ni Retirar: verificar topcard
        const topcardConnectBtn = Array.from(document.querySelectorAll(
          '[class*="lead-actions"] button, [data-x--lead-actions-bar] button, .profile-topcard__actions button'
        )).find(btn => {
          const txt = (btn.innerText || btn.textContent || '').toLowerCase().trim();
          return txt === 'conectar' || txt === 'connect';
        });
        if (topcardConnectBtn) {
          console.log('[cazary.ai] detectConnectionState: "Conectar" en topcard → none');
          return 'none';
        }

        // "Añadir nota" en el dropdown → el lead ya está conectado (solo aparece para 1er grado)
        const hasAddNote = menuTexts.some(t => {
          const lower = t.toLowerCase();
          return lower.includes('añadir nota') || lower.includes('add note') ||
                 lower.includes('add a note')  || lower.includes('add note (optional)');
        });
        if (hasAddNote) {
          console.log('[cazary.ai] detectConnectionState: "Añadir nota" encontrado → connected (ya conectado)');
          return 'connected';
        }

        console.warn('[cazary.ai] detectConnectionState: dropdown correcto sin Conectar/Retirar/AñadirNota → SAFE DEFAULT none');
        return 'none';
      }

      // No se pudo abrir dropdown → safe default
      console.warn('[cazary.ai] detectConnectionState: no se pudo abrir dropdown → none');
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
    note = personalizeMessage(note, lead);
    // Cargar overrides de selectores antes de ejecutar (fail-safe: no bloquea si falla)
    try {
      const { supabase_workspace_id: wsId } = await chrome.storage.local.get('supabase_workspace_id');
      if (wsId) await loadSelectorOverrides(wsId);
    } catch (_) {}
    await sleep(2500 + Math.random() * 1500);

    // ── Detectar OUT_OF_NETWORK (perfil bloqueado) ────────────────────────────
    const isOutOfNetwork = window.location.href.includes('OUT_OF_NETWORK');
    if (isOutOfNetwork) {
      console.log('[cazary.ai] SalesNav: perfil OUT_OF_NETWORK detectado → búsqueda extendida de botón Conectar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(1500);
    }

    // ── SMART STATE DETECTION ─────────────────────────────────────────────────
    const connectionState = await detectConnectionState();
    console.log(`[cazary.ai] ConnectionState: ${connectionState} | platform=${platform}`);

    if (connectionState === 'connected') {
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
                return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
                  action: 'connect', success: false,
                  reason: 'out_of_network_locked',
                  lead_id: leadId, campaign_id: campaignId,
                }});
              }
            } else {
              console.warn('[cazary.ai] SalesNav: "Conectar" no encontrado ni en dropdown ni en topcard');
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
        // Sin dialog → verificar si conexión se envió automáticamente
        await sleep(1000);
        const verifyOpened = await clickMoreButton();
        if (verifyOpened) {
          await sleep(600);
          const verifyContainer = getDropdownContainer();
          if (verifyContainer) {
            const texts = Array.from(verifyContainer.querySelectorAll('li, a, button'))
              .map(el => (el.innerText || '').trim().toLowerCase());
            const isPendingNow = texts.some(t => t.includes('pendiente') || t.includes('retirar'));
            const connectGone  = !texts.some(t => t.trim() === 'conectar' || t.trim() === 'connect');
            const btn = document.querySelector('[data-x--lead-actions-bar-overflow-menu]');
            if (btn) btn.click();
            if (isPendingNow || connectGone) {
              console.log('[cazary.ai] SalesNav: ✅ conexión enviada sin dialog');
              return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
                action: 'connect', success: true, reason: 'sent',
                lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
              }});
            }
          }
        }
        console.warn('[cazary.ai] SalesNav: dialog no apareció, conexión no confirmada');
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'modal_not_opened',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      // ── PASO 4: Enviar invitación via dialog ─────────────────────────────────
      console.log('[cazary.ai] SalesNav: dialog detectado → buscando .connect-cta-form__send');
      const sendBtn = document.querySelector('.connect-cta-form__send');
      if (!sendBtn) {
        console.warn('[cazary.ai] SalesNav: .connect-cta-form__send no encontrado en dialog');
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
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: true, reason: 'sent',
          lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
        }});
      }

      // Reintento único
      const sendBtn2 = document.querySelector('.connect-cta-form__send');
      if (sendBtn2) {
        sendBtn2.click();
        await sleep(2000);
        if (!isSalesNavDialogOpen()) {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: true, reason: 'sent',
            lead_id: leadId, campaign_id: campaignId, connection_note: note || '',
          }});
        }
      }

      const limitHit = document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);
      if (limitHit) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }
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
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        console.log('[cazary.ai] LI connect: encontrado en dropdown, clickeando...');
        const modalOpened = await forceClick(item);
        if (!modalOpened) {
          console.warn('[cazary.ai] forceClick: modal no abrió tras 3 intentos');
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
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'daily_limit_reached',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    console.log(`[cazary.ai] connect done: success=${!modalOpen}`);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'connect', success: !modalOpen,
      lead_id: leadId, campaign_id: campaignId,
      connection_note: note || '',
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
      // Buscar card del lead en la lista/búsqueda actual de SalesNav
      const snUrl = lead?.salesnav_url ?? lead?.linkedin_url ?? '';
      const snSlug = snUrl ? String(snUrl).split('?')[0].split('/').filter(Boolean).pop() : null;
      const leadName = (lead?.full_name || lead?.name || '').trim().toLowerCase();

      let snCard = null;
      if (snSlug) {
        const anchors = Array.from(document.querySelectorAll('a[href*="/sales/lead/"]'));
        const cardAnchor = anchors.find(a => (a.getAttribute('href') || '').toLowerCase().includes(snSlug));
        snCard = cardAnchor?.closest('li, [data-id], .artdeco-list__item, [class*="result"]') ||
                 cardAnchor?.parentElement || null;
      }
      // Fallback por nombre en la lista visible
      if (!snCard && leadName) {
        const nameEls = Array.from(document.querySelectorAll('[data-anonymize="person-name"], .result-lockup__name'));
        const matched = nameEls.find(el => (el.textContent || '').trim().toLowerCase() === leadName);
        snCard = matched?.closest('li, [data-id], .artdeco-list__item') || null;
      }

      if (!snCard) {
        console.log('[cazary.ai] connect mode=fast SalesNav → fallback mode=profile (card no encontrada)');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      // Buscar botón Connect inline en la card
      const snConnectBtn = Array.from(snCard.querySelectorAll('button,[role="button"]')).find(el => {
        if (!el.offsetParent) return false;
        const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        return t === 'conectar' || t === 'connect' ||
               label.includes('conectar') || label.includes('connect');
      }) || null;

      if (!snConnectBtn) {
        console.log('[cazary.ai] connect mode=fast SalesNav → fallback mode=profile (sin btn Connect en card)');
        return executeConnect(taskId, note, leadId, campaignId, lead);
      }

      console.log('[cazary.ai] connect mode=fast SalesNav: card encontrada → clickeando Connect');
      simulateClick(snConnectBtn);
      await sleep(1500);

      // ── Dialog de nota SalesNav ───────────────────────────────────────────
      const dialogOpen = isSalesNavDialogOpen();
      if (dialogOpen) {
        const sendBtn = document.querySelector('.connect-cta-form__send');
        if (!sendBtn) {
          console.log('[cazary.ai] connect mode=fast SalesNav → fallback (sin send btn en dialog)');
          return executeConnect(taskId, note, leadId, campaignId, lead);
        }
        if (note && note.trim()) {
          const noteBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
            const t = (el.innerText || el.textContent || '').toLowerCase();
            return t.includes('nota') || t.includes('note') || t.includes('agregar') ||
                   t.includes('add a') || t.includes('añadir') || t.includes('optional');
          });
          if (noteBtn) { simulateClick(noteBtn); await sleep(700); }
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
          }
        }
        sendBtn.click();
        await sleep(2000);
        if (isSalesNavDialogOpen()) {
          console.log('[cazary.ai] connect mode=fast SalesNav → fallback (dialog aún abierto)');
          return executeConnect(taskId, note, leadId, campaignId, lead);
        }
      }

      const limitHit = document.body.innerText.toLowerCase().match(/límite|limit|weekly invitation/);
      if (limitHit) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'daily_limit_reached',
          lead_id: leadId, campaign_id: campaignId, method: 'fast',
        }});
      }

      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: true, reason: 'sent',
        lead_id: leadId, campaign_id: campaignId,
        connection_note: note || '', method: 'fast',
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
    await sleep(2000 + Math.random() * 1500);
    window.scrollTo({ top: 200, behavior: 'smooth' });
    await sleep(1000);

    const msgBtnSel = getSelector(platform, 'message', 'message_btn',
      'button[aria-label*="Mensaje"], button[aria-label*="Message"], button[aria-label*="InMail"]');
    let msgBtn = null;
    for (let i = 0; i < 3; i++) {
      msgBtn = Array.from(document.querySelectorAll('button,[role="button"],a'))
        .filter(el => el.offsetParent)
        .find(el => {
          const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'mensaje'     || t === 'message'  ||
                 t === 'inmail'      || t.includes('enviar mensaje') ||
                 label.includes('mensaje') || label.includes('message') ||
                 label.includes('inmail');
        }) || document.querySelector(msgBtnSel);
      if (msgBtn) break;
      await sleep(800);
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

    msgBtn.focus();
    msgBtn.click();
    await sleep(2500);

    let inputEl = null;

    const msgFieldSel = platform === 'salesnav'
      ? getSelector('salesnav', 'message', 'message_field',
          'textarea.message-anywhere-compose-box__msg-body, .compose-message__textarea, [data-test-compose-message-textarea], textarea[placeholder*="mensaje"], textarea[placeholder*="message"]')
      : getSelector('linkedin', 'message', 'message_field',
          '.msg-form__contenteditable[contenteditable="true"], [role="textbox"][data-placeholder], [data-artdeco-is-focused][contenteditable="true"]');

    if (platform === 'salesnav') {
      for (let i = 0; i < 4; i++) {
        inputEl =
          document.querySelector('textarea.message-anywhere-compose-box__msg-body') ||
          document.querySelector('.compose-message__textarea') ||
          document.querySelector('[data-test-compose-message-textarea]') ||
          document.querySelector('textarea[placeholder*="mensaje"], textarea[placeholder*="message"]') ||
          document.querySelector('.inmail-compose-form textarea') ||
          document.querySelector('[contenteditable="true"][role="textbox"]') ||
          document.querySelector(msgFieldSel) ||
          document.querySelector('textarea:not([disabled])');
        if (inputEl) break;
        await sleep(700);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        inputEl =
          document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
          document.querySelector('[role="textbox"][data-placeholder]') ||
          document.querySelector('[contenteditable="true"].msg-form__contenteditable') ||
          document.querySelector('[data-artdeco-is-focused][contenteditable="true"]') ||
          document.querySelector(msgFieldSel);
        if (inputEl) break;
        await sleep(700);
      }
    }

    if (!inputEl) {
      reportSelectorFailure(platform, 'message', 'message_field', msgFieldSel,
        document.querySelector('.msg-overlay-conversation-bubble, .compose-message, [class*="compose"]')?.innerHTML
        ?? document.body.innerHTML.substring(0, 3000));
      console.warn('[cazary.ai][SelectorHealing] selector_failure: message_field');
      console.warn('[cazary.ai] Message input not found. Page HTML fragment:',
        document.body.innerHTML.slice(0, 600));
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'message', success: false, reason: 'input_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    inputEl.focus();
    if (inputEl.tagName === 'TEXTAREA') {
      inputEl.value = '';
      document.execCommand('insertText', false, text);
      inputEl.dispatchEvent(new Event('input',  { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      inputEl.innerText = '';
      document.execCommand('insertText', false, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(800 + Math.random() * 400);

    // Send button — buscar por texto (funciona en ambas plataformas sin importar clases)
    const msgSendBtnSel = getSelector(platform, 'message', 'message_send_btn',
      'button[aria-label*="Enviar"], button[aria-label*="Send message"]');
    let sendBtn = null;
    for (let i = 0; i < 5; i++) {
      sendBtn = Array.from(document.querySelectorAll('button,[role="button"]'))
        .filter(el => el.offsetParent && !el.disabled)
        .find(el => {
          const t = (el.innerText || el.textContent || '').trim().toLowerCase();
          return t === 'enviar' || t === 'send';
        }) || document.querySelector(msgSendBtnSel);
      if (sendBtn) break;
      await sleep(500);
    }

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.focus();
      sendBtn.click();
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

    await sleep(1000);
    console.log(`[cazary.ai] message sent platform=${platform} leadId=${leadId}`);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'message', success: true,
      lead_id: leadId, campaign_id: campaignId, message_text: text,
    }});
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
    console.log(`[cazary.ai] executeFollow platform=${platform}`);
    await sleep(2000);

    let followBtn = null;

    if (platform === 'salesnav') {
      const opened = await clickMoreButton();
      if (!opened) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'follow', success: false, reason: 'more_button_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }
      followBtn = findMenuItemByText('seguir', 'follow');
    } else {
      followBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
        const t = (el.innerText || '').trim().toLowerCase();
        return (t === 'seguir' || t === 'follow') && el.offsetParent;
      });
      if (!followBtn) {
        const opened = await clickMoreButton();
        if (opened) followBtn = findMenuItemByText('seguir', 'follow');
      }
    }

    if (!followBtn) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'follow', success: false, reason: 'button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    followBtn.focus();
    followBtn.click();
    await sleep(800);
    console.log('[cazary.ai] follow done');
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'follow', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
  }

  // ── ACCIÓN 5b: UNFOLLOW ───────────────────────────────────────────────────

  async function executeUnfollow(taskId, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[cazary.ai] executeUnfollow platform=${platform}`);
    await sleep(2000);

    const opened = await clickMoreButton();
    if (!opened) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'unfollow', success: false, reason: 'more_button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    const unfollowItem = findMenuItemByText(
      'dejar de seguir', 'unfollow', 'stop following', 'dejar seguir'
    );
    if (!unfollowItem) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'unfollow', success: false, reason: 'item_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(unfollowItem);
    await sleep(800);
    console.log('[cazary.ai] unfollow done');
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'unfollow', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
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

  async function executeLikePost(taskId, leadId, campaignId) {
    console.log('[cazary.ai] executeLikePost');
    await sleep(2000);

    const likeButtons = Array.from(document.querySelectorAll(
      'button[aria-label*="Me gusta"]:not([aria-pressed="true"]), ' +
      'button[aria-label*="Like"]:not([aria-pressed="true"]), ' +
      'button[data-control-name="react"]:not(.active), ' +
      'button.react-button__trigger:not([aria-pressed="true"])'
    )).filter(b => b.offsetParent && !b.disabled);

    if (!likeButtons.length) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'like', success: false, reason: 'no_posts_to_like',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(likeButtons[0]);
    await sleep(600);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'like', success: true, lead_id: leadId, campaign_id: campaignId,
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
      await sleep(1500);
      const platform = getPlatform();
      const withdrawSel = getSelector(platform, 'withdraw', 'withdraw_btn',
        'button[aria-label*="Pending"], button[aria-label*="Retirar"], button[aria-label*="Withdraw"], button[aria-label*="Remove connection"]');
      const selectors = [
        withdrawSel,
        'button[aria-label*="Pending"]',
        'button[aria-label*="Remove connection"]',
        'button[aria-label*="Retirar"]',
        'button[aria-label*="Withdraw"]',
      ];
      let btn = null;
      for (const sel of selectors) {
        btn = document.querySelector(sel);
        if (btn) break;
      }
      if (!btn) {
        const allBtns = Array.from(document.querySelectorAll('button'));
        btn = allBtns.find(b => {
          const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
          return txt === 'pendiente' || txt === 'pending' || txt === 'retirar invitación' ||
                 txt === 'withdraw' || txt === 'eliminar conexión' || txt === 'remove connection';
        });
      }
      if (!btn) {
        reportSelectorFailure(platform, 'withdraw', 'withdraw_btn', withdrawSel,
          document.querySelector('.pvs-profile-actions, .pv-top-card-v2-ctas')?.innerHTML
          ?? document.body.innerHTML.substring(0, 3000));
        console.warn('[cazary.ai][SelectorHealing] selector_failure: withdraw_btn');
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'withdraw', success: false, reason: 'button_not_found', lead_id: leadId } });
        return;
      }
      simulateClick(btn);
      await sleep(1200);
      // Confirm dialog if present
      const confirmBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = confirmBtns.find(b => {
        const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
        return txt === 'retirar' || txt === 'withdraw' || txt === 'confirmar' || txt === 'confirm';
      });
      if (confirmBtn) {
        simulateClick(confirmBtn);
        await sleep(1000);
      }
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'withdraw', success: true, reason: 'withdrawn', lead_id: leadId } });
    } catch (err) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'withdraw', success: false, reason: err.message ?? 'unknown_error', lead_id: leadId } });
    }
  }

  async function executeFindEmail(taskId, leadId) {
    try {
      await sleep(2000);
      // Open contact info overlay
      const contactLink = document.querySelector('a[href*="overlay/contact-info"]') ||
        Array.from(document.querySelectorAll('a, button')).find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt.includes('información de contacto') || txt.includes('contact info');
        });
      if (!contactLink) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'find_email', success: false, reason: 'contact_link_not_found', lead_id: leadId } });
        return;
      }
      simulateClick(contactLink);
      await sleep(1500);
      // Extract email
      const mailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      const foundEmail = mailLinks.length > 0
        ? mailLinks[0].href.replace('mailto:', '').split('?')[0].trim()
        : null;
      if (!foundEmail) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'find_email', success: false, reason: 'email_not_found', lead_id: leadId } });
        return;
      }
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'find_email', success: true, lead_id: leadId, data: { email: foundEmail } } });
    } catch (err) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'find_email', success: false, reason: err.message ?? 'unknown_error', lead_id: leadId } });
    }
  }

  async function executeFindPhone(taskId, leadId) {
    try {
      await sleep(2000);
      const contactLink = document.querySelector('a[href*="overlay/contact-info"]') ||
        Array.from(document.querySelectorAll('a, button')).find(el => {
          const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          return txt.includes('información de contacto') || txt.includes('contact info');
        });
      if (!contactLink) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'find_phone', success: false, reason: 'contact_link_not_found', lead_id: leadId } });
        return;
      }
      simulateClick(contactLink);
      await sleep(1500);
      const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
      const foundPhone = telLinks.length > 0
        ? telLinks[0].href.replace('tel:', '').trim()
        : null;
      if (!foundPhone) {
        safeSendMessage({ type: 'ACTION_DONE', taskId,
          result: { action: 'find_phone', success: false, reason: 'phone_not_found', lead_id: leadId } });
        return;
      }
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'find_phone', success: true, lead_id: leadId, data: { phone: foundPhone } } });
    } catch (err) {
      safeSendMessage({ type: 'ACTION_DONE', taskId,
        result: { action: 'find_phone', success: false, reason: err.message ?? 'unknown_error', lead_id: leadId } });
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
      case 'check_connection': await executeCheckConnection(taskId, params.leadId, params.campaignId);              break;
      case 'check_inbox':      await executeCheckInbox(taskId, params.campaignId);                                  break;
      case 'follow':           await executeFollow(taskId, params.leadId, params.campaignId);                       break;
      case 'unfollow':         await executeUnfollow(taskId, params.leadId, params.campaignId);                     break;
      case 'disconnect':       await executeDisconnect(taskId, params.leadId, params.campaignId);                   break;
      case 'like':             await executeLikePost(taskId, params.leadId, params.campaignId);                     break;
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
                  await executeLikePost(msg.taskId, msg.leadId, msg.campaignId);
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
            const detected = detectOwnProfile();
            sendResponse({ success: !!detected });
            break;
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
