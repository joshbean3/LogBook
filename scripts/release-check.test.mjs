// Tests for the release checks and the iOS project files. Run with: pnpm test:scripts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { devPlist } from './ios-dev-plist.mjs';
import { RESOLVED, checkBundle, checkCapConfig, checkEnv, checkIosProject, checkSpm, parsePlist, stampProject, targetSettings } from './release-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const good = { VITE_API_ORIGIN: 'https://api.logbook-app.test', VITE_SUPPORT_EMAIL: 'help@logbook-app.test' };

const bundle = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-bundle-'));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
};

test('settings: a real server and support address pass', () => {
  assert.deepEqual(checkEnv(good, 'help@logbook-app.test'), []);
  assert.deepEqual(checkEnv({ ...good, VITE_SITE_ORIGIN: 'https://logbook-app.test' }, 'Help@logbook-app.test'), []);
});

test('settings: the server address must be set, https, not fly.dev, an origin only', () => {
  assert.match(checkEnv({ ...good, VITE_API_ORIGIN: '' })[0], /VITE_API_ORIGIN is not set/);
  assert.match(checkEnv({ ...good, VITE_API_ORIGIN: 'https://some-app.fly.dev' }).join('\n'), /fly\.dev/);
  assert.match(checkEnv({ ...good, VITE_API_ORIGIN: 'http://api.logbook-app.test' }).join('\n'), /https/);
  assert.match(checkEnv({ ...good, VITE_API_ORIGIN: 'https://api.logbook-app.test/' }).join('\n'), /no trailing slash/);
  assert.match(checkEnv({ ...good, VITE_API_ORIGIN: 'https://localhost' }).join('\n'), /not a public server/);
});

test('settings: the support address must be set, real, and the one on the legal pages', () => {
  assert.match(checkEnv({ ...good, VITE_SUPPORT_EMAIL: undefined }).join('\n'), /VITE_SUPPORT_EMAIL is not set/);
  assert.match(checkEnv({ ...good, VITE_SUPPORT_EMAIL: 'support@example.com' }).join('\n'), /example address/);
  assert.match(checkEnv(good, 'other@logbook-app.test').join('\n'), /not the address on the legal pages/);
  assert.match(checkEnv(good, '').join('\n'), /not the address on the legal pages/);
});

test('settings: Strava and test stubs are refused', () => {
  assert.match(checkEnv({ ...good, VITE_FEATURE_STRAVA: '1' }).join('\n'), /Strava is not in the release build/);
  assert.match(checkEnv({ ...good, VITE_FAKE_CLOCK: '2026-11-10' }).join('\n'), /VITE_FAKE_CLOCK/);
});

test('bundle: a clean build passes', () => {
  const dir = bundle({ 'index.html': '<div id="root"></div>', 'assets/index-abc.js': 'const a="/api/sessions";console.log("Today")', 'assets/index-abc.css': '.card{color:red}' });
  assert.deepEqual(checkBundle(dir), []);
});

test('bundle: the developer gallery fails by chunk name, by text and by route', () => {
  assert.match(checkBundle(bundle({ 'assets/UiGallery-x1.js': 'export default 1' })).join('\n'), /developer screen: 1 in assets\/UiGallery-x1\.js/);
  assert.match(checkBundle(bundle({ 'assets/index-a.js': 'const r=[{path:"/dev/ui"}]' })).join('\n'), /developer screen/);
  assert.match(checkBundle(bundle({ 'assets/index-a.js': 'import("./StubRoots-9.js")' })).join('\n'), /developer screen/);
  // still refused in the owner's own build
  assert.match(checkBundle(bundle({ 'assets/index-a.js': 'const r=[{path:"/dev/ui"}]' }), { strava: true }).join('\n'), /developer screen/);
});

test('bundle: Strava copy or a /strava/ request path fails unless the build is the owner\'s own', () => {
  const copy = bundle({ 'assets/Settings-a.js': 'const t="Connect Strava"' });
  const route = bundle({ 'assets/index-a.js': 'fetch(o+"/strava/sync")' });
  assert.match(checkBundle(copy).join('\n'), /Strava: 1 in assets\/Settings-a\.js/);
  assert.match(checkBundle(route).join('\n'), /Strava: 1 in assets\/index-a\.js/);
  assert.deepEqual(checkBundle(copy, { strava: true }), []);
  assert.deepEqual(checkBundle(route, { strava: true }), []);
});

