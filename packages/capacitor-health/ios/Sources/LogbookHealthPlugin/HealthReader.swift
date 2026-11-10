import Foundation
import HealthKit

/// What can go wrong before a query runs.
enum HealthReaderError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        switch self {
        case .unavailable: return "Apple Health isn't available on this device."
        }
    }
}

/// Logbook's reader for Apple Health.
///
/// Version 1.0 reads three things and shows each on Progress: sleep, heart rate variability and resting heart rate. This
/// class asks for exactly those in one sheet, and can read the newest of each back raw so it can be checked against the
/// Health app. The sync engine (`HealthSync`) reads the same three types and no others.
final class HealthReader {
    static let shared = HealthReader()
    let store = HKHealthStore()

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }

    /// The three types Logbook reads, and nothing else. Read only: Logbook writes nothing. Add a type here only when a
    /// screen shows it, and change NSHealthShareUsageDescription, the connect sheet and the privacy policy with it.
    static var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        if let hrv = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { types.insert(hrv) }
        if let resting = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { types.insert(resting) }
        return types
    }

    /// Shows Apple's permission sheet (only the first time, or for types added since). The answer says nothing about
    /// what was allowed: Apple never tells an app whether reading was denied (denied reads look like no data).
    func requestAuthorization(_ done: @escaping (Error?) -> Void) {
        guard Self.available else { return done(HealthReaderError.unavailable) }
        store.requestAuthorization(toShare: nil, read: Self.readTypes) { _, error in
            done(error)
        }
    }

    /// Whether Apple's sheet would still show (a first connect, or types added in a later version).
    func needsAuthorization(_ done: @escaping (Bool) -> Void) {
        guard Self.available else { return done(false) }
        store.getRequestStatusForAuthorization(toShare: [], read: Self.readTypes) { status, _ in
            done(status == .shouldRequest)
        }
    }

    /// Raw values to compare with the Health app: last night's sleep, the newest heart rate variability and resting heart
    /// rate. Each part reports its own error (a locked phone reads as "locked"), so one missing type never hides the
    /// others. This stays on the phone: it goes to the web view, never to the server.
    func readingCheck(_ done: @escaping ([String: Any]) -> Void) {
        guard Self.available else { return done(["available": false]) }
        let group = DispatchGroup()
        let lock = NSLock()
        var out: [String: Any] = ["available": true, "checkedAt": Self.iso(Date())]
        let put: (String, Any) -> Void = { key, value in
            lock.lock()
            out[key] = value
            lock.unlock()
        }

        // last night: every sleep segment in the last 36 hours, oldest first
        if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let now = Date()
            let predicate = HKQuery.predicateForSamples(withStart: now.addingTimeInterval(-36 * 3600), end: now, options: [])
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: 500, sortDescriptors: sort) { _, samples, error in
                if let error = error { put("sleepError", Self.describe(error)) }
                let rows: [[String: Any]] = (samples as? [HKCategorySample] ?? []).map { s in
                    [
                        "start": Self.iso(s.startDate),
                        "end": Self.iso(s.endDate),
                        "stage": Self.stage(s.value),
                        "source": s.sourceRevision.source.name,
                        "bundle": s.sourceRevision.source.bundleIdentifier,
                        "device": s.sourceRevision.productType ?? "",
                    ]
                }
                put("sleep", rows)
                group.leave()
            }
            store.execute(query)
        }

        latest(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), key: "hrv", group: group, put: put)
        latest(.restingHeartRate, unit: HKUnit.count().unitDivided(by: HKUnit.minute()), key: "restingHr", group: group, put: put)

        group.notify(queue: .main) {
            lock.lock()
            let result = out
            lock.unlock()
            done(result)
        }
    }

    /// The newest sample of a type: its value in `unit`, when, and where it came from.
    private func latest(_ id: HKQuantityTypeIdentifier, unit: HKUnit, key: String, group: DispatchGroup, put: @escaping (String, Any) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: id) else { return }
        group.enter()
        let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: sort) { _, samples, error in
            if let error = error { put("\(key)Error", Self.describe(error)) }
            if let s = (samples as? [HKQuantitySample])?.first {
                put(key, [
                    "value": s.quantity.doubleValue(for: unit),
                    "at": Self.iso(s.endDate),
                    "source": s.sourceRevision.source.name,
                    "device": s.sourceRevision.productType ?? "",
                ] as [String: Any])
            }
            group.leave()
        }
        store.execute(query)
    }

    /// HKCategoryValueSleepAnalysis by raw value.
    static func stage(_ raw: Int) -> String {
        switch raw {
        case 0: return "in_bed"
        case 1: return "asleep"
        case 2: return "awake"
        case 3: return "core"
        case 4: return "deep"
        case 5: return "rem"
        default: return "unknown"
        }
    }

    /// An error in words. A locked phone is its own case: Health can't be read until it is unlocked.
    static func describe(_ error: Error) -> String {
        if let hk = error as? HKError, hk.code == .errorDatabaseInaccessible { return "locked" }
        return error.localizedDescription
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func iso(_ date: Date) -> String { isoFormatter.string(from: date) }
}
