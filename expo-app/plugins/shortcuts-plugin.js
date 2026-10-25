/**
 * Expo config plugin: static Android app shortcuts.
 *
 * Adds long-press launcher shortcuts (WhatsApp / Telegram / SMS) that open
 * the shell with ?app=<id> preselected. Static shortcuts suit this app —
 * truly dynamic shortcuts (from history) would need a native module.
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const SHORTCUTS = [
  { label: 'WhatsApp', url: 'https://avithegod2010.github.io/chat-launcher/?app=whatsapp' },
  { label: 'Telegram', url: 'https://avithegod2010.github.io/chat-launcher/?app=telegram' },
  { label: 'SMS', url: 'https://avithegod2010.github.io/chat-launcher/?app=sms' },
];

/** Build res/xml/shortcuts.xml content. */
function shortcutsXml() {
  const items = SHORTCUTS.map(
    ({ label, url }) => `    <shortcut
        android:shortcutId="${label.toLowerCase()}"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="${label}"
        android:shortcutLongLabel="Launch on ${label}">
      <intent
          android:action="android.intent.action.VIEW"
          android:data="${url}" />
    </shortcut>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items}
</shortcuts>
`;
}

/** Inject the android.app.shortcuts meta-data reference into the manifest. */
function addManifestMetaData(androidManifest) {
  const app = androidManifest.manifest.application;
  app.$['xmlns:android'] = 'http://schemas.android.com/apk/res/android';
  app['meta-data'] = [].concat(app['meta-data'] || []).filter(
    (m) => m?.$?.['android:name'] !== 'android.app.shortcuts',
  );
  app['meta-data'].push({
    $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' },
  });
}

module.exports = function withShortcuts(config) {
  const withManifest = withAndroidManifest(config, (cfg) => {
    addManifestMetaData(cfg.modResults);
    return cfg;
  });
  return withDangerousMod(withManifest, [
    'android',
    async (cfg) => {
      const resDir = join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      await mkdir(resDir, { recursive: true });
      await writeFile(join(resDir, 'shortcuts.xml'), shortcutsXml(), 'utf8');
      return cfg;
    },
  ]);
};

// Exposed for tests.
module.exports.shortcutsXml = shortcutsXml;
module.exports.SHORTCUTS = SHORTCUTS;
