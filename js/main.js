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
import { createQueue } from './queue.js';
import { exportData, importData } from './backup.js';
import { createTemplates, expandTemplate } from './templates.js';
import { createLists, parseMembers, toCsv, parseCsv } from './lists.js';
import { suggestApp, isConfident } from './suggest.js';
import { createSync, encryptPayload, mergeRemote } from './sync.js';
import { derivePair } from './colors.js';
import { parseVcf } from './vcf.js';
import { drawQr } from './qr.js';
import { availableLangs, initLang, setLang, t } from './i18n.js';
import {
  attachRipples,
  askText,
  attachSheetDrag,
  burst,
  openDialog,
  prefersReducedMotion,
  safeStorage,
  shake,
  toast,
  vibrate,
  warnStorageOnce,
  withViewTransition,
} from './ui.js';

const APP_VERSION = '2.0.2';
const SETTINGS_KEY = 'chatlauncher:settings';
const SYNC_CFG_KEY = 'chatlauncher:sync';
const $ = (sel) => document.querySelector(sel);

/** Display names for the language palette entries. */
const LANG_LABELS = {
  en: 'English', hi: 'हिन्दी', es: 'Español', ar: 'العربية', mr: 'मराठी',
  bn: 'বাংলা', ta: 'தமிழ்', de: 'Deutsch', fr: 'Français', pt: 'Português',
  ru: 'Русский', ja: '日本語',
};

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
const queue = createQueue(storage);
const templates = createTemplates(storage);
const lists = createLists(storage);
const sync = createSync();

/** @type {{theme: string, textScale: string, contrast: string, country: string|null,
 *          order: string[], disabled: string[], accent: string, accentCustom: string|null}} */
let settings = loadSettings();

const state = {
  iso: settings.country ?? detectCountryIso() ?? 'US',
  national: '',
  message: '',
  defaultApp: null, // set via ?app=
  suggested: null, // smart app suggestion for the typed number
};

function loadSettings() {
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(raw.theme) ? raw.theme : 'system',
      textScale: raw.textScale === 'large' ? 'large' : 'normal',
      contrast: raw.contrast === 'high' ? 'high' : 'normal',
      country: typeof raw.country === 'string' ? raw.country : null,
      order: Array.isArray(raw.order) ? raw.order.filter((id) => getApp(id)) : [...DEFAULT_ORDER],
      disabled: Array.isArray(raw.disabled) ? raw.disabled.filter((id) => getApp(id)) : [],
      accent: ACCENTS[raw.accent] ? raw.accent : raw.accentCustom ? 'custom' : 'violet',
      accentCustom: /^#[0-9a-f]{6}$/i.test(raw.accentCustom ?? '') ? raw.accentCustom : null,
    };
  } catch {
    return {
      theme: 'system',
      textScale: 'normal',
      contrast: 'normal',
      country: null,
      order: [...DEFAULT_ORDER],
      disabled: [],
      accent: 'violet',
      accentCustom: null,
    };
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
  renderTemplateChips();
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

function applyTextScale() {
  document.documentElement.dataset.text = settings.textScale === 'large' ? 'large' : 'normal';
}

function applyContrast() {
  document.documentElement.dataset.contrast = settings.contrast === 'high' ? 'high' : 'normal';
}

function applyAccent() {
  let pair = ACCENTS[settings.accent];
  if (settings.accent === 'custom' && settings.accentCustom) {
    pair = derivePair(settings.accentCustom) ?? ACCENTS.violet;
  }
  const [a, b] = pair ?? ACCENTS.violet;
  document.documentElement.style.setProperty('--accent', a);
  document.documentElement.style.setProperty('--accent-2', b);
}

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
  saveSettings();
  withViewTransition(() => applyTheme());
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
  const country = countryByIso(state.iso);
  phoneInput.value = formatAsYouType(state.national, state.iso, country?.dial ?? '');
  updateValidity();
  updateSuggestion();
}

/** ✦ Smart suggestion: highlight the tile this number would most likely use. */
function updateSuggestion() {
  const e164 = currentE164();
  const entry = e164 ? history.list().find((x) => x.e164 === e164) ?? null : null;
  const appId = e164 ? suggestApp(entry, stats.get()) : null;
  state.suggested = isConfident(appId, stats.get()) ? appId : null;
  grid.querySelectorAll('.tile').forEach((tile) => {
    tile.classList.toggle('suggested', !!state.suggested && tile.dataset.app === state.suggested);
  });
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
// Swipe the sheet down to dismiss it (mobile-friendly, motion-aware).
attachSheetDrag(countrySheet.querySelector('.sheet'), { onDismiss: closeCountrySheet });

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
  updateSuggestion();
}

/* ----------------------------------------------------------------- launch */

function launch(app, event) {
  const check = currentCheck();
  if (!check.e164) {
    shake($('#heroCard'));
    toast(t('enterValid'), { kind: 'warn' });
    phoneInput.focus();
    return;
  }
  const country = countryByIso(state.iso);
  if (check.state === 'short' || check.state === 'long') {
    // Unusual length is advisory, not a hard block: let the user insist.
    const expected = check.min === check.max ? `${check.min}` : `${check.min}–${check.max}`;
    toast(t('unusualLength', { country: country?.name ?? '', typed: check.typed, expected }), {
      kind: 'warn',
      timeout: 9000,
      actionLabel: t('openAnyway'),
      onAction: () => {
        launchNumber(app, check.e164);
        if (event) burst(event.clientX, event.clientY, app.color);
      },
    });
    return;
  }
  launchNumber(app, check.e164);
  if (event) burst(event.clientX, event.clientY, app.color);
}

