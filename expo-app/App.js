import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as QuickActions from 'expo-quick-actions';
import * as Sharing from 'expo-sharing';
import { useShareIntent } from 'expo-share-intent';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { HomeWidgetView, WIDGET_NAME, saveWidgetItems } from './widgets/HomeWidget';

/**
 * Thin shell around the live Chat Launcher PWA (the real app lives on
 * GitHub Pages — this container only hosts it and hands any external
 * navigation to the operating system, so wa.me / tel: / sms: deep links
 * open the right installed app instead of loading inside the WebView).
 *
 * Shell-only extras (not part of the web app):
 *  - native contact picker: pick a contact, the number (+ name + photo) is
 *    pushed into the page through a postMessage bridge
 *  - dynamic launcher shortcuts: the page posts its top history entries,
 *    the shell mirrors them as Android/iOS quick actions
 *  - home-screen widget (react-native-android-widget): mirrors the top
 *    history entries, one tap opens the site with the number pre-filled
 *  - share-in target (expo-share-intent): text shared from any app lands in
 *    the page and the first phone number in it is extracted there
 *  - scheduled chats (expo-notifications): the page asks for a notification
 *    at a chosen time; tapping it opens the deep link
 */
const WEB_ORIGIN = 'https://avithegod2010.github.io';
const START_URL = `${WEB_ORIGIN}/chat-launcher/`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function isAppUrl(url) {
  if (!url || url.startsWith('about:')) return true;
  return url.startsWith(WEB_ORIGIN + '/chat-launcher');
}

/** Push a message into the page (the web app listens for these types). */
function shellMessage(payload) {
  const json = JSON.stringify(payload);
  return `window.postMessage(${json}, '*'); true;`;
}

export default function App() {
  const webRef = useRef(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  const pushNumber = useCallback((number) => {
    webRef.current?.injectJavaScript(shellMessage({ type: 'chatlauncher-contact', number }));
  }, []);

  /** Quick actions land here — reload the app URL with the number params. */
  const openFromAction = useCallback((action) => {
    const number = action?.params?.number;
    if (!number) return;
    const app = action?.params?.app;
    const url = `${START_URL}?number=${encodeURIComponent('+' + number)}${app ? `&app=${encodeURIComponent(app)}` : ''}`;
    webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  /* ---- dynamic launcher shortcuts ------------------------------------- */
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    openFromAction(QuickActions.initial);
    const subscription = QuickActions.addListener(openFromAction);
    return () => subscription.remove();
  }, [openFromAction]);

  const onShellMessage = useCallback((event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data?.type === 'history' && Array.isArray(data.items)) {
      const items = data.items
        .filter((it) => typeof it?.e164 === 'string' && /^\d{7,15}$/.test(it.e164))
        .slice(0, 3)
        .map((it, i) => ({
          id: `hist-${i}`,
          title: (it.label || `+${it.e164}`).slice(0, 24),
          params: { number: it.e164, app: it.app || '' },
        }));
      if (items.length) QuickActions.setItems(items).catch(() => {});
      // Keep the home-screen widget in sync with the same data.
      saveWidgetItems(items).then(() => {
        requestWidgetUpdate({
          widgetName: WIDGET_NAME,
          renderWidget: () => <HomeWidgetView items={items} />,
        }).catch(() => {});
      });
      return;
    }
    if (data?.type === 'chatlauncher-schedule') {
      scheduleChatNotification(data).catch(() => {});
      return;
    }
    // The page hands us its backup as base64 (blob downloads no-op in the
    // WebView): write it to cache and open the share sheet.
    if (data?.type === 'chatlauncher-export') {
      saveBackupFile(data).catch(() => {});
    }
  }, []);

  /* ---- share-in target -------------------------------------------------- */
  useEffect(() => {
    if (!hasShareIntent) return;
    const text = shareIntent.text ?? '';
    if (text.trim()) {
      webRef.current?.injectJavaScript(
        shellMessage({ type: 'chatlauncher-share', text: text.slice(0, 2000) }),
      );
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  /* ---- scheduled chats --------------------------------------------------- */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response?.notification?.request?.content?.data?.url;
      if (url && isAppUrl(url)) {
        webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
      } else if (url) {
        Linking.openURL(url).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  /* ---- native contact picker ------------------------------------------ */
  const openContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Contacts permission needed', 'Allow contacts access to pick a number.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.ImageBase64,
        ],
      });
      const list = [];
      for (const c of data) {
        const numbers = (c.phoneNumbers ?? [])
          .map((p) => (p.number ?? '').replace(/[^\d+]/g, ''))
          .filter((n) => /^\+?\d{7,15}$/.test(n));
        if (!numbers.length) continue;
        list.push({
          id: String(c.id ?? list.length),
          name: c.name || `+${numbers[0].replace(/^\+/, '')}`,
          number: numbers.find((n) => n.startsWith('+')) ?? numbers[0],
          avatar: typeof c.imageBase64 === 'string' && c.imageBase64.length < 12000
            ? `data:image/png;base64,${c.imageBase64}`
            : null,
        });
        if (list.length >= 400) break;
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(list);
      setQuery('');
      setContactsOpen(true);
    } catch {
      Alert.alert('Could not read contacts', 'Try again or type the number instead.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const chooseContact = useCallback(
    (contact) => {
      webRef.current?.injectJavaScript(
        shellMessage({
          type: 'chatlauncher-contact',
          number: contact.number,
          name: contact.name?.startsWith('+') ? null : contact.name,
          avatar: contact.avatar,
        }),
      );
      setContactsOpen(false);
    },
    [],
  );

  const filtered = query
    ? contacts.filter(
        (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.number.includes(query),
      )
    : contacts;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0b1020" />
      <WebView
        ref={webRef}
        source={{ uri: START_URL }}
        style={styles.web}
        originWhitelist={['https://*', 'about:*', 'data:*']}
        onShouldStartLoadWithRequest={(request) => {
          if (isAppUrl(request.url)) return true;
          Linking.openURL(request.url).catch(() => {});
          return false;
        }}
        onMessage={onShellMessage}
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

      <Pressable
        style={styles.contactsFab}
        onPress={openContacts}
        accessibilityLabel="Pick from contacts"
        disabled={contactsLoading}
      >
        {contactsLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.fabIcon}>👤</Text>
        )}
      </Pressable>

      <Modal visible={contactsOpen} animationType="slide" onRequestClose={() => setContactsOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Pick a contact</Text>
            <Pressable onPress={() => setContactsOpen(false)} hitSlop={12}>
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search name or number…"
            placeholderTextColor="#98a0c0"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => chooseContact(item)}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.rowAvatar} />
                ) : (
                  <View style={[styles.rowAvatar, styles.rowAvatarFallback]}>
                    <Text style={styles.rowAvatarText}>
                      {(item.name || '#').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.rowTexts}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowNumber}>{item.number}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No contacts with phone numbers.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

