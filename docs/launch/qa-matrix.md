# QA matrix for Logbook 1.0

Each row is a condition. Under each condition run the tasks in `docs/launch/common-tasks.md` that the row names (all of them when it says "all"). Use the TestFlight build, real iPhones, launched from the Home Screen, no debugger (Apple, "Testing a release build"; requirement QUA-60).

The automated half runs on every push (`.github/workflows/ci.yml`): the end-to-end flows and the accessibility scan in `packages/e2e` at 320 and 390 wide. This file is the half only a phone can do.

How to fill it in: copy the "Results" table at the bottom for each build and mark each row Pass, Fail (one line, plus the task id and a screenshot) or N/A. The owner of every row is the owner unless a tester is named.

## 1. Devices and iOS versions

The deployment target is iOS 17.0 (`docs/launch/decisions.md` D4). iPhone only, portrait only (D3).

| Id | Device | iOS | Why | Tasks | Owner |
|---|---|---|---|---|---|
| D1 | iPhone SE (2nd or 3rd generation), 375 points wide | newest it runs | smallest current screen, home button, no notch | all | Owner |
| D2 | A Dynamic Island iPhone, 390 or 393 points wide | newest | the class App Review uses | all | Owner |
| D3 | A Pro Max or Air, 430 or 440 points wide | newest | largest layout | all | Owner |
| D4 | Any iPhone | iOS 26 | previous major version | T1 to T4, T10, T11 | Owner |
| D5 | Any iPhone | iOS 18 | with iOS 26, 93 percent of iPhones (Apple, June 2026) | T1 to T4, T10, T11 | Owner |
| D6 | Simulator, smallest phone that runs iOS 17 | iOS 17.0 | the lowest version the target allows | T1 to T4 | Owner |
| D7 | iPad, in iPhone compatibility mode | newest | reviewers sometimes test on an iPad | T1, T2, T4, T12.1 | Owner |

### Widths

The audit took screenshots at 320 and 390 only. Every screen is checked at each of these widths, in the browser (Playwright, `packages/e2e`) and on the phones above:

| Width (points) | Where it comes from | Checked by |
|---|---|---|
| 320 | Larger Text on a small phone, and the narrowest web view | `packages/e2e` (automatic), owner with Display Zoom on D1 |
| 375 | iPhone SE, iPhone mini | D1 |
| 390 | iPhone 12 to 16 | `packages/e2e` (automatic), D2 |
| 430 | Plus and Pro Max (14 to 16) | D3 |
| 440 | iPhone 16 Pro Max and later | D3, owner in the browser at 440 x 956 |

The static pages (`/legal/privacy.html`, `health-privacy.html`, `terms.html`, `support.html` and `acknowledgements.html`) are also read at 320 wide with the text at 200 percent, in the in-app browser.

## 2. Install state

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| I1 | Fresh install (delete the app first; Keychain items survive a delete) | all | Owner |
| I2 | Update over the previous TestFlight build with data in the account | T4, T5, T9, T11.3 | Owner |
| I3 | Delete and reinstall while Apple Health was connected: Apple Health reads Connect | T11.3 | Owner |
| I4 | Launch signed out | T1, T2 | Owner |
| I5 | Launch with an expired session (sign out on the web, then open the app) | T2.2 | Owner |

## 3. Network

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| N1 | Wi-Fi | all | Owner |
| N2 | Cellular | T4, T10 | Owner |
| N3 | Network Link Conditioner, Very Bad Network | T4, T9.1, T10.1 | Owner |
| N4 | Airplane mode at launch, then on again: offline changes are sent | T4.2, T4.3, T9.1 | Owner |
| N5 | Airplane mode mid-action (a to-do add, a journal save, an assistant answer) | T4.3, T9.1, T10.1 | Owner |
| N6 | IPv6-only network (Mac Internet Sharing, NAT64) | T2.2, T4 | Owner |
| N7 | Server down: the app says so and keeps what was typed | T4.3, T9.1 | Owner |
| N8 | A request in flight when the app goes to the background | T9.1, T10.1 | Owner |

## 4. Interrupted flows

Background and return, and force-quit and relaunch, in the middle of each. Also an incoming call and a notification tap.

| Id | Flow | Tasks | Owner |
|---|---|---|---|
| F1 | The value pager and sign up | T1.1, T2.1 | Owner |
| F2 | Each onboarding step, the notification prompt, the plan build | T3 | Owner |
| F3 | An assistant answer mid-stream | T10.1 | Owner |
| F4 | Apple Health's first sync | T11.3 | Owner |
| F5 | Writing a journal entry; an open sheet with typed text | T9.1, T6.1 | Owner |
| F6 | The password reset link opened while the app is in the background | T2.3 | Owner |