/** Shared by single launch and bulk rows. */
function launchNumber(app, e164, message = state.message) {
  const entry = history.list().find((x) => x.e164 === e164);
  history.add(e164, undefined, app.id);
  renderHistory();
  stats.record(app.id, new Date().getHours());
  vibrate(8);
  // Templates: expand {name} {number} {app} {date} {time} at launch time.
  const expanded = expandTemplate(message, {
    name: entry?.label ?? '',
    number: `+${e164}`,
    app: app.name,
  });
  const url = app.buildUrl(e164, app.supportsMessage ? expanded : '');
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

/** Inside the Android shell: mirror top history entries as launcher shortcuts. */
function notifyShellHistory() {
  const shell = window.ReactNativeWebView;
  if (!shell?.postMessage) return;
  const items = history
    .list()
    .slice(0, 3)
    .map((e) => ({ e164: e.e164, label: e.label ?? '', app: e.app ?? e.lastApp ?? '' }));
  try {
    shell.postMessage(JSON.stringify({ type: 'history', items }));
  } catch {
    /* shell bridge unavailable */
  }
}

/* ---------------------------------------------------------------- history */

const historyList = $('#historyList');
let historyQuery = '';

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

/** Display a stored E.164 with its country's grouping (98765 43210). */
function formatDisplay(e164) {
  const dial = matchDialCode(e164);
  const c = dial ? primaryCountryForDial(dial) : null;
  if (!c) return formatAsYouType(e164);
  const national = e164.slice(c.dial.length);
  return `${flagOf(c.iso)} ${formatAsYouType(national, c.iso, c.dial)}`;
}

function renderHistory() {
  let entries = history.list();
  const q = historyQuery.trim().toLowerCase();
  if (q) {
    const qDigits = q.replace(/\D/g, '');
    entries = entries.filter((e) => {
      const appName = (getApp(e.app)?.name ?? getApp(e.lastApp)?.name ?? '');
      return (
        (e.label ?? '').toLowerCase().includes(q) ||
        (e.note ?? '').toLowerCase().includes(q) ||
        appName.toLowerCase().includes(q) ||
        (qDigits !== '' && e.e164.includes(qDigits))
      );
    });
  }
  const empty = $('#historyEmpty');
  empty.hidden = entries.length > 0;
  $('#historyClear').hidden = history.list().length === 0;

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
      // Contact photo when the shell shared one; otherwise an initials avatar.
      if (entry.avatar || entry.label) {
        const avatarWrap = document.createElement('span');
        avatarWrap.className = 'chip-avatar';
        avatarWrap.style.background = `linear-gradient(135deg, hsl(${hashHue(entry.e164)} 62% 46%), hsl(${hashHue(entry.e164 + 'b')} 62% 38%))`;
        if (entry.avatar) {
          const img = document.createElement('img');
          img.src = entry.avatar;
          img.alt = '';
          avatarWrap.append(img);
        } else {
          avatarWrap.append(document.createTextNode(entry.label.trim().charAt(0).toUpperCase()));
        }
        chip.append(avatarWrap);
      }
      const label = document.createElement('span');
      label.className = 'chip-label';
      const nameLine = document.createElement('span');
      nameLine.className = 'chip-name';
      nameLine.textContent = entry.label || formatDisplay(entry.e164);
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
      if (entry.app || entry.lastApp) {
        const app = getApp(entry.app) ?? getApp(entry.lastApp);
        if (app) {
          const dot = document.createElement('span');
          dot.className = 'chip-app';
          dot.style.background = app.color;
          dot.title = app.name;
          dot.setAttribute('aria-label', app.name);
          chip.append(dot);
        }
      }
      chip.addEventListener('click', () => {
        const c = countryForE164(entry.e164);
        if (c) {
          state.iso = c.iso;
          saveCountry();
          updateCountryChip();
        }
        setNational(entry.e164.slice(c ? c.dial.length : 0));
        if (entry.app && getApp(entry.app)) state.defaultApp = entry.app;
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
  notifyShellHistory();
}

let openMenu = null;
function closeMenus() {
  openMenu?.remove();
  openMenu = null;
}

/** #6 — pick the default messenger for one history entry. */
function openAppPicker(entry) {
  const dlg = $('#appPickDialog');
  dlg.querySelector('.dialog-title').textContent = t('defaultAppTitle');
  const list = dlg.querySelector('.app-pick-list');
  const choose = async (appId) => {
    history.setDefaultApp(entry.e164, appId);
    renderHistory();
    dlg.close();
    toast(`${t('setDefaultApp')}: ${appId ? getApp(appId)?.name : t('none')}`, { kind: 'good' });
  };
  list.replaceChildren(
    ...orderedApps().map((app) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-pick-row ripple' + (entry.app === app.id ? ' active' : '');
      const icon = document.createElement('span');
      icon.className = 'app-pick-icon';
      icon.style.color = app.color;
      icon.innerHTML = app.icon;
      const name = document.createElement('span');
      name.textContent = app.name;
      btn.append(icon, name);
      btn.addEventListener('click', () => choose(app.id));
      return btn;
    }),
    (() => {
      const none = document.createElement('button');
      none.type = 'button';
      none.className = 'app-pick-row ripple';
      none.textContent = t('none');
      none.addEventListener('click', () => choose(null));
      return none;
    })(),
  );
  dlg.showModal();
}
$('#appPickClose')?.addEventListener('click', () => $('#appPickDialog').close());

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
  mk(t('setDefaultApp'), () => openAppPicker(entry));
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

/** Deterministic hue per number so avatar fallbacks get stable colors. */
function hashHue(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
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
  renderTemplateChips();
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

  const textGroup = $('#textGroup');
  textGroup?.querySelectorAll('input').forEach((input) => {
    input.checked = input.value === settings.textScale;
    input.onchange = () => {
      settings.textScale = input.value;
      saveSettings();
      withViewTransition(applyTextScale);
    };
  });

  const contrastToggle = $('#contrastToggle');
  if (contrastToggle) {
    contrastToggle.classList.toggle('on', settings.contrast === 'high');
    contrastToggle.setAttribute('aria-checked', String(settings.contrast === 'high'));
    contrastToggle.onclick = () => {
      settings.contrast = settings.contrast === 'high' ? 'normal' : 'high';
      saveSettings();
      withViewTransition(applyContrast);
      renderSettings();
    };
  }

  const accentRow = $('#accentRow');
  const customInput = $('#accentCustom');
  if (customInput) {
    customInput.value = settings.accentCustom ?? '#6c5cf6';
    customInput.onchange = () => {
      settings.accent = 'custom';
      settings.accentCustom = customInput.value;
      saveSettings();
      applyAccent();
      renderSettings();
    };
    customInput.classList.toggle('active', settings.accent === 'custom');
  }
  const accentSwatches = Object.entries(ACCENTS).map(([name, [a, b]]) => {
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
  });
  // The custom-color input lives in the same row; replaceChildren would detach
  // it permanently, so re-append it after the preset swatches.
  accentRow.replaceChildren(...accentSwatches, ...(customInput ? [customInput] : []));

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

  renderTemplateList();
  renderListList();
  renderSyncSection();
  $('#versionNote').textContent =
    `Chat Launcher v${APP_VERSION} · ${storageOk ? t('dataOnDevice') : t('storageBlocked')}`;
}

/* -------------------------------------------------- v2.0 settings sections */

function manageRow(title, sub, actions) {
  const row = document.createElement('div');
  row.className = 'manage-row';
  const grow = document.createElement('span');
  grow.className = 'grow';
  grow.textContent = title;
  if (sub) {
    const s = document.createElement('span');
    s.className = 'sub';
    s.textContent = sub;
    grow.append(s);
  }
  row.append(grow);
  for (const [label, fn, cls] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `icon-btn ripple${cls ? ' ' + cls : ''}`;
    b.textContent = label;
    b.setAttribute('aria-label', `${label} ${title}`);
    b.addEventListener('click', fn);
    row.append(b);
  }
  return row;
}

function renderTemplateList() {
  const wrap = $('#templateList');
  if (!wrap) return;
  const items = templates.list();
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'manage-empty';
    p.textContent = t('templatesEmpty');
    wrap.replaceChildren(p);
    return;
  }
  wrap.replaceChildren(
    ...items.map((tpl) =>
      manageRow(tpl.name, tpl.text.slice(0, 60), [
        ['✎', () => openTemplateEditor(tpl.id)],
        ['🗑', () => {
          templates.remove(tpl.id);
          renderTemplateList();
          renderTemplateChips();
        }, 'danger'],
      ]),
    ),
  );
}

function renderListList() {
  const wrap = $('#listList');
  if (!wrap) return;
  const items = lists.list();
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'manage-empty';
    p.textContent = t('listsEmpty');
    wrap.replaceChildren(p);
    return;
  }
  wrap.replaceChildren(
    ...items.map((l) =>
      manageRow(l.name, t('listCount', { n: l.items.length }), [
        ['✎', () => openListEditor(l.id)],
        ['🗑', () => {
          lists.remove(l.id);
          renderListList();
        }, 'danger'],
      ]),
    ),
  );
}

