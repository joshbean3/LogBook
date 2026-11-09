# Apple Health in Logbook: the plan

Status: plan, not built. Owner: Josh. Written 2026-11-09.

Goal: read Apple Health the way Bevel does (sleep with stages, HRV, resting heart rate, respiratory rate, blood oxygen,
wrist temperature, steps, energy, workouts with heart rate) and turn it into the same kind of daily read: Strain,
Recovery and Sleep rings on Today, a Health Monitor of vitals against your own normal, score pages that explain
themselves, and a coach that cites real numbers. Built in Logbook's own design system and voice (docs/inspiration.md §0,
docs/shape-system.md), with Logbook's training plan at the center, not Bevel's.

Order after this: Strava (already connected; it gets merged with Health workouts), then Hevy, then wearables. §10.

---

## 1. What Bevel does with Apple Health (from the 242 screenshots)

Every Bevel score is built from Apple Health. Nothing below needs a Bevel-made device.

| Surface (shots) | What it shows | Apple Health data behind it | Logbook equivalent |
|---|---|---|---|
| Today rings (023, 296-297, 304, 667) | Strain %, Recovery %, Sleep % in one card; "-%" and a grey ring when there is no data | Heart rate all day, HRV, resting HR, sleep stages | Three rings card on Today under the status chips |
| Daily read (297, 304, 667) | One short paragraph citing numbers: "Recovery is 58% after 4h 35m of sleep, sleep bank -5h 47m, so today suits easy work" | All of the above | The assistant's daily read card, only with health consent |
| Health Monitor (300-301, 348) | Tiles: respiratory rate, resting HR, HRV, SpO2, wrist temp, sleep; value + unit, status word (Normal / Higher / Lower) and a slim range pill: your normal band with today's marker | respiratoryRate, restingHeartRate, heartRateVariabilitySDNN, oxygenSaturation, appleSleepingWristTemperature, sleepAnalysis | Vitals tiles in Progress (already built, empty) and on Today |
| Metric detail (648-649, 670) | Chart with the normal band shaded, average line, 1M/3M/6M/1Y, "Trends Analysis" table for 3/7/14/30/90 days on 7-day rolling averages, "Last data point on…" | Each metric's history | Metric page (already built for miles; gains the band and trends table) |
| Explainers (338-339, 367) | Bands with thresholds (Low <34%, Normal 34-67%, High >67%), method in plain words, articles | None (text) | (i) sheet on every score |
| Strain page (325, 346) | Big gauge, duration and activity tiles, contribution of each workout, "Target strain" with a two-week calibration notice | Heart rate per minute, workouts | Strain page |
| Activity detail (328-329, 261) | Activity strain, total vs active time, distance, pace, energy, avg HR, Cardio Load before/after, Cardio Focus (low aerobic / high aerobic / anaerobic split) | HKWorkout, its heart rate samples, energy | Run detail page, now fed by Health too |
| Recovery page (347-348) | "77% Recovered", HRV and resting HR tiles, list of every recovery input vs normal | HRV, resting HR, respiratory rate, SpO2, wrist temp, sleep | Recovery page |
| Sleep page (350-351, 358-359) | "Tracked with [name]'s Apple Watch", hypnogram you can scrub, stage tiles with share of night, time in bed vs asleep, efficiency, sleep needed as a receipt (goal + recent strain + debt), bedtime planner | sleepAnalysis stages, inBed | Sleep page |
| Stress (378, 298-299) | 0-100 tick gauge, last HRV and last HR with "Updated 7:54 AM" | Heart rate and HRV through the day | Stress card and page (later phase) |
| Energy Bank (381) | Battery %, charged vs drained today, a day chart with sleep and workout markers, "still calibrating" | Heart rate, HRV, sleep, activity | Energy card (later phase) |
| Sync (023, 260-261, 315-316, 617) | Top pill "Syncing…" that turns into "Sync Complete"; a sync sheet with last sync, status, how to fix, "Tap to sync" | n/a | Sync pill and a sync status sheet in Settings |
| New data found (315) | One-time sheet when a new metric appears (blood pressure) | Any new type with data | "New in Apple Health" sheet |
| Settings (673-677) | Heart rate zones, calculations, "Data loading window: sync more than one year", sleep goal set by hand or worked out from 90 days of recovery | n/a | Settings › Health |
| Notifications (672) | Daily summary (sleep + recovery in the morning), activity completed (when a workout lands in Apple Health) | Background delivery | Same two, phase 7 |
| Status chip (305-311) | Active / Sick / Injured; while sick the strain ring goes grey | n/a | Logbook already has training status (sick, injured, rest, travel); scores respect it |
| Habits (538-539) | Auto-filled habits: steps, sleep, run minutes, with live value and an "auto" mark | steps, sleep, workouts | Auto habits (docs/inspiration.md §2.2) |
| Calibration (346, 381) | Honest learning period: "allow up to 2 weeks" | n/a | "Learning your normal: day 5 of 14" on every score until it has enough |

