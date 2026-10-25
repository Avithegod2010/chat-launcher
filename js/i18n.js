/**
 * Tiny i18n: English + Hindi UI strings. `t(key)` returns the active
 * translation, falling back to English, then to the key itself.
 * The language preference is stored under `chatlauncher:lang`.
 */

const STRINGS = {
  en: {
    tagline: 'no tracking · works offline · MIT',
    install: '⬇ Install app',
    placeholder: 'Phone number',
    addMessage: '+ Message',
    removeMessage: '− Message',
    messageHint: 'sent where supported',
    messagePlaceholder: 'Pre-filled message (WhatsApp & SMS)',
    copy: 'Copy',
    dialpad: '⌨ Dial pad',
    bulk: '☰ Bulk',
    qr: 'QR',
    launchTitle: 'Launch a chat',
    historyTitle: 'History',
    clearAll: 'Clear all',
    reallyClear: 'Really clear?',
    historyEmpty: 'No history yet — launch a chat and it shows up here.',
    historyEmpty2: 'Everything stays on this device.',
    looksGood: 'Looks good:',
    keepTyping: 'Keep typing…',
    digitsSoFar: 'digits so far',
    numberShort: '{n} digits for {country} numbers — you typed {typed}',
    numberLong: 'Too long — {country} numbers are {n} digits',
    enterValid: 'Enter a valid phone number first',
    copied: 'Number copied',
    clipboardBlocked: 'Clipboard blocked by the browser',
    clipboardUnavailable: 'Clipboard unavailable',
    countryDetected: '{flag} {country} detected',
    launchTitle2: 'Open in',
    settings: 'Settings',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    accent: 'Accent',
    tiles: 'Tiles',
    usage: 'Your usage (local only)',
    wipeData: 'Wipe all local data…',
    typeDelete: 'Type DELETE to wipe all local data',
    wipe: 'Wipe',
    wiped: 'All local data wiped',
    nothingDeleted: 'Nothing was deleted',
    dataOnDevice: 'data stored on this device',
    storageBlocked: 'storage blocked (session only)',
    helpTitle: 'Help & shortcuts',
    close: 'Close',
    rename: 'Rename entry',
    addNote: 'Add note',
    editNote: 'Edit note',
    notePlaceholder: 'e.g. plumber — quoted 2k',
    save: 'Save',
    cancel: 'Cancel',
    pin: 'Pin',
    unpin: 'Unpin',
    copyNumber: 'Copy number',
    shareLink: 'Share link',
    delete: 'Delete',
    bulkTitle: 'Bulk launch',
    bulkPlaceholder: 'Paste numbers — one per line or comma-separated',
    bulkParse: 'Load numbers',
    bulkOpenAll: 'Open all',
    bulkBlockedPopup: '{n} blocked by the popup blocker — tap them individually',
    bulkNoneValid: 'No valid numbers found',
    bulkRowsReady: '{n} numbers ready',
    qrTitle: 'Scan to open on a phone',
    qrHint: 'Points at this number pre-filled in Chat Launcher',
    updateReady: 'A new version is ready',
    refresh: 'Refresh',
    themeNow: 'Theme: {theme}',
    installed: 'Installed! Check your home screen',
    offlineFail: 'Offline support failed to install',
    usageTotal: '{n} chats launched all-time',
    usageMonth: '{n} this month',
    usageTop: 'Top apps',
    usageNone: 'Nothing launched yet',
    whatsappDesktop: 'Open in WhatsApp Desktop app',
    appName: 'Chat Launcher',
    helpFocus: 'Focus the number field',
    helpEnter: 'Launch with the first (or highlighted) app',
    helpCtrl: 'Launch with the nth app tile',
    helpTheme: 'Switch theme',
    helpPad: 'Toggle the dial pad',
    helpHelp: 'This dialog',
    helpNote:
      'Paste a full international number (like +91 98765 43210) and the country is detected automatically. A pre-filled message is delivered on WhatsApp and SMS. LINE and Threema are app only targets — they have no open-by-number link, so those tiles just open the app. On desktop, right-click the WhatsApp or Telegram tile to open the native app instead of the website.',
  },
  hi: {
    tagline: 'कोई ट्रैकिंग नहीं · ऑफ़लाइन चलता है · MIT',
    install: '⬇ ऐप इंस्टॉल करें',
    placeholder: 'फ़ोन नंबर',
    addMessage: '+ मैसेज',
    removeMessage: '− मैसेज',
    messageHint: 'जहाँ समर्थित हो वहीं भेजा जाएगा',
    messagePlaceholder: 'पहले से लिखा मैसेज (WhatsApp और SMS)',
    copy: 'कॉपी',
    dialpad: '⌨ डायल पैड',
    bulk: '☰ बल्क',
    qr: 'QR',
    launchTitle: 'चैट शुरू करें',
    historyTitle: 'इतिहास',
    clearAll: 'सब मिटाएँ',
    reallyClear: 'पक्का मिटाएँ?',
    historyEmpty: 'अभी कोई इतिहास नहीं — कोई चैट खोलिए, वह यहाँ दिखेगी।',
    historyEmpty2: 'सब कुछ इसी डिवाइस पर रहता है।',
    looksGood: 'सही लग रहा है:',
    keepTyping: 'और टाइप करें…',
    digitsSoFar: 'अंक अब तक',
    numberShort: '{country} नंबर {n} अंक के होते हैं — आपने {typed} लिखे',
    numberLong: 'बहुत लंबा — {country} नंबर {n} अंक के होते हैं',
    enterValid: 'पहले सही फ़ोन नंबर डालें',
    copied: 'नंबर कॉपी हुआ',
    clipboardBlocked: 'ब्राउज़र ने क्लिपबोर्ड रोक दिया',
    clipboardUnavailable: 'क्लिपबोर्ड उपलब्ध नहीं',
    countryDetected: '{flag} {country} मिला',
    launchTitle2: 'में खोलें',
    settings: 'सेटिंग्स',
    theme: 'थीम',
    system: 'सिस्टम',
    light: 'लाइट',
    dark: 'डार्क',
    language: 'भाषा',
    accent: 'रंग',
    tiles: 'टाइल्स',
    usage: 'आपका इस्तेमाल (सिर्फ़ इस डिवाइस पर)',
    wipeData: 'सारा लोकल डेटा मिटाएँ…',
    typeDelete: 'सारा डेटा मिटाने के लिए DELETE लिखें',
    wipe: 'मिटाएँ',
    wiped: 'सारा लोकल डेटा मिटा दिया गया',
    nothingDeleted: 'कुछ नहीं मिटाया गया',
    dataOnDevice: 'डेटा इस डिवाइस पर सुरक्षित',
    storageBlocked: 'स्टोरेज ब्लॉक (सिर्फ़ इस सेशन के लिए)',
    helpTitle: 'सहायता और शॉर्टकट',
    close: 'बंद करें',
    rename: 'नाम बदलें',
    addNote: 'नोट जोड़ें',
    editNote: 'नोट बदलें',
    notePlaceholder: 'जैसे: प्लंबर — 2 हज़ार का कहा',
    save: 'सेव',
    cancel: 'रद्द करें',
    pin: 'पिन करें',
    unpin: 'अनपिन',
    copyNumber: 'नंबर कॉपी करें',
    shareLink: 'लिंक शेयर करें',
    delete: 'मिटाएँ',
    bulkTitle: 'बल्क लॉन्च',
    bulkPlaceholder: 'नंबर पेस्ट करें — हर लाइन में एक, या कॉमा से अलग',
    bulkParse: 'नंबर लोड करें',
    bulkOpenAll: 'सब खोलें',
    bulkBlockedPopup: '{n} पॉपअप ब्लॉकर ने रोके — उन्हें अलग से टैप करें',
    bulkNoneValid: 'कोई सही नंबर नहीं मिला',
    bulkRowsReady: '{n} नंबर तैयार',
    qrTitle: 'फ़ोन से स्कैन करके खोलें',
    qrHint: 'यह QR इस नंबर को Chat Launcher में भर देगा',
    updateReady: 'नया वर्ज़न तैयार है',
    refresh: 'रिफ़्रेश',
    themeNow: 'थीम: {theme}',
    installed: 'इंस्टॉल हो गया! होम स्क्रीन देखें',
    offlineFail: 'ऑफ़लाइन सपोर्ट इंस्टॉल नहीं हो सका',
    usageTotal: 'अब तक {n} चैट खोली गईं',
    usageMonth: 'इस महीने {n}',
    usageTop: 'टॉप ऐप्स',
    usageNone: 'अभी कुछ लॉन्च नहीं हुआ',
    whatsappDesktop: 'WhatsApp डेस्कटॉप ऐप में खोलें',
    appName: 'चैट लॉन्चर',
    helpFocus: 'नंबर फ़ील्ड पर जाएँ',
    helpEnter: 'पहले (या चुने हुए) ऐप से लॉन्च करें',
    helpCtrl: 'nth ऐप टाइल से लॉन्च करें',
    helpTheme: 'थीम बदलें',
    helpPad: 'डायल पैड चालू/बंद करें',
    helpHelp: 'यह डायलॉग',
    helpNote:
      '+91 98765 43210 जैसा पूरा इंटरनेशनल नंबर पेस्ट करें, देश अपने आप पहचान लिया जाएगा। पहले से लिखा मैसेज WhatsApp और SMS पर जाता है। LINE और Threema सिर्फ़ ऐप खोलते हैं — उनके पास नंबर से चैट खोलने का लिंक नहीं है। डेस्कटॉप पर WhatsApp/Telegram टाइल पर राइट-क्लिक करने से नेटिव ऐप खुलता है।',
  },
};

const KEY = 'chatlauncher:lang';
let current = 'en';

/**
 * @param {string} lang 'en' | 'hi'
 * @param {{setItem?: Function}} [storage] optional localStorage-like backend
 */
export function setLang(lang, storage) {
  current = STRINGS[lang] ? lang : 'en';
  if (storage) {
    try {
      storage.setItem(KEY, current);
    } catch {
      /* ignore */
    }
  }
  document.documentElement.lang = current;
  return current;
}

/** Boot the language from storage / navigator. */
export function initLang(storage) {
  let saved = null;
  try {
    saved = storage?.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (saved && STRINGS[saved]) {
    current = saved;
  } else {
    const nav = (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase();
    current = nav.startsWith('hi') ? 'hi' : 'en';
  }
  document.documentElement.lang = current;
  return current;
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  let s = STRINGS[current]?.[key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export const availableLangs = Object.keys(STRINGS);
