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

/// The Apple Health sync engine.
///
/// It reads three things and nothing else: sleep, heart rate variability and resting heart rate (the same three
/// `HealthReader.readTypes` asks for, each shown on Progress). No workouts, routes, heart rate, steps or energy.
///
/// One run at a time (a trigger that arrives during a run joins it). A run: upload what is queued; read each type from
/// its read anchor, a page at a time, each page written to disk with its new anchor before the anchor moves; once a day,
/// reconcile the last 14 days; upload again. Uploads carry the device token, never the web session.
actor HealthSync {
    static let shared = HealthSync()
    /// 2: only the three types go up, and no row carries the source's name. A phone that queued the older shape drops
    /// that queue and reads again (see `run`).
    static let payloadVersion = 2
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
    /// A run that is still going (the first read takes a while) belongs to the old connection: it is stopped and waited
    /// for first, so it cannot write its anchors over the new state. A token the Keychain refuses is an error, so the
    /// plugin never says "connected" while `status()` says not.
    func connect(token: String, apiOrigin: String, historyDays: Int) async throws {
        await stopRunning()
        files.wipe()
        guard HealthKeychain.save(token) else { throw HealthStorageError.keychain }
        var s = HealthSyncState()
        s.connected = true
        s.apiOrigin = apiOrigin
        s.payloadVersion = Self.payloadVersion
        let cal = HealthCalendar.gregorian
        let today = cal.startOfDay(for: Date())
        s.historyFrom = cal.date(byAdding: .day, value: -historyDays, to: today)
        do {
            try files.saveState(s)
        } catch {
            // no state, so no connection: the token must not stay behind on its own
            HealthKeychain.delete()
            throw error
        }
    }

    /// A Keychain item outlives the app: after an uninstall and a new install the old device token is still there, with
    /// no state beside it. It belongs to whoever used the phone before, so it goes. Called once when the plugin loads.
    func dropLeftoverToken() {
        if !files.hasState && HealthKeychain.read() != nil { HealthKeychain.delete() }
    }

    /// "Disconnect and delete": a running sync is cancelled and waited for before anything is wiped, so it cannot queue a
    /// page or write its state back after the person was told it was removed.
    func disconnect() async {
        await stopRunning()
        files.wipe()
        HealthKeychain.delete()
    }

    /// Cancels the running sync, if any, and waits until it has returned. A sync that asks to start meanwhile usually
    /// joins the cancelled one (see `sync`); if one still started while this waited, it is cancelled and waited for too,
    /// so no run is left going when the caller wipes.
    private func stopRunning() async {
        while let task = running {
            task.cancel()
            _ = await task.value
            if running == task { running = nil }
        }
    }

    func status() -> [String: Any] {
        var s = HealthSyncState()
        var problem: String?
        do {
            s = try files.loadState()
        } catch HealthStorageError.corrupt {
            // the file is kept; disconnecting (or connecting again) clears it
            problem = "corrupt"
        } catch {
            problem = "locked"
        }
        let hasToken = HealthKeychain.read() != nil
        var d: [String: Any] = [
            "connected": hasToken && (s.connected || problem == "corrupt"),
            "pending": files.pending().count,
            "deadLetter": files.deadCount(),
            // the first read (up to a year of the three types) has not finished yet
            "importing": s.connected && s.lastSyncAt == nil,
        ]
        if let at = s.lastSyncAt { d["lastSyncAt"] = Self.iso(at) }
        if let e = problem ?? s.lastError { d["lastError"] = e }
        if let h = s.historyFrom { d["historyFrom"] = Self.iso(h) }
        return d
    }

    // ---------- one run at a time ----------
    /// `origin` is the server this build talks to (the web app passes the origin it was built with). Without it the engine
    /// takes the host the release build wrote into Info.plist. The copy saved at connect is only the last fallback, so a
    /// build that moves to a new server never keeps posting to the old one.
    func sync(reason: String, origin: String? = nil) async -> HealthSyncResult {
        if let current = running { return await current.value }
        let task = Task { await self.run(reason: reason, buildOrigin: origin) }
        running = task
        let result = await task.value
        if running == task { running = nil }
        return result
    }

    /// An https (or, in a development build, http) origin with a host and nothing after it.
    static func validOrigin(_ s: String?) -> String? {
        guard let s = s, let url = URL(string: s), let scheme = url.scheme, scheme == "https" || scheme == "http",
              url.host != nil, url.path.isEmpty || url.path == "/", url.query == nil else { return nil }
        return s.hasSuffix("/") ? String(s.dropLast()) : s
    }

    /// The server this build was made for: `LogbookAPIHost` in Info.plist, which is `$(LOGBOOK_API_HOST)`, written from
    /// VITE_API_ORIGIN by `pnpm ios:release`. A development build keeps the placeholder, and then this is nil.
    static var bundleOrigin: String? {
        guard let host = Bundle.main.object(forInfoDictionaryKey: "LogbookAPIHost") as? String else { return nil }
        let h = host.trimmingCharacters(in: .whitespaces).lowercased()
        if h.isEmpty || h.contains("$(") || h == "example.com" || h.hasSuffix(".example.com") { return nil }
        return validOrigin("https://" + h)
    }

    /// Once cancelled (disconnect, or a new connect), a run writes nothing more: no page, no upload, no state.
    private func cancelled(_ r: HealthSyncResult) -> HealthSyncResult {
        var result = r
        result.error = "cancelled"
        return result
    }

    private func run(reason: String, buildOrigin: String?) async -> HealthSyncResult {
        var result = HealthSyncResult()
        var state: HealthSyncState
        do {
            state = try files.loadState()
        } catch HealthStorageError.corrupt {
            // the file is kept as it is; nothing reads or writes past it until the person reconnects
            result.error = "corrupt"
            emit("error", result.error)
            return result
        } catch {
            result.error = "locked"
            return result
        }
        guard state.connected, let token = HealthKeychain.read(), let origin = Self.validOrigin(buildOrigin) ?? Self.bundleOrigin ?? state.apiOrigin else {
            result.error = "not_connected"
            return result
        }
        if Task.isCancelled { return cancelled(result) }
        if state.apiOrigin != origin {
            state.apiOrigin = origin
            try? files.saveState(state)
        }
        emit("start", reason)

        // a new upload shape: what an older build queued (other types, source names) is dropped unsent, and the three
        // types are read again from the start
        if state.payloadVersion != Self.payloadVersion {
            files.clearQueue()
            state.anchors = [:]
            state.lastReconcile = nil
            state.payloadVersion = Self.payloadVersion
            try? files.saveState(state)
        }

        // 1. what is already queued needs no Health access
        let first = await upload(token: token, origin: origin)
        result.uploaded += first.sent
        if first.stop == .unauthorized { return signedOut(result) }
        if Task.isCancelled { return cancelled(result) }

        // 2-3. read Health: the three anchored types, then the daily reconcile
        do {
            try await readAnchored(&state)
            try await reconcileIfDue(&state)
        } catch let e as HKError where e.code == .errorDatabaseInaccessible {
            result.error = "locked"
        } catch is CancellationError {
            return cancelled(result)
        } catch {
            result.error = error.localizedDescription
        }
        if Task.isCancelled { return cancelled(result) }

        // 4. upload what this run queued
        let second = await upload(token: token, origin: origin)
        result.uploaded += second.sent
        if second.stop == .unauthorized { return signedOut(result) }
        if Task.isCancelled { return cancelled(result) }
        if second.stop == .offline && result.error == nil { result.error = "offline" }
        return finish(&state, result)
    }

    /// The server answered 401: it no longer knows this phone's token (the person signed out, deleted the account or
    /// disconnected Apple Health). Nothing queued can ever be sent and none of it may wait for the next account, so the
    /// queue, the dead letters, the anchors, the state and the token all go. Nothing is saved after this.
    private func signedOut(_ r: HealthSyncResult) -> HealthSyncResult {
        files.wipe()
        HealthKeychain.delete()
        var result = r
        result.pending = 0
        result.deadLetter = 0
        result.importing = false
        result.error = "unauthorized"
        emit("error", result.error)
        return result
    }

    private func finish(_ state: inout HealthSyncState, _ r: HealthSyncResult) -> HealthSyncResult {
        var result = r
        result.pending = files.pending().count
        result.deadLetter = files.deadCount()
        if result.error == nil || result.error == "offline" { state.lastSyncAt = Date() }
        result.importing = state.lastSyncAt == nil
        state.lastError = result.error
        try? files.saveState(state)
        emit(result.error == nil ? "done" : "error", result.error)
        return result
    }

    // ---------- the three anchored types: heart rate variability, resting heart rate, sleep ----------
    private struct QuantitySpec {
        let key: String
        let id: HKQuantityTypeIdentifier
        let unit: HKUnit
        let scale: Double
    }

    /// The two quantity types. With sleep they are everything the engine reads; keep this in step with
    /// `HealthReader.readTypes` and with what the server accepts (it refuses any other type).
    private static var quantitySpecs: [QuantitySpec] {
        let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
        return [
            QuantitySpec(key: "hrv", id: .heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), scale: 1),
            QuantitySpec(key: "resting_hr", id: .restingHeartRate, unit: bpm, scale: 1),
        ]
    }

    private func readAnchored(_ state: inout HealthSyncState) async throws {
        let since = state.historyFrom ?? HealthCalendar.gregorian.date(byAdding: .day, value: -365, to: Date())!
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
    }

    /// Reads one anchored type a page at a time. Each page's rows are queued and only then does the read anchor move, so
    /// a crash can repeat a page but never lose one.
    private func page(_ type: HKSampleType, key: String, predicate: NSPredicate, state: inout HealthSyncState, build: ([HKSample], [HKDeletedObject]) async throws -> [String: Any]) async throws {
        var anchor = state.anchors[key].flatMap { try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: $0) }
        while true {
            try Task.checkCancellation()
            let (samples, deleted, next) = try await anchored(type, predicate: predicate, anchor: anchor)
            // a page read while the person disconnected is dropped, not queued after the wipe
            try Task.checkCancellation()
            if !samples.isEmpty || !deleted.isEmpty {
                let body = try await build(samples, deleted)
                try Task.checkCancellation()
                try enqueueSplit(body)
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

    private func samples(_ type: HKSampleType, _ predicate: NSPredicate) async throws -> [HKSample] {
        try await withCheckedThrowingContinuation { cont in
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, results, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume(returning: results ?? []) }
            }
            store.execute(q)
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
        for (kind, type) in kinds {
            let uuids = try await samples(type, predicate).map { $0.uuid.uuidString }
            try Task.checkCancellation()
            try files.enqueue(["kind": kind, "from": Self.iso(from), "to": Self.iso(to), "uuids": uuids], kind: "reconcile")
        }
        try Task.checkCancellation()
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
            if Task.isCancelled { return (sent, nil) }
            guard let data = try? Data(contentsOf: file) else { return (sent, .offline) }
            let isReconcile = file.lastPathComponent.hasSuffix("-reconcile.json")
            guard let url = URL(string: origin + (isReconcile ? "/api/apple-health/reconcile" : "/api/apple-health/sync")) else { return (sent, .offline) }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.httpBody = data
            req.timeoutInterval = 30
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue(HealthCalendar.dayKey(Date()), forHTTPHeaderField: "X-Local-Date")
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
    /// Where a row came from: the writing app's bundle id and the hardware model ("Watch7,1"). Never the source's name,
    /// which is usually the person's own device name.
    private static func sourceFields(_ s: HKSample) -> [String: Any] {
        var row: [String: Any] = ["sourceBundle": s.sourceRevision.source.bundleIdentifier]
        if let p = s.sourceRevision.productType { row["productType"] = p }
        if let tz = s.metadata?[HKMetadataKeyTimeZone] as? String { row["tz"] = tz }
        return row
    }

    /// HKCategoryValueSleepAnalysis by raw value.
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

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func iso(_ d: Date) -> String { isoFormatter.string(from: d) }
}
