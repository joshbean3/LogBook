import Foundation

/// Where the engine cuts days and months: always the Gregorian calendar in the phone's current time zone.
///
/// `Calendar.current` follows the calendar the person picked in Settings. With the Buddhist calendar (the default for the
/// Thailand region) it names today "2569-11-10", with the Japanese calendar "0008-11-10", and the server and the web app
/// count in Gregorian days (docs/launch/decisions.md). Use this, never `Calendar.current`, for any day or month.
enum HealthCalendar {
    static var gregorian: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone.current
        return cal
    }

    /// yyyy-MM-dd for the day `date` falls on, in the phone's current time zone.
    static func dayKey(_ date: Date) -> String {
        let c = gregorian.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
