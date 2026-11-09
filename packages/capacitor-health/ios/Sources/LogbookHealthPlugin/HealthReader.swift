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

/// Logbook's reader for Apple Health (docs/health/apple-health.md).
///
/// Phase 1 is the proof: ask for every type the plan reads in one sheet, and read a few things back raw (last night's
/// sleep segments, the newest HRV and resting heart rate, today's steps) so they can be checked against the Health app.
/// The sync engine (anchored queries, the disk queue, uploads) is Phase 2 and builds on this class.
final class HealthReader {
    static let shared = HealthReader()
    let store = HKHealthStore()

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }

    /// Every type the plan reads (§3.3), routes included, so Apple's sheet is shown once. Read only: Logbook writes nothing.
    static var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let quantities: [HKQuantityTypeIdentifier] = [
            .heartRateVariabilitySDNN,
            .restingHeartRate,
            .respiratoryRate,
            .oxygenSaturation,
            .vo2Max,
            .walkingHeartRateAverage,
            .bodyMass,
            .heartRate,
            .stepCount,
            .activeEnergyBurned,
            .basalEnergyBurned,
            .appleExerciseTime,
            .distanceWalkingRunning,
            .distanceCycling,
            .distanceSwimming,
        ]
        for id in quantities {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        if #available(iOS 16.0, *) {
            if let t = HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature) { types.insert(t) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        types.insert(HKObjectType.workoutType())
        types.insert(HKSeriesType.workoutRoute())
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

    /// The Phase 1 proof: raw values to compare with the Health app. Each part reports its own error (a locked phone
    /// reads as "locked"), so one missing type never hides the others.
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
        latest(.respiratoryRate, unit: HKUnit.count().unitDivided(by: HKUnit.minute()), key: "respiratoryRate", group: group, put: put)

        // today's steps, summed by Health itself (it merges iPhone and Watch, so nothing is counted twice)
        if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) {
            group.enter()
            let now = Date()
            let predicate = HKQuery.predicateForSamples(withStart: Calendar.current.startOfDay(for: now), end: now, options: .strictStartDate)
            let query = HKStatisticsQuery(quantityType: steps, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
                if let error = error { put("stepsError", Self.describe(error)) }
                if let sum = stats?.sumQuantity() { put("stepsToday", sum.doubleValue(for: HKUnit.count())) }
                group.leave()
            }
            store.execute(query)
        }

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

    /// HKCategoryValueSleepAnalysis by raw value, so this compiles for iOS 15 (the stages arrived in iOS 16).
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
