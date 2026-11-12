/**
 * Pure generators for the Quick Settings tile plugin. Kept free of any `expo`
 * imports so the repository's unit tests can exercise them without installing
 * expo-app's dependency tree.
 */

const LAUNCHER_URL = 'https://avithegod2010.github.io/chat-launcher/';

/** Kotlin source for the Quick Settings tile service. */
function tileServiceKotlin(packageName) {
  const pkg = String(packageName || 'io.github.avithegod2010.chatlauncher');
  return `package ${pkg}

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.service.quicksettings.TileService

/** Quick Settings tile: one tap opens Chat Launcher. */
class LauncherTileService : TileService() {
    override fun onClick() {
        super.onClick()
        val intent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("${LAUNCHER_URL}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE,
        )
        // API 34 replaced the Intent overload with the PendingIntent one.
        @Suppress("DEPRECATION")
        startActivityAndCollapse(pi)
    }
}
`;
}

/** Manifest fragment declaring the tile service. */
function tileServiceManifestXml() {
  return `    <service
        android:name=".LauncherTileService"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/tile_label"
        android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
      <intent-filter>
        <action android:name="android.service.quicksettings.action.QS_TILE" />
      </intent-filter>
    </service>
`;
}

/** String resources for the tile label. */
function tileLabelsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="tile_label">Chat Launcher</string>
</resources>
`;
}

module.exports = { LAUNCHER_URL, tileServiceKotlin, tileServiceManifestXml, tileLabelsXml };