What Bevel gets right, and what we copy in spirit: every number has a unit, a status against your own normal, a source
line, a date, and a plain sentence. Empty states keep the layout. Scores admit when they are still learning.

What we do not copy: Bevel's art, names, exact formulas (they are not public), nutrition, CGM, health records,
biological age, cycle tracking. Logbook's scores are our own, documented in §3.6, and versioned.

---

## 2. HealthKit facts this plan stands on

Checked against Apple's documentation on 2026-11-09. See §2.1 for the sources. If a fact here changes, the design
choice next to it changes with it.

| # | Fact | What the plan does about it |
|---|---|---|
| 1 | HealthKit works on every account type, the free Apple ID included. Whether a free team can sign the background-delivery entitlement is not documented. | Phase 0 checks your team. The "PLA update" you accepted means a paid membership, so both should sign. |
| 2 | Background delivery needs the `com.apple.developer.healthkit.background-delivery` entitlement (iOS 15+); without it, turning it on fails. Reading needs `NSHealthShareUsageDescription` in Info.plist (the app crashes on the permission request without it). No background mode is needed. | Phase 0 adds the capability with background delivery and the one sentence. |
| 3 | Background delivery: some types are capped at hourly on iOS (steps among them); Apple lists no iOS types that get "immediate". The update says only that something changed. Observer queries must be set up in `application(_:didFinishLaunchingWithOptions:)`. The completion handler must always be called: after three misses, HealthKit stops sending updates. It does not run in the Simulator. | The sync engine is owned by the AppDelegate, not the web view; every path calls the handler; background is tested on your phone only. Freshness is "within the hour", not instant. |
| 4 | While the phone is locked, reads fail with `errorDatabaseInaccessible`. | A locked run stops cleanly and re-runs when protected data becomes available or the app opens. |
| 5 | An app cannot tell if read access was denied: denied looks like no data. `getRequestStatusForAuthorization` says whether Apple's sheet would still show. New in iOS 27: you may share only part of your history, and `getEarliestAuthorizedSampleDate(for:)` tells us from when. | Empty tiles say "No data from Apple Health" with where to check. Connect asks once. The import starts at the earliest date we are allowed, and Settings says when history is limited. |
| 6 | Anchored queries return new samples and deleted objects since an anchor; anchors can be saved (`NSSecureCoding`). Deleted objects are temporary and may be dropped at any time, with no stated lifetime. | Anchors saved per type. Deletions are not trusted alone: a daily reconcile compares the last 14 days' UUIDs with the server and removes what Health no longer has. |
| 7 | Statistics queries merge all sources before they add up, so iPhone + Watch steps are not doubled. (Apple does not say the merge follows the Health app's source order.) | Sums come from statistics queries only; raw cumulative samples are never added. |
| 8 | Sleep values (iOS 16+): inBed, awake, asleepCore, asleepDeep, asleepREM, asleepUnspecified. Stage samples sit inside inBed but do not overlap each other. Sleep is a category type, so nothing merges sources for us. | Nights are built from one source each (§3.6). |
| 9 | Units: HRV is SDNN in ms; blood oxygen is a fraction 0-1; sleeping wrist temperature is stored as an absolute °C and Health shows it against a baseline; VO2 max in mL/kg/min. Resting HR and walking HR average are replaced for today and yesterday as the Watch refines them; heart rate, steps and energy samples may be merged. | SpO2 × 100; temperature shown as a change from your normal (absolute on the detail page); resting HR settles after the replace (deletions + reconcile). |
| 10 | Workouts: `statistics(for:)` for energy, distance and heart rate (the old `totalEnergyBurned` and `totalDistance` are deprecated); `workoutActivities` for multisport; the route through a route query; heart rate through `predicateForObjects(from: workout)`. | The workout reader uses only the current calls. |
| 11 | Capacitor 8: a plugin class inside the app (`CAPPlugin, CAPBridgedPlugin`), registered in `capacitorDidLoad()` with `bridge?.registerPluginInstance(...)`, reached from JS with `registerPlugin('Name')`; `notifyListeners` sends events. | `LogbookHealthPlugin` is a thin face over the AppDelegate's engine. |
| 12 | App Review 5.1.3: Health data may not be used for advertising or data mining, may not be stored in iCloud, and goes to third parties only with permission. 5.1.2(i): you must disclose sharing with third-party AI and get explicit permission first. HealthKit's terms: a privacy policy is required. Storing on your own server is allowed. | §5: the server is ours, nothing in iCloud, Claude only with the consent sheet that names Anthropic, a privacy page section. |
| 13 | There is no per-app "only since you connected" limit; any start date works, down to the system floor (and the iOS 27 user limit). Apple warns statistics queries over long spans can be slow. | Month-by-month import, newest first, resumable. |
| 14 | Statistics options for heart rate: average, min, max in any interval (per 5 minutes works); sums for cumulative types. | 5-minute heart rate buckets with avg, min, max. |

### 2.1 Sources

developer.apple.com/documentation: healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:),
healthkit/hkobserverquerycompletionhandler, bundleresources/entitlements/com.apple.developer.healthkit.background-delivery,
healthkit/protecting-user-privacy, healthkit/hkerror/code/errordatabaseinaccessible,
healthkit/hkhealthstore/authorizationstatus(for:), healthkit/hkhealthstore/getearliestauthorizedsampledate(for:completion:),
healthkit/hkdeletedobject, healthkit/hkqueryanchor, healthkit/hkstatistics, healthkit/hkcategoryvaluesleepanalysis,
healthkit/hkworkout, healthkit/reading-route-data, healthkit/hkstatisticscollectionquery,
help/account/reference/supported-capabilities-ios. App Review Guidelines (5.1.2, 5.1.3):
developer.apple.com/app-store/review/guidelines. Capacitor: capacitorjs.com/docs/ios/custom-code.

