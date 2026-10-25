/**
 * Chat Launcher — application entry point.
 * Wires state, rendering, events, keyboard shortcuts, URL params,
 * service-worker updates and the PWA install prompt.
 */
import { APPS, DEFAULT_ORDER, getApp, isAppleDevice, isDesktopUA } from './apps.js';
import {
  COUNTRIES,
  countryByIso,
  flagOf,
  matchDialCode,
  primaryCountryForDial,
} from './countries.js';
import { checkNumber, digitsOnly, formatAsYouType, parsePaste, toE164 } from './phone.js';
import { createHistory } from './history.js';
import { createStats } from './stats.js';
import { drawQr } from './qr.js';
import { availableLangs, initLang, setLang, t } from './i18n.js';
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

const APP_VERSION = '1.2.0';
const SETTINGS_KEY = 'chatlauncher:settings';
const $ = (sel) => document.querySelector(sel);

const ACCENTS = {
  violet: ['#6c5cf6', '#a855f7'],
  ocean: ['#0ea5e9', '#6366f1'],
  sunset: ['#f97316', '#ef4444'],
  emerald: ['#10b981', '#3b82f6'],
};

/* ------------------------------------------------------------------ state */

const { ok: storageOk, backend: storage } = safeStorage();
const history = createHistory(storage);
const stats = createStats(storage);

/** @type {{theme: string, country: string|null, order: string[],
 *          disabled: string[], accent: string}} */
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
      accent: ACCENTS[raw.accent] ? raw.accent : 'violet',
    };
  } catch {
    return { theme: 'system', country: null, order: [...DEFAULT_ORDER], disabled: [], accent: 'violet' };
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

/* --------------------------------------------------------------- i18n -- */

initLang(storage);

/** Translate all static [data-i18n] / [data-i18n-ph] elements. */
function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}

function switchLang(lang) {
  setLang(lang, storage);
  applyStaticTranslations();
  renderTiles();
  renderHistory();
  updateValidity();
  renderSettings();
}

/* ------------------------------------------------------------------ theme */

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const resolved =
    settings.theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : settings.theme;
  document.documentElement.dataset.theme = resolved;
  $('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b1020' : '#eef0fb');
}

function applyAccent() {
  const [a, b] = ACCENTS[settings.accent] ?? ACCENTS.violet;
  document.documentElement.style.setProperty('--accent', a);
  document.documentElement.style.setProperty('--accent-2', b);
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
  toast(t('themeNow', { theme: settings.theme }));
}

/* ------------------------------------------------------------------ input */

const phoneInput = $('#phone');
const validityDot = $('#validity');
const validityMsg = $('#validityMsg');

function currentCheck() {
  const country = countryByIso(state.iso);
  if (!country) return { state: 'bad', e164: null, typed: state.national.length, min: 7, max: 15 };
  return checkNumber(country.dial, state.national, state.iso);
}

function currentE164() {
  const c = currentCheck();
  return c.state === 'ok' ? c.e164 : null;
}

function updateValidity() {
  const c = currentCheck();
  const country = countryByIso(state.iso);
  if (c.state === 'empty') {
    validityDot.className = 'validity idle';
    validityMsg.textContent = '';
  } else if (c.state === 'ok') {
    validityDot.className = 'validity ok';
    validityMsg.textContent = `${t('looksGood')} +${c.e164}`;
  } else if (c.state === 'short' || c.state === 'long') {
    validityDot.className = 'validity partial';
    const name = country?.name ?? '';
    if (c.min === c.max) {
      validityMsg.textContent =
        c.state === 'short'
          ? t('numberShort', { n: c.max, country: name, typed: c.typed })
          : t('numberLong', { n: c.max, country: name });
    } else {
      validityMsg.textContent = `${t('keepTyping')} ${c.typed} ${t('digitsSoFar')} (${c.min}–${c.max})`;
    }
  } else {
    validityDot.className = 'validity partial';
    validityMsg.textContent = `${t('keepTyping')} ${c.typed} ${t('digitsSoFar')}`;
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
    toast(t('countryDetected', { flag: flagOf(parsed.iso), country: countryByIso(parsed.iso)?.name }));
  }
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
  $('#tileCount').textContent = `${apps.length}`;
  grid.replaceChildren(
    ...apps.map((app, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tile ripple';
      btn.dataset.app = app.id;
      btn.style.setProperty('--tile', app.color);
      btn.style.setProperty('--i', String(i));
      btn.setAttribute('aria-label', `${t('launchTitle2')} ${app.name}`);
      const icon = document.createElement('span');
      icon.className = 'tile-icon';
      icon.innerHTML = app.icon;
      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = app.name;
      btn.append(icon, label);
      if (app.capability === 'limited') {
        const badge = document.createElement('span');
        badge.className = 'tile-badge';
        badge.textContent = 'app only';
        btn.append(badge);
      }
      if (app.note) btn.title = app.note;
      if (app.id === state.defaultApp) btn.classList.add(highlightClass);
      btn.addEventListener('click', (e) => launch(app, e));
      // Desktop: right-click a WhatsApp/Telegram tile to force the native app.
      if (app.appScheme && isDesktopUA()) {
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const e164 = currentE164();
          if (!e164) {
            toast(t('enterValid'), { kind: 'warn' });
            return;
          }
          location.href = app.appScheme(e164, app.supportsMessage ? state.message : '');
        });
      }
      return btn;
    }),
  );
}