test('bundle: a missing or empty folder is a failure, not a pass', () => {
  assert.match(checkBundle(path.join(os.tmpdir(), 'logbook-no-such-folder'))[0], /does not exist/);
  assert.match(checkBundle(fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-empty-')))[0], /is empty/);
});

test('capacitor config: the committed shape passes and each dev setting fails', () => {
  assert.deepEqual(checkCapConfig({ appId: 'x', webDir: 'dist', ios: { contentInset: 'never' }, plugins: {} }), []);
  assert.match(checkCapConfig({ server: { url: 'http://192.168.1.5:5173' } })[0], /server\.url/);
  assert.match(checkCapConfig({ server: { cleartext: true } })[0], /cleartext/);
  assert.match(checkCapConfig({ server: { allowNavigation: ['*'] } })[0], /allowNavigation/);
  assert.match(checkCapConfig({ ios: { webContentsDebuggingEnabled: true } })[0], /webContentsDebuggingEnabled/);
  assert.match(checkCapConfig({ webContentsDebuggingEnabled: false })[0], /webContentsDebuggingEnabled/);
});

test('iOS project: Info.plist, entitlements, privacy manifest, project file and Health types are as agreed', () => {
  assert.deepEqual(checkIosProject(root), []);
});

test('iOS project: the purpose strings are the agreed ones', () => {
  const info = parsePlist(read('apps/web/ios/App/App/Info.plist'));
  assert.equal(info.NSHealthShareUsageDescription, 'Logbook reads your sleep, heart rate variability and resting heart rate from Apple Health to show them on Progress. Readings are saved to your Logbook account.');
  assert.equal(info.NSPhotoLibraryAddUsageDescription, 'Save the cards you share to your photo library.');
  assert.match(info.NSCameraUsageDescription, /assistant or the plan builder/);
  assert.equal(info.CFBundleURLTypes, undefined);
  assert.equal(info['UISupportedInterfaceOrientations~ipad'], undefined);
});

test('iOS project: iPhone only, with the entitlements file, in both configurations', () => {
  const s = targetSettings(read('apps/web/ios/App/App.xcodeproj/project.pbxproj'));
  for (const name of ['Debug', 'Release']) {
    assert.equal(s[name].TARGETED_DEVICE_FAMILY, '1');
    assert.equal(s[name].CODE_SIGN_ENTITLEMENTS, 'App/App.entitlements');
  }
  assert.equal(s.Release.INFOPLIST_FILE, 'App/Info.plist');
  assert.equal(parsePlist(read('apps/web/ios/App/App/App.entitlements'))['com.apple.developer.healthkit'], true);
});

test('iOS project: the check notices a fourth Health type and a source name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-ios-'));
  for (const p of ['apps/web/ios/App/App/Info.plist', 'apps/web/ios/App/App/App.entitlements', 'apps/web/ios/App/App/PrivacyInfo.xcprivacy', 'apps/web/ios/App/App.xcodeproj/project.pbxproj', 'packages/capacitor-health/Package.swift']) {
    fs.mkdirSync(path.dirname(path.join(tmp, p)), { recursive: true });
    fs.copyFileSync(path.join(root, p), path.join(tmp, p));
  }
  const src = 'packages/capacitor-health/ios/Sources/LogbookHealthPlugin';
  fs.mkdirSync(path.join(tmp, src), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, src))) fs.copyFileSync(path.join(root, src, f), path.join(tmp, src, f));
  assert.deepEqual(checkIosProject(tmp), []);
  fs.appendFileSync(path.join(tmp, src, 'HealthReader.swift'), '\nlet extra = HKObjectType.quantityType(forIdentifier: .stepCount)\nlet row = ["sourceName": "x"]\n');
  const problems = checkIosProject(tmp).join('\n');
  assert.match(problems, /it must read exactly heartRateVariabilitySDNN, restingHeartRate, sleepAnalysis/);
  assert.match(problems, /sourceName/);
  // and a URL scheme or an iPad block in the release plist
  const plist = path.join(tmp, 'apps/web/ios/App/App/Info.plist');
  fs.writeFileSync(plist, devPlist(fs.readFileSync(plist, 'utf8')));
  assert.match(checkIosProject(tmp).join('\n'), /CFBundleURLTypes registers a URL scheme/);
});

