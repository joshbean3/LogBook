import UIKit
import Capacitor

/// The shell around the web view, for what capacitor.config.ts cannot reach.
///
/// Capacitor's `prepareWebView` sets `scrollView.bounces = false`, so every page stopped dead at both ends: the surest tell
/// of a web view. `capacitorDidLoad()` runs right after that, so the rubber band is turned back on here (and on short
/// pages too, as a table view would). Link previews are off, here and in the config, so a long press means one thing:
/// the app's own menu. The content inset stays `never` (the app draws under the status bar on purpose).
class LogbookViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView else { return }
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
    }
}
