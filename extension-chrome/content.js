// ============================================================
// NEXUSAI — CONTENT SCRIPT
// Extractor de perfiles LinkedIn/SalesNav + ejecutor de acciones
// ============================================================

(function () {
  'use strict';

  // ── Evitar doble inyección ────────────────────────────────────────────────
  if (window.__nexusai_loaded__) return;
  window.__nexusai_loaded__ = true;

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

  function simulateClick(el) {
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.click();
    return true;
  }

  function typeIntoField(el, text) {
    if (!el) return false;
    el.focus();
    el.value = '';
    // Usar execCommand para que React/Angular detecten el cambio
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // ── Detectar si es Sales Navigator ───────────────────────────────────────

  function isSalesNavigator() {
    return window.location.hostname.includes('linkedin.com') &&
           window.location.pathname.startsWith('/sales');
  }

  // ── Extraer perfil LinkedIn estándar ─────────────────────────────────────

  function extractLinkedInProfile() {
    // Nombre
    let name = getText([
      'h1.text-heading-xlarge',
      '.pv-text-details__left-panel h1',
      'h1[data-generated-suggestion-target]',
      'h1',
    ]);
    if (!name) {
      const m = document.title.replace(/^\(\d+\)\s*/, '').match(/^(.+?)\s*[|\-–]/);
      if (m) name = m[1].trim();
    }

    // Titular
    const headline = getText([
      '.pv-text-details__left-panel .text-body-medium.break-words',
      'div.text-body-medium.break-words',
      '.ph5 .mt2 div:first-child',
      '.text-body-medium',
    ]);

    // Empresa actual
    const company = getText([
      '.pv-text-details__right-panel .inline-show-more-text',
      '.pv-top-card--list li:nth-child(2)',
      'button[aria-label*="empresa"]',
      '.pv-text-details__right-panel span',
    ]);

    // Ubicación
    const location = getText([
      '.pv-text-details__left-panel .text-body-small.inline.t-black--light.break-words',
      '.pv-top-card--list-bullet li span',
    ]);

    // Extracto/About
    const about = getText([
      '.pv-shared-text-with-see-more span[aria-hidden="true"]',
      '#about ~ div div div span[aria-hidden="true"]',
    ]);

    // Conexiones
    const connections = getText([
      '.pv-top-card--list-bullet li span.t-bold',
      '[data-field="connections_count"]',
    ]);

    // Experiencia reciente
    const expItems = getAll('#experience ~ div .pvs-list__paged-list-item').slice(0, 3);
    const experience = expItems.map((el) => {
      const title   = (el.querySelector('.t-bold span[aria-hidden="true"]') || el.querySelector('.t-bold'))?.innerText?.trim();
      const company = (el.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[0])?.innerText?.trim();
      const dates   = (el.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]')[1])?.innerText?.trim();
      return [title, company, dates].filter(Boolean).join(' · ');
    }).filter(Boolean);

    return {
      name:        name       || 'No encontrado',
      headline:    headline   || '',
      company:     company    || '',
      location:    location   || '',
      about:       about      || '',
      connections: connections || '',
      experience,
      url:         window.location.href,
      source:      'linkedin',
      extractedAt: new Date().toISOString(),
    };
  }

  // ── Extraer perfil Sales Navigator ───────────────────────────────────────

  function extractSalesNavProfile() {
    const name = getText([
      '.profile-topcard-person-entity__name',
      '[data-anonymize="person-name"]',
      'h1',
    ]);

    const headline = getText([
      '.profile-topcard__summary-position .profile-topcard__job-title',
      '.profile-topcard__summary-position',
      '[data-anonymize="headline"]',
    ]);

    const company = getText([
      '.profile-topcard__current-positions .profile-topcard__company-name',
      '[data-anonymize="company-name"]',
    ]);

    const location = getText([
      '.profile-topcard__location',
      '[data-anonymize="location"]',
    ]);

    return {
      name:        name     || 'No encontrado',
      headline:    headline || '',
      company:     company  || '',
      location:    location || '',
      about:       '',
      connections: '',
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

  // ── ACCIÓN: Enviar solicitud de conexión ──────────────────────────────────

  async function sendConnectionRequest(payload) {
    const { note } = payload || {};

    // Buscar botón "Conectar"
    const connectBtn = Array.from(document.querySelectorAll('button')).find((b) => {
      const text = b.innerText?.trim().toLowerCase();
      return text === 'conectar' || text === 'connect';
    });

    if (!connectBtn) {
      // Puede estar en el menú "Más"
      const moreBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText?.trim().toLowerCase() === 'más' || b.innerText?.trim().toLowerCase() === 'more'
      );
      if (moreBtn) {
        simulateClick(moreBtn);
        await sleep(800);
        const connectInMenu = Array.from(document.querySelectorAll('[role="menuitem"]')).find((el) =>
          el.innerText?.toLowerCase().includes('conectar') || el.innerText?.toLowerCase().includes('connect')
        );
        if (!connectInMenu) return { success: false, error: 'Botón conectar no encontrado en menú' };
        simulateClick(connectInMenu);
      } else {
        return { success: false, error: 'Botón conectar no encontrado' };
      }
    } else {
      simulateClick(connectBtn);
    }

    await sleep(1200);

    // Modal "Agregar nota"
    if (note) {
      const addNoteBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText?.toLowerCase().includes('nota') || b.innerText?.toLowerCase().includes('note')
      );
      if (addNoteBtn) {
        simulateClick(addNoteBtn);
        await sleep(600);
        const noteField = document.querySelector('textarea#custom-message');
        if (noteField) {
          typeIntoField(noteField, note.slice(0, 300)); // LinkedIn limit
          await sleep(400);
        }
      }
    }

    // Enviar
    const sendBtn = Array.from(document.querySelectorAll('button')).find((b) => {
      const t = b.innerText?.toLowerCase();
      return t === 'enviar' || t === 'send' || t === 'enviar invitación' || t === 'send invitation';
    });

    if (sendBtn) {
      simulateClick(sendBtn);
      await sleep(800);
      return { success: true, action: 'connection_sent' };
    }

    return { success: false, error: 'Botón enviar no encontrado' };
  }

  // ── ACCIÓN: Enviar mensaje directo ────────────────────────────────────────

  async function sendDirectMessage(payload) {
    const { messageText } = payload || {};
    if (!messageText) return { success: false, error: 'Sin texto de mensaje' };

    // Buscar botón Mensaje
    const msgBtn = Array.from(document.querySelectorAll('button')).find((b) => {
      const t = b.innerText?.trim().toLowerCase();
      return t === 'mensaje' || t === 'message';
    });

    if (!msgBtn) return { success: false, error: 'Botón Mensaje no encontrado — ¿son 1er grado?' };

    simulateClick(msgBtn);
    await sleep(1500);

    // Campo de texto del mensaje
    const textBox = document.querySelector(
      '.msg-form__contenteditable[contenteditable="true"], ' +
      '[role="textbox"][data-placeholder]'
    );

    if (!textBox) return { success: false, error: 'Campo de texto no encontrado' };

    // Escribir mensaje
    textBox.focus();
    textBox.innerText = messageText;
    textBox.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);

    // Enviar
    const submitBtn = document.querySelector(
      '.msg-form__send-button, button[type="submit"][class*="send"]'
    );

    if (submitBtn && !submitBtn.disabled) {
      simulateClick(submitBtn);
      await sleep(600);
      return { success: true, action: 'message_sent' };
    }

    // Fallback: Enter
    textBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(600);
    return { success: true, action: 'message_sent_enter' };
  }

  // ── ACCIÓN: Like a una publicación ───────────────────────────────────────

  async function likePost() {
    // Buscar el primer post no likeado
    const likeButtons = Array.from(document.querySelectorAll('button[aria-label*="Me gusta"], button[aria-label*="Like"]'))
      .filter((b) => !b.classList.contains('active') && b.getAttribute('aria-pressed') !== 'true');

    if (likeButtons.length === 0) return { success: false, error: 'No hay publicaciones para likear' };

    simulateClick(likeButtons[0]);
    await sleep(500);
    return { success: true, action: 'post_liked' };
  }

  // ── ACCIÓN: Visitar perfil (solo registro) ────────────────────────────────

  async function visitProfile() {
    // La navegación ya fue hecha por background.js
    // Solo esperamos que cargue y devolvemos éxito
    await sleep(2000);
    return { success: true, action: 'profile_visited' };
  }

  // ── Listener de mensajes desde background.js ──────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      try {
        let result;
        switch (msg.action) {

          case 'extract_profile':
            result = isSalesNavigator()
              ? extractSalesNavProfile()
              : extractLinkedInProfile();
            sendResponse({ success: true, data: result });
            break;

          case 'extract_inbox':
            sendResponse({ success: true, data: extractInboxMessages() });
            break;

          case 'send_connection':
            result = await sendConnectionRequest(msg.payload);
            sendResponse(result);
            break;

          case 'send_message':
            result = await sendDirectMessage(msg.payload);
            sendResponse(result);
            break;

          case 'like_post':
            result = await likePost();
            sendResponse(result);
            break;

          case 'visit_profile':
            result = await visitProfile();
            sendResponse(result);
            break;

          case 'count_search_results':
            // Esperar a que LinkedIn termine de renderizar el contador
            await sleep(2500);
            result = extractSearchCount();
            sendResponse({ success: true, count: result, url: window.location.href });
            break;

          default:
            sendResponse({ success: false, error: `Acción desconocida: ${msg.action}` });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // async
  });

  // ── Extraer conteo de resultados de búsqueda ─────────────────────────────

  function extractSearchCount() {
    // LinkedIn estándar: "Aproximadamente X resultados"
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

    // Sales Navigator: número en el header
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

    // Fallback: buscar cualquier texto con patrón "X results" o "X resultados"
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

  // ── Auto-extracción al cargar un perfil ───────────────────────────────────
  // Notifica al background que se cargó un perfil de LinkedIn

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
        chrome.runtime.sendMessage({
          type:    'PROFILE_LOADED',
          profile,
        }).catch(() => {}); // background puede no estar escuchando
      }
    }, 2000);
  }

  // Ejecutar al cargar y en navegación SPA de LinkedIn
  onProfilePageLoad();

  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      onProfilePageLoad();
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
