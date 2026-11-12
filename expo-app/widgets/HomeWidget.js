/**
 * 4×2 home-screen widget: your top launch targets, one tap to open.
 *
 * Data flow: the WebView page posts its history to the shell (App.js), which
 * stores it in AsyncStorage and asks the widget to redraw. The headless task
 * handler below re-reads the stored items on every action, so it always
 * renders the latest data even when the app process is gone.
 */
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FlexWidget,
  TextWidget,
  registerWidgetTaskHandler,
} from 'react-native-android-widget';

export const WIDGET_NAME = 'HomeWidget';
const DATA_KEY = 'chatlauncher:widget-items';
const START_URL = 'https://avithegod2010.github.io/chat-launcher/';

export async function saveWidgetItems(items) {
  try {
    await AsyncStorage.setItem(
      DATA_KEY,
      JSON.stringify(
        (Array.isArray(items) ? items : []).slice(0, 3).map((it) => ({
          e164: String(it?.e164 ?? '').replace(/[^\d]/g, '').slice(0, 15),
          label: String(it?.label ?? '').slice(0, 24),
          app: String(it?.app ?? '').slice(0, 24),
        })),
      ),
    );
  } catch {
    /* storage unavailable — widget keeps its last rendering */
  }
}

export function openNumber(e164, app) {
  const url =
    `${START_URL}?number=${encodeURIComponent('+' + e164)}` +
    (app ? `&app=${encodeURIComponent(app)}` : '');
  Linking.openURL(url).catch(() => {});
}

function TargetChip({ label, sub, number, app }) {
  return (
    <FlexWidget
      clickAction="OPEN_NUMBER"
      clickActionData={{ number, app }}
      style={{
        flex: 1,
        height: 'match_parent',
        marginHorizontal: 3,
        borderRadius: 14,
        backgroundColor: 'rgba(108, 92, 246, 0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
      }}
    >
      <TextWidget
        style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}
        text={label}
        maxLines={1}
      />
      <TextWidget
        style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 }}
        text={sub}
        maxLines={1}
      />
    </FlexWidget>
  );
}

export function HomeWidgetView({ items }) {
  const targets = items.length
    ? items
    : [
        { e164: '', label: 'WhatsApp', app: 'whatsapp' },
        { e164: '', label: 'Telegram', app: 'telegram' },
        { e164: '', label: 'SMS', app: 'sms' },
      ];
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 22,
        backgroundColor: 'rgba(11, 16, 32, 0.92)',
        padding: 10,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <TextWidget
        style={{ color: '#c9cdf1', fontSize: 11, fontWeight: '700' }}
        text="Chat Launcher"
      />
      <FlexWidget style={{ flexDirection: 'row', height: 46 }}>
        {targets.map((it, i) => (
          <TargetChip
            key={`${it.e164}-${i}`}
            label={it.label || `+${it.e164}`}
            sub={it.e164 ? 'tap to open' : 'open app'}
            number={it.e164}
            app={it.app}
          />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

async function readWidgetItems() {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

registerWidgetTaskHandler(async ({ widgetAction, clickAction, clickActionData, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'OPEN_NUMBER') {
    const { number = '', app = '' } = clickActionData ?? {};
    if (number) openNumber(number, app);
  }
  const items = await readWidgetItems();
  renderWidget(<HomeWidgetView items={items} />);
});
