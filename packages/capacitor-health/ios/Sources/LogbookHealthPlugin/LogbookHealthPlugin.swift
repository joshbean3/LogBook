import Foundation
import Capacitor

/// Apple Health, as the web app reaches it: `registerPlugin('LogbookHealth')` in apps/web/src/lib/health.ts.
/// A thin face over `HealthReader` (permission, the reading check) and `HealthSync` (the engine) (plan §3.7).
@objc(LogbookHealthPlugin)
public class LogbookHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LogbookHealthPlugin"
    public let jsName = "LogbookHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "needsAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readingCheck", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]

    private let reader = HealthReader.shared

    override public func load() {
        // the engine's progress reaches the web view as `healthSync` events while it is open
        Task {
            // a token left in the Keychain by an earlier install belongs to nobody on this one
            await HealthSync.shared.dropLeftoverToken()
            await HealthSync.shared.setListener { [weak self] event in
                self?.notifyListeners("healthSync", data: event)
            }
        }
    }

    @objc public func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HealthReader.available])
    }

    @objc public func requestAuthorization(_ call: CAPPluginCall) {
        reader.requestAuthorization { error in
            if let error = error {
                call.reject(HealthReader.describe(error))
            } else {
                call.resolve(["asked": true])
            }
        }
    }

    @objc public func needsAuthorization(_ call: CAPPluginCall) {
        reader.needsAuthorization { needed in
            call.resolve(["needed": needed])
        }
    }

    @objc public func readingCheck(_ call: CAPPluginCall) {
        reader.readingCheck { result in
            call.resolve(result)
        }
    }

    /// The token from POST /api/apple-health/connect goes into the Keychain; the first read starts on the next sync.
    @objc public func connect(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let origin = call.getString("apiOrigin") else {
            return call.reject("connect needs a token and the API origin")
        }
        let days = call.getInt("historyDays") ?? 365
        Task {
            do {
                try await HealthSync.shared.connect(token: token, apiOrigin: origin, historyDays: days)
                call.resolve(["connected": true])
            } catch {
                call.reject("Couldn’t save the connection on this phone. Unlock it and try again.")
            }
        }
    }

    @objc public func sync(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "open"
        Task {
            let result = await HealthSync.shared.sync(reason: reason)
            call.resolve(result.dict)
        }
    }

    @objc public func status(_ call: CAPPluginCall) {
        Task {
            let s = await HealthSync.shared.status()
            call.resolve(s)
        }
    }

    /// Stops syncing on this phone (queue, anchors and token gone). The app then deletes the server's copy.
    @objc public func disconnect(_ call: CAPPluginCall) {
        Task {
            await HealthSync.shared.disconnect()
            call.resolve(["connected": false])
        }
    }
}
