/**
 * Content script: when the user selects text that contains a phone number,
 * float a small "launch" pill near it. Clicking it asks the service worker
 * to open Chat Launcher with the number pre-filled. tel: links get the pill
 * as well. All styling is inline — CSP-safe on every site.
 */

const PILL_ID = 'chatlauncher-pill';
const NUMBER_RE = /\+?\d[\d\s\-().]{6,18}\d/;

let currentText = '';

function removePill() {
  document.getElementById(PILL_ID)?.remove();
  currentText = '';
}

function launch(text) {
  chrome.runtime.sendMessage({ type: 'chatlauncher-open', text });
  removePill();
}

function showPill(x, y, text) {
  removePill();
  currentText = text;
  const pill = document.createElement('button');
  pill.id = PILL_ID;
  pill.type = 'button';
  pill.textContent = '💬 Open chat';
  pill.setAttribute('style', [
    'position: fixed',
    `left: ${Math.min(x, window.innerWidth - 140)}px`,
    `top: ${Math.min(y + 12, window.innerHeight - 44)}px`,
    'z-index: 2147483647',
    'padding: 7px 14px',
    'border: none',
    'border-radius: 999px',
    'background: linear-gradient(135deg, #4f46e5, #7c3aed)',
    'color: #fff',
    'font: 600 13px/1 system-ui, sans-serif',
    'cursor: pointer',
    'box-shadow: 0 10px 24px -8px rgba(0,0,0,.55)',
  ].join(';'));
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    launch(currentText);
  });
  document.documentElement.append(pill);
}

document.addEventListener('selectionchange', () => {
  const sel = document.getSelection?.();
  const text = sel?.toString().trim() ?? '';
  if (text && text.length <= 120 && NUMBER_RE.test(text)) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showPill(rect.left, rect.bottom, text);
  } else {
    removePill();
  }
});

document.addEventListener('scroll', removePill, { passive: true });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removePill();
});
