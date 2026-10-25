/**
 * Tiny blocking theme bootstrap: runs before first paint so light-theme users
 * never see a dark flash. Kept as its own external file (CSP forbids inline).
 */
(function () {
  var resolved = 'dark';
  var override = null;
  try {
    override = new URLSearchParams(location.search).get('theme');
  } catch (e) { /* very old browsers */ }
  try {
    var raw = localStorage.getItem('chatlauncher:settings');
    var pref = raw ? JSON.parse(raw).theme : null;
    if (override === 'light' || override === 'dark') {
      resolved = override;
    } else if (pref === 'light' || pref === 'dark') {
      resolved = pref;
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (e) {
    resolved =
      override === 'light' || override === 'dark'
        ? override
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  }
  document.documentElement.dataset.theme = resolved;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1020' : '#eef0fb');
})();