---

## 3. Architecture

### 3.1 The shape of it

```
Apple Health (on the iPhone)
  │  HKAnchoredObjectQuery per type (new + deleted since last anchor)
  │  HKStatisticsCollectionQuery for sums and per-5-minute heart rate (de-duplicated by Health)
  ▼
LogbookHealth (Swift, inside the app target)
  │  builds upload batches → writes them to a queue on disk → uploads with the session cookie
  │  advances each anchor only after the server says it stored the batch
  ▼
POST /api/health/sync  (idempotent: Health's UUIDs, or user+day+metric)
  ▼
SQLite on the server: health_samples, health_days, sleep_segments, activities (+ source), health_scores
  │  dirty days recomputed with the score functions in packages/shared/src/health/
  ▼
GET /api/health/…  → Today rings, Health Monitor, score pages, sleep, run detail, assistant context
```

### 3.2 Decisions, with the reason for each

1. A Swift plugin inside the app, not an npm HealthKit plugin. The community plugins read samples but do not do
   anchored sync, deletions, statistics de-duplication, background delivery with a disk queue, or upload while the web
   view is not running. Those five are what make Bevel's data correct and always fresh. Capacitor supports a plugin
   class inside the app target, registered from `LogbookViewController` (it already subclasses `CAPBridgeViewController`).
2. The iPhone sums; the server scores. Steps, energy and heart rate are summed on the phone with statistics queries,
   because Health merges its sources before it adds up (iPhone and Watch both count steps; adding raw samples double
   counts). Scores run on the server from what was uploaded, so the web app, the assistant and every device see one
   answer.
3. Score functions live in `packages/shared/src/health/`: pure TypeScript, no I/O, unit tested, versioned
   (`SCORE_VERSION`). The server uses them; the phone can run the same code for an instant preview before the upload
   lands.
4. Native code uploads, not the web view. Background deliveries can wake the app without its web view, and Apple wants
   the observers set up at launch, so the engine (`HealthSync.shared`) lives with the AppDelegate and starts in
   `application(_:didFinishLaunchingWithOptions:)`; the plugin is only its face to the web app. The plugin posts
   to `${apiOrigin}/api/health/sync` with `URLSession`; the session cookie is already in the shared cookie store because
   `CapacitorCookies` is on. The web app tells the plugin the API origin at sign-in.
5. At-least-once, idempotent. Every batch carries Health's UUIDs (or user + day + metric for sums). The server upserts.
   The phone advances an anchor only after a 200. A lost response means one re-send, never a gap or a double.
6. Heart rate goes up as 5-minute buckets, not raw samples. A year of Watch heart rate is hundreds of thousands of
   samples. Five-minute average, minimum and maximum (288 buckets a day, a few KB) are enough for strain, stress and
   the day chart. Workouts keep finer heart rate (5-second buckets) for zones and the activity chart.
7. Workouts join the existing `activities` table with a `source` column, so the run list, Progress and Training stay
   one list. A run that came from both Strava and Apple Health is matched and shown once (§3.8).

### 3.3 What we read

