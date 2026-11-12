/**
 * Pure XML generators for the Android shortcut plugin.
 *
 * Kept free of any `expo` imports so the repository's unit tests can exercise
 * them without installing expo-app's dependency tree.
 */

const SHORTCUTS = [
  { id: 'whatsapp', label: 'WhatsApp', url: 'https://avithegod2010.github.io/chat-launcher/?app=whatsapp' },
  { id: 'telegram', label: 'Telegram', url: 'https://avithegod2010.github.io/chat-launcher/?app=telegram' },
  { id: 'sms', label: 'SMS', url: 'https://avithegod2010.github.io/chat-launcher/?app=sms' },
];

/** res/xml/shortcuts.xml — labels as @string references (AAPT requires refs). */
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

/** res/values/shortcut_labels.xml — the string resources themselves. */
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

module.exports = { SHORTCUTS, shortcutsXml, shortcutLabelsXml };
