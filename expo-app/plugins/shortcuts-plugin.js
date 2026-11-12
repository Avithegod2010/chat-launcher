/**
 * Expo config plugin: static Android app shortcuts.
 *
 * Adds long-press launcher shortcuts (WhatsApp / Telegram / SMS) that open
 * the shell with ?app=<id> preselected. Static shortcuts suit this app —
 * truly dynamic shortcuts (from history) are set at runtime through
 * expo-quick-actions instead.
 *
 * Implementation note: this runs entirely in a dangerous mod and edits the
 * generated AndroidManifest.xml textually. In this Expo version the
 * dangerous mod executes before withAndroidManifest actions, so the usual
 * in-memory manifest edit would never be serialized.
 */
const { withDangerousMod } = require('expo/config-plugins');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const SHORTCUTS = [
  { label: 'WhatsApp', url: 'https://avithegod2010.github.io/chat-launcher/?app=whatsapp' },
  { label: 'Telegram', url: 'https://avithegod2010.github.io/chat-launcher/?app=telegram' },
  { label: 'SMS', url: 'https://avithegod2010.github.io/chat-launcher/?app=sms' },
];

const MANIFEST_ENTRY =
  '    <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>\n';

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

module.exports = function withShortcuts(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;

      // 1. res/xml/shortcuts.xml
      const resDir = join(projectRoot, 'app', 'src', 'main', 'res', 'xml');
      await mkdir(resDir, { recursive: true });
      await writeFile(join(resDir, 'shortcuts.xml'), shortcutsXml(), 'utf8');

      // 2. <meta-data> reference inside the generated AndroidManifest.xml
      const manifestPath = join(projectRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
      const text = await readFile(manifestPath, 'utf8');
      if (!text.includes('android.app.shortcuts')) {
        if (!text.includes('</application>')) {
          throw new Error('[shortcuts-plugin] </application> not found in AndroidManifest.xml');
        }
        await writeFile(
          manifestPath,
          text.replace('</application>', `${MANIFEST_ENTRY}  </application>`),
          'utf8',
        );
      }
      return cfg;
    },
  ]);
};

// Exposed for tests.
module.exports.shortcutsXml = shortcutsXml;
module.exports.SHORTCUTS = SHORTCUTS;