| Data | HealthKit type | How it is read | Uploaded as | Used for |
|---|---|---|---|---|
| Sleep | `sleepAnalysis` (category) | anchored | every segment: start, end, stage, source | nights, sleep score, need, debt, hypnogram |
| HRV | `heartRateVariabilitySDNN` | anchored | every sample (a few a day) | recovery, stress, Health Monitor |
| Resting HR | `restingHeartRate` | anchored | every sample (one a day) | recovery, Health Monitor, zones |
| Respiratory rate | `respiratoryRate` | anchored | every sample (overnight) | recovery input, Health Monitor |
| Blood oxygen | `oxygenSaturation` | anchored | every sample, as % | recovery input, Health Monitor |
| Wrist temperature | `appleSleepingWristTemperature` | anchored | one per night | recovery input, Health Monitor |
| VO2 max | `vo2Max` | anchored | every sample | fitness trend, zones |
| Walking HR average | `walkingHeartRateAverage` | anchored | daily | Health Monitor (later) |
| Weight | `bodyMass` | anchored | every sample | weight trend (later) |
| Heart rate | `heartRate` | statistics, 5-minute buckets, avg/min/max | per day: buckets | strain, stress, energy, day chart |
| Steps | `stepCount` | statistics, daily sum + 5-minute buckets | per day: total + buckets | auto habit, stress (exclude movement), Progress |
| Active energy | `activeEnergyBurned` | statistics, daily sum | per day | strain context, Progress |
| Resting energy | `basalEnergyBurned` | statistics, daily sum | per day | total energy |
| Exercise minutes | `appleExerciseTime` | statistics, daily sum | per day | Progress, auto habit |
| Workouts | `HKWorkout` | anchored | summary + stats + 5-second HR + route (phase 6) | activities, activity strain, run detail |

Read only. Logbook writes nothing to Apple Health in this plan (writing runs logged by hand is a later option).

### 3.4 The sync engine (Swift)

State kept on the phone, in the app's Application Support folder (not UserDefaults: anchors are data):

- one `HKQueryAnchor` per anchored type, archived with `NSKeyedArchiver`;
- a set of dirty days for the summed types;
- a queue of upload batches as JSON files, oldest first;
- the import cursor for the first import (which month it has reached).

One sync run, whatever started it (opening the app, pull to refresh, Sync now, a background delivery):

1. Stop if Health data is unavailable (device locked: §2). Try again when protected data becomes available.
2. For each anchored type, run an anchored query from its saved anchor, capped at 2,000 results per call (loop until
   done). Added samples go into a batch; deleted objects go in as deletions by UUID. Mark the days they touch dirty.
3. For dirty days (and always today and yesterday), run statistics collection queries: daily sums for steps, energy,
   exercise; 5-minute buckets for heart rate and steps. Each day is one upsert.
