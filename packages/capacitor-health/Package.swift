// swift-tools-version: 5.9
import PackageDescription

// Logbook's Apple Health reader, as a local Capacitor plugin. `pnpm ios` (cap sync) adds it to CapApp-SPM, so new
// Swift files here need no change to the Xcode project. docs/health/apple-health.md §3.2.
let package = Package(
    name: "LogbookCapacitorHealth",
    platforms: [.iOS(.v17)],
    products: [
        .library(
            name: "LogbookCapacitorHealth",
            targets: ["LogbookHealthPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "LogbookHealthPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/LogbookHealthPlugin",
            linkerSettings: [.linkedFramework("HealthKit")])
    ]
)
