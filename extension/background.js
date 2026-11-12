/**
 * Chat Launcher extension — MV3 service worker.
 * Context menu + toolbar button + selection events all funnel into one thing:
 * opening the PWA with the number pre-filled (?number=…).
 */

const DEFAULT_SITE = 'https://avithegod2010.github.io/chat-launcher/';

let cachedSite = DEFAULT_SITE;
chrome.storage.sync.get({ site: DEFAULT_SITE }, ({ site }) => {
  cachedSite = site || DEFAULT_SITE;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.site?.newValue) cachedSite = changes.site.newValue;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'chatlauncher-open',
      title: 'Open in Chat Launcher ("%s")',
      contexts: ['selection', 'link'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const raw = info.selectionText ?? info.linkUrl ?? '';
  openFor(raw);
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: cachedSite }));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'chatlauncher-open' && typeof msg.text === 'string') {
    openFor(msg.text);
    sendResponse({ ok: true });
  }
  return false;
});

/** Extract the first plausible phone number and open the site pre-filled. */
function openFor(raw) {
  const text = String(raw ?? '');
  const mined = text.match(/\+?\d[\d\s\-().]{6,18}\d/);
  const candidate = mined?.[0];
  const url = candidate
    ? `${cachedSite}/?number=${encodeURIComponent(candidate.replace(/\s+/g, ''))}`
    : cachedSite;
  chrome.tabs.create({ url });
}
