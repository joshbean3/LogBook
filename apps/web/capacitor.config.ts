import type { CapacitorConfig } from '@capacitor/cli';

/** The native shell around Logbook. The web build is bundled into the app; data syncs with your own server. */
const config: CapacitorConfig = {
  appId: 'com.joshbean.logbook',
  appName: 'Orby',
  webDir: 'dist',
  backgroundColor: '#EAF5FC',
  ios: {
    contentInset: 'never',
    backgroundColor: '#EAF5FC',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    // a long press on a link is the app's menu, never a WebKit preview card (ios/App/App/LogbookViewController.swift sets it too)
    allowsLinkPreview: false,
  },
  plugins: {
    // native HTTP: requests leave from the device, cookies live in the native jar, no CORS
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
    SplashScreen: { launchShowDuration: 0, launchAutoHide: false, backgroundColor: '#EAF5FC', showSpinner: false },
    StatusBar: { style: 'LIGHT', overlaysWebView: true },
    // the WebView never resizes for the keyboard: lib/keyboard.ts writes --kb and html.kb-open (docs/feel.md §12)
    Keyboard: { resize: 'none', resizeOnFullScreen: false },
  },
};

export default config;
