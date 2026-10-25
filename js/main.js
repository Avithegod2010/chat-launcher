/**
 * Chat Launcher — application entry point.
 * Wires state, rendering, events, keyboard shortcuts, URL params,
 * service-worker updates and the PWA install prompt.
 */
import { APPS, DEFAULT_ORDER, getApp, isAppleDevice } from './apps.js';
import { COUNTRIES, countryByIso, flagOf, matchDialCode, primaryCountryForDial } from './countries.js';
import { digitsOnly, formatAsYouType, isValid, parsePaste, toE164 } from './phone.js';
import { createHistory } from './history.js';
import {
  attachRipples,
  askText,
  burst,
  openDialog,
  prefersReducedMotion,
  safeStorage,
  shake,
  toast,
  vibrate,
  warnStorageOnce,
} from './ui.js';

const APP_VERSION = '1.0.0';
const SETTINGS_KEY = 'chatlauncher:settings';
const $ = (sel) => document.querySelector(sel);

/* ------------------------------------------------------------------ state */

const { ok: storageOk, backend: storage } = safeStorage();
const history = createHistory(storage);

/** @type {{theme: 'system'|'light'|'dark', country: string|null,
 *          order: string[], disabled: string[]}} */
let settings = loadSettings();

const state = {
  iso: settings.country ?? detectCountryIso() ?? 'US',
  national: '',
  message: '',
  defaultApp: null, // set via ?app=
};

function loadSettings() {
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(raw.theme) ? raw.theme : 'system',
      country: typeof raw.country === 'string' ? raw.country : null,
      order: Array.isArray(raw.order) ? raw.order.filter((id) => getApp(id)) : [...DEFAULT_ORDER],
      disabled: Array.isArray(raw.disabled) ? raw.disabled.filter((id) => getApp(id)) : [],
    };
  } catch {
    return { theme: 'system', country: null, order: [...DEFAULT_ORDER], disabled: [] };
  }
}

function saveSettings() {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* non-persistent mode */
  }
}

function detectCountryIso() {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && countryByIso(region)) return region;
  }
  return null;
}

/* ------------------------------------------------------------------ theme */

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const resolved =
    settings.theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = resolved;
  $('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b1020' : '#eef0fb');
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
  saveSettings();
  const flip = () => applyTheme();
  if (document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(flip);
  } else {
    flip();
  }
  toast(`Theme: ${settings.theme}`);
}

/* ------------------------------------------------------------------ input */

const phoneInput = $('#phone');
const validityDot = $('#validity');
const validityMsg = $('#validityMsg');

function currentE164() {
  const country = countryByIso(state.iso);
  if (!country) return null;
  return toE164(country.dial, state.national, { iso: state.iso });
}

function updateValidity() {
  const e = currentE164();
  const ok = !!e && isValid(e);
  validityDot.dataset.state = state.national ? (ok ? 'ok' : 'partial') : 'idle';
  if (!state.national) {
    validityDot.className = 'validity idle';
    validityMsg.textContent = '';
  } else if (ok) {
    validityDot.className = 'validity ok';
    validityMsg.textContent = `Looks good: +${e}`;
  } else {
    validityDot.className = 'validity partial';
    const country = countryByIso(state.iso);
    validityMsg.textContent = `Keep typing… ${country?.dial ?? ''} number, ${
      state.national.length
    } digits so far`;
  }
}

function setNational(digits) {
  state.national = digitsOnly(digits).slice(0, 15);
  phoneInput.value = formatAsYouType(state.national);
  updateValidity();
}

phoneInput.addEventListener('input', () => {
  setNational(phoneInput.value);
});

phoneInput.addEventListener('paste', (e) => {
  const text = e.clipboardData?.getData('text') ?? '';
  const parsed = parsePaste(text);
  if (parsed) {
    e.preventDefault();
    state.iso = parsed.iso;
    saveCountry();
    updateCountryChip();
    setNational(parsed.national);
    toast(`${flagOf(parsed.iso)} ${countryByIso(parsed.iso)?.name} detected`);
  }
  // Otherwise: let the native paste happen; the input handler strips formatting.
});

function saveCountry() {
  settings.country = state.iso;
  saveSettings();
}

/* ------------------------------------------------------------- country UI */