/* ------------------------------------------------------------- sync (E2E) */

let syncCfg = loadSyncCfg();

function loadSyncCfg() {
  try {
    const raw = JSON.parse(storage.getItem(SYNC_CFG_KEY) ?? '{}');
    return {
      url: typeof raw.url === 'string' ? raw.url : '',
      username: typeof raw.username === 'string' ? raw.username : '',
      password: typeof raw.password === 'string' ? raw.password : '',
      passphrase: typeof raw.passphrase === 'string' ? raw.passphrase : '',
      lastSync: Number(raw.lastSync) || 0,
    };
  } catch {
    return { url: '', username: '', password: '', passphrase: '', lastSync: 0 };
  }
}

function saveSyncCfg() {
  try {
    storage.setItem(SYNC_CFG_KEY, JSON.stringify(syncCfg));
  } catch {
    /* non-persistent */
  }
}

function syncStatus(msg, kind = '') {
  const el = $('#syncStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `sync-status${kind ? ' ' + kind : ''}`;
}

function renderSyncSection() {
  $('#syncUrl').value = syncCfg.url;
  $('#syncUser').value = syncCfg.username;
  $('#syncPass').value = syncCfg.password;
  $('#syncPhrase').value = syncCfg.passphrase;
  if (syncCfg.lastSync) {
    syncStatus(t('syncLast', { when: new Date(syncCfg.lastSync).toLocaleString() }));
  }
}

function syncPayload() {
  return {
    settings,
    history: history.list(),
    stats: stats.get(),
    templates: templates.list(),
    lists: lists.list(),
  };
}

function readSyncInputs() {
  syncCfg.url = $('#syncUrl').value.trim();
  syncCfg.username = $('#syncUser').value.trim();
  syncCfg.password = $('#syncPass').value;
  syncCfg.passphrase = $('#syncPhrase').value;
  saveSyncCfg();
  return syncCfg;
}

$('#syncPush')?.addEventListener('click', async () => {
  const cfg = readSyncInputs();
  if (!cfg.url || !cfg.passphrase) {
    syncStatus(t('syncNeedUrlPass'), 'bad');
    return;
  }
  syncStatus(t('syncWorking'));
  const envelope = await encryptPayload(syncPayload(), cfg.passphrase);
  const res = await sync.push(cfg, envelope);
  if (res.ok) {
    syncCfg.lastSync = Date.now();
    saveSyncCfg();
    syncStatus(t('syncPushed'), 'good');
  } else {
    syncStatus(t('syncFail', { err: res.error ?? `HTTP ${res.status}` }), 'bad');
  }
});

$('#syncPull')?.addEventListener('click', async () => {
  const cfg = readSyncInputs();
  if (!cfg.url || !cfg.passphrase) {
    syncStatus(t('syncNeedUrlPass'), 'bad');
    return;
  }
  syncStatus(t('syncWorking'));
  const res = await sync.pull(cfg, cfg.passphrase);
  if (!res.ok) {
    syncStatus(
      res.status === 404 ? t('syncNothing') : t('syncFail', { err: res.error ?? `HTTP ${res.status}` }),
      res.status === 404 ? '' : 'bad',
    );
    return;
  }
  // The payload came from our own encrypted blob, but validate it like a
  // backup anyway — never trust data, even your own.
  const result = importData(
    JSON.stringify({ format: 'chat-launcher-backup', version: 1, ...res.payload }),
  );
  if (!result.ok) {
    syncStatus(t('syncFail', { err: result.error }), 'bad');
    return;
  }
  const added = mergeRemote(result, { history, templates, lists });
  if (result.settings) {
    settings = { ...settings, ...result.settings };
    saveSettings();
    applyTheme();
    applyAccent();
    applyTextScale();
    applyContrast();
  }
  renderTiles();
  renderHistory();
  renderTemplateList();
  renderListList();
  syncCfg.lastSync = Date.now();
  saveSyncCfg();
  syncStatus(t('syncMerged', { n: added.history }), 'good');
});

['syncUrl', 'syncUser', 'syncPass', 'syncPhrase'].forEach((id) => {
  $(`#${id}`)?.addEventListener('change', readSyncInputs);
});

/* ----------------------------------------------------------- templates UI */

let editingTemplateId = null;

function openTemplateEditor(id = null) {
  editingTemplateId = id;
  const dlg = $('#templateDialog');
  const tpl = id ? templates.list().find((x) => x.id === id) : null;
  $('#templateName').value = tpl?.name ?? '';
  $('#templateText').value = tpl?.text ?? '';
  $('#templateDelete').hidden = !tpl;
  dlg.showModal();
  $('#templateName').focus();
}

$('#templateNew')?.addEventListener('click', () => openTemplateEditor());
$('#templateClose')?.addEventListener('click', () => $('#templateDialog').close());
$('#templateCancel')?.addEventListener('click', () => $('#templateDialog').close());
$('#templateDelete')?.addEventListener('click', () => {
  if (editingTemplateId) templates.remove(editingTemplateId);
  $('#templateDialog').close();
  renderTemplateList();
  renderTemplateChips();
});
$('#templateForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  templates.save({
    id: editingTemplateId ?? undefined,
    name: $('#templateName').value,
    text: $('#templateText').value,
  });
  $('#templateDialog').close();
  renderTemplateList();
  renderTemplateChips();
  toast(t('savedToast'), { kind: 'good' });
});