/* ----------------------------------------------------------------- launch */

function launch(app, event) {
  const e164 = currentE164();
  if (!e164) {
    shake($('#heroCard'));
    toast(t('enterValid'), { kind: 'warn' });
    phoneInput.focus();
    return;
  }
  launchNumber(app, e164);
  if (event) burst(event.clientX, event.clientY, app.color);
}

/** Shared by single launch and bulk rows. */
function launchNumber(app, e164, message = state.message) {
  history.add(e164);
  renderHistory();
  stats.record(app.id);
  vibrate(8);
  const url = app.buildUrl(e164, app.supportsMessage ? message : '');
  const isWebLink = url.startsWith('https://');
  if (!isWebLink) {
    location.href = url;
    return true;
  }
  const win = window.open(url, '_blank');
  if (win) {
    win.opener = null;
    return true;
  }
  location.href = url;
  return true;
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

function countryForE164(e164) {
  const dial = matchDialCode(e164);
  return dial ? primaryCountryForDial(dial) : null;
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
      const nameLine = document.createElement('span');
      nameLine.className = 'chip-name';
      nameLine.textContent = entry.label || formatAsYouType(entry.e164);
      label.append(nameLine);
      if (entry.note) {
        const note = document.createElement('span');
        note.className = 'chip-note';
        note.textContent = entry.note;
        label.append(note);
      }
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
        const c = countryForE164(entry.e164);
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
      more.setAttribute('aria-label', `⋯ ${entry.label || entry.e164}`);
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
  mk(entry.pinned ? t('unpin') : t('pin'), () => {
    (entry.pinned ? history.unpin : history.pin).call(history, entry.e164);
    renderHistory();
  });
  mk(t('rename'), async () => {
    const label = await askText({ title: t('rename'), value: entry.label || '' });
    if (label !== null) {
      history.renameLabel(entry.e164, label);
      renderHistory();
    }
  });
  mk(entry.note ? t('editNote') : t('addNote'), async () => {
    const note = await askText({
      title: entry.note ? t('editNote') : t('addNote'),
      value: entry.note || '',
      placeholder: t('notePlaceholder'),
    });
    if (note !== null) {
      history.setNote(entry.e164, note);
      renderHistory();
    }
  });
  mk(t('copyNumber'), async () => {
    try {
      await navigator.clipboard.writeText(`+${entry.e164}`);
      toast(t('copied'), { kind: 'good' });
    } catch {
      toast(t('clipboardBlocked'), { kind: 'warn' });
    }
  });
  mk(t('qr'), () => openQr(entry.e164));
  if (navigator.share) {
    mk(t('shareLink'), () => {
      navigator.share({ text: `+${entry.e164}`, url: shareUrl(entry.e164) }).catch(() => {});
    });
  }
  mk(t('delete'), () => {
    history.remove(entry.e164);
    renderHistory();
  }, true);

  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
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
    clearBtn.textContent = t('clearAll');
    clearBtn.classList.remove('armed');
    history.clear();
    renderHistory();
    stats.clear();
    toast(t('wiped'), { kind: 'good' });
  } else {
    clearBtn.textContent = t('reallyClear');
    clearBtn.classList.add('armed');
    clearArmed = setTimeout(() => {
      clearArmed = null;
      clearBtn.textContent = t('clearAll');
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
        .catch(() => toast(t('clipboardUnavailable'), { kind: 'warn' }));
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
  msgToggle.textContent = open ? t('removeMessage') : t('addMessage');
  if (open) msgInput.focus();
  else if (!msgInput.value) state.message = '';
});
msgInput.addEventListener('input', () => {
  state.message = msgInput.value.slice(0, 300);
});

/* ------------------------------------------------------------ QR dialog */

$('#qrBtn').addEventListener('click', () => {
  const e164 = currentE164();
  if (!e164) {
    toast(t('enterValid'), { kind: 'warn' });
    return;
  }
  openQr(e164);
});

function openQr(e164) {
  const dlg = $('#qrDialog');
  const canvas = dlg.querySelector('canvas');
  const ok = drawQr(canvas, shareUrl(e164));
  dlg.querySelector('.qr-hint').textContent = t('qrHint');
  dlg.querySelector('.qr-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(e164));
      toast(t('copied'), { kind: 'good' });
    } catch {
      toast(t('clipboardBlocked'), { kind: 'warn' });
    }
  };
  if (!ok) {
    toast(t('clipboardUnavailable'), { kind: 'warn' });
  }
  dlg.showModal();
}
$('#qrClose').addEventListener('click', () => $('#qrDialog').close());

/* -------------------------------------------------------------- bulk mode */

$('#bulkBtn').addEventListener('click', () => {
  $('#bulkRows').replaceChildren();
  $('#bulkTextarea').value = '';
  $('#bulkOpenAll').disabled = true;
  $('#bulkDialog').showModal();
});
$('#bulkClose').addEventListener('click', () => $('#bulkDialog').close());

$('#bulkParse').addEventListener('click', () => {
  const raw = $('#bulkTextarea').value;
  const tokens = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const country = countryByIso(state.iso);
  const rows = [];
  for (const tok of tokens.slice(0, 50)) {
    const parsed = parsePaste(tok);
    let e164 = null;
    if (parsed) {
      e164 = toE164(parsed.dial, parsed.national, { iso: parsed.iso });
    } else if (country) {
      e164 = toE164(country.dial, tok, { iso: state.iso });
    }
    const dial = parsed?.dial ?? country?.dial ?? '';
    const iso = parsed?.iso ?? state.iso;
    const national = parsed ? parsed.national : digitsOnly(tok);
    rows.push({
      token: tok,
      e164,
      valid: !!e164 && dial !== '' && checkNumber(dial, national, iso).state === 'ok',
    });
  }
  renderBulkRows(rows);
  const validCount = rows.filter((r) => r.valid).length;
  if (!validCount) toast(t('bulkNoneValid'), { kind: 'warn' });
  else toast(t('bulkRowsReady', { n: validCount }));
  $('#bulkOpenAll').disabled = validCount === 0;
});

function renderBulkRows(rows) {
  const list = $('#bulkRows');
  const defaultApp = (state.defaultApp && getApp(state.defaultApp)) || orderedApps()[0];
  list.replaceChildren(
    ...rows.map((row) => {
      const el = document.createElement('div');
      el.className = 'bulk-row' + (row.valid ? '' : ' invalid');
      const num = document.createElement('span');
      num.className = 'bulk-num';
      num.textContent = row.e164 ? `+${row.e164}` : row.token;
      const stateSpan = document.createElement('span');
      stateSpan.className = 'bulk-state';
      stateSpan.textContent = row.valid ? '✓' : '✕';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ripple';
      btn.textContent = defaultApp?.name ?? t('launchTitle2');
      btn.disabled = !row.valid;
      btn.addEventListener('click', () => {
        if (defaultApp && row.e164) launchNumber(defaultApp, row.e164);
      });
      el.append(stateSpan, num, btn);
      return el;
    }),
  );
}

$('#bulkOpenAll').addEventListener('click', () => {
  const rows = [...document.querySelectorAll('#bulkRows .bulk-row')];
  const app = (state.defaultApp && getApp(state.defaultApp)) || orderedApps()[0];
  let opened = 0;
  let blocked = 0;
  rows.forEach((row, i) => {
    const num = row.querySelector('.bulk-num').textContent;
    const e164 = num.startsWith('+') ? num.slice(1) : '';
    const valid = !row.classList.contains('invalid');
    if (!valid || !app) return;
    setTimeout(() => {
      history.add(e164);
      stats.record(app.id);
      const url = app.buildUrl(e164, app.supportsMessage ? state.message : '');
      const win = window.open(url, '_blank');
      if (win) {
        win.opener = null;
        opened++;
      } else {
        blocked++;
      }
      if (i === rows.length - 1 && blocked > 0) {
        toast(t('bulkBlockedPopup', { n: blocked }), { kind: 'warn', timeout: 6000 });
      }
    }, i * 400);
  });
});

/* -------------------------------------------------------------- copy/share */

$('#copyBtn').addEventListener('click', async () => {
  const e164 = currentE164();
  if (!e164) {
    toast(t('enterValid'), { kind: 'warn' });
    return;
  }
  try {
    await navigator.clipboard.writeText(`+${e164}`);
    toast(t('copied'), { kind: 'good' });
  } catch {
    toast(t('clipboardBlocked'), { kind: 'warn' });
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

  const langGroup = $('#langGroup');
  const currentLang = document.documentElement.lang || 'en';
  langGroup.querySelectorAll('input').forEach((input) => {
    input.checked = input.value === currentLang;
    input.onchange = () => switchLang(input.value);
  });

  const accentRow = $('#accentRow');
  accentRow.replaceChildren(
    ...Object.entries(ACCENTS).map(([name, [a, b]]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-swatch' + (settings.accent === name ? ' active' : '');
      btn.style.background = `linear-gradient(135deg, ${a}, ${b})`;
      btn.setAttribute('aria-label', `${t('accent')}: ${name}`);
      btn.addEventListener('click', () => {
        settings.accent = name;
        saveSettings();
        applyAccent();
        renderSettings();
      });
      return btn;
    }),
  );

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
      toggle.setAttribute('aria-label', `${app.name}`);
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

  $('#versionNote').textContent =
    `Chat Launcher v${APP_VERSION} · ${storageOk ? t('dataOnDevice') : t('storageBlocked')}`;
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

$('#usageOpen').addEventListener('click', () => {
  renderUsage();
  $('#usageDialog').showModal();
});
$('#usageClose').addEventListener('click', () => $('#usageDialog').close());

function renderUsage() {
  const s = stats.get();
  const wrap = $('#usageBody');
  const month = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const totalEl = document.createElement('p');
  totalEl.className = 'usage-total';
  totalEl.textContent = s.total
    ? `${t('usageTotal', { n: s.total })} · ${t('usageMonth', { n: s.byMonth[month] ?? 0 })}`
    : t('usageNone');
  wrap.replaceChildren(totalEl);
  const entries = Object.entries(s.byApp).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries[0]?.[1] ?? 1;
  for (const [appId, count] of entries) {
    const app = getApp(appId);
    const row = document.createElement('div');
    row.className = 'stat-row';
    const name = document.createElement('span');
    name.className = 'stat-name';
    name.textContent = app?.name ?? appId;
    const bar = document.createElement('span');
    bar.className = 'stat-bar';
    const fill = document.createElement('span');
    fill.className = 'stat-fill';
    fill.style.width = `${Math.round((count / max) * 100)}%`;
    if (app) fill.style.background = app.color;
    bar.append(fill);
    const num = document.createElement('span');
    num.className = 'stat-num';
    num.textContent = String(count);
    row.append(name, bar, num);
    wrap.append(row);
  }
}

$('#clearDataBtn').addEventListener('click', async () => {
  const sure = await askText({
    title: t('typeDelete'),
    placeholder: 'DELETE',
    confirmLabel: t('wipe'),
  });
  if (sure === 'DELETE') {
    history.clear();
    stats.clear();
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
    applyAccent();
    settingsDialog.close();
    toast(t('wiped'), { kind: 'good' });
  } else if (sure !== null) {
    toast(t('nothingDeleted'), { kind: 'warn' });
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
  let minedFromText = false;
  if (!candidate && text) {
    const m = text.match(/\+?\d[\d\s\-().]{6,18}\d/);
    if (m) {
      candidate = m[0];
      minedFromText = true;
    }
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
  if (text && !minedFromText) {
    state.message = text.slice(0, 300);
    msgInput.value = state.message;
    $('#messageRow').classList.add('open');
    msgToggle.textContent = t('removeMessage');
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
              toast(t('updateReady'), {
                kind: 'good',
                actionLabel: t('refresh'),
                timeout: 12000,
                onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
              });
            }
          });
        });
      })
      .catch(() => toast(t('offlineFail'), { kind: 'warn' }));
  });

  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
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
    toast(t('installed'), { kind: 'good' });
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
  applyAccent();
  applyStaticTranslations();
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