const countryChip = $('#countryChip');
const countrySheet = $('#countrySheet');
const countrySearch = $('#countrySearch');
const countryList = $('#countryList');

function updateCountryChip() {
  const c = countryByIso(state.iso);
  countryChip.querySelector('.flag').textContent = c ? flagOf(c.iso) : '🌐';
  countryChip.querySelector('.dial').textContent = c ? `+${c.dial}` : '+…';
}

function renderCountryList(filter = '') {
  const q = filter.trim().toLowerCase();
  const items = COUNTRIES.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.dial.startsWith(q.replace(/\D/g, '')),
  );
  countryList.replaceChildren(
    ...items.map((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sheet-item ripple' + (c.iso === state.iso ? ' active' : '');
      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = flagOf(c.iso);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = c.name;
      const dial = document.createElement('span');
      dial.className = 'dial';
      dial.textContent = `+${c.dial}`;
      btn.append(flag, name, dial);
      btn.addEventListener('click', () => {
        state.iso = c.iso;
        saveCountry();
        updateCountryChip();
        updateValidity();
        closeCountrySheet();
        phoneInput.focus();
      });
      return btn;
    }),
  );
}

function openCountrySheet() {
  countrySearch.value = '';
  renderCountryList();
  countrySheet.classList.add('open');
  countrySearch.focus();
}
function closeCountrySheet() {
  countrySheet.classList.remove('open');
}

countryChip.addEventListener('click', openCountrySheet);
countrySheet.querySelector('.sheet-backdrop').addEventListener('click', closeCountrySheet);
countrySheet.querySelector('.sheet-close').addEventListener('click', closeCountrySheet);
countrySearch.addEventListener('input', () => renderCountryList(countrySearch.value));

/* ------------------------------------------------------------------- tiles */

const grid = $('#grid');
const highlightClass = 'highlight';

function orderedApps() {
  const known = new Set(DEFAULT_ORDER);
  const ordered = [...settings.order, ...DEFAULT_ORDER.filter((id) => !settings.order.includes(id))];
  return ordered.filter((id) => known.has(id) && !settings.disabled.includes(id)).map(getApp);
}

function renderTiles() {
  const apps = orderedApps();
  grid.replaceChildren(
    ...apps.map((app, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile ripple';
      btn.dataset.app = app.id;
      btn.style.setProperty('--tile', app.color);
      btn.style.setProperty('--i', String(i));
      btn.setAttribute('aria-label', `Open chat in ${app.name}`);
      if (app.capability === 'limited') {
        const badge = document.createElement('span');
        badge.className = 'tile-badge';
        badge.textContent = 'app only';
        btn.append(badge);
      }
      const icon = document.createElement('span');
      icon.className = 'tile-icon';
      icon.innerHTML = app.icon;
      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = app.name;
      btn.append(icon, label);
      if (app.note) btn.title = app.note;
      if (app.id === state.defaultApp) btn.classList.add(highlightClass);
      btn.addEventListener('click', (e) => launch(app, e));
      return btn;
    }),
  );
}

/* ----------------------------------------------------------------- launch */

function launch(app, event) {
  const e164 = currentE164();
  if (!e164 || !isValid(e164)) {
    shake($('#heroCard'));
    toast('Enter a valid phone number first', { kind: 'warn' });
    phoneInput.focus();
    return;
  }
  history.add(e164);
  renderHistory();
  vibrate(8);
  if (event) {
    burst(event.clientX, event.clientY, app.color);
  }
  const url = app.buildUrl(e164, app.supportsMessage ? state.message : '');
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    // Popup blocked: fall back to same-tab navigation.
    location.href = url;
  }
}

function launchDefault() {
  const apps = orderedApps();
  const app = (state.defaultApp && getApp(state.defaultApp)) || apps[0];
  if (app) launch(app);
}

function launchByIndex(idx) {
  const app = orderedApps()[idx];
  if (app) launch(app);
}

/* ---------------------------------------------------------------- history */

const historyList = $('#historyList');

function flagForE164(e164) {
  const dial = matchDialCode(e164);
  if (!dial) return '🌐';
  const c = primaryCountryForDial(dial);
  return c ? flagOf(c.iso) : '🌐';
}

