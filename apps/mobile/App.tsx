import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

/**
 * Logbook on the phone through Expo Go: the deployed web app, full screen, in one WebView. Cookies persist between opens
 * (the sign-in sticks), links to other sites open in the browser, swiping from the left edge goes back, and a pull at the
 * top refreshes. The server to open comes from app.json → expo.extra.appUrl (the Fly app).
 */
const APP_URL: string = (Constants.expoConfig?.extra?.appUrl as string | undefined) ?? 'https://josh-logbook.fly.dev';
const origin = new URL(APP_URL).origin;

export default function App() {
  const web = useRef<WebView>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const stayInside = (req: WebViewNavigation) => {
    if (req.url.startsWith(origin) || req.url.startsWith('about:')) return true;
    // Strava and COROS sign-in pages come back to our origin on their own; anything else is the phone's browser
    if (/strava\.com|coros\.com/.test(req.url)) return true;
    void Linking.openURL(req.url);
    return false;
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar style="light" backgroundColor="#000000" />
        {failed ? (
          <View style={styles.center}>
            <Text style={styles.title}>Couldn’t reach Logbook</Text>
            <Text style={styles.sub}>{failed}</Text>
            <Pressable
              style={styles.button}
              onPress={() => {
                setFailed(null);
                web.current?.reload();
              }}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        <WebView
          ref={web}
          source={{ uri: `${APP_URL}/today` }}
          style={[styles.web, failed ? styles.hidden : null]}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={stayInside}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => setFailed(e.nativeEvent.description || 'Check your connection.')}
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 500) setFailed(`The server answered ${e.nativeEvent.statusCode}.`);
          }}
          applicationNameForUserAgent="Logbook/1.0 (expo)"
        />
        {loading && !failed ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color="#5b66ff" />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  web: { flex: 1, backgroundColor: '#000000' },
  hidden: { opacity: 0, height: 0, flex: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' },
  button: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, backgroundColor: '#ffffff' },
  buttonText: { color: '#000000', fontSize: 17, fontWeight: '600' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
