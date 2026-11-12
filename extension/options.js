/** Options page: override the Chat Launcher URL (e.g. a custom domain). */

const DEFAULT_SITE = 'https://avithegod2010.github.io/chat-launcher/';
const input = document.getElementById('baseUrl');
const ok = document.getElementById('ok');

chrome.storage.sync.get({ site: DEFAULT_SITE }, ({ site }) => {
  input.value = site;
});

document.getElementById('save').addEventListener('click', () => {
  let url = input.value.trim().replace(/\/+$/, '');
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return;
  } catch {
    return;
  }
  chrome.storage.sync.set({ site: url || DEFAULT_SITE }, () => {
    ok.hidden = false;
    setTimeout(() => (ok.hidden = true), 1600);
  });
});
