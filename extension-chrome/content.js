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
      const degreeSelectors = [
        '.profile-topcard-person-entity__degree-distance',
        '[data-anonymize="person-degree"]',
        '.dist-value',
        '.profile-topcard__distance',
      ];
      for (const sel of degreeSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent?.trim() ?? '';
          const is1st = text.includes('1') && !text.includes('12') && !text.includes('1,');
          console.log(`[NexusAI] SalesNav degree: "${text}" → is1st=${is1st}`);
          return is1st;
        }
      }
      return false;
    } else {
      const hasMessage = Array.from(document.querySelectorAll('button')).some(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        return t === 'mensaje' || t === 'message';
      });
      const hasConnect = Array.from(document.querySelectorAll('button')).some(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        return t === 'conectar' || t === 'connect';
      });
      return hasMessage && !hasConnect;
    }
  }

  function isPendingConnection() {
    return Array.from(document.querySelectorAll('button, span')).some(el => {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      return t.includes('pendiente') || t.includes('pending') ||
             t.includes('retirar') || t.includes('withdraw');
    });
  }

  // ── Helpers de menú overflow ──────────────────────────────────────────────

  async function clickMoreButton() {
    const candidates = Array.from(document.querySelectorAll(
      'button, [role="button"], div[class*="overflow"]'
    )).filter(el => {
      if (!el.offsetParent) return false;
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      const text  = (el.innerText || el.textContent || '').trim().toLowerCase();
      const cls   = (el.className || '').toLowerCase();
      return label.includes('más acciones') || label.includes('more actions') ||
             label.includes('opciones adicionales') || label.includes('overflow') ||
             text === '...' || text === '•••' || text === 'más' || text === 'more' ||
             cls.includes('overflow') || cls.includes('dropdown__trigger');
    });
    if (!candidates.length) {
      console.warn('[NexusAI] clickMoreButton: ningún botón "..." encontrado');
      return false;
    }
    console.log('[NexusAI] clickMoreButton: encontrado', candidates[0].outerHTML.slice(0, 100));
    simulateClick(candidates[0]);
    await sleep(900);
    return true;
  }

  function findMenuItemByText(...keywords) {
    const selectors = [
      '[role="menuitem"]', '[role="option"]',
      '.artdeco-dropdown__item', 'li[class*="artdeco-dropdown"]',
      '[data-control-name]', 'li[class*="dropdown"]',
      'div[class*="dropdown-option"]',
    ];
    for (const sel of selectors) {
      const items = Array.from(document.querySelectorAll(sel));
      const found = items.find(el => {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        return keywords.some(kw => t.includes(kw.toLowerCase()));
      });
      if (found) {
        console.log(`[NexusAI] findMenuItemByText("${keywords[0]}"): found via ${sel}`);
        return found;
      }
    }
    const allItems = Array.from(document.querySelectorAll(
      '[role="menuitem"], [role="option"], .artdeco-dropdown__item'
    )).filter(el => el.offsetParent);
    if (allItems.length) {
      console.warn(`[NexusAI] findMenuItemByText("${keywords[0]}"): NOT FOUND. Items disponibles:`,
        allItems.map(el => (el.innerText || '').trim()).filter(Boolean)
      );
    }
    return null;
  }

  // ── Extraer perfil LinkedIn estándar ─────────────────────────────────────

  function extractLinkedInProfile() {
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

    const headline = getText([
      '.pv-text-details__left-panel .text-body-medium.break-words',
      'div.text-body-medium.break-words',
      '.ph5 .mt2 div:first-child',
      '.text-body-medium',
    ]);

    const company = getText([
      '.pv-text-details__right-panel .inline-show-more-text',
      '.pv-top-card--list li:nth-child(2)',
      'button[aria-label*="empresa"]',
      '.pv-text-details__right-panel span',
    ]);

    const location = getText([
      '.pv-text-details__left-panel .text-body-small.inline.t-black--light.break-words',
      '.pv-top-card--list-bullet li span',
    ]);

    const about = getText([
      '.pv-shared-text-with-see-more span[aria-hidden="true"]',
      '#about ~ div div div span[aria-hidden="true"]',
    ]);

    const connections = getText([
      '.pv-top-card--list-bullet li span.t-bold',
      '[data-field="connections_count"]',
    ]);

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
    const nameEl =
      document.querySelector('.profile-nav-card-mini__title') ||
      document.querySelector('[data-anonymize="person-name"]') ||
      document.querySelector('.feed-identity-module__actor-meta .t-bold') ||
      document.querySelector('.global-nav__me-photo + span') ||
      document.querySelector('.profile-nav-card-mini__profile-picture ~ div .t-bold');

    const imgEl =
      document.querySelector('.profile-nav-card-mini__profile-picture img') ||
      document.querySelector('.feed-identity-module__actor-meta img') ||
      document.querySelector('.global-nav__me-photo');

    const headlineEl =
      document.querySelector('.profile-nav-card-mini__headline') ||
      document.querySelector('.feed-identity-module__actor-meta .t-14');

    const name = nameEl?.textContent?.trim() || nameEl?.innerText?.trim();
    if (!name) return;

    const profile = {
      name,
      profile_url:  'https://www.linkedin.com/in/me/',
      headline:     headlineEl?.textContent?.trim() ?? '',
      avatar_url:   imgEl?.src ?? '',
      detected_at:  new Date().toISOString(),
    };

    safeStorageSet({ linkedin_profile: profile });
    safeSendMessage({ type: 'LINKEDIN_PROFILE_DETECTED', profile });
  }

  if (window.location.hostname === 'www.linkedin.com') {
    const path = window.location.pathname;
    if (path === '/feed/' || path === '/feed' || path.startsWith('/in/me') || path === '/') {
      setTimeout(detectOwnProfile, 2000);
      setTimeout(detectOwnProfile, 5000);
    }
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
    console.log(`[NexusAI] Inbox observer activo para ${isSnInbox ? 'SalesNav' : 'LinkedIn'}`);
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

  // ── ACCIÓN 2: CONNECT ─────────────────────────────────────────────────────

  async function executeConnect(taskId, note, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[NexusAI] executeConnect platform=${platform} leadId=${leadId}`);
    await sleep(2500 + Math.random() * 1500);

    if (isFirstDegreeConnection()) {
      console.log('[NexusAI] Already 1st degree');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'already_connected',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    if (isPendingConnection()) {
      console.log('[NexusAI] Connection pending');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'already_pending',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    if (platform === 'salesnav') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(1000);

      const opened = await clickMoreButton();
      if (!opened) {
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'more_button_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }

      const connectItem = findMenuItemByText('conectar', 'connect', 'invitar', 'invite');
      if (!connectItem) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
          action: 'connect', success: false, reason: 'connect_item_not_found',
          lead_id: leadId, campaign_id: campaignId,
        }});
      }
      simulateClick(connectItem);

    } else {
      window.scrollTo({ top: 200, behavior: 'smooth' });
      await sleep(1200);

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
                 (label.includes('connect')  && !label.includes('follow') && !label.includes('message'));
        });
        if (connectBtn) break;
        await sleep(800);
      }

      if (!connectBtn) {
        const opened = await clickMoreButton();
        if (!opened) {
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        const item = findMenuItemByText('conectar', 'connect');
        if (!item) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
            action: 'connect', success: false, reason: 'button_not_found',
            lead_id: leadId, campaign_id: campaignId,
          }});
        }
        simulateClick(item);
      } else {
        simulateClick(connectBtn);
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
        const field = document.querySelector(
          'textarea#custom-message, textarea[name="message"], ' +
          'textarea[placeholder*="nota"], textarea[placeholder*="note"]'
        );
        if (field) {
          field.focus();
          field.value = '';
          document.execCommand('insertText', false, note.slice(0, 300));
          field.dispatchEvent(new Event('input',  { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(400);
        }
      }
    }

    let sendBtn = null;
    for (let i = 0; i < 6; i++) {
      sendBtn = Array.from(document.querySelectorAll(
        'button, [role="button"], [data-test-modal] button'
      )).find(el => {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return t === 'enviar' || t === 'send' ||
               t.includes('enviar sin') || t.includes('send without') ||
               t.includes('enviar invit') || t.includes('send invit') ||
               t.includes('enviar ahora') || t.includes('send now');
      });
      if (sendBtn) break;
      await sleep(600);
    }

    if (!sendBtn) {
      const modal = document.querySelector('.artdeco-modal,[role="dialog"],.send-invite');
      console.warn('[NexusAI] Send btn not found. Modal:',
        modal ? modal.innerHTML.slice(0, 800) : 'NO MODAL');
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'connect', success: false, reason: 'send_button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(sendBtn);
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

    console.log(`[NexusAI] connect done: success=${!modalOpen}`);
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'connect', success: !modalOpen,
      lead_id: leadId, campaign_id: campaignId,
      connection_note: note || '',
    }});
  }

  // ── ACCIÓN 3: SEND MESSAGE ────────────────────────────────────────────────

  async function executeMessage(taskId, text, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[NexusAI] executeMessage platform=${platform} leadId=${leadId}`);
    await sleep(2000 + Math.random() * 1500);
    window.scrollTo({ top: 200, behavior: 'smooth' });
    await sleep(1000);

    const msgBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find(el => {
      const t     = (el.innerText || el.textContent || '').trim().toLowerCase();
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      return t === 'mensaje' || t === 'message' ||
             label.includes('mensaje') || label.includes('message') ||
             label.includes('inmail');
    });

    if (!msgBtn) {
      return safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
        action: 'message', success: false, reason: 'button_not_found',
        lead_id: leadId, campaign_id: campaignId,
      }});
    }

    simulateClick(msgBtn);
    await sleep(2200);

    let inputEl = null;

    if (platform === 'salesnav') {
      for (let i = 0; i < 4; i++) {
        inputEl =
          document.querySelector('textarea.message-anywhere-compose-box__msg-body') ||
          document.querySelector('.compose-message__textarea') ||
          document.querySelector('[data-test-compose-message-textarea]') ||
          document.querySelector('textarea[placeholder*="mensaje"], textarea[placeholder*="message"]') ||
          document.querySelector('.inmail-compose-form textarea') ||
          document.querySelector('[contenteditable="true"][role="textbox"]') ||
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
          document.querySelector('[data-artdeco-is-focused][contenteditable="true"]');
        if (inputEl) break;
        await sleep(700);
      }
    }

    if (!inputEl) {
      console.warn('[NexusAI] Message input not found. Page HTML fragment:',
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

    let sendBtn = null;
    if (platform === 'salesnav') {
      sendBtn =
        document.querySelector('button[data-test-inmail-compose-send-btn]') ||
        document.querySelector('.inmail-compose-form button[type="submit"]') ||
        document.querySelector('[data-test-compose-send-btn]') ||
        Array.from(document.querySelectorAll('button')).find(b => {
          const t = (b.innerText || '').trim().toLowerCase();
          return (t === 'enviar' || t === 'send') && b.offsetParent;
        });
    } else {
      sendBtn =
        document.querySelector('.msg-form__send-button:not([disabled])') ||
        document.querySelector('button.msg-form__send-button') ||
        document.querySelector('button[type="submit"][class*="send"]');
    }

    if (sendBtn && !sendBtn.disabled) {
      simulateClick(sendBtn);
    } else {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ctrlKey: false }));
    }

    await sleep(1000);
    console.log(`[NexusAI] message sent platform=${platform} leadId=${leadId}`);
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

    console.log(`[NexusAI] checkConnection platform=${platform} connected=${connected} pending=${pending}`);
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
    console.log(`[NexusAI] executeFollow platform=${platform}`);
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

    simulateClick(followBtn);
    await sleep(800);
    console.log('[NexusAI] follow done');
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'follow', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
  }

  // ── ACCIÓN 5b: UNFOLLOW ───────────────────────────────────────────────────

  async function executeUnfollow(taskId, leadId, campaignId) {
    const platform = getPlatform();
    console.log(`[NexusAI] executeUnfollow platform=${platform}`);
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
    console.log('[NexusAI] unfollow done');
    safeSendMessage({ type: 'ACTION_DONE', taskId, result: {
      action: 'unfollow', success: true, lead_id: leadId, campaign_id: campaignId,
    }});
  }

  // ── ACCIÓN 6: DISCONNECT ──────────────────────────────────────────────────

  async function executeDisconnect(taskId, leadId, campaignId) {
    console.log('[NexusAI] executeDisconnect');
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
    console.log('[NexusAI] executeLikePost');
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
    console.log('[NexusAI] executeCommentPost');
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

    console.log(`[NexusAI] checkInbox isSalesNav=${isSalesNav}`);

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
      if (convItems.length) { console.log(`[NexusAI] LI inbox selector: ${sel} → ${convItems.length} convs`); break; }
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

    console.log(`[NexusAI] LI inbox: ${unreadConvs.length} unread, ${results.length} procesando`);
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
      '.conversation-list-item',
      '[data-test-list-item]',
      '.inbox-list-item',
      '[class*="conversation-list__item"]',
      'li[class*="conversation"]',
    ];

    let convItems = [];
    for (const sel of convSelectors) {
      convItems = Array.from(document.querySelectorAll(sel));
      if (convItems.length) { console.log(`[NexusAI] SN inbox selector: ${sel} → ${convItems.length}`); break; }
    }

    if (!convItems.length) {
      console.warn('[NexusAI] SalesNav inbox: no conversations found. DOM sample:',
        document.body.innerHTML.slice(0, 400));
    }

    const unreadConvs = convItems.filter(el =>
      el.querySelector('[class*="unread-indicator"], [class*="badge"], .artdeco-notification-badge') ||
      el.classList.toString().includes('unread') ||
      el.querySelector('[aria-label*="unread"], [aria-label*="no leído"]')
    );

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

    console.log(`[NexusAI] SN inbox: ${unreadConvs.length} unread, ${results.length} procesando`);
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

  // ── Escuchar tareas inyectadas por background via postMessage ────────────

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'NEXUSAI_TASK') return;

    const { task, taskId, ...params } = event.data;

    switch (task) {
      case 'view_profile':     await executeViewProfile(taskId);                                                     break;
      case 'connect':          await executeConnect(taskId, params.note, params.leadId, params.campaignId);         break;
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
            console.log(`[NexusAI] execute_task recibido: ${msg.task} | taskId: ${msg.taskId}`);
            (async () => {
              switch (msg.task) {
                case 'view_profile':
                  await executeViewProfile(msg.taskId);
                  break;
                case 'connect':
                  await executeConnect(msg.taskId, msg.note ?? '', msg.leadId, msg.campaignId);
                  break;
                case 'message':
                  await executeMessage(msg.taskId, msg.text ?? '', msg.leadId, msg.campaignId);
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
                default:
                  console.warn('[NexusAI] execute_task desconocido:', msg.task);
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
