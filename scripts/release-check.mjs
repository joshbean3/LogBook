#!/usr/bin/env node
// The checks a release build must pass. scripts/ios-release.sh runs every one; each can also be run alone.
//
//   node scripts/release-check.mjs env                    the build settings (server address, support address, no Strava)
//   node scripts/release-check.mjs bundle <dir> [--strava] the built files: no developer screen, no Strava
//   node scripts/release-check.mjs capconfig <file>       the synced capacitor.config.json: no dev server settings
//   node scripts/release-check.mjs ios                    Info.plist, entitlements, privacy manifest, project file, Health types
//   node scripts/release-check.mjs spm                    CapApp-SPM/Package.swift lists every Capacitor plugin
//   node scripts/release-check.mjs stamp <version> <build> write the version and build number into the Xcode project
//
// Each check prints one line per problem and exits 1, or prints one line and exits 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IOS = 'apps/web/ios/App';
const HEALTH_SRC = 'packages/capacitor-health/ios/Sources/LogbookHealthPlugin';
/** The lowest iOS the app runs on (docs/launch/decisions.md D4). */
export const MIN_IOS = '17.0';

// ---------- the build settings ----------
const EXAMPLE_HOST = /(^|\.)example\.(com|org|net)$/i;

/** The settings a release build is made with. `env` is the process environment; `legalEmail` is the address on the legal pages. */
export const checkEnv = (env, legalEmail) => {
  const out = [];
  const origin = (env.VITE_API_ORIGIN ?? '').trim();
  if (!origin) out.push('VITE_API_ORIGIN is not set. Set it to the server address you control, for example https://api.<your domain>.');
  else {
    let u = null;
    try {
      u = new URL(origin);
    } catch {
      out.push(`VITE_API_ORIGIN is not an address: ${origin}`);
    }
    if (u) {
      if (u.protocol !== 'https:') out.push(`VITE_API_ORIGIN must start with https:// (got ${origin})`);
      if (/(^|\.)fly\.dev$/i.test(u.hostname)) out.push(`VITE_API_ORIGIN is a fly.dev address (${u.hostname}). A release goes to a domain you control.`);
      if (/^(localhost|127\.|10\.|192\.168\.|\[::1\])/i.test(u.hostname) || EXAMPLE_HOST.test(u.hostname)) out.push(`VITE_API_ORIGIN is not a public server (${u.hostname})`);
      if (u.pathname !== '/' || u.search || u.hash || origin.endsWith('/')) out.push(`VITE_API_ORIGIN must be the origin only, with no path and no trailing slash (got ${origin})`);
    }
  }
  const site = (env.VITE_SITE_ORIGIN ?? '').trim();
  if (site) {
    try {
      const u = new URL(site);
      if (u.protocol !== 'https:' || /(^|\.)fly\.dev$/i.test(u.hostname) || EXAMPLE_HOST.test(u.hostname) || site.endsWith('/')) out.push(`VITE_SITE_ORIGIN must be an https origin you control, with no trailing slash (got ${site})`);
    } catch {
      out.push(`VITE_SITE_ORIGIN is not an address: ${site}`);
    }
  }
  const email = (env.VITE_SUPPORT_EMAIL ?? '').trim();
  if (!email) out.push('VITE_SUPPORT_EMAIL is not set. Set it to the support address people can write to.');
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) out.push(`VITE_SUPPORT_EMAIL is not an email address: ${email}`);
  else if (EXAMPLE_HOST.test(email.split('@')[1])) out.push(`VITE_SUPPORT_EMAIL is an example address (${email})`);
  else if (legalEmail !== undefined && email.toLowerCase() !== String(legalEmail).trim().toLowerCase()) out.push(`VITE_SUPPORT_EMAIL (${email}) is not the address on the legal pages (${legalEmail || 'none'}). Make docs/launch/legal-fields.json match.`);
  if ((env.VITE_FEATURE_STRAVA ?? '') === '1') out.push('VITE_FEATURE_STRAVA is 1. Strava is not in the release build: unset it.');
  if ((env.VITE_FEATURE_HEALTH ?? '') === '0') out.push('VITE_FEATURE_HEALTH is 0, but this project carries the HealthKit entitlement and purpose string. See docs/launch/decisions.md (D1) before building without Apple Health.');
  if (env.VITE_FAKE_CLOCK) out.push('VITE_FAKE_CLOCK is set. It swaps in test stubs: unset it.');
  return out;
};

