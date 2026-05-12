(function() {
  var script = document.currentScript;
  var slug = script.getAttribute('data-slug');
  if (!slug) { console.error('VendéPro Widget: falta data-slug'); return; }

  var host = script.getAttribute('data-host') || 'https://app.vendepro.com.ar';

  var iframe = document.createElement('iframe');
  iframe.src = host + '/widget/' + encodeURIComponent(slug);
  iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:580px;border:none;z-index:99999;background:transparent;pointer-events:none;';
  iframe.allow = 'clipboard-write';
  iframe.title = 'Chat VendéPro';

  document.body.appendChild(iframe);

  window.addEventListener('message', function(e) {
    if (e.source !== iframe.contentWindow) return;
    if (e.data && e.data.type === 'vendepro-widget-resize') {
      iframe.style.width = e.data.width + 'px';
      iframe.style.height = e.data.height + 'px';
      iframe.style.pointerEvents = e.data.interactive ? 'auto' : 'none';
    }
  });
})();