const copyProject = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-ios-'));
  const src = 'packages/capacitor-health/ios/Sources/LogbookHealthPlugin';
  const files = ['apps/web/ios/App/App/Info.plist', 'apps/web/ios/App/App/App.entitlements', 'apps/web/ios/App/App/PrivacyInfo.xcprivacy', 'apps/web/ios/App/App.xcodeproj/project.pbxproj', 'packages/capacitor-health/Package.swift'];
  for (const f of fs.readdirSync(path.join(root, src))) files.push(`${src}/${f}`);
  for (const p of files) {
    fs.mkdirSync(path.dirname(path.join(tmp, p)), { recursive: true });
    fs.copyFileSync(path.join(root, p), path.join(tmp, p));
  }
  const edit = (p, from, to) => {
    const file = path.join(tmp, p);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes(from), `${p} holds ${from}`);
    fs.writeFileSync(file, text.split(from).join(to));
  };
  return { tmp, edit, src };
};

test('iOS project: light, named Logbook, arm64, iOS 17, AutoFill domain', () => {
  const info = parsePlist(read('apps/web/ios/App/App/Info.plist'));
  assert.equal(info.UIUserInterfaceStyle, 'Light');
  assert.equal(info.CFBundleName, 'Logbook');
  assert.deepEqual(info.UIRequiredDeviceCapabilities, ['arm64']);
  assert.equal(info.LogbookAPIHost, '$(LOGBOOK_API_HOST)');
  const ent = parsePlist(read('apps/web/ios/App/App/App.entitlements'));
  assert.deepEqual(ent['com.apple.developer.associated-domains'], ['webcredentials:$(LOGBOOK_API_HOST)']);
  const s = targetSettings(read('apps/web/ios/App/App.xcodeproj/project.pbxproj'));
  for (const name of ['Debug', 'Release']) {
    assert.equal(s[name].IPHONEOS_DEPLOYMENT_TARGET, '17.0');
    assert.ok(s[name].LOGBOOK_API_HOST);
  }

  const { tmp, edit } = copyProject();
  edit('apps/web/ios/App/App/Info.plist', '<string>Light</string>', '<string>Dark</string>');
  edit('apps/web/ios/App/App/Info.plist', '<string>arm64</string>', '<string>armv7</string>');
  edit('apps/web/ios/App/App/Info.plist', '<string>Logbook</string>\n\t<key>CFBundlePackageType', '<string>$(PRODUCT_NAME)</string>\n\t<key>CFBundlePackageType');
  edit('apps/web/ios/App/App.xcodeproj/project.pbxproj', 'IPHONEOS_DEPLOYMENT_TARGET = 17.0;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;');
  edit('packages/capacitor-health/Package.swift', '.iOS(.v17)', '.iOS(.v15)');
  edit('apps/web/ios/App/App/App.entitlements', 'webcredentials:$(LOGBOOK_API_HOST)', 'webcredentials:example.com');
  const problems = checkIosProject(tmp).join('\n');
  for (const re of [/UIUserInterfaceStyle must be Light/, /arm64 only/, /CFBundleName must be Logbook/, /\(Release\): IPHONEOS_DEPLOYMENT_TARGET must be 17\.0/, /every IPHONEOS_DEPLOYMENT_TARGET/, /capacitor-health\/Package\.swift/, /associated-domains/]) assert.match(problems, re);
});

test('Health plugin: Gregorian days, a disconnect that waits, a state that tolerates new keys', () => {
  const { tmp, edit, src } = copyProject();
  assert.deepEqual(checkIosProject(tmp), []);
  edit(`${src}/HealthSync.swift`, 'HealthCalendar.gregorian.date(byAdding', 'Calendar.current.date(byAdding');
  edit(`${src}/HealthSync.swift`, 'func disconnect() async {\n        await stopRunning()\n', 'func disconnect() async {\n');
  edit(`${src}/HealthStorage.swift`, 'try c.decodeIfPresent(Bool.self, forKey: .connected) ?? false', 'try c.decode(Bool.self, forKey: .connected)');
  const problems = checkIosProject(tmp).join('\n');
  assert.match(problems, /Calendar\.current is used/);
  assert.match(problems, /disconnect\(\) must cancel and wait/);
  assert.match(problems, /decodeIfPresent/);
});

