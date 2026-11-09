# Apple Health in Logbook: the plan

Status: plan, reviewed (25 findings from an independent review folded in), not built. Owner: Josh. Written 2026-11-09.

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
  │  HKAnchoredObjectQuery per type: new + deleted since the read anchor
  │  HKStatisticsCollectionQuery for daily sums (Health merges sources)
  │  raw heart rate per changed day → a zone histogram per 5 minutes, built on the phone
  ▼
HealthSync (Swift actor, owned by the AppDelegate; one run at a time)
  │  each page of results + its new anchor → one batch file, written atomically (the queue is the safety net)
  │  uploads with a background URLSession upload task and a per-device token from the Keychain
  ▼
POST /api/apple-health/sync   (idempotent: batch id, Health UUIDs, user+day+metric; bad rows dropped, not the batch)
  │  rows written → 200 → dirty days scored after the answer, in date order
  ▼
SQLite: health_samples, health_days, sleep_segments, sleep_nights, activities (+ source), health_scores
  ▼
GET /api/apple-health/…  → Today rings, Health Monitor, score pages, sleep, run detail, the coach (with consent)
```

### 3.2 Decisions, with the reason for each

1. A Swift engine inside the app, not an npm HealthKit plugin. The community plugins read samples but do not do
   anchored sync, deletions, statistics merging, background delivery with a disk queue, or upload while the web view is
   not running. Those are what keep Bevel's data correct and fresh. Capacitor supports a plugin class inside the app
   target, registered from `LogbookViewController` (it already subclasses `CAPBridgeViewController`).
2. The engine lives with the AppDelegate. Apple wants observer queries set up in
   `application(_:didFinishLaunchingWithOptions:)`, and a background delivery can wake the app with no scene and no web
   view. So `HealthSync.shared` starts there; `LogbookHealthPlugin` is only its face to the web app.
3. One run at a time. `HealthSync` is a Swift actor. A trigger that arrives during a run (an observer, the app opening,
   Sync now) joins that run; every waiting observer completion handler is called when it ends.
4. The iPhone sums; the server scores. Daily sums come from statistics queries, because Health merges its sources before
   it adds up (iPhone and Watch both count steps; adding raw samples double counts). Scores run on the server, so the
   web app, the coach and every device see one answer.
5. Score functions live in `packages/shared/src/health/`: pure TypeScript, no I/O, unit tested, versioned
   (`SCORE_VERSION`). The phone can run the same code for an instant preview.
6. Its own credential. The native uploader does not borrow the web view's cookie (it only sits in the shared cookie
   store by accident of how CapacitorHttp works, and is written to disk lazily). Connecting mints a per-device sync
   token, kept in the Keychain (readable after first unlock), sent as a bearer token to the sync routes only, revocable
   from Settings. The API origin is built into the app and saved natively, so a background launch has it. Every native
   request sends `X-Local-Date` and the phone's time zone.
7. Two anchors' worth of safety, one anchor. The read anchor moves forward as soon as a page of results and that anchor
   are written to disk together (temp file, then rename). The disk queue is what keeps the data; a 200 from the server
   only deletes the file. Offline for a week means a week of small files, not one ever-growing re-read.
8. The server answers fast. `POST` writes rows and answers 200; scoring runs after the answer. One Fly machine stays
   running (`min_machines_running = 1`), because a background delivery has seconds, not a cold start.
9. Heart rate as zone histograms. Outside workouts the Watch samples every few minutes, so a 5-minute average says
   little about time in a zone. The phone reads the day's raw heart rate (a few hundred samples outside workouts),
   gives each sample the time until the next one (at most 10 minutes), and uploads, per 5-minute bucket, seconds in each
   5 bpm band plus count, min, max and average. The server can then apply any zones, now or later. Buckets inside a
   workout are left out; workouts carry their own 5-second heart rate.
10. Workouts join the existing `activities` table with a `source` column, so the run list, Progress and Training stay
    one list. A run from both Strava and Apple Health is matched and shown once (§3.8).
11. A payload version. If a later phase needs a new upload shape, bumping `payloadVersion` on the phone resets the
    anchors and the import cursor and re-imports cleanly.

### 3.3 What we read

| Data | HealthKit type | How it is read | Uploaded as | Used for |
|---|---|---|---|---|
| Sleep | `sleepAnalysis` (category) | anchored | every segment: start, end, stage, source, device product type | nights, sleep score, need, debt, hypnogram |
| HRV | `heartRateVariabilitySDNN` | anchored | every sample, with source and whether user-entered | recovery, stress, Health Monitor |
| Resting HR | `restingHeartRate` | anchored | every sample (Apple replaces today's and yesterday's) | Health Monitor |
| Respiratory rate | `respiratoryRate` | anchored | every sample (overnight) | recovery input, Health Monitor |
| Blood oxygen | `oxygenSaturation` | anchored | every sample, as % | recovery input, Health Monitor |
| Wrist temperature | `appleSleepingWristTemperature` | anchored | one per night (absolute °C) | recovery input, Health Monitor (as change from normal) |
| VO2 max | `vo2Max` | anchored | every sample | fitness trend |
| Walking HR average | `walkingHeartRateAverage` | anchored | daily | Health Monitor (later) |
| Weight | `bodyMass` | anchored | every sample | weight trend (later) |
| Heart rate | `heartRate` | anchored to find changed days, then raw samples per changed day | per day: 5-minute zone histograms, frozen time zone | strain, sleeping HR, stress, energy, day chart |
| Steps | `stepCount` | anchored to find changed days, then statistics | per day: total + 5-minute sums | auto habit, stress (exclude movement), Progress |
| Active / resting energy | `activeEnergyBurned`, `basalEnergyBurned` | statistics, daily sum | per day | Progress |
| Exercise minutes | `appleExerciseTime` | statistics, daily sum | per day | Progress, auto habit |
| Workouts | `HKWorkout` (+ `workoutRoute`) | anchored; heart rate re-read for workouts of the last 48 hours on every sync | summary, `statistics(for:)` energy and distance, 5-second HR, route (phase 5) | activities, strain, run detail |

Read only. Logbook writes nothing to Apple Health in this plan. Permission is asked for every type above, routes
included, in one sheet; on each launch `getRequestStatusForAuthorization` says whether a type added later needs asking.

### 3.4 The sync engine (Swift)

State on the phone, in Application Support, every file with `completeUntilFirstUserAuthentication` protection and
excluded from backup (it is Health data; Apple forbids it in iCloud):

- the read anchor per anchored type (archived `HKQueryAnchor`), saved with an install ID: a restored backup or a new
  phone has a different ID, so the anchors reset and the import runs again;
- the batch queue: one JSON file per batch (id, payload version, rows), oldest first; a dead-letter folder;
- the import cursor (which month the first import has reached) and the payload version.

"Cannot read the file" (before first unlock after a reboot) is not "the file is missing": the run stops and waits.

One run, whatever started it:

1. Upload the queue first (needs no Health access). On 200, delete the file. On 401, stop all uploads until the next
   sign-in or reconnect. On any other 4xx, move the file to dead-letter (Settings › Health shows it). On a network error
   or 5xx, keep it for the next run.
2. If Health is locked (`errorDatabaseInaccessible`), stop and re-run when protected data becomes available.
3. For each anchored type, query from the read anchor, 2,000 results a page. Each page and its new anchor become one
   batch file (temp, then rename); then the anchor moves. Deleted objects go in as deletions by UUID. The days touched
   (including heart rate and step days, which are only read this way to learn what changed) become dirty.
4. For dirty days, plus today and yesterday: daily sums by statistics query; heart rate histograms from that day's raw
   samples; workouts of the last 48 hours get their heart rate re-read (the Watch often syncs it after the workout).
   Each day's summed rows carry its frozen time zone (§6).
5. Once a day, reconcile the sample types for the last 14 days: queue the list of UUIDs Health still has, through the
   same queue so order holds. If Health returns none while the server has rows (access revoked, history limited), skip
   and flag it instead of deleting.
6. Upload what step 3-5 queued, batches split to at most 1 MB.
7. Tell the web view (if it is running) with a `healthSync` event: started, progress, done, error.

First import: newest month first (1 year by default, up to 2 years in Settings), so Today fills in within seconds and
history arrives behind it. It resumes from the cursor. The server does not score during the import; when the last
month lands it scores every day in date order.

Background: an `HKObserverQuery` for sleep, HRV, heart rate and workouts, set up at launch with background delivery on
(hourly is the realistic pace on iOS). A delivery runs the same engine inside `beginBackgroundTask`, uploads with a
background `URLSession` upload-from-file task (it finishes even if the app is suspended), and a watchdog calls every
observer completion handler well before the time runs out, on every path (three misses and HealthKit stops sending).
Background is best effort; opening the app is the guarantee.

### 3.5 Server: tables and routes

Migration `0017_health.sql`:

| Table | Key | Columns |
|---|---|---|
| `health_devices` | `id` | `user_id, token_hash, name, created_at, last_seen_at, revoked_at` |
| `health_samples` | `user_id, uuid` | `type, start_at, end_at, value, unit, source_bundle, source_name, product_type, user_entered, meta_json, deleted_at, updated_at`; index `user_id, type, start_at` |
| `health_days` | `user_id, date, metric` | `value, buckets_json, day_start_at, tz` (frozen the first time the day is summed), `updated_at` |
| `sleep_segments` | `user_id, uuid` | `start_at, end_at, stage` (in_bed, asleep, awake, core, deep, rem), `source_bundle, source_name, product_type, tz, deleted_at` |
| `sleep_nights` | `user_id, date` (the day you woke) | `start_at, end_at, in_bed_sec, asleep_sec, awake_sec, core_sec, deep_sec, rem_sec, efficiency, sleeping_hr, hrv, rr, spo2, temp, source, naps_json, computed_at` |
| `activities` (existing) | `id` | add `source` (strava, health), `external_id` (Health UUID), `source_bundle`, `energy_kcal`, `hr_json` (5-second), `match_id` |
| `health_scores` | `user_id, date` | `strain, recovery, sleep_score, sleep_need_sec, sleep_debt_sec, stress_json, energy_json, inputs_json, baselines_json, confidence, version, computed_at` |
| `health_sync` | `user_id` | `connected_at, last_sync_at, last_error, types_seen_json, history_from, importing` |

Rules: upserts by UUID never clear `deleted_at` (Health never reuses a UUID, so a late re-send cannot bring a deleted
sample back). Samples more than a day in the future, malformed rows and unknown types are dropped one by one and
counted in the answer; the batch still succeeds. Sync is refused while the account is not connected (no `health_sync`
row) or the device token is revoked.

Routes, under `/api/apple-health/*` (`/api/health` is already Fly's health check):

- `POST /connect` (signed in with the web session): creates `health_sync`, mints a device token, returns it once.
- `POST /sync` (device token): `{ batchId, payloadVersion, samples[], deletions[], days[], sleep[], workouts[] }`, at
  most 2 MB (Hono `bodyLimit` on this route), `Idempotency-Key` = `batchId`. Answers `{ stored, dropped, dirtyFrom }`,
  then scores from the earliest changed day forward to today (at most 60 days), in date order.
- `POST /reconcile` (device token): `{ type, from, to, uuids[] }`.
- `GET /status`, `GET /day/:date`, `GET /metric/:id?from&to` (signed in): status and calibration; the day's rings,
  vitals with normal ranges, last night, workouts, stress and energy; a metric's series, normal band and trends table
  (3/7/14/30/90 days on 7-day rolling averages).
- `DELETE /` (signed in): revokes device tokens, deletes every health row. The phone stops observers and clears its
  queue and token before it calls this, so nothing in flight brings data back.

Export and account deletion include the new tables (`services/exporter.ts`, `DELETE /me`).

### 3.6 The scores (ours, documented, versioned)

Every score returns `{ value, confidence: 'calibrating' | 'low' | 'ok', inputs }`, so a page can say what it used and
what was missing. User-entered samples (`HKWasUserEntered`) show in history but never shape a baseline.

Your normal (every vital): built from one value per day (the night's value, below), today left out: the median of the
last 60 days and a band of median ± 1.5 spreads (1.4826 × median absolute deviation, with a floor per metric).
Calibrating until there are 14 days with a value: "Learning your normal, day 5 of 14", the value shown, no status word.
A new Watch or a big change in the data can be marked in Settings to start the baseline over.

The night's values: sleeping heart rate (the lowest 30-minute average inside the sleep window, from the histograms),
HRV (average of samples inside the sleep window), respiratory rate and SpO2 (averages inside the window), wrist
temperature (the night's sample). Daytime Breathe readings do not count toward the night.

Status words: inside the band "Normal"; outside it "Higher" or "Lower". Orange only when the direction is the worrying
one (sleeping HR higher, HRV lower, SpO2 lower, temperature higher); navy otherwise. Never red for a number.

Sleep (per night):
- Sources are told apart by device (`sourceRevision.productType`: Watch or iPhone) and app, not by bundle ID (Apple's
  own sources share `com.apple.health.*`). One source per night: Apple Watch first, then another wearable writing to
  Health (Oura, Whoop, AutoSleep), then iPhone. Changeable in Settings › Health › Sleep source.
- The night: the longest session ending between 6 PM yesterday and 6 PM today, built from that source; segments less
  than 60 minutes apart join one session; others are naps. For a Watch night (the Watch writes no in-bed samples), time
  in bed is the span of the Watch's own samples, awake included.
- Sleep need = goal (asked during connect) + recent strain (0-45 minutes, by how far yesterday sat above your normal strain)
  + debt repayment (a fifth of the 7-night debt, at most 60 minutes). Shown as a receipt (shot 358).
- Sleep debt = the sum over the last 7 nights of need minus asleep, never below zero per night.
- Sleep score (0-100%): 55% time asleep against need, 15% efficiency, 15% deep + REM share against your normal, 15%
  consistency (spread of bedtime and wake time over 7 nights). No stages: that part drops and the rest re-weights,
  confidence "low".

Recovery (per morning, 0-100%), one formula, stated once:
- z-scores against your normal: `zH` for HRV (on a log scale), `zR` for sleeping heart rate (higher heart rate gives a
  higher `zR`), `zS` for the sleep score (against your normal sleep score).
- `S = 0.5·zH − 0.3·zR + 0.2·zS − P`, where `P` takes points off only when respiratory rate, temperature or SpO2 sit past
  the edge of your band in the worrying direction (0.3 each).
- `Recovery = 100 / (1 + e^−(1.1·S + 0.4))`: an ordinary morning reads about 60%, one spread better about 82%, one spread
  worse about 33%, so the Low (<34%), Normal and High (>67%) bands each show up on real days. The constants live in
  `SCORE_VERSION` and are checked on fixture weeks.
- No HRV last night: built from sleeping heart rate and sleep, confidence "low", and the page says so.

Strain (per day, 0-100%):
- Zones (Karvonen) from your max and resting heart rate. Max: across workouts in the last 180 days, the highest value
  held for at least 30 seconds, taking the 95th percentile of those peaks (one optical spike cannot move it), capped at
  208 − 0.7 × age + 15; until there is a workout, the formula. Resting: your sleeping-HR normal. Editable in Settings.
  Never Strava's zones (Strava data must stay out of anything the coach reads).
- Load = seconds in zone 1-5 weighted 1-5 (Edwards TRIMP), from the histograms outside workouts plus each workout's
  5-second heart rate.
- Strain = 100 × (1 − e^(−load ÷ k)). It rises fast at first and slowly near the top. k is set so a 60-minute easy run
  lands near 45%. Near the top the curve flattens on purpose (a long hard run and a marathon both read "very high");
  the page also shows load in plain units so big days can still be told apart.
- What each workout added is its step along the curve (the day's strain before and after it), so the parts add up to
  the day.
- Cardio load: the 7-day vs 28-day weighted average of daily load, in words: Detraining, Maintaining, Building,
  Overreaching. On the run detail as before/after (shot 329); fed into Training.
- Sick or Injured: the strain ring goes grey and the daily read leans toward rest (Bevel 311).

Stress and Energy (phase 8): 5-minute windows outside workouts and with few steps. Stress rises with heart rate above
your resting normal and falls with HRV above your normal, 0-100. Energy starts the day from recovery, drains with load
and stress minutes, refills in calm windows and sleep. Both calibrate for 14 days.

### 3.7 The plugin's JavaScript face

```ts
// apps/web/src/lib/health.ts (a web mock with the same face, for the browser and for screenshots)
interface LogbookHealth {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ asked: boolean }>; // Apple's sheet; cannot report read denials
  needsAuthorization(): Promise<{ needed: boolean }>; // getRequestStatusForAuthorization, for types added later
  connect(o: { token: string; historyDays: number }): Promise<void>; // token from POST /connect, into the Keychain
  sync(o?: { reason: 'open' | 'manual' }): Promise<{ uploaded: number; pending: number; deadLetter: number; error?: string }>;
  status(): Promise<{ lastSyncAt: string | null; pending: number; deadLetter: number; importedFrom: string | null; earliestAllowed: string | null; locked: boolean }>;
  disconnect(): Promise<void>; // stops observers, clears anchors, queue and token; then the app calls DELETE /api/apple-health
  addListener(e: 'healthSync', fn: (s: { phase: 'start' | 'progress' | 'done' | 'error'; detail?: string }) => void): Promise<{ remove(): void }>;
}
```

### 3.8 Strava and Health, one list

The same run often arrives twice: Apple Watch records it, the Strava app uploads it to Strava, and both reach Logbook.

- Match: same kind, starts within 5 minutes, durations within 10%. The pair is linked (`match_id`), shown once with
  both source chips. If either side is later deleted, the link goes and the other shows alone.
- What shows from where: name, route, laps and Strava's numbers from Strava; heart rate detail, energy and zones from
  Health.
- The coach: Strava data never goes to the model (Strava's terms; already enforced in `ai.ts` and `claude.ts`). A
  workout from Health may, with health consent. A Health workout whose source app is Strava is treated as Strava's and
  kept from the coach. That is stricter than the rules require, on purpose.

---

## 4. Screens and flows (in the shape system)

1. Connect (Settings › Connections › Apple Health, and a card on Today until connected): one sheet that says what it
   unlocks (the three rings, your normal, the coach reading your recovery), what it reads, that nothing is written, and
   that it stays in your Logbook. "Connect Apple Health" (navy pill) opens Apple's permission sheet. Then it asks your
   sleep goal (a time stepper, 7h 30m to start) while the first import runs, and turns into progress ("Reading the last
   year… October").
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
9. Settings › Health: history window (1 to 2 years), sleep source, sleep goal (by hand, or from your best
   recovery nights over 90 days, as Bevel 675-677), heart rate zones, units, start the baseline over (new Watch), dead-letter batches, Disconnect (stops syncing on the phone, deletes
   the server copy, then says how to remove access in the Health app).
10. Auto habits: a habit can be tied to steps, sleep or a workout; it lights itself with the live value and an "auto"
    mark.
11. Notifications (phase 7): morning summary once last night's sleep lands; "Run saved" when a workout arrives.

---

## 5. Privacy, consent and Apple's rules

- Apple's rules (§2.1) allow storing Health data on our own server for the app's own features. They forbid advertising
  and data brokering, storing Health data in iCloud, and sharing it with a third party without clear permission.
  Logbook does none of the first three.
- Claude is a third party. The consent sheet ships in Phase 1, before anything from Health could reach the coach.
  Health data reaches Claude only when `consent.health` is true (the consent model already has
  the field, defaulting to "not asked"). The consent sheet names Anthropic, says which numbers go (scores, last night's
  sleep, vitals vs normal; never raw samples), and is reversible in Settings.
- The phone's queue and anchors are excluded from backup (Health data may not go to iCloud) and protected until first
  unlock. The device token lives in the Keychain and can be revoked.
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
| Travel and time zones | Instants in UTC. Each day is cut in the time zone the phone had when that day was first summed, and that zone is frozen on the day (`health_days.tz`); a later trip never rewrites days spent elsewhere. Sleep and workouts use their own time-zone metadata when Health has it. |
| Daylight saving days | 23 or 25 hours: each day stores its start instant next to its buckets, so a bucket's time is start + index × 5 minutes, true on any day. |
| Night shift, naps, a long wake mid-night | The 6 PM to 6 PM window and the 60-minute join rule; daytime sessions are naps (counted toward debt, not the score). |
| Old watch (no stages) | Asleep without stages: no hypnogram colors, stage part of the score dropped. |
| Huge history | Month-by-month import, 2,000-result pages, resumable; heart rate only as 5-minute buckets. |
| Retries and doubles | Upserts by UUID or user+day+metric, keyed by batch id; a re-sent batch changes nothing, and never undeletes. |
| Token revoked or expired | 401 stops uploads; the queue waits (capped at 30 days or 200 MB, oldest dropped with a note in Settings). |
| Clock wrong or future data | The server drops those rows and keeps the rest of the batch. |
| A batch the server refuses (4xx) | Moved to dead-letter, so it never blocks the queue; Settings shows it with "Send logs". |
| Offline for days | One small batch file per page; the read anchor keeps moving; all of it uploads when the network returns. |
| Two syncs at once (an observer and the app opening) | The actor runs one; the other joins it. |
| Phone rebooted, not yet unlocked | Files cannot be read yet: the run waits instead of treating anchors as missing. |
| Reinstall, restore from backup, new phone | The install ID differs, anchors reset, the import runs again; upserts make it harmless. |
| Workout heart rate arrives after the workout | Workouts from the last 48 hours have their heart rate re-read on every sync. |
| A workout crosses midnight | It belongs to the day it started; its load is split into each day's strain by its timestamps. |
| Samples typed in by hand | Shown, never used for a baseline. |
| New Watch | Its data can shift your normal; "Start the baseline over" in Settings. |
| Access revoked or history limited, then reconcile | Health returns nothing while the server has rows: reconcile skips and flags it instead of deleting. |
| Disconnect while a batch is in flight | The phone stops and clears first; the server refuses sync once disconnected. |
| Matched run deleted on one side | The link goes; the other side shows alone. |
| Heart rate sampled every few minutes | Zone time comes from per-sample time (at most 10 minutes per sample), not 5-minute averages. |
| A one-off optical spike (210 bpm) | Max heart rate needs 30 seconds sustained and takes a 95th percentile; capped by age. |
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
- Engine tests (Swift, XCTest, in the Simulator with fixtures): offline for 5 runs then online uploads each page once;
  a 4xx goes to dead-letter and the next batch still sends; two triggers at once run once; an unreadable anchor file
  does not reset; every path calls the observer completion handler.
- On your phone (per phase): the checklist in §8 under each "Done when", each written as a fixture with an expected
  output or a log line you can read in Settings › Health.

---

## 8. Step by step

Each phase ends with a commit, a deploy where the server changed, and a check on your iPhone.

Phase 0: Ready the app and server (S)
1. Confirm the team in Xcode is your paid membership (HealthKit works on any team; background delivery is only
   documented for paid ones, §2 row 1).
2. Add the HealthKit capability (App target › Signing & Capabilities) with Background Delivery ticked.
3. Add `NSHealthShareUsageDescription` to Info.plist (why Logbook reads Health; it writes nothing).
4. Keep one Fly machine running (`min_machines_running = 1` in fly.toml): background uploads cannot wait for a cold start.
5. Done when: the app installs with the capability, and `fly status` shows one machine running after an hour idle.

Phase 1: The bridge, the proof, the consent (M)
1. `HealthSync` (AppDelegate) and `LogbookHealthPlugin` (registered in `LogbookViewController`); `lib/health.ts` with
   the web mock.
2. Ask for every type in §3.3, routes included; a hidden debug page shows last night's sleep segments, the newest HRV and
   resting HR, raw.
3. The coach consent sheet for health (names Anthropic, says which numbers go), stored in `consent.health`.
4. Done when: Apple's sheet appears once; the debug page's values equal the Health app's for the same samples (same
   timestamps and values); the consent choice survives a reinstall.

Phase 2: The pipeline (L)
1. Shared zod schemas for batches; migration 0017; `/connect`, `/sync`, `/reconcile`, `/status`, `DELETE`.
2. The engine (§3.4): read anchors, atomic batch files, queue, dead-letter, actor, histograms, frozen time zones,
   payload version, install ID, first import month by month.
3. Foreground sync on open and pull to refresh; the sync pill; Settings › Health with status, pending, dead-letter,
   Sync now.
4. Done when (each a test or a log line): the server's step total for 3 chosen days equals the Health app's daily
   total; a sample deleted in the Health app is gone after the next sync; airplane mode for 3 syncs then online sends
   each batch once (server log: no duplicate batch ids); a forced 422 lands in dead-letter while the next batch stores.

Phase 3: Health Monitor (M)
1. Night values, normal ranges and calibration in shared; `GET /day/:date`, `GET /metric/:id`.
2. Vitals tiles live (Progress and Today); metric pages with the band, trends table, explainers.
3. Done when: fixture weeks give the expected bands and status words (tests); on your phone, the 30-day row of the
   trends table matches the same numbers worked out from the export.

Phase 4: Sleep (M)
1. Night builder, source choice by device, Watch time-in-bed rule; `sleep_nights`.
2. Sleep page (hypnogram, stages, need receipt, debt); sleep goal and sleep source in Settings.
3. Done when: fixture nights (normal, nap, split night, two sources, no stages, DST) give the expected sessions; on your
   phone, last week's asleep totals are within 5 minutes of the Health app's.

Phase 5: Workouts (M)
1. Health workouts into `activities` with source, energy, 5-second heart rate, route; the 48-hour heart rate re-read;
   Strava matching.
2. Run detail with zones and heart rate chart; source chips on the run list; coach run notes for Health runs, only with
   consent.
3. Done when: a Watch run that also went to Strava shows once with both chips (test and your phone); its zone seconds
   from the fixture match the expected split; a run note appears only with consent on.

Phase 6: The three rings (L)
1. Max heart rate rule, zones, load, Strain, Recovery, Sleep score in shared with fixture tests; scoring after import
   and from the changed day forward.
2. The rings card on Today, the three score pages, (i) explainers, calibration notices; training status respected.
3. Done when: fixture weeks produce the expected scores (an ordinary morning near 60%, a short night lower, a 60-minute
   easy run near 45% strain); on your phone, the rings show without "calibrating" 14 days after connecting.

Phase 7: Background, notifications, auto habits (M)
1. Observer queries at launch, background delivery, background upload task, watchdog, protected-data flush, daily
   reconcile.
2. Morning summary and run-saved notifications; auto habits for steps, sleep and workouts.
3. Done when: Settings › Health logs at least one background sync on a day you did not open the app; the summary
   arrives on most mornings (best effort, §9); a habit tied to steps lights itself.

Phase 8: Stress and Energy (M)
1. 5-minute models in shared; the Stress and Energy cards and pages.
2. Done when: fixture days give the expected curves (a still evening reads low; a stretch of high heart rate at rest
   reads higher; a workout is left out).

Phase 9: The coach reads your health (S)
1. The context builder (scores, last night, vitals vs normal; no raw samples); the Strava-origin exclusion.
2. The daily read card under the rings.
3. Done when: with consent on, the read cites last night's sleep and recovery; with it off, a route test proves nothing
   from Health reaches Claude.

---

## 9. Decisions for you, and risks

Decided (2026-11-09):
1. One Fly machine stays running for background uploads (`min_machines_running = 1`).
2. The first import reads 1 year of history (newest month first, so Today fills in within seconds).
3. The sleep goal is asked during connect (7h 30m offered as the starting value).
4. Health workouts recorded by the Strava app stay away from the coach.

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