// ---------- the built files ----------
/** What must never be in a release bundle. Guideline 2.5.19: a feature that is not offered is absent, not switched off. */
export const bundleRules = (withStrava) => [
  { name: 'developer screen', re: /UiGallery|PagerLab|StubRoots|dev\/ui/ },
  ...(withStrava ? [] : [{ name: 'Strava', re: /Strava|\/strava\b/ }]),
];

const TEXT_FILE = /\.(js|mjs|css|html|json|webmanifest|txt|xml|svg)$/;
const walk = (dir, list = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, list);
    else list.push(p);
  }
  return list;
};

/** Every hit in `dir`: the file, the rule and a little of the text around it. A file's own name counts. */
export const scanBundle = (dir, { strava = false } = {}) => {
  const rules = bundleRules(strava);
  const hits = [];
  const files = walk(dir);
  for (const f of files) {
    const rel = path.relative(dir, f);
    for (const rule of rules) if (rule.re.test(rel)) hits.push({ file: rel, rule: rule.name, near: 'the file name' });
    if (!TEXT_FILE.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const rule of rules) {
      for (const m of text.matchAll(new RegExp(rule.re.source, 'g'))) hits.push({ file: rel, rule: rule.name, near: text.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, ' ') });
    }
  }
  return { files: files.length, hits };
};

export const checkBundle = (dir, opts = {}) => {
  if (!fs.existsSync(dir)) return [`${dir} does not exist. Build first.`];
  const { files, hits } = scanBundle(dir, opts);
  if (!files) return [`${dir} is empty. Build first.`];
  const by = new Map();
  for (const h of hits) by.set(`${h.rule}|${h.file}`, [...(by.get(`${h.rule}|${h.file}`) ?? []), h.near]);
  return [...by].map(([k, near]) => {
    const [rule, file] = k.split('|');
    return `${rule}: ${near.length} in ${file}   ...${near[0]}...`;
  });
};

// ---------- the synced Capacitor config ----------
/** Settings that point the app at a development server or open the web view to a debugger. None may ship. */
export const checkCapConfig = (config) => {
  const out = [];
  const server = config?.server ?? {};
  if (server.url !== undefined) out.push(`server.url is set (${server.url}): the app would load its screens from a server, not from the bundle`);
  if (server.cleartext !== undefined) out.push('server.cleartext is set: plain http must stay off');
  if (server.allowNavigation !== undefined) out.push('server.allowNavigation is set: the web view must not leave the bundle');
  for (const [where, c] of [['', config], ['ios.', config?.ios], ['android.', config?.android]]) {
    if (c && c.webContentsDebuggingEnabled !== undefined) out.push(`${where}webContentsDebuggingEnabled is set: web view debugging must be left to the build type`);
  }
  return out;
};

// ---------- the iOS project ----------
/** A small reader for the XML property lists in this project (dict, array, string, integer, real, true, false). */
export const parsePlist = (xml) => {
  const body = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const tokens = [...body.matchAll(/<(\/?)(plist|dict|array|key|string|integer|real|true|false|date|data)\b[^>]*?(\/?)>([^<]*)/g)];
  let i = 0;
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const value = () => {
    const [, close, tag, selfClose, text] = tokens[i++];
    if (close) throw new Error(`unexpected </${tag}>`);
    if (tag === 'true') return true;
    if (tag === 'false') return false;
    if (tag === 'dict') {
      const d = {};
      if (selfClose) return d;
      while (!(tokens[i][1] && tokens[i][2] === 'dict')) {
        const [, c, t, , keyText] = tokens[i++];
        if (c || t !== 'key') throw new Error(`expected <key> in a dict, got <${c}${t}>`);
        i++; // </key>
        d[unesc(keyText)] = value();
      }
      i++;
      return d;
    }
    if (tag === 'array') {
      const a = [];
      if (selfClose) return a;
      while (!(tokens[i][1] && tokens[i][2] === 'array')) a.push(value());
      i++;
      return a;
    }
    if (selfClose) return '';
    i++; // the closing tag
    if (tag === 'integer' || tag === 'real') return Number(text);
    return unesc(text);
  };
  if (!tokens.length || tokens[0][2] !== 'plist') throw new Error('not a property list');
  i = 1;
  return value();
};

