/**
 * Expo config plugin: Quick Settings tile.
 *
 * Ships a small Kotlin TileService that opens Chat Launcher from the
 * notification shade. Like the shortcuts plugin, it runs entirely in a
 * dangerous mod (which executes before withAndroidManifest in this Expo
 * version) and edits the generated files on disk.
 */
const { withDangerousMod } = require('expo/config-plugins');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const {
  tileServiceKotlin,
  tileServiceManifestXml,
  tileLabelsXml,
} = require('./tile-extras');

const SERVICE = tileServiceManifestXml();

module.exports = function withLauncherTile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package ?? 'io.github.avithegod2010.chatlauncher';
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const mainDir = join(projectRoot, 'app', 'src', 'main');
      const resDir = join(mainDir, 'res');
      const kotlinDir = join(mainDir, 'java', ...pkg.split('.'));

      // 1. Kotlin TileService
      await mkdir(kotlinDir, { recursive: true });
      await writeFile(join(kotlinDir, 'LauncherTileService.kt'), tileServiceKotlin(pkg), 'utf8');

      // 2. Label resources
      await mkdir(join(resDir, 'values'), { recursive: true });
      await writeFile(join(resDir, 'values', 'tile_labels.xml'), tileLabelsXml(), 'utf8');

      // 3. <service> declaration inside the generated AndroidManifest.xml
      const manifestPath = join(mainDir, 'AndroidManifest.xml');
      const text = await readFile(manifestPath, 'utf8');
      if (!text.includes('LauncherTileService')) {
        if (!text.includes('</application>')) {
          throw new Error('[tile-plugin] </application> not found in AndroidManifest.xml');
        }
        await writeFile(
          manifestPath,
          text.replace('</application>', `${SERVICE}  </application>`),
          'utf8',
        );
      }
      return cfg;
    },
  ]);
};

module.exports.tileServiceKotlin = tileServiceKotlin;
module.exports.tileServiceManifestXml = tileServiceManifestXml;
module.exports.tileLabelsXml = tileLabelsXml;
