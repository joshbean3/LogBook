import type { CapacitorConfig } from '@capacitor/cli';

/** The native shell around Logbook. The web build is bundled into the app; data syncs with your own server. */
const config: CapacitorConfig = {
  appId: 'com.joshbean.logbook',
  appName: 'Logbook',
  webDir: 'dist',
  backgroundColor: '#000000',
  ios: {
    contentInset: 'never',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    // a long press on a link is the app's menu, never a WebKit preview card (ios/App/App/LogbookViewController.swift sets it too)
    allowsLinkPreview: false,
  },
  plugins: {
    // native HTTP: requests leave from the device, cookies live in the native jar, no CORS
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
    SplashScreen: { launchShowDuration: 0, launchAutoHide: false, backgroundColor: '#000000', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: true },
    // the WebView never resizes for the keyboard: lib/keyboard.ts writes --kb and html.kb-open (docs/feel.md §12)
    Keyboard: { resize: 'none', resizeOnFullScreen: false },
  },
};

export default config;