const HEALTH_PURPOSE = 'Logbook reads your sleep, heart rate variability and resting heart rate from Apple Health to show them on Progress. Readings are saved to your Logbook account.';
const PHOTO_ADD_PURPOSE = 'Save the cards you share to your photo library.';
const HEALTH_TYPES = ['heartRateVariabilitySDNN', 'restingHeartRate', 'sleepAnalysis'];
const COLLECTED = {
  EmailAddress: true,
  Name: true,
  UserID: true,
  OtherUserContent: true,
  PhotosorVideos: true,
  Fitness: true,
  Health: true,
  CrashData: false,
};

/** The build settings of each configuration of the App target, by configuration name. */
export const targetSettings = (pbx) => {
  const out = {};
  for (const m of pbx.matchAll(/\/\* (Debug|Release) \*\/ = \{\s*isa = XCBuildConfiguration;[\s\S]*?buildSettings = \{([\s\S]*?)\n\t\t\t\};/g)) {
    if (!/PRODUCT_BUNDLE_IDENTIFIER/.test(m[2])) continue; // the project-level configuration, not the target's
    const s = {};
    for (const l of m[2].matchAll(/^\s*([A-Z0-9_]+) = ([^;]*);/gm)) s[l[1]] = l[2].replace(/^"|"$/g, '');
    out[m[1]] = s;
  }
  return out;
};

export const checkIosProject = (root = ROOT) => {
  const out = [];
  const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
  const plistOf = (p) => {
    try {
      return parsePlist(read(p));
    } catch (e) {
      out.push(`${p} could not be read as a property list: ${e.message}`);
      return null;
    }
  };

  const info = plistOf(`${IOS}/App/Info.plist`);
  if (info) {
    if (info.NSHealthShareUsageDescription !== HEALTH_PURPOSE) out.push('Info.plist: NSHealthShareUsageDescription is not the agreed sentence');
    if (!/assistant/.test(info.NSCameraUsageDescription ?? '') || !/plan builder/.test(info.NSCameraUsageDescription ?? '')) out.push('Info.plist: NSCameraUsageDescription must name the assistant and the plan builder');
    if (info.NSPhotoLibraryAddUsageDescription !== PHOTO_ADD_PURPOSE) out.push('Info.plist: NSPhotoLibraryAddUsageDescription is missing or changed');
    if ('NSHealthUpdateUsageDescription' in info) out.push('Info.plist: NSHealthUpdateUsageDescription is present, but Logbook never writes to Apple Health');
    for (const [k, v] of Object.entries(info)) if (/UsageDescription$/.test(k) && /recovery|strain|score/i.test(String(v))) out.push(`Info.plist: ${k} promises recovery, strain or a score`);
    if ('CFBundleURLTypes' in info) out.push('Info.plist: CFBundleURLTypes registers a URL scheme. No feature in the release build uses one (it was the Strava return).');
    if ('UISupportedInterfaceOrientations~ipad' in info) out.push('Info.plist: the iPad orientation block is back. Logbook is iPhone only.');
    if (JSON.stringify(info.UISupportedInterfaceOrientations) !== JSON.stringify(['UIInterfaceOrientationPortrait'])) out.push('Info.plist: UISupportedInterfaceOrientations must be portrait only');
    if (JSON.stringify(info.UIRequiredDeviceCapabilities) !== JSON.stringify(['arm64'])) out.push('Info.plist: UIRequiredDeviceCapabilities must be arm64 only (an update can relax this list, never tighten it)');
    if (info.CFBundleName !== 'Logbook') out.push(`Info.plist: CFBundleName must be Logbook (got ${info.CFBundleName})`);
    if (info.LogbookAPIHost !== '$(LOGBOOK_API_HOST)') out.push('Info.plist: LogbookAPIHost must be $(LOGBOOK_API_HOST) (the Health engine reads the server from it)');
    if (info.UIUserInterfaceStyle !== 'Light') out.push('Info.plist: UIUserInterfaceStyle must be Light (the app has one light theme; docs/brand.md item 14)');
    if ((info.UIRequiredDeviceCapabilities ?? []).includes('healthkit')) out.push('Info.plist: remove healthkit from UIRequiredDeviceCapabilities (it would hide the app from devices without Health)');
  }

  const ent = plistOf(`${IOS}/App/App.entitlements`);
  if (ent && ent['com.apple.developer.healthkit'] !== true) out.push('App.entitlements: com.apple.developer.healthkit must be true');
  if (ent && JSON.stringify(ent['com.apple.developer.associated-domains']) !== JSON.stringify(['webcredentials:$(LOGBOOK_API_HOST)'])) out.push('App.entitlements: com.apple.developer.associated-domains must be exactly webcredentials:$(LOGBOOK_API_HOST) (Password AutoFill for the server)');

  const privacy = plistOf(`${IOS}/App/PrivacyInfo.xcprivacy`);
  if (privacy) {
    if (privacy.NSPrivacyTracking !== false) out.push('PrivacyInfo.xcprivacy: NSPrivacyTracking must be false');
    if ((privacy.NSPrivacyTrackingDomains ?? []).length) out.push('PrivacyInfo.xcprivacy: NSPrivacyTrackingDomains must be empty');
    const stamp = (privacy.NSPrivacyAccessedAPITypes ?? []).find((a) => a.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryFileTimestamp');
    if (!stamp || !(stamp.NSPrivacyAccessedAPITypeReasons ?? []).includes('C617.1')) out.push('PrivacyInfo.xcprivacy: the file timestamp reason C617.1 is missing');
    const got = Object.fromEntries((privacy.NSPrivacyCollectedDataTypes ?? []).map((d) => [String(d.NSPrivacyCollectedDataType).replace('NSPrivacyCollectedDataType', ''), d]));
    for (const [type, linked] of Object.entries(COLLECTED)) {
      const d = got[type];
      if (!d) out.push(`PrivacyInfo.xcprivacy: ${type} is not declared`);
      else {
        if (d.NSPrivacyCollectedDataTypeLinked !== linked) out.push(`PrivacyInfo.xcprivacy: ${type} must be ${linked ? 'linked' : 'not linked'} to the person`);
        if (d.NSPrivacyCollectedDataTypeTracking !== false) out.push(`PrivacyInfo.xcprivacy: ${type} must not be used for tracking`);
      }
    }
    for (const type of Object.keys(got)) if (!(type in COLLECTED)) out.push(`PrivacyInfo.xcprivacy: ${type} is declared but not on the agreed list. Update the App Privacy answers and this check together.`);
  }

  const pbx = read(`${IOS}/App.xcodeproj/project.pbxproj`);
  const settings = targetSettings(pbx);
  for (const name of ['Debug', 'Release']) {
    const s = settings[name];
    if (!s) {
      out.push(`project.pbxproj: the App target has no ${name} configuration`);
      continue;
    }
    if (s.TARGETED_DEVICE_FAMILY !== '1') out.push(`project.pbxproj (${name}): TARGETED_DEVICE_FAMILY must be 1 (iPhone only), got ${s.TARGETED_DEVICE_FAMILY}`);
    if (s.CODE_SIGN_ENTITLEMENTS !== 'App/App.entitlements') out.push(`project.pbxproj (${name}): CODE_SIGN_ENTITLEMENTS must be App/App.entitlements`);
    if (s.IPHONEOS_DEPLOYMENT_TARGET !== MIN_IOS) out.push(`project.pbxproj (${name}): IPHONEOS_DEPLOYMENT_TARGET must be ${MIN_IOS} (docs/launch/decisions.md D4), got ${s.IPHONEOS_DEPLOYMENT_TARGET}`);
    if (!s.LOGBOOK_API_HOST) out.push(`project.pbxproj (${name}): LOGBOOK_API_HOST is missing (the Password AutoFill host; the release stamp fills it)`);
  }
  if (settings.Release && settings.Release.INFOPLIST_FILE !== 'App/Info.plist') out.push('project.pbxproj (Release): INFOPLIST_FILE must be App/Info.plist');
  const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]*);/g)].map((m) => m[1]);
  if (targets.length !== 4 || targets.some((t) => t !== MIN_IOS)) out.push(`project.pbxproj: every IPHONEOS_DEPLOYMENT_TARGET must be ${MIN_IOS} (found ${targets.join(', ')})`);
  if (!new RegExp(`platforms: \\[\\.iOS\\(\\.v${MIN_IOS.split('.')[0]}\\)\\]`).test(read('packages/capacitor-health/Package.swift'))) out.push(`packages/capacitor-health/Package.swift: the platform must be .iOS(.v${MIN_IOS.split('.')[0]})`);
  const resources = /\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//.exec(pbx)?.[1] ?? '';
  if (!/PrivacyInfo\.xcprivacy in Resources/.test(resources)) out.push('project.pbxproj: PrivacyInfo.xcprivacy is not in the App target\'s resources');

  // the Health plugin: three read types, nothing else, and no source name in an upload
  let swift = '';
  for (const f of fs.readdirSync(path.join(root, HEALTH_SRC))) if (f.endsWith('.swift')) swift += read(`${HEALTH_SRC}/${f}`).replace(/\/\/.*$/gm, '');
  const types = [...new Set([...swift.matchAll(/forIdentifier:\s*\.(\w+)/g)].map((m) => m[1]))].sort();
  const stray = [...new Set([...swift.matchAll(/\b(workoutType|workoutRoute|HKWorkout|HKSeriesType|HKQuantityTypeIdentifier\.\w+|HKQuantityType\(\.\w+\)|characteristicType|HKCorrelationType|HKElectrocardiogramType|HKClinicalType)\b/g)].map((m) => m[1]))];
  for (const s of [...swift.matchAll(/QuantitySpec\(key: "\w+", id: \.(\w+)/g)].map((m) => m[1])) if (!types.includes(s)) types.push(s);
  types.sort();
  if (JSON.stringify(types) !== JSON.stringify(HEALTH_TYPES)) out.push(`Health plugin: reads ${types.join(', ') || 'nothing'}; it must read exactly ${HEALTH_TYPES.join(', ')}`);
  if (stray.length) out.push(`Health plugin: other HealthKit types are named in the code (${stray.join(', ')})`);
  if (/requestAuthorization\(toShare:\s*(?!\s|nil)/.test(swift)) out.push('Health plugin: requestAuthorization asks to write. Logbook only reads.');
  if (/"sourceName"/.test(swift)) out.push('Health plugin: an upload row carries sourceName (usually the person\'s device name)');
  // days are cut on the Gregorian calendar whatever the phone's calendar setting (finding ios-10)
  if (/Calendar\.current/.test(swift)) out.push('Health plugin: Calendar.current is used. Cut days and months with HealthCalendar.gregorian (Buddhist and Japanese calendars give other years).');
  // a disconnect waits for a running sync before it wipes (finding ios-09)
  if (!/func disconnect\(\) async \{\s*await stopRunning\(\)\s*files\.wipe\(\)/.test(swift)) out.push('Health plugin: disconnect() must cancel and wait for a running sync (await stopRunning()) before it wipes.');
  // a state file from an older build still loads (finding ios-16)
  if (/HealthSyncState\.self/.test(swift) && !/decodeIfPresent\(Bool\.self, forKey: \.connected\)/.test(swift)) out.push('Health plugin: HealthSyncState must decode each key with decodeIfPresent and a default.');
  return out;
};

// ---------- the Swift package the plugins are linked through ----------
/** Every Capacitor plugin the web app depends on must be in CapApp-SPM/Package.swift, which `npx cap sync ios` writes. */
export const checkSpm = (root = ROOT) => {
  const out = [];
  const major = MIN_IOS.split('.')[0];
  const web = path.join(root, 'apps/web');
  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8')).dependencies ?? {});
  const swift = fs.readFileSync(path.join(root, IOS, 'CapApp-SPM/Package.swift'), 'utf8');
  for (const dep of deps) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(web, 'node_modules', dep, 'package.json'), 'utf8'));
    } catch {
      out.push(`${dep} is not installed. Run pnpm install.`);
      continue;
    }
    if (!pkg.capacitor?.ios) continue; // not a native plugin
    const folder = dep.startsWith('@logbook/') ? `packages/${dep.split('/')[1]}` : `node_modules/${dep}`;
    if (!swift.includes(`${folder}"`)) out.push(`CapApp-SPM/Package.swift does not list ${dep}. Run npx cap sync ios in apps/web on a Mac and commit the file.`);
  }
  // cap sync copies the platform from the first IPHONEOS_DEPLOYMENT_TARGET in the Xcode project
  if (!swift.includes(`platforms: [.iOS(.v${major})]`)) out.push(`CapApp-SPM/Package.swift is not on iOS ${major}. Run npx cap sync ios in apps/web on a Mac and commit the file.`);
  return out;
};

