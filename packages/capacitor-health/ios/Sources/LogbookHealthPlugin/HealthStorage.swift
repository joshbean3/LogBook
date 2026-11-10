import Foundation
import Security

/// What the sync engine remembers between runs (docs/health/apple-health.md §3.4). Plain values only, so it is Codable.
struct HealthSyncState: Codable {
    var connected = false
    var apiOrigin: String?
    var payloadVersion = 0
    /// The first day the engine reads (a year back unless Settings says otherwise).
    var historyFrom: Date?
    /// One archived HKQueryAnchor per anchored type: the read anchor (it moves as soon as a page is safely on disk).
    var anchors: [String: Data] = [:]
    var lastReconcile: Date?
    var lastSyncAt: Date?
    var lastError: String?
}

/// Why a run could not read or write its own files.
enum HealthStorageError: Error {
    /// The files exist but can't be read yet (the phone has not been unlocked since it restarted).
    case locked
}

/// The engine's files, in Application Support/LogbookHealth: the state, the upload queue, and dead letters.
///
/// Every file is protected until the phone's first unlock and kept out of backups (it is Health data; Apple keeps that out
/// of iCloud). "Can't read it" is never mistaken for "it isn't there": an unreadable state stops the run instead of
/// starting the import over.
final class HealthStorage {
    static let shared = HealthStorage()

    private let fm = FileManager.default
    let root: URL
    let queueDir: URL
    let deadDir: URL
    private var stateURL: URL { root.appendingPathComponent("state.json") }

    private init() {
        let base = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? fm.temporaryDirectory
        root = base.appendingPathComponent("LogbookHealth", isDirectory: true)
        queueDir = root.appendingPathComponent("queue", isDirectory: true)
        deadDir = root.appendingPathComponent("dead", isDirectory: true)
        prepare()
    }

    private func prepare() {
        let attrs: [FileAttributeKey: Any] = [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        for dir in [root, queueDir, deadDir] {
            if !fm.fileExists(atPath: dir.path) {
                try? fm.createDirectory(at: dir, withIntermediateDirectories: true, attributes: attrs)
            }
        }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var r = root
        try? r.setResourceValues(values)
    }

    private func write(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    // ---------- state ----------
    /// Whether this install has a state file, readable or not. A fresh install has none.
    var hasState: Bool { fm.fileExists(atPath: stateURL.path) }

    func loadState() throws -> HealthSyncState {
        guard fm.fileExists(atPath: stateURL.path) else { return HealthSyncState() }
        guard let data = try? Data(contentsOf: stateURL) else { throw HealthStorageError.locked }
        return (try? JSONDecoder().decode(HealthSyncState.self, from: data)) ?? HealthSyncState()
    }

    func saveState(_ state: HealthSyncState) throws {
        try write(try JSONEncoder().encode(state), to: stateURL)
    }

    // ---------- the queue ----------
    /// Writes one upload (a batch, or a reconcile) as its own file, atomically. Names sort oldest first.
    @discardableResult
    func enqueue(_ body: [String: Any], kind: String) throws -> URL {
        let data = try JSONSerialization.data(withJSONObject: body, options: [])
        let stamp = String(format: "%.0f", Date().timeIntervalSince1970 * 1000)
        let url = queueDir.appendingPathComponent("\(stamp)-\(UUID().uuidString.prefix(8))-\(kind).json")
        try write(data, to: url)
        return url
    }

    func pending() -> [URL] {
        let files = (try? fm.contentsOfDirectory(at: queueDir, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    func deadCount() -> Int {
        ((try? fm.contentsOfDirectory(at: deadDir, includingPropertiesForKeys: nil)) ?? []).count
    }

    func remove(_ url: URL) {
        try? fm.removeItem(at: url)
    }

    /// A batch the server refused for good (a 4xx other than 401): kept aside so it never blocks the queue.
    func bury(_ url: URL) {
        let to = deadDir.appendingPathComponent(url.lastPathComponent)
        try? fm.removeItem(at: to)
        try? fm.moveItem(at: url, to: to)
    }

    /// Empties the upload queue and the dead letters. The state stays.
    func clearQueue() {
        for dir in [queueDir, deadDir] {
            for f in (try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [] { try? fm.removeItem(at: f) }
        }
    }

    /// Disconnect: the queue, the dead letters and the state all go.
    func wipe() {
        clearQueue()
        try? fm.removeItem(at: stateURL)
    }
}

/// The device token, in the Keychain: readable after the first unlock, never copied to another phone. Keychain items
/// outlive the app (they stay after an uninstall), so `HealthSync.dropLeftoverToken()` clears one the app no longer owns.
enum HealthKeychain {
    private static let service = "app.logbook.health"
    private static let account = "device-token"

    private static var base: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    @discardableResult
    static func save(_ token: String) -> Bool {
        delete()
        var q = base
        q[kSecValueData as String] = Data(token.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(q as CFDictionary, nil) == errSecSuccess
    }

    static func read() -> String? {
        var q = base
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete() {
        SecItemDelete(base as CFDictionary)
    }
}