4. Write the batch to the queue file, holding the new anchors alongside it (not saved yet).
5. Once a day, reconcile: for the sample types, send the server the UUIDs Health still has for the last 14 days; the
   server soft-deletes the rest (Health's deletion records can expire before we read them, §2 row 6).
6. Upload queued batches in order. On 200: save that batch's anchors, delete the file. On 401: stop and wait for the next
   sign-in. On a network error: leave the file; the next run sends it.
7. Tell the web view (if it is running) with a `healthSync` event: started, progress, done, error.

The first import runs month by month, newest first (the last 90 days by default, up to 2 years from Settings), so Today
fills in within seconds and history arrives behind it. It resumes from the cursor if the app closes.

Background: an `HKObserverQuery` for sleep, HRV, resting HR and workouts, set up in
`application(_:didFinishLaunchingWithOptions:)` on every launch, with background delivery turned on (hourly is the
realistic pace on iOS). A delivery runs the same sync with a short budget (the newest data only, then return) and calls
the observer's completion handler on every path, errors included: three misses and HealthKit stops sending updates.
Background is best effort; opening the app is the guarantee.

### 3.5 Server: tables and routes

Migration `0017_health.sql`:

| Table | Key | Columns |
|---|---|---|
| `health_samples` | `user_id, uuid` | `type, start_at, end_at, value, unit, source_bundle, source_name, device, tz, meta_json, deleted_at, updated_at`; index `user_id, type, start_at` |
| `health_days` | `user_id, date, metric` | `value, buckets_json` (5-minute array or null), `updated_at` |
| `sleep_segments` | `user_id, uuid` | `start_at, end_at, stage` (in_bed, asleep, awake, core, deep, rem), `source_bundle, source_name, device, deleted_at` |
| `sleep_nights` | `user_id, date` (the day you woke) | `start_at, end_at, in_bed_sec, asleep_sec, awake_sec, core_sec, deep_sec, rem_sec, efficiency, latency_sec, source_bundle, naps_json, computed_at` |
| `activities` (existing) | `id` | add `source` (strava, health), `external_id` (Health UUID), `source_bundle`, `energy_kcal`, `hr_json` (5-second buckets), `match_id` (the other source's row for the same workout) |
| `health_scores` | `user_id, date` | `strain, recovery, sleep_score, sleep_need_sec, sleep_debt_sec, stress_json, energy_json, inputs_json` (what each score used), `baselines_json, confidence, version, computed_at` |
| `health_sync` | `user_id` | `connected_at, last_sync_at, last_error, types_seen_json, history_from, device` |

Routes (all signed in, all scoped to the owner):

- `POST /api/health/sync`: body `{ device, batch: { samples[], deletions[], days[], sleep[], workouts[] } }`, at most 2 MB.
  Validated with zod in `packages/shared`. Upserts in one transaction, marks dirty dates, recomputes scores for them
  (and the next day, since sleep and baselines carry over), returns `{ stored, dirtyDates, scores }`.
- `GET /api/health/status`: connected, last sync, types with data, calibration progress.
- `GET /api/health/day/:date`: rings, vitals with normal ranges, last night, workouts, stress/energy series.
- `GET /api/health/metric/:id?from&to`: series, normal band, trends table (3/7/14/30/90 days, 7-day rolling averages).
- `POST /api/health/reconcile`: `{ type, from, to, uuids[] }`; soft-deletes rows in that window Health no longer has.
- `DELETE /api/health`: disconnect, delete every health row for the account.

Export and account deletion include the new tables (`services/exporter.ts`, `DELETE /me`).

### 3.6 The scores (ours, documented, versioned)

Every score returns `{ value, confidence: 'calibrating' | 'low' | 'ok', inputs }`, so a page can say what it used and
what was missing.

Your normal (every vital): the median of the last 60 days (at least 14 values) and a band of median ± 1 spread
(1.4826 × median absolute deviation, floored per metric so a very steady person still has a band). Under 14 values:
"Learning your normal, day 5 of 14", with the value shown and no status word.

Status words: inside the band "Normal"; above "Higher"; below "Lower". Orange only when the direction is the worrying
one (resting HR higher, HRV lower, SpO2 lower, temperature higher); otherwise navy. Never red for a number.

Sleep (per night):
- The night: the longest sleep session that ends between 6 PM yesterday and 6 PM today, built from one source. Segments
  less than 60 minutes apart join one session. Other sessions that day are naps.
- One source per night: Apple Watch first, then any other wearable writing to Health (Oura, Whoop, AutoSleep), then
  iPhone. Changeable in Settings › Health › Sleep source.
- Sleep need = goal (7h 30m until set) + recent strain (0 to 45 minutes, by how far yesterday's strain sat above your
  normal) + debt repayment (a fifth of the last 7 nights' debt, at most 60 minutes). Shown as a receipt, like shot 358.
- Sleep debt = the sum over the last 7 nights of need minus asleep, never below zero per night.
- Sleep score (0-100%): 55% time asleep against need, 15% efficiency (asleep ÷ in bed), 15% deep + REM share against
  your normal, 15% consistency (spread of bedtime and wake time over 7 nights). Without stages (old watch, iPhone only):
  the stage part is left out and the rest re-weighted, confidence "low".

Recovery (per morning, 0-100%):
- Inputs: last night's HRV (samples inside the sleep window; else the morning's first), resting HR, respiratory rate,
  wrist temperature, SpO2, and the sleep score.
- Each vital becomes a z-score against your normal (HRV on a log scale, since it is skewed). Resting HR counts inverted.
  Respiratory rate, temperature and SpO2 only take points away, and only past the edge of your band.
- Recovery = logistic(0.45 z_hrv − 0.25 z_rhr + 0.20 z_sleep − penalties) mapped to 0-100%.
- No HRV last night: built from resting HR and sleep, confidence "low", and the page says so.

Strain (per day, 0-100%):
- Heart rate zones from your max and resting heart rate (Karvonen): max from the highest workout HR in 90 days, else
  208 − 0.7 × age; resting from your normal. Strava's zones are used if you set them there. Editable in Settings.
- Load = minutes in zone 1-5 weighted 1-5 (Edwards TRIMP), from the 5-minute buckets all day, plus workouts at 5-second
  detail.
- Strain = 100 × (1 − e^(−load ÷ k)): it rises fast at first and slowly near the top, like Bevel's "rises
  logarithmically". k is set so a 60-minute easy run lands near 45%.
- Each workout's strain is its own load on the same curve; the Strain page lists what each one added.
- Cardio load: 7-day vs 28-day weighted average of daily load (the acute to chronic ratio), with plain words: Detraining,
  Maintaining, Building, Overreaching. Shown on the run detail as before/after (shot 329) and fed into Training.
- While your training status is Sick or Injured, the strain ring goes grey and the daily read leans toward rest
  (Bevel 311 does the same).

Stress and Energy (phase 8): 5-minute windows outside workouts and with few steps. Stress rises with heart rate above
your resting normal and falls with HRV above your normal, 0-100. Energy starts each day from recovery, drains with load
and stress minutes, refills in calm windows and sleep. Both show "calibrating" for 14 days.

### 3.7 The plugin's JavaScript face

```ts
// apps/web/src/lib/health.ts (a web mock with the same face, for the browser and for screenshots)
interface LogbookHealth {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ asked: boolean }>; // shows Apple's sheet once; cannot report read denials
  configure(o: { apiOrigin: string; historyDays: number }): Promise<void>;
  sync(o?: { reason: 'open' | 'manual' | 'import' }): Promise<{ uploaded: number; pending: number; error?: string }>;
  status(): Promise<{ lastSyncAt: string | null; pending: number; importedFrom: string | null; protectedDataAvailable: boolean }>;
  disconnect(): Promise<void>; // stops observers, clears anchors and queue (the server delete is a separate call)
  addListener(e: 'healthSync', fn: (s: { phase: 'start' | 'progress' | 'done' | 'error'; detail?: string }) => void): Promise<{ remove(): void }>;
}
```

### 3.8 Strava and Health, one list

The same run often arrives twice: Apple Watch records it, the Strava app uploads it to Strava, and both reach Logbook.

- Match: same kind, starts within 5 minutes, durations within 10%. The pair is linked (`match_id`), shown once with
  both source chips.
- What shows from where: name, route, laps and Strava's numbers from Strava; heart rate detail, energy and the HR
  zones from Health.
- Claude: Strava data never goes to the model (Strava's terms; already enforced in `ai.ts` and `claude.ts`). A workout
  from Health may, with health consent. A Health workout whose source app is Strava (`com.strava…` writes to Health
  too) is treated as Strava's and kept from Claude. That is stricter than the rules require, on purpose.

---

## 4. Screens and flows (in the shape system)

1. Connect (Settings › Connections › Apple Health, and a card on Today until connected): one sheet that says what it
   unlocks (the three rings, your normal, the coach reading your recovery), what it reads, that nothing is written, and
   that it stays in your Logbook. "Connect Apple Health" (navy pill) opens Apple's permission sheet. Then the first
   import starts and the sheet turns into progress ("Reading the last 90 days… October").
2. Today: a rings card (Strain, Recovery, Sleep) under the status chips; "–%" and grey rings until there is data; a line
   under it while calibrating. The assistant's daily read under the rings (consent permitting). A Health Monitor row of
   tiles further down.
3. Score pages (pushed): a hero gauge, two stat tiles, the read, "What went into it" (each input vs normal), the
   timeline of what moved it, (i) explainer sheet with bands, method and the trends table.
4. Sleep page: source line ("From Josh's Apple Watch"), the hypnogram (scrub to read a stage and time), stage tiles with
   share of the night and your typical range, time in bed vs asleep, efficiency, sleep need receipt, 7-night debt.
5. Health Monitor and metric pages: the existing Vitals tiles and metric pages, now with the band, status word, last
   data point date, 1M/3M/6M/1Y, and the trends table.
6. Run detail: activity strain, zones bar (low aerobic / high aerobic / anaerobic), heart rate chart, cardio load
   before/after, source chips.
7. Sync: the top pill ("Syncing…" → "Synced") on foreground syncs that bring something new; Settings › Health shows
   last sync, what was found, pending uploads, Sync now, and the fix list when something is wrong.
8. New data found: a one-time sheet when a type shows data for the first time ("Blood oxygen is now in your Health
   Monitor").
9. Settings › Health: history window (90 days to 2 years), sleep source, sleep goal (by hand, or from your best
   recovery nights over 90 days, as Bevel 675-677), heart rate zones, units, Disconnect (deletes the server copy, then
   says how to remove access in the Health app).
10. Auto habits: a habit can be tied to steps, sleep or a workout; it lights itself with the live value and an "auto"
    mark.
11. Notifications (phase 7): morning summary once last night's sleep lands; "Run saved" when a workout arrives.

---

## 5. Privacy, consent and Apple's rules

- Apple's rules (§2.1) allow storing Health data on our own server for the app's own features. They forbid advertising
  and data brokering, storing Health data in iCloud, and sharing it with a third party without clear permission.
  Logbook does none of the first three.
- Claude is a third party. Health data reaches Claude only when `consent.health` is true (the consent model already has
  the field, defaulting to "not asked"). The consent sheet names Anthropic, says which numbers go (scores, last night's
  sleep, vitals vs normal; never raw samples), and is reversible in Settings.
- No health values in logs or error reports. Payloads are size-capped and validated. Disconnect deletes every row.
  Export includes everything. The privacy page gains a Health section.

---

## 6. Edge cases, and what happens

| Case | What happens |
|---|---|
| Read access denied | Health reports no data, not "denied" (§2). Each empty tile says "No data from Apple Health" with the path to check: Settings › Health › Data Access & Devices › Logbook. |
| No Apple Watch | Steps, energy and iPhone sleep (bedtime schedule) only. Recovery and strain need heart rate: their rings say "Needs a heart rate source" instead of a number. Sleep scores with confidence "low". |
| Two sources for one night (Watch + Oura, Watch + AutoSleep) | One source per night (§3.6); the Sleep page names it; Settings lets you pick. Never added together. |
| Steps from iPhone and Watch | Statistics queries de-duplicate by Health's own source order. We never add raw step samples. |
| Watch syncs late | The night lands hours after waking. The day's scores recompute; the page shows "Updated 9:12 AM". A morning summary waits for the sleep to arrive. |
| Edits and deletions in the Health app | Anchored queries report deletions by UUID; the row goes, the day recomputes. Deletion records can expire, so the daily reconcile catches any we missed. |
| Resting HR changes after the fact | The Watch replaces today's and yesterday's resting HR as it learns. The replace arrives as a delete + add; recovery recomputes. |
| You share only part of your history (iOS 27) | The import starts at the earliest date Health allows; Settings says "Apple Health shares from March 2026"; calibration counts from there. |
| A background delivery handler is missed | Three misses end background updates, so every code path calls it, and a test runs each path. A launch re-registers. |
| Device locked during a background delivery | Health data is unreadable while locked. The run stops cleanly, calls the completion handler, and re-runs when protected data becomes available or the app opens. |
| App force-quit, Low Power Mode, no network | Background delivery may not come. The queue holds what was read. Opening the app always syncs. |
| Travel and time zones | Instants stored in UTC with the sample's time zone. Days are cut in the phone's time zone at sync; when the zone changes, the last 3 days are re-summed. |
| Daylight saving days | 23 or 25 hours: buckets are keyed by timestamp, not by minute-of-day index. |
| Night shift, naps, a long wake mid-night | The 6 PM to 6 PM window and the 60-minute join rule; daytime sessions are naps (counted toward debt, not the score). |
| Old watch (no stages) | Asleep without stages: no hypnogram colors, stage part of the score dropped. |
| Huge history | Month-by-month import, 2,000-result pages, resumable; heart rate only as 5-minute buckets. |
| Retries and doubles | Upserts by UUID or user+day+metric; a re-sent batch changes nothing. |
| Session expired in the background | 401 stops uploads; the queue waits for the next sign-in. |
| Clock wrong or future data | The server refuses samples more than a day in the future. |
| A metric appears months later | First data for a type triggers the "new data found" sheet once. |
| Web or iPad | The web app reads from the server (no connect button outside the iPhone app). |
| Sick or injured | Strain ring grey; recovery still shown; the read suggests rest. |
| Units | Stored metric; shown in the account's units (mi/km, °F/°C, lb/kg). |

---

## 7. Testing and how we know it works

- Score functions: unit tests with fixture days in `packages/shared/src/health/*.test.ts`: normal nights, naps, split
  nights, two sources, no stages, DST nights, travel, missing HRV, calibration boundaries (13 vs 14 values).
- Server: route tests for idempotent sync (same batch twice), deletions, dirty-date recompute, consent gating of the
  assistant context, delete and export.
- Background delivery does not run in the Simulator, so Phase 7 is tested on your phone only.
- Native: a DEBUG-only fixture mode (`HealthFixtures.json` in the app bundle) that feeds the sync engine fake samples, so
  the whole pipeline runs in the Simulator. The Simulator's Health app also takes hand-entered data.
- Web: a mock plugin with the same face, so every screen is built and screenshotted in Chromium (as with the Claude
  stand-in), at 390 and 320 wide.
- On your phone (the real test, per phase): the checklist in §8 under each "Done when".

---

## 8. Step by step

Each phase ends with a commit, a deploy where the server changed, and a check on your iPhone.

Phase 0: Ready the app (S)
1. Confirm the team in Xcode is your paid membership (HealthKit works on any team; background delivery is only
   documented for paid ones, §2 row 1).
2. Add the HealthKit capability in Xcode (App target › Signing & Capabilities), with Background Delivery ticked.
3. Add `NSHealthShareUsageDescription` to Info.plist: why Logbook reads Health. (No write sentence: it writes nothing.)
4. Done when: the app builds and installs with the capability on.

Phase 1: The bridge and a proof (M)
1. `LogbookHealthPlugin.swift` in the app target: isAvailable, requestAuthorization, a raw read of last night's sleep,
   latest HRV and resting HR.
2. Register it in `LogbookViewController.capacitorDidLoad()`; `lib/health.ts` with the web mock.
3. A hidden debug page that shows the raw numbers.
4. Done when: on your iPhone, Apple's sheet appears once, and the debug page shows last night's sleep and this
   morning's HRV matching the Health app.

Phase 2: The pipeline (L)
1. Shared zod schemas for the batch; migration 0017; `POST /health/sync`, `GET /health/status`, `DELETE /health`.
2. The sync engine (anchors, dirty days, statistics buckets, queue, ack-before-advance), first import month by month.
3. Foreground sync on open and pull to refresh; the sync pill; Settings › Health with status and Sync now.
4. Done when: a fresh connect imports 90 days; deleting a sample in the Health app removes it after the next sync;
   airplane mode then online uploads the queue once; the server row counts match the Health app's totals for 3 sample
   days.

Phase 3: Health Monitor (M)
1. Normal ranges and calibration in shared; `GET /health/day/:date` and `/health/metric/:id`.
2. Vitals tiles live (Progress and Today); metric pages with the band, trends table, explainers.
3. Done when: resting HR, HRV, respiratory rate, SpO2 and wrist temperature show with your normal and status, and the
   30-day trend row matches a hand calculation.

Phase 4: Sleep (M)
1. Night builder and source choice in shared; `sleep_nights`.
2. Sleep page (hypnogram, stages, need receipt, debt); sleep goal in Settings.
3. Done when: last week's nights match the Health app's sleep view to the minute, a nap is shown as a nap, and a night
   with both Watch and another app shows one source.

Phase 5: The three rings (L)
1. Strain, Recovery, Sleep score in shared, with tests; `health_scores` recompute on dirty days.
2. The rings card on Today, the three score pages, (i) explainers, calibration notices; training status respected.
3. Done when: 14 days after connecting, all three rings show without "calibrating", a hard run moves strain the way you
   would expect, and a short night lowers recovery.

Phase 6: Workouts (M)
1. Health workouts into `activities` with source, energy, 5-second heart rate; Strava matching.
2. Run detail with zones, activity strain, cardio load; source chips on the run list; coach run notes come back for
   Health runs (consent).
3. Done when: a Watch run that also went to Strava shows once with both chips, and its zones bar matches the Workout
   app's zones.

Phase 7: Background, notifications, auto habits (M)
1. Observer queries set up at launch with background delivery; the completion handler on every path; flush when
   protected data becomes available; the daily reconcile.
2. Morning summary and run-saved notifications; auto habits for steps, sleep and workouts.
3. Done when: you wake, do not open the app, and get the morning summary after the Watch syncs; a run logs itself.

Phase 8: Stress and Energy (M)
1. 5-minute models in shared; the Stress and Energy cards and pages.
2. Done when: a calm evening reads low stress and a stressful meeting with a high heart rate reads higher.

Phase 9: The coach reads your health (S)
1. The consent sheet naming Anthropic; the context builder (scores, last night, vitals vs normal); Strava-origin
   exclusion.
2. The daily read card under the rings.
3. Done when: with consent on, the read cites last night's sleep and recovery; with it off, nothing from Health reaches
   Claude (route test proves it).

---

## 9. Decisions for you, and risks

Decide before Phase 2:
1. History window to start with: 90 days (fast first import) or 1 year (trends from day one, a slower first import).
2. Sleep goal: 7h 30m until set, or ask during connect.
3. Health workouts recorded by the Strava app: keep them from Claude (the plan's default) or treat them like any other
   Health workout.

Risks:
- Background delivery is best effort (iOS decides). Mitigation: opening the app always syncs; the summary notification
  is a nice-to-have, not a promise.
- Our scores are not Bevel's and will not match Bevel's numbers. They will be consistent, explained and tuned on your
  data over the first two weeks.
- Watch data quality varies (loose strap, no HRV some nights). Every score carries confidence and says what was missing.

---

## 10. After Apple Health

1. Strava (connected today): Phase 6 merges it with Health workouts. Next steps there: webhooks for instant runs (already
   wired for deliveries), segment efforts later.
2. Hevy (lifting): Hevy writes workouts to Apple Health already, so lifts appear once Phase 6 lands (as strength
   workouts with duration, energy and heart rate). For sets, reps and weights, Hevy's API (Hevy Pro, an API key the
   owner pastes in) fills `lift_sets`, matched to the Health workout by time.
3. Wearables: Oura, Whoop, Garmin and COROS mostly write sleep, heart rate and workouts into Apple Health. Apple Health
   becomes the hub: once this plan ships, their data arrives through it with no extra work, and the sleep source setting
   picks between them. Direct APIs come only for what they keep out of Health (Oura readiness, Whoop recovery, Garmin
   Body Battery), each its own small plan.