function renderHistory() {
  const entries = history.list();
  const empty = $('#historyEmpty');
  empty.hidden = entries.length > 0;
  $('#historyClear').hidden = entries.length === 0;

  historyList.replaceChildren(
    ...entries.map((entry) => {
      const wrap = document.createElement('div');
      wrap.className = 'chip-wrap';

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip ripple';
      const flag = document.createElement('span');
      flag.className = 'flag';
      flag.textContent = flagForE164(entry.e164);
      const label = document.createElement('span');
      label.className = 'chip-label';
      label.textContent = entry.label || formatAsYouType(entry.e164);
      chip.append(flag, label);
      if (entry.count > 1) {
        const count = document.createElement('span');
        count.className = 'chip-count';
        count.textContent = `×${entry.count}`;
        chip.append(count);
      }
      if (entry.pinned) {
        const pin = document.createElement('span');
        pin.className = 'chip-pin';
        pin.textContent = '📌';
        pin.setAttribute('aria-label', 'pinned');
        chip.append(pin);
      }
      chip.addEventListener('click', () => {
        const dial = matchDialCode(entry.e164);
        const c = dial ? COUNTRIES.find((x) => x.dial === dial) : null;
        if (c) {
          state.iso = c.iso;
          saveCountry();
          updateCountryChip();
        }
        setNational(entry.e164.slice(c ? c.dial.length : 0));
        phoneInput.focus();
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
      wrap.append(chip);

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'chip-more';
      more.setAttribute('aria-label', `Actions for ${entry.label || entry.e164}`);
      more.textContent = '⋯';
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        openChipMenu(more, entry);
      });
      wrap.append(more);
      return wrap;
    }),
  );
}

let openMenu = null;
function closeMenus() {
  openMenu?.remove();
  openMenu = null;
}

function openChipMenu(anchor, entry) {
  closeMenus();
  const menu = document.createElement('div');
  menu.className = 'menu';
  const mk = (label, fn, danger = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-item' + (danger ? ' danger' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      fn();
      closeMenus();
    });
    menu.append(b);
  };
  mk(entry.pinned ? 'Unpin' : 'Pin', () => {
    (entry.pinned ? history.unpin : history.pin).call(history, entry.e164);
    renderHistory();
  });
  mk('Rename', async () => {
    const label = await askText({
      title: 'Rename entry',
      value: entry.label || '',
      placeholder: 'e.g. Pizza place',
    });
    if (label !== null) {
      history.renameLabel(entry.e164, label);
      renderHistory();
    }
  });
  mk('Copy number', async () => {
    try {
      await navigator.clipboard.writeText(`+${entry.e164}`);
      toast('Number copied', { kind: 'good' });
    } catch {
      toast('Clipboard blocked by the browser', { kind: 'warn' });
    }
  });
  if (navigator.share) {
    mk('Share link', () => {
      navigator
        .share({ text: `Chat with +${entry.e164}`, url: shareUrl(entry.e164) })
        .catch(() => {});
    });
  }
  mk('Delete', () => {
    history.remove(entry.e164);
    renderHistory();
  }, true);

  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  const right = Math.min(r.right, window.innerWidth - 8);
  menu.style.left = `${Math.max(8, right - menu.offsetWidth)}px`;
  requestAnimationFrame(() => {
    const w = menu.offsetWidth;
    menu.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  });
  openMenu = menu;
}

function shareUrl(e164) {
  return `${location.origin}${location.pathname}?number=${encodeURIComponent('+' + e164)}`;
}

document.addEventListener('click', (e) => {
  if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.chip-more')) closeMenus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenus();
    closeCountrySheet();
  }
});

/* -------------------------------------------------------------- clear all */

const clearBtn = $('#historyClear');
let clearArmed = null;
clearBtn.addEventListener('click', () => {
  if (clearArmed) {
    clearTimeout(clearArmed);
    clearArmed = null;
    clearBtn.textContent = 'Clear all';
    clearBtn.classList.remove('armed');
    history.clear();
    renderHistory();
    toast('History cleared', { kind: 'good' });
  } else {
    clearBtn.textContent = 'Really clear?';
    clearBtn.classList.add('armed');
    clearArmed = setTimeout(() => {
      clearArmed = null;
      clearBtn.textContent = 'Clear all';
      clearBtn.classList.remove('armed');
    }, 2600);
  }
});

/* ---------------------------------------------------------------- dial pad */

const padToggle = $('#padToggle');
const pad = $('#dialPad');

