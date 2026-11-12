/**
 * Expo config plugin: static Android app shortcuts.
 *
 * Adds long-press launcher shortcuts (WhatsApp / Telegram / SMS) that open
 * the shell with ?app=<id> preselected. Static shortcuts suit this app —
 * truly dynamic shortcuts (from history) are set at runtime through
 * expo-quick-actions instead.
 *
 * Implementation notes:
 *  - Runs entirely in a dangerous mod and edits the generated
 *    AndroidManifest.xml textually: in this Expo version the dangerous mod
 *    executes before withAndroidManifest actions, so the usual in-memory
 *    manifest edit would never be serialized.
 *  - AAPT requires shortcutShortLabel/shortcutLongLabel to be resource
 *    references, so labels are emitted as string resources too.
 */
const { withDangerousMod } = require('expo/config-plugins');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { SHORTCUTS, shortcutsXml, shortcutLabelsXml } = require('./shortcuts-xml');

const MANIFEST_ENTRY =
  '    <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>\n';

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

module.exports.shortcutsXml = shortcutsXml;
module.exports.shortcutLabelsXml = shortcutLabelsXml;
module.exports.SHORTCUTS = SHORTCUTS;
