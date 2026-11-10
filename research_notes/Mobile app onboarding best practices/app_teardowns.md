# Onboarding teardowns: best-in-class health, fitness, habit and productivity apps

Research date: 2026-11-10. Evidence labels used throughout:
- **[Observed]**: screens seen in a recorded teardown or screen library (date given where the source gives one; many screen libraries such as ScreensDesign, Lazyweb and Reteno show no recording date, only a 2026 copyright footer).
- **[Company]**: claimed by the company itself or by a vendor case study it took part in.
- **[Third-party]**: an analyst, reviewer or blogger's claim or measurement.
- **[Inferred]**: my reasoning, not stated by a source.

A note on source quality: ScreensDesign "article" pages for Duolingo, Calm, Strava and Finch gave only 10 sample screens with generic captions and no order or dates, so they are thin. Their "showcase" pages (Noom, Bevel, Runna, Flo, Ladder) were more useful because they give timestamps within a recorded walkthrough. A search result citing a "funnel-researcher-dashboard.internal.trytwofold.com" page appeared twice with conversion claims (Noom loading screens, Headspace "38% drop-off" leading to 3 questions); it is an internal page of unknown provenance and I have **not** used it as evidence.

## Per-app flow summaries (what each app asks, when it asks for permissions/account/payment, first value, distinctive moves, results, criticism)

### Takeaway
The strongest flows fall into two camps: "value first" (Duolingo, Calm: a lesson or breath before the account, the paywall or reminders) and "long quiz, then plan reveal, then paywall" (Noom, Flo, Runna, Bevel, Fabulous, Ladder, Lose It!: 30 to 110+ screens that build a personalised plan, often with a projected date or result, right before a trial paywall). Hardware apps (Whoop, Oura) are an account-first setup checklist, and the "aha" is delayed by a calibration period of days.

### Cited Findings

