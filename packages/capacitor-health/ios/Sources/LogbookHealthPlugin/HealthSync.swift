import Foundation
import HealthKit

/// The outcome of one sync run, as the web app sees it.
struct HealthSyncResult {
    var uploaded = 0
    var pending = 0
    var deadLetter = 0
    var importing = false
    var error: String?

    var dict: [String: Any] {
        var d: [String: Any] = ["uploaded": uploaded, "pending": pending, "deadLetter": deadLetter, "importing": importing]
        if let error = error { d["error"] = error }
        return d
    }
}

/// The Apple Health sync engine (docs/health/apple-health.md §3.4).
///
/// One run at a time (a trigger that arrives during a run joins it). A run: upload what is queued; read each anchored type
/// from its read anchor, a page at a time, each page written to disk with its new anchor before the anchor moves; find the
/// days whose heart rate or steps changed and sum them again; import the next month of history; once a day, reconcile the
/// last 14 days; upload again. Uploads carry the device token, never the web session, so this works with no web view.
actor HealthSync {
    static let shared = HealthSync()
    static let payloadVersion = 1
    private static let pageSize = 2000
    /// Uploads are split well under the server's 2 MB cap.
    private static let maxBatchBytes = 900_000

    private let store = HKHealthStore()
    private let files = HealthStorage.shared
    private var running: Task<HealthSyncResult, Never>?
    private var listener: (([String: Any]) -> Void)?

    func setListener(_ fn: (([String: Any]) -> Void)?) {
        listener = fn
    }

    private func emit(_ phase: String, _ detail: String? = nil) {
        var d: [String: Any] = ["phase": phase]
        if let detail = detail { d["detail"] = detail }
        let fn = listener
        DispatchQueue.main.async { fn?(d) }
    }

    // ---------- connecting and disconnecting ----------
    func connect(token: String, apiOrigin: String, historyDays: Int) throws {
        HealthKeychain.save(token)
        files.wipe()
        var s = HealthSyncState()
        s.connected = true
        s.apiOrigin = apiOrigin
        s.payloadVersion = Self.payloadVersion
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        s.historyFrom = cal.date(byAdding: .day, value: -historyDays, to: today)
        s.importCursor = cal.date(from: cal.dateComponents([.year, .month], from: today))
        try files.saveState(s)
    }

    func disconnect() {
        running?.cancel()
        files.wipe()
        HealthKeychain.delete()
    }

    func status() -> [String: Any] {
        let s = (try? files.loadState()) ?? HealthSyncState()
        var d: [String: Any] = [
            "connected": s.connected && HealthKeychain.read() != nil,
            "pending": files.pending().count,
            "deadLetter": files.deadCount(),
            "importing": s.importCursor != nil,
        ]
        if let at = s.lastSyncAt { d["lastSyncAt"] = Self.iso(at) }
        if let e = s.lastError { d["lastError"] = e }
        if let c = s.importCursor { d["importingFrom"] = Self.iso(c) }
        if let h = s.historyFrom { d["historyFrom"] = Self.iso(h) }
        return d
    }

    // ---------- one run at a time ----------
    func sync(reason: String) async -> HealthSyncResult {
        if let current = running { return await current.value }
        let task = Task { await self.run(reason: reason) }
        running = task
        let result = await task.value
        running = nil
        return result
    }

    private func run(reason: String) async -> HealthSyncResult {
        var result = HealthSyncResult()
        var state: HealthSyncState
        do {
            state = try files.loadState()
        } catch {
            result.error = "locked"
            return result
        }
        guard state.connected, let token = HealthKeychain.read(), let origin = state.apiOrigin else {
            result.error = "not_connected"
            return result
        }
        emit("start", reason)

        // a new upload shape: start the import over (plan §3.2, decision 11)
        if state.payloadVersion != Self.payloadVersion {
            let cal = Calendar.current
            state.anchors = [:]
            state.dirtyDays = []
            state.importCursor = cal.date(from: cal.dateComponents([.year, .month], from: Date()))
            state.payloadVersion = Self.payloadVersion
            try? files.saveState(state)
        }

        // 1. what is already queued needs no Health access
        let first = await upload(token: token, origin: origin)
        result.uploaded += first.sent
        if first.stop == .unauthorized {
            result.error = "unauthorized"
            return finish(&state, result)
        }

        // 2-5. read Health: anchored types, changed days, the next months of history, the daily reconcile
        do {
            try await readAnchored(&state)
            try await sumDirtyDays(&state)
            try await recentWorkouts(&state)
            try await importHistory(&state, result: &result)
            try await reconcileIfDue(&state)
        } catch let e as HKError where e.code == .errorDatabaseInaccessible {
            result.error = "locked"
        } catch is CancellationError {
            result.error = "cancelled"
        } catch {
            result.error = error.localizedDescription
        }

        // 6. upload what this run queued
        let second = await upload(token: token, origin: origin)
        result.uploaded += second.sent
        if second.stop == .unauthorized { result.error = "unauthorized" } else if second.stop == .offline && result.error == nil { result.error = "offline" }
        return finish(&state, result)
    }

    private func finish(_ state: inout HealthSyncState, _ r: HealthSyncResult) -> HealthSyncResult {
        var result = r
        result.pending = files.pending().count
        result.deadLetter = files.deadCount()
        result.importing = state.importCursor != nil
        if result.error == nil || result.error == "offline" { state.lastSyncAt = Date() }
        state.lastError = result.error
        try? files.saveState(state)
        emit(result.error == nil ? "done" : "error", result.error)
        return result
    }

    // ---------- anchored types: vitals, sleep, workouts; and change detection for heart rate and steps ----------
    private struct QuantitySpec {
        let key: String
        let id: HKQuantityTypeIdentifier
        let unit: HKUnit
        let scale: Double
    }

    private static var quantitySpecs: [QuantitySpec] {
        let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
        var specs = [
            QuantitySpec(key: "hrv", id: .heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), scale: 1),
            QuantitySpec(key: "resting_hr", id: .restingHeartRate, unit: bpm, scale: 1),
            QuantitySpec(key: "respiratory_rate", id: .respiratoryRate, unit: bpm, scale: 1),
            QuantitySpec(key: "spo2", id: .oxygenSaturation, unit: HKUnit.percent(), scale: 100),
            QuantitySpec(key: "vo2max", id: .vo2Max, unit: HKUnit(from: "ml/kg*min"), scale: 1),
            QuantitySpec(key: "walking_hr", id: .walkingHeartRateAverage, unit: bpm, scale: 1),
            QuantitySpec(key: "body_mass", id: .bodyMass, unit: HKUnit.gramUnit(with: .kilo), scale: 1),
        ]
        if #available(iOS 16.0, *) {
            specs.append(QuantitySpec(key: "wrist_temp", id: .appleSleepingWristTemperature, unit: HKUnit.degreeCelsius(), scale: 1))
        }
        return specs
    }

    private func readAnchored(_ state: inout HealthSyncState) async throws {
        let since = state.historyFrom ?? Calendar.current.date(byAdding: .day, value: -365, to: Date())!
        let fromHistory = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)

        for spec in Self.quantitySpecs {
            guard let type = HKObjectType.quantityType(forIdentifier: spec.id) else { continue }
            try await page(type, key: spec.key, predicate: fromHistory, state: &state) { samples, deleted in
                let rows: [[String: Any]] = samples.compactMap { s in
                    guard let q = s as? HKQuantitySample else { return nil }
                    var row = Self.sourceFields(q)
                    row["uuid"] = q.uuid.uuidString
                    row["type"] = spec.key
                    row["start"] = Self.iso(q.startDate)
                    row["end"] = Self.iso(q.endDate)
                    row["value"] = q.quantity.doubleValue(for: spec.unit) * spec.scale
                    if (q.metadata?[HKMetadataKeyWasUserEntered] as? Bool) == true { row["userEntered"] = true }
                    return row
                }
                return ["samples": rows, "deletions": deleted.map { ["uuid": $0.uuid.uuidString, "kind": "sample"] }]
            }
        }

        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            try await page(sleep, key: "sleep", predicate: fromHistory, state: &state) { samples, deleted in
                let rows: [[String: Any]] = samples.compactMap { s in
                    guard let c = s as? HKCategorySample, let stage = Self.stage(c.value) else { return nil }
                    var row = Self.sourceFields(c)
                    row["uuid"] = c.uuid.uuidString
                    row["start"] = Self.iso(c.startDate)
                    row["end"] = Self.iso(c.endDate)
                    row["stage"] = stage
                    return row
                }
                return ["sleep": rows, "deletions": deleted.map { ["uuid": $0.uuid.uuidString, "kind": "sleep"] }]
            }
        }

        var workoutRows: [[String: Any]] = []
        var workoutDeletions: [[String: Any]] = []
        try await page(HKObjectType.workoutType(), key: "workout", predicate: fromHistory, state: &state, write: false) { samples, deleted in
            for s in samples { if let w = s as? HKWorkout { workoutRows.append(await self.workoutRow(w)) } }
            workoutDeletions += deleted.map { ["uuid": $0.uuid.uuidString, "kind": "workout"] }
            return [:]
        }
        if !workoutRows.isEmpty || !workoutDeletions.isEmpty {
            try enqueueSplit(["workouts": workoutRows, "deletions": workoutDeletions])
        }

        // heart rate and steps are not uploaded sample by sample: the anchor only says which recent days changed
        let recent = HKQuery.predicateForSamples(withStart: Calendar.current.date(byAdding: .day, value: -7, to: Date()), end: nil, options: .strictStartDate)
        for (key, id) in [("hr_changes", HKQuantityTypeIdentifier.heartRate), ("steps_changes", .stepCount)] {
            guard let type = HKObjectType.quantityType(forIdentifier: id) else { continue }
            var days = Set(state.dirtyDays)
            try await page(type, key: key, predicate: recent, state: &state, write: false) { samples, _ in
                for s in samples { days.insert(Self.dayKey(s.startDate)) }
                return [:]
            }
            state.dirtyDays = Array(days).sorted()
            try files.saveState(state)
        }
    }

    /// Reads one anchored type a page at a time. Each page's rows are queued (unless `write` is false, when the caller
    /// collects them) and only then does the read anchor move, so a crash can repeat a page but never lose one.
    private func page(_ type: HKSampleType, key: String, predicate: NSPredicate, state: inout HealthSyncState, write: Bool = true, build: ([HKSample], [HKDeletedObject]) async throws -> [String: Any]) async throws {
        var anchor = state.anchors[key].flatMap { try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: $0) }
        while true {
            try Task.checkCancellation()
            let (samples, deleted, next) = try await anchored(type, predicate: predicate, anchor: anchor)
            if !samples.isEmpty || !deleted.isEmpty {
                let body = try await build(samples, deleted)
                if write { try enqueueSplit(body) }
            }
            if let next = next {
                anchor = next
                state.anchors[key] = try? NSKeyedArchiver.archivedData(withRootObject: next, requiringSecureCoding: true)
                try files.saveState(state)
            }
            if samples.count + deleted.count < Self.pageSize { break }
        }
    }

    private func anchored(_ type: HKSampleType, predicate: NSPredicate, anchor: HKQueryAnchor?) async throws -> ([HKSample], [HKDeletedObject], HKQueryAnchor?) {
        try await withCheckedThrowingContinuation { cont in
            let q = HKAnchoredObjectQuery(type: type, predicate: predicate, anchor: anchor, limit: Self.pageSize) { _, samples, deleted, next, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume(returning: (samples ?? [], deleted ?? [], next)) }
            }
            store.execute(q)
        }
    }

    // ---------- the day sums ----------
    private func sumDirtyDays(_ state: inout HealthSyncState) async throws {
        // today and yesterday always: the Watch keeps adding to them
        var days = Set(state.dirtyDays)
        days.insert(Self.dayKey(Date()))
        days.insert(Self.dayKey(Date().addingTimeInterval(-86_400)))
        try await sumDays(Array(days).sorted(), state: &state)
        state.dirtyDays = []
        try files.saveState(state)
    }

    /// Sums days, a week of them per upload, each in the time zone it was first summed in.
    private func sumDays(_ days: [String], state: inout HealthSyncState) async throws {
        var rows: [[String: Any]] = []
        for (i, day) in days.enumerated() {
            try Task.checkCancellation()
            let zone = state.dayZones[day] ?? TimeZone.current.identifier
            state.dayZones[day] = zone
            rows += try await dayRows(day, zone: zone)
            if rows.count >= 35 || i == days.count - 1 {
                if !rows.isEmpty { try enqueueSplit(["days": rows]) }
                rows = []
            }
        }
        // keep the time zone map short: 90 days is plenty to re-sum late data
        let cutoff = Self.dayKey(Date().addingTimeInterval(-90 * 86_400))
        state.dayZones = state.dayZones.filter { $0.key >= cutoff }
    }

    private func dayRows(_ day: String, zone: String) async throws -> [[String: Any]] {
        guard let tz = TimeZone(identifier: zone) else { return [] }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let start = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])), let end = cal.date(byAdding: .day, value: 1, to: start) else { return [] }
        let base: [String: Any] = ["date": day, "dayStart": Self.iso(start), "tz": zone]
        var rows: [[String: Any]] = []
        func add(_ metric: String, _ value: Double?, _ buckets: Any? = nil) {
            guard value != nil || buckets != nil else { return }
            var r = base
            r["metric"] = metric
            r["value"] = value ?? NSNull()
            if let b = buckets { r["buckets"] = b }
            rows.append(r)
        }
        let kcal = HKUnit.kilocalorie()
        let steps = try await sum(.stepCount, HKUnit.count(), start, end)
        let stepBuckets = try await stepsByFive(start, end)
        let active = try await sum(.activeEnergyBurned, kcal, start, end)
        let basal = try await sum(.basalEnergyBurned, kcal, start, end)
        let exercise = try await sum(.appleExerciseTime, HKUnit.minute(), start, end)
        add("steps", steps, stepBuckets.isEmpty ? nil : stepBuckets)
        add("active_kcal", active)
        add("basal_kcal", basal)
        add("exercise_min", exercise)
        let hr = try await heartBuckets(start, end)
        if !hr.isEmpty { add("hr", nil, hr) }
        return rows
    }

    private func sum(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ start: Date, _ end: Date) async throws -> Double? {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
                if let error = error as? HKError, error.code == .errorNoData { return cont.resume(returning: nil) }
                if let error = error { return cont.resume(throwing: error) }
                cont.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit))
            }
            store.execute(q)
        }
    }

    /// Steps in 5-minute sums, as [index, steps] pairs (Health merges iPhone and Watch, so nothing is counted twice).
    private func stepsByFive(_ start: Date, _ end: Date) async throws -> [[Double]] {
        guard let type = HKObjectType.quantityType(forIdentifier: .stepCount) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let q = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: start, intervalComponents: DateComponents(minute: 5))
            q.initialResultsHandler = { _, results, error in
                if let error = error as? HKError, error.code == .errorNoData { return cont.resume(returning: []) }
                if let error = error { return cont.resume(throwing: error) }
                var out: [[Double]] = []
                results?.enumerateStatistics(from: start, to: end) { stats, _ in
                    if let v = stats.sumQuantity()?.doubleValue(for: HKUnit.count()), v > 0 {
                        out.append([Double(Int(stats.startDate.timeIntervalSince(start) / 300)), v.rounded()])
                    }
                }
                cont.resume(returning: out)
            }
            store.execute(q)
        }
    }

    /// Heart rate as 5-minute buckets: each reading counts for the time until the next one (at most 10 minutes), spread
    /// into 5 bpm bands. Readings inside a workout are left out; workouts carry their own heart rate (plan §3.2, decision 9).
    private func heartBuckets(_ start: Date, _ end: Date) async throws -> [[String: Any]] {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return [] }
        let dayPredicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let workouts = try await samples(HKObjectType.workoutType(), dayPredicate).compactMap { $0 as? HKWorkout }.map { ($0.startDate, $0.endDate) }
        let readings = try await samples(hrType, HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)).compactMap { $0 as? HKQuantitySample }
        let bpmUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
        struct Acc { var n = 0; var total = 0.0; var lo = 999.0; var hi = 0.0; var z: [String: Double] = [:] }
        var acc: [Int: Acc] = [:]
        for (i, r) in readings.enumerated() {
            let t = r.startDate
            if workouts.contains(where: { t >= $0.0 && t <= $0.1 }) { continue }
            let next = i + 1 < readings.count ? readings[i + 1].startDate : t.addingTimeInterval(60)
            let seconds = max(1, min(600, next.timeIntervalSince(t)))
            let bpm = r.quantity.doubleValue(for: bpmUnit)
            guard bpm >= 20, bpm <= 250 else { continue }
            let idx = Int(t.timeIntervalSince(start) / 300)
            var a = acc[idx] ?? Acc()
            a.n += 1
            a.total += bpm
            a.lo = min(a.lo, bpm)
            a.hi = max(a.hi, bpm)
            let band = String(max(30, min(220, Int(bpm / 5) * 5)))
            a.z[band, default: 0] += seconds
            acc[idx] = a
        }
        return acc.keys.sorted().map { idx -> [String: Any] in
            let a = acc[idx]!
            return ["i": idx, "n": a.n, "avg": (a.total / Double(a.n) * 10).rounded() / 10, "min": a.lo, "max": a.hi, "z": a.z.mapValues { $0.rounded() }]
        }
    }

    private func samples(_ type: HKSampleType, _ predicate: NSPredicate) async throws -> [HKSample] {
        try await withCheckedThrowingContinuation { cont in
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, results, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume(returning: results ?? []) }
            }
            store.execute(q)
        }
    }

    // ---------- workouts ----------
    /// Workouts from the last 48 hours go up again on every run: their heart rate often reaches the phone after them.
    private func recentWorkouts(_ state: inout HealthSyncState) async throws {
        let predicate = HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-48 * 3600), end: nil, options: .strictStartDate)
        let recent = try await samples(HKObjectType.workoutType(), predicate).compactMap { $0 as? HKWorkout }
        guard !recent.isEmpty else { return }
        var rows: [[String: Any]] = []
        for w in recent { rows.append(await workoutRow(w)) }
        try enqueueSplit(["workouts": rows])
    }

    private func workoutRow(_ w: HKWorkout) async -> [String: Any] {
        var row = Self.sourceFields(w)
        row["uuid"] = w.uuid.uuidString
        row["activity"] = Self.activityName(w.workoutActivityType)
        row["start"] = Self.iso(w.startDate)
        row["end"] = Self.iso(w.endDate)
        row["durationSec"] = w.duration
        let bpmUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
        if #available(iOS 16.0, *) {
            if let e = w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity() { row["energyKcal"] = e.doubleValue(for: HKUnit.kilocalorie()) }
            for id in [HKQuantityTypeIdentifier.distanceWalkingRunning, .distanceCycling, .distanceSwimming] {
                if let d = w.statistics(for: HKQuantityType(id))?.sumQuantity() {
                    row["distanceM"] = d.doubleValue(for: HKUnit.meter())
                    break
                }
            }
            if let hr = w.statistics(for: HKQuantityType(.heartRate)) {
                if let a = hr.averageQuantity() { row["avgHr"] = a.doubleValue(for: bpmUnit) }
                if let m = hr.maximumQuantity() { row["maxHr"] = m.doubleValue(for: bpmUnit) }
            }
        }
        // heart rate in 5-second steps
        if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate), let readings = try? await samples(hrType, HKQuery.predicateForObjects(from: w)) {
            var steps: [Int: (Double, Int)] = [:]
            for r in readings.compactMap({ $0 as? HKQuantitySample }) {
                let at = Int(max(0, r.startDate.timeIntervalSince(w.startDate)) / 5) * 5
                let v = r.quantity.doubleValue(for: bpmUnit)
                guard v >= 20, v <= 250 else { continue }
                let cur = steps[at] ?? (0, 0)
                steps[at] = (cur.0 + v, cur.1 + 1)
            }
            let series = steps.keys.sorted().map { [Double($0), (steps[$0]!.0 / Double(steps[$0]!.1)).rounded()] }
            if !series.isEmpty { row["hr"] = series }
        }
        return row
    }

    // ---------- the first import, a month at a time, newest first ----------
    private func importHistory(_ state: inout HealthSyncState, result: inout HealthSyncResult) async throws {
        let cal = Calendar.current
        let floor = state.historyFrom ?? cal.date(byAdding: .day, value: -365, to: Date())!
        while let monthStart = state.importCursor {
            try Task.checkCancellation()
            if monthStart < cal.date(from: cal.dateComponents([.year, .month], from: floor))! {
                state.importCursor = nil
                try files.saveState(state)
                break
            }
            let label = DateFormatter.localizedString(from: monthStart, dateStyle: .medium, timeStyle: .none)
            emit("progress", label)
            let monthEnd = cal.date(byAdding: .month, value: 1, to: monthStart)!
            var days: [String] = []
            var d = max(monthStart, cal.startOfDay(for: floor))
            let stop = min(monthEnd, Date())
            while d < stop {
                days.append(Self.dayKey(d))
                d = cal.date(byAdding: .day, value: 1, to: d)!
            }
            try await sumDays(days, state: &state)
            state.importCursor = cal.date(byAdding: .month, value: -1, to: monthStart)
            try files.saveState(state)
            // upload as we go, so Today fills in long before the year is in
            if let token = HealthKeychain.read(), let origin = state.apiOrigin {
                let up = await upload(token: token, origin: origin)
                result.uploaded += up.sent
                if up.stop != nil { break }
            }
        }
    }

    // ---------- reconcile, once a day ----------
    private func reconcileIfDue(_ state: inout HealthSyncState) async throws {
        if let last = state.lastReconcile, Date().timeIntervalSince(last) < 20 * 3600 { return }
        let to = Date()
        let from = to.addingTimeInterval(-14 * 86_400)
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        var kinds: [(String, HKSampleType)] = []
        for spec in Self.quantitySpecs {
            if let t = HKObjectType.quantityType(forIdentifier: spec.id) { kinds.append((spec.key, t)) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { kinds.append(("sleep", sleep)) }
        kinds.append(("workout", HKObjectType.workoutType()))
        for (kind, type) in kinds {
            let uuids = try await samples(type, predicate).map { $0.uuid.uuidString }
            try files.enqueue(["kind": kind, "from": Self.iso(from), "to": Self.iso(to), "uuids": uuids], kind: "reconcile")
        }
        state.lastReconcile = Date()
        try files.saveState(state)
    }

    // ---------- the queue ----------
    /// Queues a batch, splitting it in half until it fits under the size cap.
    private func enqueueSplit(_ body: [String: Any]) throws {
        var full = body
        full["batchId"] = UUID().uuidString
        full["payloadVersion"] = Self.payloadVersion
        let size = (try? JSONSerialization.data(withJSONObject: full).count) ?? 0
        if size <= Self.maxBatchBytes {
            try files.enqueue(full, kind: "batch")
            return
        }
        // split the biggest list in half and try each half
        var biggest: (key: String, list: [Any])?
        for entry in body {
            if let list = entry.value as? [Any], list.count > (biggest?.list.count ?? 1) { biggest = (entry.key, list) }
        }
        guard let split = biggest else {
            try files.enqueue(full, kind: "batch")
            return
        }
        let key = split.key
        let list = split.list
        var a = body
        var b: [String: Any] = [:]
        a[key] = Array(list[..<(list.count / 2)])
        b[key] = Array(list[(list.count / 2)...])
        try enqueueSplit(a)
        try enqueueSplit(b)
    }

    private enum Stop { case unauthorized, offline }

    /// Sends queued uploads oldest first. 2xx: done. 401: stop until reconnected. Other 4xx: set aside so it never blocks.
    /// 5xx or no network: keep it for the next run.
    private func upload(token: String, origin: String) async -> (sent: Int, stop: Stop?) {
        var sent = 0
        for file in files.pending() {
            guard let data = try? Data(contentsOf: file) else { return (sent, .offline) }
            let isReconcile = file.lastPathComponent.hasSuffix("-reconcile.json")
            guard let url = URL(string: origin + (isReconcile ? "/api/apple-health/reconcile" : "/api/apple-health/sync")) else { return (sent, .offline) }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.httpBody = data
            req.timeoutInterval = 30
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue(Self.dayKey(Date()), forHTTPHeaderField: "X-Local-Date")
            req.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-Time-Zone")
            do {
                let (_, response) = try await URLSession.shared.data(for: req)
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                switch code {
                case 200..<300:
                    files.remove(file)
                    sent += 1
                case 401:
                    return (sent, .unauthorized)
                case 400..<500:
                    files.bury(file)
                default:
                    return (sent, .offline)
                }
            } catch {
                return (sent, .offline)
            }
        }
        return (sent, nil)
    }

    // ---------- helpers ----------
    private static func sourceFields(_ s: HKSample) -> [String: Any] {
        var row: [String: Any] = ["sourceBundle": s.sourceRevision.source.bundleIdentifier, "sourceName": s.sourceRevision.source.name]
        if let p = s.sourceRevision.productType { row["productType"] = p }
        if let tz = s.metadata?[HKMetadataKeyTimeZone] as? String { row["tz"] = tz }
        return row
    }

    /// HKCategoryValueSleepAnalysis by raw value (works back to iOS 15).
    static func stage(_ raw: Int) -> String? {
        switch raw {
        case 0: return "in_bed"
        case 1: return "asleep"
        case 2: return "awake"
        case 3: return "core"
        case 4: return "deep"
        case 5: return "rem"
        default: return nil
        }
    }

    static func activityName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .running: return "running"
        case .walking: return "walking"
        case .cycling: return "cycling"
        case .swimming: return "swimming"
        case .hiking: return "hiking"
        case .rowing: return "rowing"
        case .elliptical: return "elliptical"
        case .yoga: return "yoga"
        case .traditionalStrengthTraining: return "traditionalStrengthTraining"
        case .functionalStrengthTraining: return "functionalStrengthTraining"
        case .highIntensityIntervalTraining: return "highIntensityIntervalTraining"
        case .crossTraining: return "crossTraining"
        case .coreTraining: return "coreTraining"
        case .mixedCardio: return "mixedCardio"
        default: return "other_\(t.rawValue)"
        }
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func iso(_ d: Date) -> String { isoFormatter.string(from: d) }

    /// yyyy-MM-dd in the phone's current time zone.
    static func dayKey(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