## 5. Permissions

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| P1 | Notifications denied at the prompt; allowed then turned off in iOS Settings | T3.2, T11.4, T12.2 | Owner |
| P2 | Apple Health: all three off in Apple's sheet; one on; revoked later in the Health app | T11.3, T8.2 | Owner |
| P3 | Camera denied; Photos limited to a few photos; Save Image denied | T10.2, T9.3 | Owner |
| P4 | The assistant's permission step: Not now, then Allow later from the next AI action | T5.3, T10.1 | Owner |

## 6. Data edge cases

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| E1 | A new, empty account | all | Owner |
| E2 | A very long name, goal title and journal entry; emoji and right-to-left text | T4, T6, T9 | Owner |
| E3 | Hundreds of journal entries and to-dos | T4.3, T9 | Owner |
| E4 | A week with no sessions; a plan that has ended | T4.1, T5 | Owner |
| E5 | Midnight passes with the app open; a time zone change; daylight saving change; New Year | T4, T9.2 | Owner |

## 7. Device state

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| S1 | Low Power Mode | T4, T10.1 | Owner |
| S2 | Many apps opened, then back to Logbook: the web view is not blank | T4 | Owner |
| S3 | Very large photo and PDF attachments | T10.2 | Owner |
| S4 | Turning the phone: portrait holds with no glitch | T4, T10 | Owner |
| S5 | A hardware keyboard; a third-party keyboard | T9.1, T10.1 | Owner |
| S6 | Little free storage, then attach a photo and sync | T10.2, T11.3 | Owner |

## 8. Accessibility settings

One at a time, then the assistive technologies. A label is declared in App Store Connect only for a row where every task passed (QUA-41).

| Id | Setting | Tasks | Owner |
|---|---|---|---|
| A1 | Text size xSmall | all | Owner |
| A2 | Text size xxxLarge | all | Owner |
| A3 | Larger Accessibility Sizes AX3 | all | Owner |
| A4 | Larger Accessibility Sizes AX5 | all | Owner |
| A5 | Bold Text | all | Owner |
| A6 | Button Shapes | all | Owner |
| A7 | Reduce Transparency | all | Owner |
| A8 | Increase Contrast (with A5 and A7 on, as Apple's contrast check asks) | all | Owner |
| A9 | Differentiate Without Color, and the Grayscale color filter | all | Owner |
| A10 | Reduce Motion | all | Owner |
| A11 | VoiceOver | all | Owner |
| A12 | Voice Control ("Show numbers", "Show names", dictation in every field) | all | Owner |
| A13 | Switch Control | T1, T2, T4 | Owner |

## 9. Regions

The storefront is the United States, with miles and pounds and Monday weeks (D5), but people set their phones as they like.

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| R1 | 12-hour region; 12-hour region set to 24-hour | T4, T6.2, T12.2 | Owner |
| R2 | 24-hour region; 24-hour region set to 12-hour | T4, T6.2 | Owner |
| R3 | Week starts on Sunday in iOS Settings: Logbook weeks still start on Monday | T4.4, T5.2 | Owner |
| R4 | A non-Gregorian calendar (Buddhist, Japanese): dates and Apple Health days are right | T4, T9.2, T11.3 | Owner |
| R5 | A region with non-Latin digits (Arabic) | T4, T8 | Owner |

## 10. Review readiness

| Id | Condition | Tasks | Owner |
|---|---|---|---|
| V1 | The exact build submitted, on the newest iOS, signed in as the demo account in `docs/launch/review-notes.md` | all | Owner |
| V2 | Every link opens; no placeholder text; no "Draft" banner on the legal pages | T11.7 | Owner |
| V3 | The support and privacy addresses in App Store Connect load signed out | T11.7 | Owner |
| V4 | The server is up and sign up is open | T2.1 | Owner |

## Results

Copy this table for each build. Keep the newest build on top.

### Build: ____ (date ____)

| Id | Pass / Fail / N/A | Note |
|---|---|---|
| D1 | | |
| D2 | | |
| D3 | | |
| D4 | | |
| D5 | | |
| D6 | | |
| D7 | | |
| I1 | | |
| I2 | | |
| I3 | | |
| I4 | | |
| I5 | | |
| N1 | | |
| N2 | | |
| N3 | | |
| N4 | | |
| N5 | | |
| N6 | | |
| N7 | | |
| N8 | | |
| F1 | | |
| F2 | | |
| F3 | | |
| F4 | | |
| F5 | | |
| F6 | | |
| P1 | | |
| P2 | | |
| P3 | | |
| P4 | | |
| E1 | | |
| E2 | | |
| E3 | | |
| E4 | | |
| E5 | | |
| S1 | | |
| S2 | | |
| S3 | | |
| S4 | | |
| S5 | | |
| S6 | | |
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| A5 | | |
| A6 | | |
| A7 | | |
| A8 | | |
| A9 | | |
| A10 | | |
| A11 | | |
| A12 | | |
| A13 | | |
| R1 | | |
| R2 | | |
| R3 | | |
| R4 | | |
| R5 | | |
| V1 | | |
| V2 | | |
| V3 | | |
| V4 | | |