function toggleDialPad(force) {
  const open = force ?? !document.body.classList.contains('pad-open');
  document.body.classList.toggle('pad-open', open);
  padToggle.setAttribute('aria-expanded', String(open));
}

padToggle.addEventListener('click', () => toggleDialPad());
pad.querySelectorAll('[data-key]').forEach((key) => {
  key.addEventListener('click', () => {
    const k = key.dataset.key;
    if (k === 'back') {
      setNational(state.national.slice(0, -1));
    } else if (k === 'paste') {
      navigator.clipboard
        ?.readText()
        .then((text) => {
          const parsed = parsePaste(text);
          if (parsed) {
            state.iso = parsed.iso;
            saveCountry();
            updateCountryChip();
            setNational(parsed.national);
          } else {
            setNational(text);
          }
        })
        .catch(() => toast('Clipboard unavailable', { kind: 'warn' }));
    } else {
      setNational(state.national + k);
    }
    phoneInput.focus({ preventScroll: true });
  });
});

/* ---------------------------------------------------------------- message */

const msgToggle = $('#msgToggle');
const msgInput = $('#message');

msgToggle.addEventListener('click', () => {
  const row = $('#messageRow');
  const open = row.classList.toggle('open');
  msgToggle.setAttribute('aria-expanded', String(open));
  msgToggle.textContent = open ? '− Message' : '+ Message';
  if (open) msgInput.focus();
  else if (!msgInput.value) state.message = '';
});
msgInput.addEventListener('input', () => {
  state.message = msgInput.value.slice(0, 300);
});

/* -------------------------------------------------------------- copy/share */

$('#copyBtn').addEventListener('click', async () => {
  const e164 = currentE164();
  if (!e164 || !isValid(e164)) {
    toast('Enter a valid number first', { kind: 'warn' });
    return;
  }
  try {
    await navigator.clipboard.writeText(`+${e164}`);
    toast('Number copied', { kind: 'good' });
  } catch {
    toast('Clipboard blocked by the browser', { kind: 'warn' });
  }
});

/* ---------------------------------------------------------------- settings */

const settingsDialog = $('#settingsDialog');

$('#settingsOpen').addEventListener('click', () => {
  renderSettings();
  settingsDialog.showModal();
});
$('#settingsClose').addEventListener('click', () => settingsDialog.close());

function renderSettings() {
  const themeGroup = $('#themeGroup');
  themeGroup.querySelectorAll('input').forEach((input) => {
    input.checked = input.value === settings.theme;
    input.onchange = () => {
      settings.theme = input.value;
      saveSettings();
      applyTheme();
    };
  });

  const list = $('#tileSettings');
  const all = [...settings.order, ...DEFAULT_ORDER.filter((id) => !settings.order.includes(id))];
  list.replaceChildren(
    ...all.map((id, i) => {
      const app = getApp(id);
      const row = document.createElement('div');
      row.className = 'tile-row';
      const name = document.createElement('span');
      name.className = 'tile-row-name';
      name.textContent = app.name;
      if (app.capability === 'limited') {
        const b = document.createElement('span');
        b.className = 'tile-badge';
        b.textContent = 'app only';
        name.append(b);
      }
      const controls = document.createElement('span');
      controls.className = 'tile-row-controls';
      const mk = (label, fn, disabled = false) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'icon-btn ripple';
        b.textContent = label;
        b.setAttribute('aria-label', `${label} ${app.name}`);
        b.disabled = disabled;
        b.addEventListener('click', fn);
        controls.append(b);
        return b;
      };
      mk('↑', () => moveTile(id, -1), i === 0);
      mk('↓', () => moveTile(id, +1), i === all.length - 1);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'switch' + (settings.disabled.includes(id) ? '' : ' on');
      toggle.setAttribute('role', 'switch');
      toggle.setAttribute('aria-checked', String(!settings.disabled.includes(id)));
      toggle.setAttribute('aria-label', `Show ${app.name}`);
      toggle.addEventListener('click', () => {
        settings.disabled = settings.disabled.includes(id)
          ? settings.disabled.filter((x) => x !== id)
          : [...settings.disabled, id];
        saveSettings();
        renderTiles();
        renderSettings();
      });
      controls.append(toggle);
      row.append(name, controls);
      return row;
    }),
  );

  $('#versionNote').textContent = `Chat Launcher v${APP_VERSION} · ${storageOk ? 'data stored on this device' : 'storage blocked (session only)'}`;
}