/** Chips above the message field: one tap inserts a template. */
function renderTemplateChips() {
  const wrap = $('#templateChips');
  if (!wrap) return;
  const items = templates.list();
  wrap.hidden = items.length === 0;
  wrap.replaceChildren(
    ...items.slice(0, 6).map((tpl) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ghost-btn ripple template-chip';
      b.textContent = tpl.name;
      b.title = tpl.text.slice(0, 80);
      b.addEventListener('click', () => {
        const row = $('#messageRow');
        if (!row.classList.contains('open')) msgToggle.click();
        msgInput.value = tpl.text.slice(0, 300);
        state.message = msgInput.value;
        msgInput.focus();
      });
      return b;
    }),
  );
}

/* ---------------------------------------------------------- lists UI ----- */

let openListId = null;

function openListEditor(id) {
  openListId = id;
  const l = lists.get(id);
  if (!l) return;
  $('#listsTitle').textContent = l.name;
  renderListItems(l);
  $('#listsDialog').showModal();
}

$('#listNew')?.addEventListener('click', async () => {
  const name = await askText({ title: t('listNew'), placeholder: t('listsTitle') });
  if (name === null || !name.trim()) return;
  const created = lists.create(name);
  if (!created) {
    toast(t('listsCap'), { kind: 'warn' });
    return;
  }
  renderListList();
  openListEditor(created.id);
});

$('#listsClose')?.addEventListener('click', () => $('#listsDialog').close());
$('#listDelete')?.addEventListener('click', () => {
  if (openListId) {
    lists.remove(openListId);
    renderListList();
  }
  $('#listsDialog').close();
});

function renderListItems(l) {
  const wrap = $('#listItems');
  wrap.replaceChildren(
    ...l.items.map((it) =>
      manageRow(it.label || `+${it.e164}`, formatDisplay(it.e164), [
        ['✕', () => {
          lists.removeItem(l.id, it.e164);
          renderListItems(lists.get(l.id));
          renderListList();
        }],
      ]),
    ),
  );
  if (!l.items.length) {
    const p = document.createElement('p');
    p.className = 'manage-empty';
    p.textContent = t('listEmpty');
    wrap.replaceChildren(p);
  }
}

$('#listAddForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#listAddInput');
  const members = parseMembers(input.value);
  if (!members.length) {
    toast(t('bulkNoneValid'), { kind: 'warn' });
    return;
  }
  for (const m of members) lists.addItem(openListId, m);
  input.value = '';
  renderListItems(lists.get(openListId));
  renderListList();
});