#### Duolingo (language, habit benchmark)
- [Observed, undated ScreensDesign recording] The flow runs: splash, welcome, a Duo the owl mascot screen, then a speech bubble saying "Just 7 quick questions before we start your first lesson!", then language selection, a loading screen of Duo reading on a stack of books, progress-bar question screens, and a proficiency self-assessment. Monetisation screens come after these. — [ScreensDesign: Duolingo onboarding design](https://screensdesign.com/articles/duolingo-onboarding-design/)
- [Observed, 2026] A Russian-language UX and dark-pattern analysis says the account request comes only after the user picks a language, answers goal and level questions, and *finishes a lesson*. — [vc.ru (2026)](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov)
- [Third-party] A teardown says Duolingo does not ask you to sign up until after the first lesson, when it asks you to "save your progress". — [Medium: Product Breakdown](https://medium.com/product-breakdown/product-breakdown-3-learnings-from-the-duolingo-app-7cb4a2e15cb3)
- [Company, via third party] Taplytics quotes a Duolingo executive saying that letting users try a lesson before signing up raised sign-up metrics significantly (no number in the summary I saw; the page itself would not load because of redirects). — [Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding)
- [Third-party, unverified] Appcues says delaying signup alone produced a "20% lift in daily active users" and gives an ~8.9% free-to-paid rate. I found no Duolingo primary source for the 20% figure. — [Appcues: 10 best user onboarding experiences](https://www.appcues.com/blog/the-10-best-user-onboarding-experiences)
- [Company] Jorge Mazal (Head of Product from late 2017) says the growth turnaround began with retention work (fixing the "leaky bucket"), and Amplitude credits him with growing DAU about 4.5x. His Lenny's Newsletter post covers streaks, leaderboards and push notifications as the main levers, rather than onboarding. — [Lenny's Newsletter: How Duolingo reignited user growth](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth); [Amplitude AMA](https://amplitude.com/community/events/ama-jorge-mazal-duolingo.md)
- [Third-party] A UX Collective critique comparing the 2022 and 2024 flows says the later one is quicker to get through but packs more into the UI. (The page returned 403 to me, so this is from the search snippet only.) — [UX Collective: Duolingo's onboarding 2 years on](https://uxdesign.cc/duolingos-onboarding-2-years-on-3cbccad139f7)
- [Third-party, 2022 experiments, no numbers] A secondhand summary of an X thread names four 2022 retention experiments: a home-screen widget where Duo's expression changes as a lesson is put off, a streak app icon, commitment wording on the goal screen instead of "Continue", and a "Perfect Streak Week" celebration. No results are given. — [Lazyweb: Duolingo retention experiments](https://design.lazyweb.com/blog/duolingo-retention-experiments.md)

#### Noom (weight loss, the archetypal long quiz)
- [Observed] Screen counts differ by capture and version: 77 steps (ScreensDesign showcase), ~109 screens (Reteno), and "up to 113 screens taking 10–15 minutes" for the web-to-app funnel (RevenueCat). — [ScreensDesign: Noom](https://screensdesign.com/showcase/noom-weight-loss-food-tracker); [Reteno gallery](https://gallery.reteno.com/flows/app-screens-noom); [RevenueCat: web-to-app onboarding funnel](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel)
- [Observed] A dynamic goal timeline predicts a target weight-loss date at ~01:18 into the recording and is updated by later answers (~04:26). There are behavioural "sliders" for self-reflection (~03:26). After the quiz and a personalised plan preview comes a soft paywall: a 7-day free trial on a 2-month plan, a 15-minute countdown timer, and the price shown per week (~07:38). — [ScreensDesign: Noom](https://screensdesign.com/showcase/noom-weight-loss-food-tracker)
- [Third-party] A user account describes the projected date moving *earlier* as more answers are given. A growth blog argues that showing a predicted weight on a specific date uses the endowment effect; that is the blog's interpretation. — [Ageist](https://www.ageist.com/wellness/health/a-new-member-of-the-noom-community/); [Growth Classics: Noom](https://growthclassics.beehiiv.com/p/noom-3-7-billion-weight-loss-story)
- [Third-party estimates, conflicting] ScreensDesign's page gives both "$500K/mo, 35K downloads" and "$900K/mo, 45K installs". Treat as rough. — [ScreensDesign: Noom](https://screensdesign.com/showcase/noom-weight-loss-food-tracker)

#### Headspace (meditation)
- [Company/partner, experiment page with April 2026 screenshots] Irrational Labs, Headspace and Purchasely tested five onboarding variants on new free-trial users. A short personalisation quiz before the course recommendation ("perceived fit") raised course starts from ~31.25% (control) to 62.97%. The quiz alone, against recommending the same Basics course with no questions, added +7.6 percentage points. A precommitment variant (plan when, where and how you will meditate) raised app opens by 7.5% and unique app-open days by 4%. **However**, no variant produced a statistically significant change in active meditation days, the precommitment effect faded after 2 to 3 days, and personalised courses did not beat the default Basics course. Reasons given: returning users landed on a generic Today page and could not find their course (a one-tap "return to course" modal was cut); new users expected short breathing exercises, not guided courses; and matching over-weighted sleep content even though stress and anxiety were the top needs chosen. — [Irrational Labs: How we doubled Headspace course starts](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- [Company] Headspace's own redesign write-up describes a "contextualized onboarding flow" built from a qualitative study of why people come to Headspace. No metrics were given. — [Appcues GoodUX: Headspace's redesign](https://goodux.appcues.com/blog/headspaces-redesign-is-a-beautiful-expansion-of-the-core-product)
- [Company/vendor] Phiture reports +109% week-1 retention, +49% paid conversions within one day and +26% new-user activation from in-app messaging and lifecycle work. That was CRM work, not an onboarding redesign. — [Phiture: Headspace retention](https://phiture.com/success-stories/headspace-retention/)
- [Third-party] Teardowns describe the subscribe screen appearing before the user gets to use the app. A reviewer quoted on Substack objected to being asked to pay before a single session. — [Tear Them Down: Headspace](https://tearthemdown.substack.com/p/headspace); [Nextleap teardown PDF](https://assets.nextleap.app/submissions/Headspace-compressed.pdf-7f007c58-5fa9-4f76-b8f7-2e884e8169d7.pdf)
- [User reviews, 2026 roundup] "Headspace was great when it had a meaningful free tier. Now you can barely try it before hitting the paywall." Google Play summaries say "most features locked behind a paywall". — [Unstar: mental health app reviews 2026](https://unstar.app/ar/blog/mental-health-app-reviews-what-users-say-about-wellbeing-apps-2026); [Kimola Google Play report](https://kimola.com/reports/headspace-review-report-insights-on-user-feedback-google-play-en-145375)
- [Company, podcast] Headspace staff discussed optimising revenue by gating content on RevenueCat's Sub Club podcast. I did not get the details. — [Sub Club: How Headspace optimized revenue by gating content](https://chartable.com/podcasts/sub-club-1538057974/episodes/143824474-how-headspace-optimized-revenue-by-gating-content-shreya-oswal-and-keya-patel-headspace)

#### Calm (meditation, sleep)
- [Third-party, older] The first-time experience is described as an intro screen, then a breathing exercise, then a short guided meditation, so value comes in the first minute. Amplitude's 2016 article on measuring onboarding uses this flow as its example. — [Amplitude: 4 steps to measure user onboarding (Dec 2016)](https://amplitude.com/blog/2016/12/06/4-steps-to-measure-user-onboarding)
- [Observed, undated] The ScreensDesign sample shows soft blue-to-purple gradients, standard iOS permission prompts over blurred gradients (no custom priming screen visible), a minimalist account creation screen, and paywall and purchase screens late in the sequence. — [ScreensDesign: Calm onboarding design](https://screensdesign.com/articles/calm-onboarding-design/)
- [Company/vendor] **Reminder priming after first value:** Calm tested a screen shown right after the first meditation that encourages setting a Daily Reminder. About 40% of users who saw it opted in. Those users showed ~3x retention, the same lift as users who had found reminders on their own, which Calm read as evidence the effect is causal. Amplitude's Alicia Shiu says the lift held at 12+ weeks and in weekly and monthly retention. Calm then rolled the prompt out widely. (The post is undated; it is commonly cited from around 2016 to 2017.) — [Amplitude: How Calm increased retention 3x](https://amplitude.com/blog/calm-increased-retention-amplitude.md)

#### Fabulous (habits, routines)
- [Third-party, dated 6 March 2023] Jason Hreha's screen-by-screen critique lists: App Store page, then science, authority and user-count claims, then a behavioural science explainer, then a lifestyle questionnaire (sleep, energy, fitness, time, support, distractibility, finances), then a "kitchen sink" goal menu, then a "personal journey" results screen, then a share-your-plan prompt, then account setup (name, age, wake time, email), then a **fingerprint commitment contract**, then a **free trial paywall before entering the app**, then a "future self" letter, then referral source, then a Duke study claim, then a "Mountains" three-level journey (praised), then notifications opt-in with loaded wording ("manipulative"), then the first habit ("drink water") with a video and tutorial, then an implementation-intention prompt, then a gratitude prompt that pre-fills a message recruiting friends ("spammy growth hack"). — [The Behavioral Scientist: Fabulous product critique](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- [Third-party] Screen counts: "20+" (Medium) and "42 onboarding screens" (Adapty). ScreensDesign puts the paywall after the quiz and the signed contract, at ~03:05 into the recording. — [ScreensDesign: Fabulous](https://screensdesign.com/showcase/fabulous-daily-habit-tracker); [Adapty: How to fix your onboarding flow](https://adapty.io/blog/markdown/how-to-fix-your-onboarding-flow.md)
- [Company/vendor] A Firebase case study says users given a customised onboarding returned to the app twice as often as users on the generic flow. — [Firebase: Fabulous case study (PDF)](https://firebase.google.cn/downloads/Firebase_Fabulous_Case_Study.pdf?hl=it)
- [Company] Google Design library features on Fabulous's engagement design. — [Google Design: Fabulous](https://design.google/library/fabulous-motivating-app-engagement)
- [User] A Product Hunt commenter: the commitment contract step "freaks me out… it looks creepy." — [Product Hunt: Fabulous](https://www.producthunt.com/p/fabulous/fabulous-for-ios-2?page=2)
- [Third-party] Hreha argues a long, tedious flow may filter out unmotivated users, so the app gets credit for motivation people already had. — [The Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)

#### Finch (self-care pet)
- [Observed, undated] Reteno logs a flow of 30+ steps with a free trial and a welcome gift or discount offer. — [Reteno: Finch](https://gallery.reteno.com/flows/app-screens-finch)
- [Observed, undated] The sequence includes picking an egg (a cracked green egg), a celebratory hatch screen with a radial sunburst, choosing the pet's pronouns, naming the "baby birb", and picking a personality trait. Then the pet (e.g. "Piper") asks for the user's name in a chat UI. A chat screen asks "What is self-care?" with multiple choices. A mascot loading screen says personalised goals are being generated. "Unlock Pro" prompts appear from about 0:49 in one recording. — [ScreensDesign: Finch onboarding](https://screensdesign.com/articles/finch-app-onboarding-design/); [Lazyweb: Finch onboarding](https://lazyweb.com/canvas/flows/finch/onboarding); [ScreensDesign: Finch showcase](https://screensdesign.com/showcase/finch-self-care-pet)
- [Third-party] A reviewer says a new user can set up a pet and start a first self-care "journey" within five minutes. — [Engadget](https://www.engadget.com/apps/this-self-care-virtual-pet-is-helping-me-get-my-act-together-160027169.html)
- [Third-party, Feb 2026] A Pratt design critique of the iOS app exists, but I did not read it. — [Pratt IxD: Finch critique](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/)

#### Strava (social fitness)
- [Observed, undated, thin] The ScreensDesign sample shows a splash and sign-up modal, a promotional overlay and a marketing screen with a social-feed mockup, a route discovery modal, a dark account creation screen, authentication verification, a profile form (name, birthday, gender), and a "Tell us who you are" screen. **Account creation comes early**, before any recording. The teardown argues that background-location access should be explained before the system dialog and that privacy and visibility choices should be kept apart. — [ScreensDesign: Strava onboarding design](https://screensdesign.com/articles/strava-onboarding-design/)
- [Company] Strava's growth team tracks install and signup rate, retention and "upload activity rate". One published experiment tested inviting friends from the activity detail view. — [Strava Design: How we design for growth](https://medium.com/strava-design/designing-for-growth-7d95fdddb9d7)
- [Company, secondhand podcast summary] Co-founder Mark Gainey says ~99% of growth has been organic and that Strava puts engagement ahead of growth. — [Terra podcast with Mark Gainey](https://landing-cf.tryterra.co/podcast/podcast-with-mark-gainey-co-founder-of-strava-97bfd4bd85e9)

#### Bevel (all-in-one health, AI coach)
- [Observed, undated] ScreensDesign records **34 onboarding steps**. Early on it asks what the user wants to improve, then immediately shows how Bevel will help (~01:19). A soft paywall with a free trial comes after onboarding (~04:51): three key benefits and a discount on the annual plan. The dashboard then starts **completely blank** (~05:11), which the teardown flags as demotivating. The mood logger has a morphing animation as you slide between emotions, there are light and dark themes, and "Learn More" overlays add context. The page gives conflicting revenue estimates ($750K/mo vs $200K/mo). — [ScreensDesign: Bevel](https://screensdesign.com/showcase/bevel-health-performance)
- [Third-party] Health and notification requests are framed around user benefit, and the paywall comes late, after goal setting. (This is a search summary of the same page.) — [ScreensDesign: Bevel](https://screensdesign.com/showcase/bevel-health-performance)
- [User/Company, Reddit] The Apple Health sheet asks for both read and write access, and users easily miss one of them. Bevel replied that it needs both, and that Health data is not processed on its servers unless the user opts into "Bevel Intelligence". — [r/bevelhealth mirror](https://redlib.groet-infra.nl/r/bevelhealth)
- [Company, release notes] A fix addressed onboarding getting stuck on the **Location permission** screen after the permission had already been answered. This confirms that location is asked during onboarding. — [App Store: Bevel](https://apps.apple.com/il/app/id6456176249)

#### Whoop (wearable)
- [Company] The first **4 days** are calibration: the recovery score is greyed out while Whoop learns the user's normal range. The developer API exposes a `user_calibrating` flag. — [Whoop podcast 40](https://www.whoop.com/at/en/thelocker/podcast-40-whoop-recovery-maximize-readiness/); [Whoop trials page](https://ww2.whoop.com/whoop-trials/); [Whoop developer docs](https://developer.whoop.com/docs/tutorials/get-current-recovery-score)
- [Third-party/community] A full baseline takes about 30 days, and the first Monthly Performance Assessment arrives after 30 days. Healthspan figures conflict (21 logged nights, or 90 days). — [Whoop community](https://community.whoop.com/t/how-long-does-it-take-for-whoop-to-learn-your-baseline-metrics/359); [Pinkbike review](https://www.pinkbike.com/news/review-6-months-tracking-recovery-and-strain-with-the-whoop-strap.html); [Whoop community: Healthspan](https://www.community.whoop.com/t/how-long-does-it-take-for-healthspan-to-calibrate-unlock/471)
- [Third-party] Digital Trends: the setup gives "much more guidance than you'll find when you strap on an Apple Watch or Galaxy Watch for the first time." A guide says setup asks you to personalise sleep and activity goals. — [Digital Trends](https://digitaltrends.com/mobile/i-wore-whoop-4-fitness-tracker-for-a-month-why-im-quitting-it); [CreateSell: Whoop app](https://createsell.com/blog/whoop-app)

#### Oura (smart ring)
- [Company, help docs] The flow is: create account, verify email, set password (optional Face ID or Touch ID), then pair the ring, then personalise the app. Country of residence matters for some features. — [Oura partner support: Member onboarding](https://partnersupport.ouraring.com/hc/en-us/articles/28560644825491-Member-Onboarding-and-Consenting-Data); [Oura support](https://support.ouraring.com/hc/articles/360058634153)
- [Third-party, July 2025] Costco support: setup "took me less than 15 minutes on an iPhone." — [Costco: Discovering Oura](https://productsupport.costco.com/customer/article/discoveringoura)
- [Third-party, may be stale] Membership is required to see health data: one month free, then $5.99/mo or $69.99/yr. — [AppFind guide](https://appfind.beehiiv.com/p/oura-ring-complete-setup-guide-track-your-health-like-a-pro-even-if-you-re-new-to-fitness-tech)

#### Runna (running plans)
- [Observed, Revyl Atlas map, undated] The flow order is: **email/password sign-up first**, then race goal, then ability, date of birth, gender and injuries, then time goal, then training days, free days and long-run day, then **notifications permission (mid-quiz)**, then plan start, units, preferences and interests, then an optional strength add-on (ability, goal, duration, frequency, days, equipment), then a **plan summary**, then the **paywall (skippable in the mapped run)**, then plan generation, a coach welcome, a guide to run types, terms, and home. — [Revyl Atlas: Runna](https://revyl-landing.pages.dev/atlas/runna/report/)
- [Observed] ScreensDesign says the quiz goes deep (weekly availability, how hilly local routes are) and the paywall sits at the end of the quiz with a free trial, offering Annual ("SAVE 50%") and Monthly. The post-onboarding plan intro shows **estimated race times** and a guide to four run types, each with a coach video. — [ScreensDesign: Runna](https://screensdesign.com/showcase/runna-running-training-plans)
- [Third-party] A UX Collective / Growth Dives case study counts **~30 screens before the plan appears** on the home screen. (The page returned 403 to me; this is from the search snippet.) — [UX Collective: How to nail onboarding, a case study of Runna](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202)
- [User post, unverified] A 14-day trial. — [Indie Hackers](https://www.indiehackers.com/post/runna-referral-code-2026-how-to-unlock-your-2-week-free-trial-f16b7f0a42)
- [Company/vendor] RevenueCat says Runna grew 30x year over year. Runna turned to in-app subscriptions after Apple rejected its plan to link out to web payments. — [RevenueCat/Runna case study](https://www.casestudies.com/company/revenuecat/case-study/how-revenuecat-helped-runna-reach-30x-year-over-year-growth)

#### Ladder (strength training)
- [Company] "After a short matching quiz, members join one of 19 coach-led programs called 'teams'." There is a 7-day free trial with "no payment info collected upfront". — [Ladder llms.txt](https://www.joinladder.com/llms.txt)
- [Observed] A ScreensDesign 12-minute walkthrough (113 screens captured across the app) notes that the quiz frames the journey around finding the right "team" (~00:56) instead of setting preferences, with "Unlock Pro" paywall screens. It estimates ~$4.3M/mo revenue. — [ScreensDesign: Ladder](https://screensdesign.com/showcase/ladder-strength-training-plans)

#### Flo (cycle tracking)
- [Company, June 2024] Flo's engineering blog says onboarding accounts for **"40% revenue"** (60M+ MAU). Flo moved onboarding from screens built into the app to a server-driven DSL so it can iterate quickly. — [Flo Health engineering: Mobile onboarding evolution part 1](https://medium.com/flo-health/mobile-onboarding-evolution-part-1-cfc9702835ce)
- [Observed] Length: ~70 screens and ~7 min (Dev.to), 55 steps (ScreensDesign), ~12 min in a March 2026 run (Notion teardown). A paywall comes after the quiz (~04:22) and is yearly-first, with monthly and family plans further down. — [ScreensDesign: Flo](https://screensdesign.com/showcase/flo-period-pregnancy-tracker); [Dev.to: health and fitness paywalls](https://dev.to/paywallpro/effective-paywall-examples-in-health-fitness-apps-2025-3op9); [Notion 2026 teardown](https://florentine-carob-c8a.notion.site/Scale-vs-Sentiment-A-2026-Strategic-Teardown-of-Flo-Health-3303f51528b2803c9e0ce3cb5f4ebc63)
- [Third-party, April 2026] RevenueCat says Flo replaced its "Enable free trial" toggle with an explicit 14-day free trial plan option on its multi-plan paywall. (Apple has been tightening rules on toggle paywalls.) — [RevenueCat: RIP toggle paywall](https://www.revenuecat.com/blog/growth/r-i-p-toggle-paywall-we-hardly-knew-ye/)
- [Third-party, July 2026] Lazyweb detected 52 Flo experiments, only 6 of them on the paywall, so most iteration happens in the core tracking loop. — [Lazyweb: Flo experiments](https://www.lazyweb.com/research/flo-health-app-experiments)

#### Lose It! (calorie tracking)
- [Observed] Lazyweb captures a plan-selection card (e.g. "Steady") with a daily calorie target, expected weekly loss and estimated weeks to goal, plus a goal-weight picker that has a bottom sheet recommending a minimum goal weight. Screen counts: ~70 (Lazyweb) and ~109, with 32 "warm-up" screens before any data collection (a community spreadsheet). — [Lazyweb: Lose It! onboarding](https://lazyweb.com/canvas/flows/lose-it/onboarding); [Community teardown sheet](https://docs.google.com/spreadsheets/d/1U-7hIIW_i271YPgiyx6_6HTASppWa_u2mYjOR8FVCh4/edit)
- [Third-party, older] The user picks a weekly loss rate (0.5 to 2 lb), and the calorie budget adjusts to give a projected goal date. — [Healthcare IT Today](https://www.healthcareittoday.com/?p=27877)

#### Todoist (productivity)
- [Company talk, 2021] Doist removed 2 steps to simplify onboarding. What remains includes a theme choice and a welcome screen, and the presenter's lesson is: "Don't let your users start from a blank page." — [Speaker Deck: How Todoist redesigned its user onboarding](https://speakerdeck.com/fmerian/how-todoist-redesigned-its-user-onboarding)
- [Third-party hypotheses, not measured] A GrowthX project proposes "task created within first 5 minutes" and "task completed within 48 hours" as activation signals. — [GrowthX: Todoist onboarding project](https://growthx.club/proof-of-work/consultancy/todoist/onboarding-project-----todoist|67436d5e3bc9d41985ac7ef5)

#### Things 3 (productivity)
- [Company] On first launch Things creates a tutorial project ("Meet Things" on Mac, "Meet Things iOS" on iPhone and iPad) that you learn from by doing its to-dos. It can be recreated later from settings. No account is needed (sync is optional through Things Cloud). — [Cultured Code support: recreate tutorial](https://culturedcode.com/things/support/articles/2803553/)
- [Third-party] Reviewers found the deadline flag icon confusing at first and say onboarding is "a bit challenging without prior experience". — [Medium: Things 3 review](https://medium.com/the-extratextual/things-3-e8f2f704b662); [The Digital Project Manager (FR)](https://thedigitalprojectmanager.com/fr/tools/avis-things-3/)

#### Streaks (habits)
- [Company, App Store] Streaks reads Health data "with your permission to determine completion of your tasks", so Health-linked tasks (steps, water, etc.) complete automatically. — [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)

### Inferences
- [Inferred] The "long quiz" apps (Noom, Flo, Runna, Bevel, Fabulous, Lose It!, Finch) all pay for length with a **visible output**: a date, a plan, race times, a calorie budget or a hatched pet. Length on its own is not the pattern; length that ends in a reveal is.
- [Inferred] Hardware apps cannot deliver their core metric on day one (Whoop's 4-day calibration). Their onboarding should therefore set expectations and give a lesser first win (e.g. first sleep logged) rather than promise an immediate score.
- [Inferred] Productivity apps without subscriptions or quizzes (Things, Todoist) avoid the blank page by seeding content, through a tutorial project or a template.

### Gaps
- No dated, complete 2025–26 screen-by-screen captures for Calm, Headspace, Strava, Oura, Todoist, Streaks or Apple Fitness+ were readable. ScreensDesign article pages show only 10 unordered screens; Mobbin and Page Flows are behind logins.
- Apple Fitness+: not researched (time budget).
- Ladder: exact paywall step position not found.
- Duolingo: no primary-source number for the delayed-signup lift. The 20% DAU figure from Appcues is unverified.
- Strava: no detail on when location, notifications or Health/contacts are requested in the current flow, or on how the Strava subscription trial is pitched during onboarding.

## Steps before core value, account and paywall

### Takeaway
Value-first apps reach core value in about 8 to 12 screens (Duolingo's 7 questions then a lesson, Calm's breath in screen 2), before any account or paywall. Quiz-first apps run 30 to 110+ screens and put the paywall after the plan reveal, at roughly the last quarter or the final step of onboarding. Strava, Runna and Oura ask for an account first.

### Cited Findings
- Duolingo: "7 quick questions", then the first lesson; the account comes after the lesson ("save your progress"). — [ScreensDesign](https://screensdesign.com/articles/duolingo-onboarding-design/); [vc.ru 2026](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov)
- Calm: intro, then breathing exercise, then a short meditation, before the account and paywall (older description). — [Amplitude 2016](https://amplitude.com/blog/2016/12/06/4-steps-to-measure-user-onboarding)
- Runna: account first, ~30 screens before the plan, and the paywall right after the plan summary but *before* plan generation and home. — [Revyl Atlas](https://revyl-landing.pages.dev/atlas/runna/report/); [UX Collective](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202)
- Noom: 77 to 113 screens; the paywall is at ~7:38 of the recording, after the plan preview. — [ScreensDesign](https://screensdesign.com/showcase/noom-weight-loss-food-tracker); [RevenueCat](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel)
- Bevel: 34 steps, then paywall (~4:51), then a blank dashboard. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Fabulous: the account comes after a long quiz, then the contract, then the paywall before entering the app. — [Behavioral Scientist 2023](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Flo: 55 to 70 screens; paywall ~4:22. — [ScreensDesign](https://screensdesign.com/showcase/flo-period-pregnancy-tracker)
- Benchmark [Third-party, July 2026, ~800-app corpus]: across Lazyweb's sample the first paywall is at a mean absolute step of 14.3 (median 11), and 27.5% (11 of 40) put it on the literal last onboarding step. Category leaders put it at a relative position of 0.75 versus 0.91 for challengers (only 12 vs 10 paywalled flows, so directional). — [Lazyweb: Ladder/paywall step research](https://experiments.lazyweb.com/research/how-many-steps-before-the-paywall-in-onboarding.md); [Lazyweb: Do category leaders paywall earlier?](https://experiments.lazyweb.com/research/do-category-leaders-paywall-earlier.md)

### Inferences
- [Inferred] "Paywall after the plan reveal, before the plan is usable" (Runna, Noom, Flo) is the dominant subscription pattern. The plan works as the endowed object the user is asked to unlock.

### Gaps
- Most screen counts come from different captures and versions and disagree (Noom 77/109/113; Lose It! 70/109; Flo 55/70). Reliable time-to-value in seconds is rarely published.

## Personalisation questions and whether answers visibly change the product

### Takeaway
The best flows turn answers into a concrete artefact on screen: Noom's goal date that moves as you answer, Lose It!'s weeks-to-goal card, Runna's plan summary and estimated race times, Ladder's team match, Finch's generated goals, Fabulous's "personal journey". Headspace's controlled test shows that a quiz increases *starts* through perceived fit even when the recommendation is no better than the default, but it does not by itself change downstream behaviour.

### Cited Findings
- Noom's projected date adjusts with answers. — [ScreensDesign](https://screensdesign.com/showcase/noom-weight-loss-food-tracker); [Ageist](https://www.ageist.com/wellness/health/a-new-member-of-the-noom-community/)
- Lose It!: pace choice drives the calorie budget and goal date; a "Steady" plan card shows weeks to goal. — [Lazyweb](https://lazyweb.com/canvas/flows/lose-it/onboarding); [Healthcare IT Today](https://www.healthcareittoday.com/?p=27877)
- Runna: race goal, ability, injuries, time goal, days, terrain, then a plan summary and estimated race times. — [Revyl Atlas](https://revyl-landing.pages.dev/atlas/runna/report/); [ScreensDesign](https://screensdesign.com/showcase/runna-running-training-plans)
- Ladder: the quiz is framed as matching you to one of 19 coach-led "teams". — [Ladder](https://www.joinladder.com/llms.txt); [ScreensDesign](https://screensdesign.com/showcase/ladder-strength-training-plans)
- Bevel: "what do you want to improve" is answered immediately with how Bevel will help. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Headspace: the quiz doubled course starts (31% to 63%) and +7.6pp came from the quiz alone with the same course; personalised courses did not beat Basics; no lift in meditation days. — [Irrational Labs](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- Fabulous: customised onboarding gave 2x returns (Firebase case study) [Company/vendor]. — [Firebase](https://firebase.google.cn/downloads/Firebase_Fabulous_Case_Study.pdf?hl=it)
- Critique: Fabulous asks intrusive lifestyle questions without explaining why. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)

### Inferences
- [Inferred] "Perceived fit" (the feeling that the plan was made for me) drives starts and conversion. Real product changes, and getting users back to their plan the next day, drive retention. A flow needs both.

### Gaps
- No public data isolating the conversion effect of a *moving* projected date (Noom-style) versus a static plan.

## Permission requests: which, when, and with what priming

### Takeaway
The evidence-backed pattern is to ask for reminders or notifications **after first value**, framed as part of the habit (Calm: ~40% opt-in, 3x retention). Many quiz apps ask mid-onboarding instead (Runna mid-quiz, Fabulous with loaded "success" wording, Bevel asking for Health and Location during onboarding). Health permission sheets cause confusion over read/write toggles.

### Cited Findings
- Calm: a reminder prompt after the first session gave ~40% opt-in and 3x retention, held at 12+ weeks [Company/vendor]. — [Amplitude](https://amplitude.com/blog/calm-increased-retention-amplitude.md)
- Runna: notifications are asked mid-quiz, after training days and before plan start [Observed]. — [Revyl Atlas](https://revyl-landing.pages.dev/atlas/runna/report/)
- Fabulous: the notification opt-in uses wording that ties notifications to success, which the critic calls manipulative [Third-party 2023]. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Bevel: Health and Notifications are framed around benefit. The Health sheet's read and write toggles are easily missed. Location is asked in onboarding (a release-note bug fix confirms it). — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance); [r/bevelhealth](https://redlib.groet-infra.nl/r/bevelhealth); [App Store](https://apps.apple.com/il/app/id6456176249)
- Strava teardown advice: explain background location before the system dialog; don't bundle permissions into one growth sequence [Third-party]. — [ScreensDesign: Strava](https://screensdesign.com/articles/strava-onboarding-design/)
- Calm sample screens show native iOS prompts over gradients with no visible custom pre-prompt [Observed, undated]. — [ScreensDesign: Calm](https://screensdesign.com/articles/calm-onboarding-design/)
- Streaks requests Health access so tasks can complete automatically, a clear value exchange [Company]. — [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)
- Oura: the data consent step is part of account setup and pairing [Company]. — [Oura partner support](https://partnersupport.ouraring.com/hc/en-us/articles/28560644825491-Member-Onboarding-and-Consenting-Data)

### Inferences
- [Inferred] The Health permission works best when tied to a visible payoff on the next screen (Streaks' auto-complete, Bevel's dashboard). Bevel's blank dashboard after the paywall undercuts that payoff.

### Gaps
- No current data on Duolingo's notification pre-prompt timing or wording, or Strava's location and Health timing. No published opt-in rates for Health permission priming.

## Account creation timing

### Takeaway
Value-first apps defer the account until after the first win (Duolingo: after the first lesson, framed as "save your progress"; Things: no account at all). Quiz apps place the account late in the quiz, just before the contract or paywall (Fabulous), or right at the start (Runna, Strava, Oura).

### Cited Findings
- Duolingo: the account comes after the first lesson; an executive says this raised sign-ups significantly [Company via third party]. — [Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding); [Medium](https://medium.com/product-breakdown/product-breakdown-3-learnings-from-the-duolingo-app-7cb4a2e15cb3)
- Runna: email/password is the first step [Observed]. — [Revyl Atlas](https://revyl-landing.pages.dev/atlas/runna/report/)
- Strava: sign-up modal, account creation and verification come early, before profile fields [Observed]. — [ScreensDesign: Strava](https://screensdesign.com/articles/strava-onboarding-design/)
- Oura: account, email verification and password come before pairing [Company]. — [Oura support](https://partnersupport.ouraring.com/hc/en-us/articles/28560644825491-Member-Onboarding-and-Consenting-Data)
- Fabulous: the account comes after the quiz and plan, before the contract and paywall [Third-party 2023]. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Things 3: local-first, with a tutorial project on first launch and no account needed [Company]. — [Cultured Code](https://culturedcode.com/things/support/articles/2803553/)

### Inferences
- [Inferred] Account-first works when the account is needed straight away (syncing a device or connecting watch data for Strava, Oura, Runna). Otherwise deferral backed by "save your progress" is the safer default.

### Gaps
- No published A/B data beyond Duolingo's on account timing in health and fitness specifically. Guest-mode details for Headspace, Calm and Noom are not confirmed.

## First win / aha moment and speed

### Takeaway
The fastest wins are experiential: Duolingo's first lesson, Calm's breath in the first minute, Finch's egg hatching and the pet saying your name. Plan apps deliver a "symbolic" win (the plan or date reveal) within minutes and defer the real win (first run or meal logged). Wearables deliver the core metric only after calibration.

### Cited Findings
- Duolingo's first lesson comes before signup. — [vc.ru 2026](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov)
- Calm: breathing exercise, then a short meditation, at first open. — [Amplitude 2016](https://amplitude.com/blog/2016/12/06/4-steps-to-measure-user-onboarding)
- Finch: hatch celebration, naming, and the pet asking for your name; setup takes under 5 minutes. — [ScreensDesign](https://screensdesign.com/articles/finch-app-onboarding-design/); [Engadget](https://www.engadget.com/apps/this-self-care-virtual-pet-is-helping-me-get-my-act-together-160027169.html)
- Runna: plan summary, then estimated race times and coach videos. — [ScreensDesign](https://screensdesign.com/showcase/runna-running-training-plans)
- Whoop: recovery is greyed out for 4 days. — [Whoop](https://www.whoop.com/at/en/thelocker/podcast-40-whoop-recovery-maximize-readiness/)
- Bevel: the blank dashboard after onboarding is flagged as demotivating. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Fabulous: the first habit is "drink water", a deliberately tiny win, plus a bedside water bottle task. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Generic benchmark (unverified vendor post): a minimum 40%+ first-workout completion. — [Dev.to fitness onboarding guide](https://dev.to/paywallpro/fitness-app-onboarding-guide-data-motivation-completion-an0)

### Inferences
- [Inferred] For a health app that reads Apple Health, backfilling historical data at connect time is the obvious way to avoid Bevel's blank dashboard and Whoop's calibration wait. No source here measured that, though.

### Gaps
- Measured time-to-aha (in seconds) is not published for any of these apps.

## Tutorial style

### Takeaway
Carousels are mostly gone from the best flows. They are replaced by learning by doing (Duolingo's lesson, Things' "Meet Things" project, Calm's breath), conversational mascot chat (Finch, Duolingo's Duo speech bubbles), and post-paywall contextual guides (Runna's run-types guide with coach videos, Bevel's "Learn More" overlays).

### Cited Findings
- Things 3: a tutorial project made of to-dos. — [Cultured Code](https://culturedcode.com/things/support/articles/2803553/)
- Finch: chat-style dialogue with the pet. — [Lazyweb](https://lazyweb.com/canvas/flows/finch/onboarding)
- Duolingo: Duo speech bubbles, a loading illustration and a progress bar. — [ScreensDesign](https://screensdesign.com/articles/duolingo-onboarding-design/)
- Runna: coach welcome and run-types guide with coach videos after plan generation. — [Revyl Atlas](https://revyl-landing.pages.dev/atlas/runna/report/); [ScreensDesign](https://screensdesign.com/showcase/runna-running-training-plans)
- Bevel: "Learn More" overlays. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Fabulous: a video plus a tutorial for the first habit; the UI was found confusing. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Todoist: "Don't let your users start from a blank page." — [Speaker Deck](https://speakerdeck.com/fmerian/how-todoist-redesigned-its-user-onboarding)

### Inferences
- [Inferred] Tutorials have moved to *after* the paywall in subscription apps, which keeps the pre-paywall flow focused on building the plan.

### Gaps
- Coach-mark usage in the current Todoist and Strava apps was not confirmed.

## Motion, haptics, mascots, celebration and tone

### Takeaway
Mascots and characters carry tone in the most-loved flows (Duolingo's Duo, Finch's birb). Celebration moments (Finch's hatch sunburst, Duolingo's streak celebrations) mark the first win. Calm uses slow gradients and serene minimalism to put the user in the product's emotional state during onboarding itself. Bevel uses morphing micro-interactions. I found no source that documents haptics specifically.

### Cited Findings
- Duolingo: Duo illustrations and dark-theme progress screens; a "Perfect Streak Week" celebration and a widget where Duo's face changes as a lesson is put off (2022). — [ScreensDesign](https://screensdesign.com/articles/duolingo-onboarding-design/); [Lazyweb](https://design.lazyweb.com/blog/duolingo-retention-experiments.md)
- Finch: hatch screen with radial sunburst; warm, conversational tone; mascot loading screen. — [ScreensDesign](https://screensdesign.com/articles/finch-app-onboarding-design/); [Lazyweb](https://lazyweb.com/canvas/flows/finch/onboarding)
- Calm: soft blue-to-purple gradients, serene minimalism. — [ScreensDesign](https://screensdesign.com/articles/calm-onboarding-design/)
- Bevel: morphing mood-slider animation, light and dark themes. — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance)
- Fabulous: an emotive "future self" letter and a commitment contract signed with a fingerprint; some users find it creepy. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding); [Product Hunt](https://www.producthunt.com/p/fabulous/fabulous-for-ios-2?page=2)
- Finch caution [Third-party]: copying the pet or reward currency without a real self-care loop can feel manipulative. — [ScreensDesign: Finch showcase](https://screensdesign.com/showcase/finch-self-care-pet)

### Inferences
- [Inferred] Static teardowns cannot capture haptics; their absence from the sources reflects the method, not the apps.

### Gaps
- No documented haptic patterns for any of the apps. Primary-source motion specs are not public.

## Published results (labelled)

### Takeaway
Few rigorous public numbers exist. The most credible are Calm's reminder prompt (3x retention, ~40% opt-in), Headspace/Irrational Labs (course starts doubled, no change in meditation), Fabulous via Firebase (2x return with customised onboarding) and Flo (onboarding = 40% of revenue). Duolingo's delayed-signup lift is often quoted but has no primary number I could find.

### Cited Findings
- Calm, reminder after first session: ~40% opt-in, 3x retention [Company/vendor, Amplitude]. — [Amplitude](https://amplitude.com/blog/calm-increased-retention-amplitude.md)
- Headspace quiz: course starts 31.25% to 62.97%; quiz alone +7.6pp; precommitment +7.5% opens and +4% open days; no significant change in active meditation days [Partner case study]. — [Irrational Labs](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- Headspace CRM: +109% W1 retention, +49% paid conversion in a day, +26% activation [Vendor, not onboarding]. — [Phiture](https://phiture.com/success-stories/headspace-retention/)
- Fabulous customised onboarding: 2x return [Vendor, Firebase]. — [Firebase PDF](https://firebase.google.cn/downloads/Firebase_Fabulous_Case_Study.pdf?hl=it)
- Flo: "40% revenue from onboarding", 60M+ MAU [Company, June 2024]. — [Flo engineering](https://medium.com/flo-health/mobile-onboarding-evolution-part-1-cfc9702835ce)
- Duolingo delayed signup: "significantly" raised sign-ups [Company quote via Taplytics]; 20% DAU [Third-party Appcues, unverified]. — [Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding); [Appcues](https://www.appcues.com/blog/the-10-best-user-onboarding-experiences)
- Duolingo retention-led growth: ~4.5x DAU [Company/affiliated]. Secondhand claims of D1 +1%, D7 +2%, D14 +3% from one feature could not be verified. — [Lenny's Newsletter](https://lennysnewsletter.com/p/how-duolingo-reignited-user-growth); [Amplitude AMA](https://amplitude.com/community/events/ama-jorge-mazal-duolingo.md)
- Runna: 30x YoY growth [Vendor, RevenueCat]. — [RevenueCat case](https://www.casestudies.com/company/revenuecat/case-study/how-revenuecat-helped-runna-reach-30x-year-over-year-growth)

### Inferences
- [Inferred] The Headspace result is the most important caution in the set: onboarding tweaks reliably move *top-of-funnel* metrics (starts, opens, trial starts) and much less reliably move the habit itself.

### Gaps
- No public onboarding A/B numbers found for Noom, Strava, Whoop, Oura, Bevel, Finch, Todoist, Things, Streaks, Ladder or Lose It!.

## Reviewer and user criticism

### Takeaway
The recurring complaints are paywalls before any value (Headspace, Fabulous), flows that are too long or intrusive (Fabulous, Flo, Noom), manipulative commitment, urgency or notification copy (Fabulous's contract and notification wording, Noom's 15-minute countdown), spammy referral prompts, and empty states after setup (Bevel's blank dashboard, Things' "angry red tasks").

### Cited Findings
- Headspace: "you can barely try it before hitting the paywall"; asked to pay before a single session. — [Unstar 2026](https://unstar.app/ar/blog/mental-health-app-reviews-what-users-say-about-wellbeing-apps-2026); [Tear Them Down](https://tearthemdown.substack.com/p/headspace)
- Fabulous: asks for personal information before building trust; paywall before value; manipulative notification copy; spammy pre-filled friend recruitment; inconsistent stats (30M vs 22M users). — [Behavioral Scientist 2023](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding)
- Flo: "exceptionally long", which could frustrate users who want immediate utility. — [ScreensDesign: Flo](https://screensdesign.com/showcase/flo-period-pregnancy-tracker)
- Noom: 15-minute countdown timer on the paywall [Observed]. — [ScreensDesign](https://screensdesign.com/showcase/noom-weight-loss-food-tracker)
- Duolingo: a 2026 Russian analysis frames parts of the flow as "dark patterns". — [vc.ru 2026](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov)
- Bevel: blank dashboard; easy to miss Health read/write toggles; stuck on the Location screen (since fixed). — [ScreensDesign](https://screensdesign.com/showcase/bevel-health-performance); [r/bevelhealth](https://redlib.groet-infra.nl/r/bevelhealth); [App Store](https://apps.apple.com/il/app/id6456176249)
- Things 3: confusing deadline flag; "onboarding a bit challenging without prior experience". — [Medium](https://medium.com/the-extratextual/things-3-e8f2f704b662); [Digital PM](https://thedigitalprojectmanager.com/fr/tools/avis-things-3/)

### Inferences
- [Inferred] Criticism concentrates where the flow takes something (data, money, commitment) before giving anything. Apps that give first (Duolingo, Calm, Finch) attract much less onboarding criticism.

### Gaps
- No systematic 2025–26 App Store review mining was done (time budget). The quotes are illustrative, not representative.

## Recurring patterns in the strongest flows, and anti-patterns

### Takeaway
Patterns: give a real or symbolic win before asking for anything; make personalisation produce a visible artefact (a date, a plan, a match, a pet); ask for reminders or notifications right after the first win; defer the account behind "save your progress" unless a device or sync needs it; put the paywall after the reveal; seed content so the first screen after setup is never empty; carry tone with a character or a calm aesthetic; celebrate the first completion. Anti-patterns: paywall before any value, unexplained intrusive questions, manipulative contract, urgency or notification copy, spammy referral asks, permission bundles, blank dashboards, and treating a lift in starts as proof that the habit formed.

### Cited Findings
- Value before ask: Duolingo (lesson, then signup), Calm (breath, then reminder prompt with 3x retention). — [vc.ru](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov); [Amplitude](https://amplitude.com/blog/calm-increased-retention-amplitude.md)
- Visible personalisation: Noom (date), Lose It! (weeks to goal), Runna (race times), Ladder (team), Headspace (fit doubled starts). — sources above: [ScreensDesign Noom](https://screensdesign.com/showcase/noom-weight-loss-food-tracker); [Lazyweb Lose It!](https://lazyweb.com/canvas/flows/lose-it/onboarding); [ScreensDesign Runna](https://screensdesign.com/showcase/runna-running-training-plans); [Ladder](https://www.joinladder.com/llms.txt); [Irrational Labs](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- Paywall after the reveal, around the last quarter of onboarding for leaders. — [Lazyweb](https://experiments.lazyweb.com/research/do-category-leaders-paywall-earlier.md)
- Onboarding is a revenue engine worth instrumenting and iterating server-side (Flo: 40% of revenue, server-driven DSL). — [Flo engineering](https://medium.com/flo-health/mobile-onboarding-evolution-part-1-cfc9702835ce)
- Seeded content and no blank page: Todoist, Things. — [Speaker Deck](https://speakerdeck.com/fmerian/how-todoist-redesigned-its-user-onboarding); [Cultured Code](https://culturedcode.com/things/support/articles/2803553/)
- Anti-pattern evidence: Fabulous critique; Headspace paywall complaints; Bevel blank dashboard; Noom countdown. — [Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding); [Unstar](https://unstar.app/ar/blog/mental-health-app-reviews-what-users-say-about-wellbeing-apps-2026); [ScreensDesign Bevel](https://screensdesign.com/showcase/bevel-health-performance)
- Anti-pattern of over-claiming: Headspace starts doubled but meditation did not change; returning users could not find their course. — [Irrational Labs](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- Toggle "enable free trial" paywalls are being retired (Flo, April 2026). — [RevenueCat](https://www.revenuecat.com/blog/growth/r-i-p-toggle-paywall-we-hardly-knew-ye/)

### Inferences
- [Inferred] For a health or habit app that connects Apple Health, the strongest composite flow would be: a short goal question set (3 to 7 questions) whose answers visibly build a plan or projection; then a benefit-framed Health connect that immediately backfills real data into a first insight; then the first tiny habit or check-in with a celebration; then a reminder prompt framed around the habit just done; then account and paywall (if any). The "next day" return path to the plan should be explicit, given Headspace's finding.
- [Inferred] Long quizzes are a monetisation tool that suits paid-acquisition subscription apps (Noom, Flo). They are criticised and may filter users, so a product not optimising for trial conversion should prefer shorter flows.

### Gaps
- No head-to-head data compares short value-first flows with long quiz flows on retention in the same category.
- Haptics and motion specifics are undocumented in public sources.
