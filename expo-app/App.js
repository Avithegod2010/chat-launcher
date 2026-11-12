import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import * as QuickActions from 'expo-quick-actions';

/**
 * Thin shell around the live Chat Launcher PWA (the real app lives on
 * GitHub Pages — this container only hosts it and hands any external
 * navigation to the operating system, so wa.me / tel: / sms: deep links
 * open the right installed app instead of loading inside the WebView).
 *
 * Shell-only extras (not part of the web app):
 *  - native contact picker (#10): pick a contact, the number is pushed
 *    into the page through a postMessage bridge
 *  - dynamic launcher shortcuts (#11): the page posts its top history
 *    entries, the shell mirrors them as Android/iOS quick actions
 */
const WEB_ORIGIN = 'https://avithegod2010.github.io';
const START_URL = `${WEB_ORIGIN}/chat-launcher/`;

function isAppUrl(url) {
  if (!url || url.startsWith('about:')) return true;
  return url.startsWith(WEB_ORIGIN + '/chat-launcher');
}

/** Push a number into the page as a message event (the web app listens). */
function contactMessage(number) {
  const payload = JSON.stringify({ type: 'chatlauncher-contact', number });
  return `window.postMessage(${payload}, '*'); true;`;
}

export default function App() {
  const webRef = useRef(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [query, setQuery] = useState('');

  const pushNumber = useCallback((number) => {
    webRef.current?.injectJavaScript(contactMessage(number));
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
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type !== 'history' || !Array.isArray(data.items)) return;
      const items = data.items
        .filter((it) => typeof it?.e164 === 'string' && /^\d{7,15}$/.test(it.e164))
        .slice(0, 3)
        .map((it, i) => ({
          id: `hist-${i}`,
          title: (it.label || `+${it.e164}`).slice(0, 24),
          params: { number: it.e164, app: it.app || '' },
        }));
      if (items.length) QuickActions.setItems(items).catch(() => {});
    } catch {
      /* ignore non-JSON messages */
    }
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
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
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
      pushNumber(contact.number);
      setContactsOpen(false);
    },
    [pushNumber],
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
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowNumber}>{item.number}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No contacts with phone numbers.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  rowName: { color: '#e9ecfb', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
  rowNumber: { color: '#98a0c0', fontSize: 13 },
  empty: { color: '#98a0c0', textAlign: 'center', marginTop: 30 },
});
