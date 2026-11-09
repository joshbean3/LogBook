# Onboarding: what the research says, and what Logbook does with it

November 2026. Sources are linked; vendor and company-blog numbers are marked as such. Numbers that couldn't be confirmed were left out, including the often-quoted Duolingo "delay sign-up" figure and the claims that a priming screen lifts opt-in 2 to 3 times.

## What held up

| Finding | Source | In Logbook |
|---|---|---|
| Health and fitness flows run long (median 20.5 screens; Bevel 34). Long works when the questions visibly shape the result, with a progress bar and a reason under each question. | [Lazyweb](https://www.lazyweb.com/research/health-fitness-onboarding-length), [RevenueCat](https://www.revenuecat.com/blog/growth/why-your-onboarding-experience-might-be-too-short) (vendor) | Five questions at most. Each sub-line says what the answer is for. The block preview moves with the answers. |
| Showing progress already made raises persistence (endowed progress). | [Nunes & Drèze 2006](https://ideas.repec.org/a/oup/jconrs/v32y2006i4p504-512.html) | The setup bar opens with the account segment already filled. |
| A projected result that moves as you answer (Noom's goal date). Value shown right after the goal (Bevel). | [RevenueCat](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel), [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance) | Picking a race glides to race day and the block's shape: weeks, 22 to 35 mi, the taper. Read off the real `buildTemplate`, so it never promises a number the plan won't keep. |
| Visible work raises perceived value, but only when the work is real. Fake "analysing" delays read as manipulative. | [Buell & Norton 2011](https://ideas.repec.org/a/inm/ormnsc/v57y2011i9p1564-1579.html) | "Writing your plan": the steps the answers asked for, one beat each, held only until the plan is actually saved. A tap hurries it. |
| When and where plans help, modestly (d about 0.15 to 0.35 after bias correction). | [Konstanz 2025 re-analysis](https://kops.uni-konstanz.de/handle/123456789/69905) | Run days, the long-run day, wake and leave times, the nudge time. |
| Prompting a reminder time after first value: about 40% set one, and they retained about 3 times better. | [Amplitude on Calm](https://amplitude.com/blog/calm-increased-retention-amplitude) (vendor, 2016) | The nudge step, on the phone only: the notification previewed at the time it will arrive (alarm + 15 min). |
| Ask permission in context. The opt-out belongs in the app's own choice before the system alert. No incentives. | [HIG Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy), [App Review 5.1.1](https://developer.apple.com/app-store/review/guidelines/) | "Nudge me at 6:45" or "No nudges" is chosen first. Only "Nudge me" plus Continue triggers iOS's alert. |
| Haptics follow their documented meanings: selection when a value changes, success when a task completes. Keep them sparse. | [HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | Selection ticks on every choice and on each written step. One success when the plan lands. None on plain navigation. |
| Make setup skippable, resumable and kind to Reduce Motion. | HIG [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding), [Launching](https://developer.apple.com/design/human-interface-guidelines/launching), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Every step after the goal can be skipped. Answers persist per account, so a reload resumes the same step. Under Reduce Motion everything fades instead of moving. |

## Not done yet, on purpose

- Account after the plan ("Save your plan" at the end, as Duolingo does). This needs an anonymous, local-first session on the server. The value pager before the account softens it for now.
- Importing history from Apple Health or Strava to pre-fill weekly miles. Apple Health's sync is built (phase 2), but its first import runs on the phone after connecting. Pre-filling from it belongs with Settings → Apple Health, after the first Xcode build.
- A paywall. If one comes, it goes after the plan reveal, never before it.

## Flow

Runs for every new account, and once on every fresh install of the iOS app (an account that already has a plan gets it as a preview that saves nothing). Settings → Replay setup runs it any time, also as a preview.


1. Value pager, then privacy, then the account (unchanged).
2. Goal: chips, then race day and the block's shape.
3. Days and weekly miles, with the shape kept in view.
4. Wake and leave times, with what happens before the door.
5. Habits, as lights.
6. Morning nudge (iOS only).
7. How Logbook works: a page per part (to-dos, habits, goals, journal, learned, plan, progress, the ask bar), each with a looping demo of the real gestures and labels, and numbered steps lit as the demo plays them. Under Reduce Motion each demo holds its finished frame. Swipe or Next; Skip jumps to the plan.
8. Writing your plan, then the week and Today's first-run face, then the hand-off to Today.
