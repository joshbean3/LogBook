import Foundation
import Capacitor

/// Apple Health, as the web app reaches it: `registerPlugin('LogbookHealth')` in apps/web/src/lib/health.ts.
/// A thin face over `HealthReader`; the work happens there (docs/health/apple-health.md §3.7).
@objc(LogbookHealthPlugin)
public class LogbookHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LogbookHealthPlugin"
    public let jsName = "LogbookHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "needsAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readingCheck", returnType: CAPPluginReturnPromise),
    ]

    private let reader = HealthReader.shared

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
}