// ---------- the version stamp ----------
/** Writes the version and build number into every configuration that has them. Returns the new project text. */
/** With `apiOrigin`, also writes its host into LOGBOOK_API_HOST, the Password AutoFill domain in App.entitlements. */
export const stampProject = (pbx, version, build, apiOrigin) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`the version must look like 1.0.0, got ${version}`);
  if (!/^[1-9]\d*$/.test(String(build))) throw new Error(`the build number must be a whole number above 0, got ${build}`);
  let n = 0;
  const next = pbx
    .replace(/MARKETING_VERSION = [^;]*;/g, () => (n++, `MARKETING_VERSION = ${version};`))
    .replace(/CURRENT_PROJECT_VERSION = [^;]*;/g, () => (n++, `CURRENT_PROJECT_VERSION = ${build};`));
  if (n !== 4) throw new Error(`expected MARKETING_VERSION and CURRENT_PROJECT_VERSION in two configurations, found ${n} settings`);
  if (apiOrigin === undefined) return next;
  let host;
  try {
    host = new URL(apiOrigin).hostname;
  } catch {
    throw new Error(`VITE_API_ORIGIN is not an address: ${apiOrigin}`);
  }
  if (!/^[a-z0-9.-]+$/i.test(host) || EXAMPLE_HOST.test(host)) throw new Error(`the server host cannot go into the entitlements: ${host}`);
  let h = 0;
  const out = next.replace(/LOGBOOK_API_HOST = [^;]*;/g, () => (h++, `LOGBOOK_API_HOST = ${host};`));
  if (h !== 2) throw new Error(`expected LOGBOOK_API_HOST in two configurations, found ${h}`);
  return out;
};