/** Write a page-provided backup (base64) to cache and open the share sheet. */
async function saveBackupFile({ name, base64 }) {
  try {
    if (
      typeof base64 !== 'string' ||
      !/^[A-Za-z0-9+/=]+$/.test(base64) ||
      base64.length > 12 * 1024 * 1024
    ) {
      return;
    }
    const safeName =
      typeof name === 'string' && /^[\w.-]{1,80}$/.test(name)
        ? name
        : 'chat-launcher-backup.json';
    const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Chat Launcher backup',
        UTI: 'public.json',
      });
    }
  } catch {
    /* nothing we can do from the shell — the page already toasted success */
  }
}

/** Schedule the "your chat is due" notification (web asks via the bridge). */
async function scheduleChatNotification({ seconds, number, url }) {
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return;
    const safeSeconds = Math.min(Math.max(Number(seconds) || 0, 60), 60 * 60 * 24 * 30);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Chat Launcher',
        body: `Open your chat with +${String(number ?? '').slice(0, 15)}`,
        data: { url: String(url ?? START_URL) },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: safeSeconds,
        channelId: 'chatlauncher',
      },
    });
  } catch {
    /* notifications unavailable — the web app already told the user */
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1020' },
  web: { flex: 1 },
  contactsFab: {
    position: 'absolute',
    right: 18,
    bottom: 26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108, 92, 246, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabIcon: { fontSize: 24, color: '#fff' },
  modal: { flex: 1, backgroundColor: '#0b1020', paddingTop: 54, paddingHorizontal: 16 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: '#e9ecfb', fontSize: 20, fontWeight: '700' },
  modalClose: { color: '#98a0c0', fontSize: 22, paddingHorizontal: 6 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#e9ecfb',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: 'rgba(108,92,246,0.35)',
  },
  rowAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { color: '#e9ecfb', fontSize: 16, fontWeight: '700' },
  rowTexts: { flex: 1 },
  rowName: { color: '#e9ecfb', fontSize: 15, fontWeight: '600' },
  rowNumber: { color: '#98a0c0', fontSize: 13 },
  empty: { color: '#98a0c0', textAlign: 'center', marginTop: 30 },
});
