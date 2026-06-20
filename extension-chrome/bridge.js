// bridge.js — Content script inyectado en proyecto-linkedin-ai.vercel.app
// Permite que la webapp se comunique con background.js via window.postMessage
// ya que chrome.runtime.sendMessage no funciona desde páginas externas sin externally_connectable

(function () {
  if (window.__cazaryBridgeLoaded) return;
  window.__cazaryBridgeLoaded = true;

  // Señal para que la webapp sepa que el bridge está activo
  window.postMessage({ type: 'CAZARY_BRIDGE_READY' }, '*');

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data?.type?.startsWith('CAZARY_REQ_')) return;

    const { type, payload, requestId } = event.data;
    const msgType = type.replace('CAZARY_REQ_', '');

    try {
      const response = await chrome.runtime.sendMessage({ type: msgType, ...payload });
      window.postMessage({ type: 'CAZARY_RES_' + requestId, response }, '*');
    } catch (e) {
      window.postMessage({ type: 'CAZARY_RES_' + requestId, error: e.message }, '*');
    }
  });

  console.log('[cazary.ai] bridge.js cargado en', window.location.hostname);
})();
