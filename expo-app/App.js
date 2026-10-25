import { StatusBar } from 'expo-status-bar';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Thin shell around the live Chat Launcher PWA (the real app lives on
 * GitHub Pages — this container only hosts it and hands any external
 * navigation to the operating system, so wa.me / tel: / sms: deep links
 * open the right installed app instead of loading inside the WebView).
 */
const WEB_ORIGIN = 'https://avithegod2010.github.io';
const START_URL = `${WEB_ORIGIN}/chat-launcher/`;

function isAppUrl(url) {
  if (!url || url.startsWith('about:')) return true;
  return url.startsWith(WEB_ORIGIN + '/chat-launcher') ||
    url.startsWith(WEB_ORIGIN + '/chat-launcher/');
}

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0b1020" />
      <WebView
        source={{ uri: START_URL }}
        style={styles.web}
        originWhitelist={['https://*', 'about:*', 'data:*']}
        onShouldStartLoadWithRequest={(request) => {
          if (isAppUrl(request.url)) return true;
          Linking.openURL(request.url).catch(() => {});
          return false;
        }}
        onOpenWindow={(event) => {
          Linking.openURL(event.nativeEvent.targetUrl).catch(() => {});
        }}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        pullToRefreshEnabled
        sharedCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  web: {
    flex: 1,
  },
});