function moveTile(id, delta) {
  const all = [...settings.order, ...DEFAULT_ORDER.filter((x) => !settings.order.includes(x))];
  const i = all.indexOf(id);
  const j = i + delta;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  settings.order = all;
  saveSettings();
  renderTiles();
  renderSettings();
}

$('#clearDataBtn').addEventListener('click', async () => {
  const sure = await askText({
    title: 'Type DELETE to wipe all local data',
    placeholder: 'DELETE',
    confirmLabel: 'Wipe',
  });
  if (sure === 'DELETE') {
    history.clear();
    try {
      storage.removeItem(SETTINGS_KEY);
    } catch {
      /* ignore */
    }
    settings = loadSettings();
    state.iso = settings.country ?? detectCountryIso() ?? 'US';
    renderTiles();
    renderHistory();
    updateCountryChip();
    applyTheme();
    settingsDialog.close();
    toast('All local data wiped', { kind: 'good' });
  } else if (sure !== null) {
    toast('Nothing was deleted', { kind: 'warn' });
  }
});

/* ------------------------------------------------------------------ header */

$('#themeToggle').addEventListener('click', cycleTheme);
$('#helpOpen').addEventListener('click', () => openDialog('helpDialog'));
$('#helpClose').addEventListener('click', () => $('#helpDialog').close());

/* --------------------------------------------------------------- shortcuts */

document.addEventListener('keydown', (e) => {
  const el = document.activeElement;
  const typing =
    el instanceof HTMLElement &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  if (typing) {
    if (e.key === 'Enter' && el !== msgInput) {
      e.preventDefault();
      launchDefault();
    }
    return;
  }
  if (e.target instanceof HTMLElement && e.target.closest('dialog[open]')) return;
  if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
    e.preventDefault();
    launchByIndex(Number(e.key) - 1);
    return;
  }
  switch (e.key) {
    case '/':
      e.preventDefault();
      phoneInput.focus();
      break;
    case 'd':
    case 'D':
      toggleDialPad();
      break;
    case 't':
    case 'T':
      cycleTheme();
      break;
    case '?':
      openDialog('helpDialog');
      break;
    case 'Enter':
      launchDefault();
      break;
  }
});

/* ------------------------------------------------------------- URL params */

function consumeParams() {
  const params = new URLSearchParams(location.search);
  const number = params.get('number');
  const text = params.get('text') ?? params.get('title');
  const app = params.get('app');

  let candidate = number;
  if (!candidate && text) {
    // Share-target flow: mine any phone-like token out of the shared text.
    const m = text.match(/\+?\d[\d\s\-().]{6,18}\d/);
    if (m) candidate = m[0];
  }
  if (candidate) {
    const parsed = parsePaste(candidate);
    if (parsed) {
      state.iso = parsed.iso;
      saveCountry();
      updateCountryChip();
      setNational(parsed.national);
    } else {
      setNational(candidate);
    }
  }
  if (text && !number) {
    state.message = text.slice(0, 300);
    msgInput.value = state.message;
    $('#messageRow').classList.add('open');
    msgToggle.textContent = '− Message';
  }
  if (app && getApp(app)) {
    state.defaultApp = app;
  }
}

/* --------------------------------------------------------- SW and install */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast('A new version is ready', {
                kind: 'good',
                actionLabel: 'Refresh',
                timeout: 12000,
                onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
              });
            }
          });
        });
      })
      .catch(() => toast('Offline support failed to install', { kind: 'warn' }));
  });

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') {
    $('#installBtn').hidden = true;
    toast('Installed! Check your home screen', { kind: 'good' });
  }
  deferredInstall = null;
});
window.addEventListener('appinstalled', () => {
  $('#installBtn').hidden = true;
});

/* -------------------------------------------------------------------- boot */

function init() {
  if (!storageOk) warnStorageOnce();
  applyTheme();
  systemDark.addEventListener('change', () => {
    if (settings.theme === 'system') applyTheme();
  });
  attachRipples();
  updateCountryChip();
  renderTiles();
  renderHistory();
  consumeParams();
  updateValidity();
  registerServiceWorker();
  if (!('ontouchstart' in window)) phoneInput.focus();
}

init();