// ---------- command line ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const report = (name, problems, okLine) => {
    if (problems.length) {
      for (const p of problems) console.error(`${name}: ${p}`);
      process.exit(1);
    }
    console.log(`${name}: ${okLine}`);
  };
  if (cmd === 'env') {
    let legalEmail;
    try {
      legalEmail = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/launch/legal-fields.json'), 'utf8')).supportEmail ?? '';
    } catch {
      legalEmail = undefined;
    }
    report('release settings', checkEnv(process.env, legalEmail), `server ${process.env.VITE_API_ORIGIN}, support ${process.env.VITE_SUPPORT_EMAIL}, no Strava`);
  } else if (cmd === 'bundle') {
    const strava = args.includes('--strava');
    const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'apps/web/dist');
    report('bundle', checkBundle(dir, { strava }), `${path.relative(process.cwd(), dir) || '.'} holds no developer screen${strava ? ' (Strava allowed: this is not a release build)' : ' and no Strava'}`);
  } else if (cmd === 'capconfig') {
    const file = path.resolve(args[0] ?? path.join(ROOT, IOS, 'App/capacitor.config.json'));
    if (!fs.existsSync(file)) report('capacitor config', [`${file} does not exist. Run npx cap sync ios first.`], '');
    report('capacitor config', checkCapConfig(JSON.parse(fs.readFileSync(file, 'utf8'))), 'no dev server, no cleartext, no debugging switch');
  } else if (cmd === 'ios') {
    report('ios project', checkIosProject(), 'entitlement, privacy manifest, purpose strings, iPhone only, three Health types');
  } else if (cmd === 'spm') {
    report('swift package', checkSpm(), 'every Capacitor plugin is listed');
  } else if (cmd === 'stamp') {
    const file = path.join(ROOT, IOS, 'App.xcodeproj/project.pbxproj');
    try {
      fs.writeFileSync(file, stampProject(fs.readFileSync(file, 'utf8'), args[0] ?? '', args[1] ?? '', process.env.VITE_API_ORIGIN));
    } catch (e) {
      report('version', [e.message], '');
    }
    console.log(`version: ${args[0]} (${args[1]})${process.env.VITE_API_ORIGIN ? `, AutoFill host ${new URL(process.env.VITE_API_ORIGIN).hostname}` : ''} written to the Xcode project`);
  } else {
    console.error('usage: node scripts/release-check.mjs env | bundle <dir> [--strava] | capconfig [file] | ios | spm | stamp <version> <build>');
    process.exit(2);
  }
}