$('#listExport')?.addEventListener('click', () => {
  const l = lists.get(openListId);
  if (!l) return;
  const csv = toCsv([
    ['name', 'number'],
    ...l.items.map((it) => [it.label, `+${it.e164}`]),
  ]);
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${l.name.replace(/[^\w-]+/g, '_')}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('#listImport')?.addEventListener('click', () => $('#csvFile').click());
$('#csvFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !openListId) return;
  try {
    const rows = parseCsv(await file.text());
    const members = parseMembers(rows.map((r) => r.join(',')).join('\n'));
    for (const m of members) lists.addItem(openListId, m);
    renderListItems(lists.get(openListId));
    renderListList();
    toast(t('listImported', { n: members.length }), { kind: 'good' });
  } catch {
    toast(t('backupFail'), { kind: 'warn' });
  }
});

$('#listLaunchAll')?.addEventListener('click', () => {
  const l = lists.get(openListId);
  if (!l?.items.length) return;
  $('#listsDialog').close();
  const app = (state.defaultApp && getApp(state.defaultApp)) || orderedApps()[0];
  if (!app) return;
  let blocked = 0;
  l.items.forEach((it, i) => {
    setTimeout(() => {
      const win = launchNumber(app, it.e164);
      if (win === false) blocked++;
    }, i * 400);
  });
  toast(t('bulkRowsReady', { n: l.items.length }));
});

/* ------------------------------------------------------- schedule a chat */

let scheduleAppId = null;

$('#scheduleOpen')?.addEventListener('click', () => {
  const e164 = currentE164();
  if (!e164) {
    toast(t('enterValid'), { kind: 'warn' });
    return;
  }
  scheduleAppId = state.defaultApp ?? orderedApps()[0]?.id ?? null;
  const app = getApp(scheduleAppId);
  $('#appPickDialog').close();
  $('#scheduleSummary').textContent = t('scheduleSummary', {
    number: `+${e164}`,
    app: app?.name ?? '',
  });
  // Default to 30 minutes from now, in local time, minute precision.
  const when = new Date(Date.now() + 30 * 60000);
  const local = new Date(when.getTime() - when.getTimezoneOffset() * 60000);
  $('#scheduleAt').value = local.toISOString().slice(0, 16);
  $('#scheduleAt').min = local.toISOString().slice(0, 16);
  $('#scheduleDialog').showModal();
});
$('#scheduleClose')?.addEventListener('click', () => $('#scheduleDialog').close());
$('#scheduleCancel')?.addEventListener('click', () => $('#scheduleDialog').close());
$('#scheduleForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const e164 = currentE164();
  const when = new Date($('#scheduleAt').value);
  if (!e164 || Number.isNaN(when.getTime())) return;
  const seconds = Math.max(60, Math.round((when.getTime() - Date.now()) / 1000));
  const app = getApp(scheduleAppId) ?? orderedApps()[0];
  const url = app ? app.buildUrl(e164, app.supportsMessage ? state.message : '') : shareUrl(e164);
  const shell = window.ReactNativeWebView;
  if (scheduleInShell(seconds, e164, url)) {
    toast(t('scheduledToast'), { kind: 'good' });
  } else {
    toast(t('scheduleNeedApp'), { kind: 'warn', timeout: 6000 });
  }
  $('#scheduleDialog').close();
});

/* -------------------------------------------------------------- scanner -- */

let scannerStream = null;
let scannerTimer = null;

/** Extract a phone number from scanned content: URLs, tel:, vCards, digits. */
function numberFromScan(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const urlMatch = text.match(/[?&](?:number|text)=(?:\+?\d[\d\s\-().]{5,20})/);
  if (urlMatch) {
    const parsed = parsePaste(decodeURIComponent(urlMatch[1]));
    if (parsed) return parsed;
  }
  const waMatch = text.match(/wa\.me\/(\+?\d{7,15})|api\.whatsapp\.com\/send\?phone=(\+?\d{7,15})/i);
  if (waMatch) {
    const parsed = parsePaste(waMatch[1] ?? waMatch[2]);
    if (parsed) return parsed;
  }
  const telMatch = text.match(/^(?:tel|smsto):(\+?\d[\d\s\-().]{5,20})/im);
  if (telMatch) {
    const parsed = parsePaste(telMatch[1]);
    if (parsed) return parsed;
  }
  const vcard = text.match(/TEL[;^:]*(?:TYPE=[^:]*:)?:?\s*(\+?\d[\d\s\-().]{5,20})/im);
  if (vcard) {
    const parsed = parsePaste(vcard[1]);
    if (parsed) return parsed;
  }
  return parsePaste(text);
}

function stopScanner() {
  if (scannerTimer) {
    clearInterval(scannerTimer);
    scannerTimer = null;
  }
  scannerStream?.getTracks().forEach((track) => track.stop());
  scannerStream = null;
}

async function startScannerCamera() {
  const video = $('#scannerVideo');
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = scannerStream;
    await video.play().catch(() => {});
    if ('BarcodeDetector' in window) {
      startNativeDetectLoop(video);
    } else {
      // Desktop browsers (and older WebViews) lack BarcodeDetector — fall
      // back to the vendored jsQR decoder over canvas frames.
      startJsqrDetectLoop(video);
    }
  } catch {
    $('#scannerUnsupported').hidden = false;
    toast(t('cameraBlocked'), { kind: 'warn' });
  }
}

function handleScannedText(raw) {
  const parsed = numberFromScan(raw);
  if (!parsed) return;
  stopScanner();
  $('#scannerDialog').close();
  state.iso = parsed.iso;
  saveCountry();
  updateCountryChip();
  setNational(parsed.national);
  phoneInput.focus();
  toast(t('countryDetected', { flag: flagOf(parsed.iso), country: countryByIso(parsed.iso)?.name }));
}