test('Debug plist: Info.plist plus the logbook scheme, and nothing else', () => {
  const release = read('apps/web/ios/App/App/Info.plist');
  const dev = parsePlist(devPlist(release));
  assert.deepEqual(dev.CFBundleURLTypes, [{ CFBundleURLName: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleURLSchemes: ['logbook'] }]);
  delete dev.CFBundleURLTypes;
  assert.deepEqual(dev, parsePlist(release));
  assert.throws(() => devPlist(devPlist(release)), /already registers/);
});

test('version stamp: writes the version and build into both configurations', () => {
  const pbx = read('apps/web/ios/App/App.xcodeproj/project.pbxproj');
  const s = targetSettings(stampProject(pbx, '1.0.0', 412));
  for (const name of ['Debug', 'Release']) {
    assert.equal(s[name].MARKETING_VERSION, '1.0.0');
    assert.equal(s[name].CURRENT_PROJECT_VERSION, '412');
  }
  assert.throws(() => stampProject(pbx, '1.0', 3), /must look like 1\.0\.0/);
  assert.throws(() => stampProject(pbx, '1.0.0', 0), /whole number above 0/);
  // with the server address, its host becomes the AutoFill domain in both configurations
  const withHost = targetSettings(stampProject(pbx, '1.0.0', 412, 'https://api.logbook-app.test'));
  for (const name of ['Debug', 'Release']) assert.equal(withHost[name].LOGBOOK_API_HOST, 'api.logbook-app.test');
  assert.throws(() => stampProject(pbx, '1.0.0', 412, 'https://api.example.com'), /cannot go into the entitlements/);
});

test('swift package: every Capacitor plugin listed, iOS 17, Package.resolved committed', () => {
  const tree = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-spm-'));
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), text);
    }
    return dir;
  };
  const plugin = (name) => JSON.stringify({ name, capacitor: { ios: { src: 'ios' } } });
  const base = {
    'apps/web/package.json': JSON.stringify({ dependencies: { '@capacitor/haptics': '8.0.0', '@logbook/capacitor-health': 'workspace:*', react: '19.0.0' } }),
    'apps/web/node_modules/@capacitor/haptics/package.json': plugin('@capacitor/haptics'),
    'apps/web/node_modules/@logbook/capacitor-health/package.json': plugin('@logbook/capacitor-health'),
    'apps/web/node_modules/react/package.json': JSON.stringify({ name: 'react' }),
  };
  const swift = (platform, folders) =>
    `let package = Package(\n  platforms: [.iOS(.${platform})],\n  dependencies: [\n${folders.map((f) => `    .package(name: "x", path: "../../../../../${f}")`).join(',\n')}\n  ]\n)\n`;
  const all = ['node_modules/@capacitor/haptics', 'packages/capacitor-health'];
  const ok = tree({ ...base, 'apps/web/ios/App/CapApp-SPM/Package.swift': swift('v17', all), [`apps/web/ios/App/${RESOLVED}`]: '{}' });
  assert.deepEqual(checkSpm(ok), []);
  const stale = tree({ ...base, 'apps/web/ios/App/CapApp-SPM/Package.swift': swift('v15', all.slice(0, 1)) });
  const problems = checkSpm(stale).join('\n');
  assert.match(problems, /does not list @logbook\/capacitor-health/);
  assert.match(problems, /not on iOS 17/);
  assert.match(problems, /Package\.resolved is missing/);
  assert.doesNotMatch(problems, /react/);
});

test('bundle: a fly.dev fallback address fails a release build, not the owner\'s own', () => {
  const dir = bundle({ 'assets/index-a.js': 'const o="https://"??"https://my-app.fly.dev"' });
  assert.match(checkBundle(dir).join('\n'), /fly\.dev address: 1 in assets\/index-a\.js/);
  assert.deepEqual(checkBundle(dir, { strava: true }), []);
});
