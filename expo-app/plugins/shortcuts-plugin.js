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
 *
 * AAPT requires shortcutShortLabel/shortcutLongLabel to be resource
 * references, so the labels are emitted as string resources too.
 */
const { withDangerousMod } = require('expo/config-plugins');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const SHORTCUTS = [
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://avithegod2010.github.io/chat-launcher/?app=whatsapp' },
  { id: 'telegram', label: 'Telegram', url: 'https://avithegod2010.github.io/chat-launcher/?app=telegram' },
  { id: 'sms', label: 'SMS', url: 'https://avithegod2010.github.io/chat-launcher/?app=sms' },
];

const MANIFEST_ENTRY =
  '    <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>\n';

/** Build res/xml/shortcuts.xml content (labels as @string references). */
function shortcutsXml() {
  const items = SHORTCUTS.map(
    ({ id, label, url }) => `    <shortcut
        android:shortcutId="${id}"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="@string/shortcut_${id}_short"
        android:shortcutLongLabel="@string/shortcut_${id}_long">
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

/** Build res/values/shortcut_labels.xml string resources. */
function shortcutLabelsXml() {
  const strings = SHORTCUTS.flatMap(({ id, label }) => [
    `    <string name="shortcut_${id}_short">${label}</string>`,
    `    <string name="shortcut_${id}_long">Launch on ${label}</string>`,
  ]).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${strings}
</resources>
`;
}

module.exports = function withShortcuts(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const resDir = join(projectRoot, 'app', 'src', 'main', 'res');

      // 1. res/xml/shortcuts.xml
      await mkdir(join(resDir, 'xml'), { recursive: true });
      await writeFile(join(resDir, 'xml', 'shortcuts.xml'), shortcutsXml(), 'utf8');

      // 2. res/values/shortcut_labels.xml (labels must be resource refs)
      await mkdir(join(resDir, 'values'), { recursive: true });
      await writeFile(join(resDir, 'values', 'shortcut_labels.xml'), shortcutLabelsXml(), 'utf8');

      // 3. <meta-data> reference inside the generated AndroidManifest.xml
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
module.exports.shortcutLabelsXml = shortcutLabelsXml;
module.exports.SHORTCUTS = SHORTCUTS;