function startNativeDetectLoop(video) {
  window.BarcodeDetector.getSupportedFormats()
    .then((formats) => {
      const wanted = ['qr_code', 'code_128', 'ean_13', 'data_matrix', 'code_39'].filter((f) =>
        formats.includes(f),
      );
      return new window.BarcodeDetector(wanted.length ? { formats: wanted } : undefined);
    })
    .then((detector) => {
      scannerTimer = setInterval(async () => {
        if (!scannerStream) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) handleScannedText(codes[0].rawValue);
        } catch {
          /* frame not ready — keep scanning */
        }
      }, 350);
    });
}

let jsqrCanvas = null;

function startJsqrDetectLoop(video) {
  jsqrCanvas = jsqrCanvas ?? document.createElement('canvas');
  const ctx = jsqrCanvas.getContext('2d', { willReadFrequently: true });
  import('./vendor/jsqr.js')
    .then(({ default: jsQR }) => {
      scannerTimer = setInterval(() => {
        if (!scannerStream || !video.videoWidth) return;
        const w = Math.min(640, video.videoWidth);
        const scale = w / video.videoWidth;
        jsqrCanvas.width = w;
        jsqrCanvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, jsqrCanvas.width, jsqrCanvas.height);
        try {
          const code = jsQR(
            ctx.getImageData(0, 0, jsqrCanvas.width, jsqrCanvas.height).data,
            jsqrCanvas.width,
            jsqrCanvas.height,
          );
          if (code?.data) handleScannedText(code.data);
        } catch {
          /* frame not ready — keep scanning */
        }
      }, 400);
    })
    .catch(() => {
      $('#scannerUnsupported').hidden = false;
    });
}

$('#scanBtn')?.addEventListener('click', () => {
  $('#scannerUnsupported').hidden = true;
  $('#scannerActions').hidden = true;
  $('#scannerDialog').showModal();
  startScannerCamera();
});
$('#scannerClose')?.addEventListener('click', () => {
  stopScanner();
  $('#scannerDialog').close();
});
$('#scannerStart')?.addEventListener('click', () => {
  $('#scannerActions').hidden = true;
  startScannerCamera();
});

/* ------------------------------------------------------ command palette -- */

let paletteItems = [];
let paletteActive = 0;

function buildPaletteItems(q) {
  const query = q.trim().toLowerCase();
  const match = (s) => !query || s.toLowerCase().includes(query);
  const items = [];
  const e164 = currentE164();

  for (const app of orderedApps()) {
    items.push({
      icon: app.icon,
      label: e164 ? `${t('launchTitle2')} ${app.name}` : `${app.name}`,
      hint: e164 ? `+${e164}` : t('paletteNoNumber'),
      run: () => launch(app),
      when: match(app.name),
    });
  }
  const actions = [
    { icon: '⌨', label: t('dialpad'), run: () => toggleDialPad() },
    { icon: '📋', label: t('copy'), run: () => $('#copyBtn').click() },
    { icon: '🔗', label: t('qr'), run: () => $('#qrBtn').click() },
    { icon: '📷', label: t('scan'), run: () => $('#scanBtn').click() },
    { icon: '☰', label: t('bulk'), run: () => $('#bulkBtn').click() },
    { icon: '⚙', label: t('settings'), run: () => $('#settingsOpen').click() },
    { icon: '📊', label: t('usage'), run: () => $('#usageOpen').click() },
    { icon: '🎨', label: t('helpTheme'), run: () => cycleTheme() },
    { icon: '🔠', label: t('textSize'), run: () => {
      settings.textScale = settings.textScale === 'large' ? 'normal' : 'large';
      saveSettings();
      withViewTransition(applyTextScale);
    } },
    { icon: '◐', label: t('highContrast'), run: () => {
      settings.contrast = settings.contrast === 'high' ? 'normal' : 'high';
      saveSettings();
      withViewTransition(applyContrast);
    } },
    { icon: '⏰', label: t('scheduleOpen'), run: () => {
      closeMenus();
      $('#scheduleOpen').click();
    }, when: !!e164 },
    { icon: '⬇', label: t('backupExport'), run: () => $('#exportBtn').click() },
  ];
  for (const a of actions) {
    if (a.when === false) continue;
    items.push({ ...a, when: match(a.label) });
  }
  for (const code of availableLangs) {
    items.push({
      icon: '🌐',
      label: `${t('language')}: ${LANG_LABELS[code] ?? code}`,
      hint: code,
      run: () => switchLang(code),
      when: match(`${LANG_LABELS[code] ?? code} ${t('language')}`),
    });
  }
  for (const entry of history.list().slice(0, 15)) {
    items.push({
      icon: '🕘',
      label: entry.label || formatDisplay(entry.e164),
      hint: `+${entry.e164}`,
      run: () => {
        const c = countryForE164(entry.e164);
        if (c) {
          state.iso = c.iso;
          saveCountry();
          updateCountryChip();
        }
        setNational(entry.e164.slice(c ? c.dial.length : 0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      when: match(`${entry.label ?? ''} ${entry.e164}`),
    });
  }
  for (const tpl of templates.list().slice(0, 8)) {
    items.push({
      icon: '✉',
      label: `${t('paletteInsertTemplate')}: ${tpl.name}`,
      hint: tpl.text.slice(0, 40),
      run: () => {
        const row = $('#messageRow');
        if (!row.classList.contains('open')) msgToggle.click();
        msgInput.value = tpl.text.slice(0, 300);
        state.message = msgInput.value;
      },
      when: match(tpl.name),
    });
  }
  for (const l of lists.list()) {
    items.push({
      icon: '📢',
      label: `${t('listsLabel')}: ${l.name}`,
      hint: t('listCount', { n: l.items.length }),
      run: () => {
        renderListList();
        openListEditor(l.id);
      },
      when: match(l.name),
    });
  }
  return items.filter((it) => it.when);
}

function renderPalette() {
  const input = $('#paletteInput');
  const list = $('#paletteList');
  paletteItems = buildPaletteItems(input.value);
  paletteActive = Math.min(paletteActive, Math.max(0, paletteItems.length - 1));
  list.replaceChildren(
    ...paletteItems.map((item, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-item' + (i === paletteActive ? ' active' : '');
      btn.setAttribute('role', 'option');
      const icon = document.createElement('span');
      icon.className = 'palette-icon';
      icon.innerHTML = item.icon;
      const label = document.createElement('span');
      label.textContent = item.label;
      btn.append(icon, label);
      if (item.hint) {
        const hint = document.createElement('small');
        hint.textContent = item.hint;
        btn.append(hint);
      }
      btn.addEventListener('click', () => runPaletteItem(i));
      li.append(btn);
      return li;
    }),
  );
  if (!paletteItems.length) {
    const empty = document.createElement('li');
    empty.className = 'palette-empty';
    empty.textContent = t('paletteEmpty');
    list.replaceChildren(empty);
  }
  list.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' });
}

function runPaletteItem(i) {
  const item = paletteItems[i];
  if (!item) return;
  $('#paletteDialog').close();
  item.run();
}

function openPalette() {
  paletteActive = 0;
  $('#paletteInput').value = '';
  renderPalette();
  $('#paletteDialog').showModal();
  $('#paletteInput').focus();
}

$('#paletteOpen')?.addEventListener('click', openPalette);
$('#paletteClose')?.addEventListener('click', () => $('#paletteDialog').close());
$('#paletteInput')?.addEventListener('input', () => {
  paletteActive = 0;
  renderPalette();
});
$('#paletteInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteActive = Math.min(paletteActive + 1, paletteItems.length - 1);
    renderPalette();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteActive = Math.max(paletteActive - 1, 0);
    renderPalette();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runPaletteItem(paletteActive);
  }
});

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
    templates.clear();
    lists.clear();
    try {
      storage.removeItem(SETTINGS_KEY);
      storage.removeItem(SYNC_CFG_KEY);
    } catch {
      /* ignore */
    }
    syncCfg = loadSyncCfg();
    settings = loadSettings();
    state.iso = settings.country ?? detectCountryIso() ?? 'US';
    renderTiles();
    renderHistory();
    renderTemplateChips();
    updateCountryChip();
    applyTheme();
    applyAccent();
    applyTextScale();
    applyContrast();
    settingsDialog.close();
    toast(t('wiped'), { kind: 'good' });
  } else if (sure !== null) {
    toast(t('nothingDeleted'), { kind: 'warn' });
  }
});

/* ------------------------------------------------------ backup / restore */

$('#historySearch')?.addEventListener('input', (e) => {
  historyQuery = e.target.value;
  renderHistory();
});

/**
 * UTF-8 safe base64 (btoa alone mangles non-Latin1). Chunks the byte array
 * so multi-megabyte backups with avatars don't blow the call stack.
 * @param {string} str
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

/**
 * In the Android shell, blob downloads silently no-op (the WebView has no
 * download listener for blob: URLs) — hand the payload to the shell instead,
 * which writes it to a file and opens the share sheet.
 * @param {string} json
 * @param {string} filename
 * @returns {boolean} true when the shell took over
 */
function exportViaShell(json, filename) {
  const shell = window.ReactNativeWebView;
  if (!shell?.postMessage) return false;
  const base64 = utf8ToBase64(json);
  try {
    shell.postMessage(JSON.stringify({ type: 'chatlauncher-export', name: filename, base64 }));
    return true;
  } catch {
    return false;
  }
}

$('#exportBtn')?.addEventListener('click', () => {
  try {
    const json = exportData({
      settings,
      history: history.list(),
      stats: stats.get(),
      templates: templates.list(),
      lists: lists.list(),
    });
    const filename = `chat-launcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (exportViaShell(json, filename)) {
      toast(t('backupDone'), { kind: 'good' });
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t('backupDone'), { kind: 'good' });
  } catch {
    toast(t('backupFail'), { kind: 'warn' });
  }
});

$('#importBtn')?.addEventListener('click', () => $('#importFile').click());

$('#importFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const result = importData(text);
    if (!result.ok) {
      toast(t('backupFail'), { kind: 'warn' });
      return;
    }
    if (result.settings) {
      settings = { ...settings, ...result.settings };
      saveSettings();
      applyTheme();
      applyAccent();
      applyTextScale();
      applyContrast();
    }
    history.replaceAll(result.history);
    if (result.stats) stats.replace(result.stats);
    templates.replaceAll(result.templates ?? []);
    lists.replaceAll(result.lists ?? []);
    if (settings.country) state.iso = settings.country;
    updateCountryChip();
    renderTiles();
    renderHistory();
    renderTemplateChips();
    renderSettings();
    toast(t('backupImported', { n: result.history.length }), { kind: 'good' });
  } catch {
    toast(t('backupFail'), { kind: 'warn' });
  }
});

/* ---------------------------------------------------- vCard contact import */

async function importVcfFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast(t('backupFail'), { kind: 'warn' });
    return;
  }
  try {
    const contacts = parseVcf(await file.text());
    let added = 0;
    for (const c of contacts.slice(0, 50)) {
      const e164 = c.number.slice(1);
      history.add(e164, c.name || undefined);
      added++;
    }
    renderHistory();
    toast(added ? t('contactsImported', { n: added }) : t('bulkNoneValid'), {
      kind: added ? 'good' : 'warn',
    });
  } catch {
    toast(t('backupFail'), { kind: 'warn' });
  }
}

$('#vcfBtn')?.addEventListener('click', () => $('#vcfFile').click());
$('#vcfFile')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  importVcfFile(file);
});

// Drag & drop a .vcf anywhere on the page.
document.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
});
document.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  e.preventDefault();
  if (/\.vcf$/i.test(file.name) || file.type === 'text/vcard') importVcfFile(file);
});

/* ------------------------------------------------------- error boundary --- */

let errorToastAt = 0;
function surfaceError() {
  const now = Date.now();
  if (now - errorToastAt < 5000) return;
  errorToastAt = now;
  toast(t('errorToast'), {
    kind: 'warn',
    timeout: 10000,
    actionLabel: t('reload'),
    onAction: () => location.reload(),
  });
}
window.addEventListener('error', surfaceError);
window.addEventListener('unhandledrejection', surfaceError);

/* ------------------------------------------------------ offline queue ----- */

function queueIfOffline(e164) {
  queue.add(e164, state.defaultApp ?? undefined);
  toast(t('queuedOffline'), {
    kind: 'warn',
    timeout: 8000,
    actionLabel: t('queuedLaunch'),
    onAction: () => offerQueued(),
  });
}

function offerQueued() {
  const pending = queue.list();
  if (!pending.length) return;
  const { e164, app: appId } = pending[0];
  const app = (appId && getApp(appId)) || orderedApps()[0];
  if (!app) return;
  queue.take(e164);
  launchNumber(app, e164);
}

window.addEventListener('online', () => {
  if (queue.list().length) {
    toast(t('queueBackOnline'), {
      kind: 'good',
      timeout: 10000,
      actionLabel: t('queuedLaunch'),
      onAction: () => offerQueued(),
    });
  }
});

$('#themeToggle').addEventListener('click', cycleTheme);
$('#helpOpen').addEventListener('click', () => openDialog('helpDialog'));
$('#helpClose').addEventListener('click', () => $('#helpDialog').close());

/* ---------------------------------------------------- shell bridge (#10) */

// The Android/iOS shell pushes numbers picked from the native contact picker,
// text shared into the app, and scheduled-send requests come back the other
// way. Only trusted when we're actually running inside the shell.
window.addEventListener('message', (e) => {
  if (!window.ReactNativeWebView) return; // not inside the shell
  let data = e.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return;
    }
  }
  if (!data || typeof data !== 'object') return;

  if (data.type === 'chatlauncher-contact') {
    const raw = String(data.number ?? '');
    if (!/^\+?\d{7,15}$/.test(raw)) return;
    const parsed = parsePaste(raw.startsWith('+') ? raw : `+${raw}`);
    if (parsed) {
      state.iso = parsed.iso;
      saveCountry();
      updateCountryChip();
      setNational(parsed.national);
    } else {
      setNational(raw);
    }
    // Photo thumbnails ride along (validated by history.setAvatar).
    const e164 = currentE164();
    if (e164 && typeof data.avatar === 'string') history.setAvatar(e164, data.avatar);
    if (e164 && typeof data.name === 'string' && data.name.trim() && data.name.length <= 40) {
      history.renameLabel(e164, data.name.trim());
      renderHistory();
    }
    phoneInput.focus();
    return;
  }

  if (data.type === 'chatlauncher-share') {
    // Shared into the shell from another app: mine the first number.
    const text = String(data.text ?? '');
    const mined = text.match(/\+?\d[\d\s\-().]{6,18}\d/);
    const candidate = mined?.[0] ?? '';
    if (!candidate) {
      toast(t('bulkNoneValid'), { kind: 'warn' });
      return;
    }
    const parsed = parsePaste(candidate);
    if (parsed) {
      state.iso = parsed.iso;
      saveCountry();
      updateCountryChip();
      setNational(parsed.national);
      toast(t('countryDetected', { flag: flagOf(parsed.iso), country: countryByIso(parsed.iso)?.name }));
    } else {
      setNational(candidate);
    }
    phoneInput.focus();
    return;
  }
});

/** Ask the shell to schedule a notification (Android shell only). */
function scheduleInShell(seconds, e164, url) {
  const shell = window.ReactNativeWebView;
  if (!shell?.postMessage) return false;
  shell.postMessage(JSON.stringify({ type: 'chatlauncher-schedule', seconds, number: e164, url }));
  return true;
}

/* --------------------------------------------------------------- shortcuts */

document.addEventListener('keydown', (e) => {
  const el = document.activeElement;
  const typing =
    el instanceof HTMLElement &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  // Inside any open dialog, let native handling win (forms, Escape…).
  if (e.target instanceof HTMLElement && e.target.closest('dialog[open]')) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const dlg = document.querySelector('dialog[open]');
      dlg?.close();
      openPalette();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (typing) {
    if (e.key === 'Enter' && el === phoneInput) {
      e.preventDefault();
      launchDefault();
    }
    return;
  }
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
    // Offline: the deep link can't work without network — hold the number.
    if (!navigator.onLine) {
      const check = currentCheck();
      if (check.e164) queueIfOffline(check.e164);
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
  applyTextScale();
  applyContrast();
  applyStaticTranslations();
  systemDark.addEventListener('change', () => {
    if (settings.theme === 'system') applyTheme();
  });
  attachRipples();
  updateCountryChip();
  renderTiles();
  renderHistory();
  renderTemplateChips();
  consumeParams();
  updateValidity();
  updateSuggestion();
  registerServiceWorker();
  if (!('ontouchstart' in window)) phoneInput.focus();
  // A number queued offline last session can be opened now.
  if (navigator.onLine && queue.list().length) offerQueued();
}

init();
