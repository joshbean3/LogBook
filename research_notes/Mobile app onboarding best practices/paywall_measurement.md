# Paywall placement in onboarding, and measuring and A/B testing onboarding (subscription health, fitness and productivity apps)

Evidence labels used throughout:
- **[LARGE DATASET]**: large industry dataset with stated sample (e.g. RevenueCat SOSA: 115k apps / $16B, 2026 edition; 75k apps / $10B, 2025 edition). Observational and descriptive, not causal. Sample is apps on that vendor's platform only.
- **[VENDOR CLAIM]**: vendor marketing or blog figure with no published method or sample.
- **[COMPANY-REPORTED TEST]**: one company's own A/B test result; usually no sample size or confidence interval published.
- **[RIGOROUS]**: peer-reviewed or methodologically explicit (e.g. Kohavi et al.).
- **[SECONDARY]**: aggregator or blog summarising someone else's data; weakest.

---

## 1. Paywall placement: hard vs soft, timing relative to onboarding, trial length, day-0 behaviour

### Takeaway
Monetisation is decided almost entirely on install day: in RevenueCat's 2026 data, 82.1% of Health & Fitness trial starts (78% for Productivity) happen on Day 0, and about half of all paid conversions also happen on Day 0. So a paywall at the end of onboarding is the highest-volume placement. Hard paywalls convert about 5x better by Day 35 with roughly equal year-one retention. Longer trials convert better per trial, but most apps are moving toward short trials. No large dataset directly compares "end of onboarding" with "after first value" placement. That evidence is vendor claims and single-company tests.

### Cited Findings

**Day-0 concentration**
- [LARGE DATASET, RevenueCat SOSA 2026; 115k+ apps, $16B+ revenue, 1B+ transactions, mainly 2025 data] Share of trial starts on Day 0: Business 89.9% (highest), Health & Fitness 82.1%, Gaming 81.5%, Productivity 78% (lowest). Days 1–3 add another 5–12%. After Day 3, trial starts are below 5% in every category. — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [LARGE DATASET, SOSA 2026] 50.6% of paid conversions happen on Day 0 overall. Productivity is highest at 71.9% and Education lowest at 28.5%. 19.2% of conversions happen at Week 6 or later (Travel 28.2%). **Internal inconsistency:** the same report's hard-paywall section says "1/3 of all conversions happen on day zero for both methods". — [RevenueCat SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [LARGE DATASET, SOSA 2025; 75k apps, $10B+] 82% of trial starts occur on install day (quoted contributor Phil Carter). Another contributor says 80–90%. Median download-to-trial is 6.2%, and P90 apps reach 20.3%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [VENDOR CLAIM, Adapty] 89.4% of trial starts happen on Day 0. "Miss that first session and the chance a user ever starts a trial drops to 11%." Also: "80% of your subscription revenue comes from the first paywall" shown after onboarding. No method given. — [Adapty (via search summary of Adapty blog/onboarding content)](https://adapty.io/blog/how-to-personalize-onboarding-and-paywalls-in-your-mobile-app/)
- [VENDOR CLAIM, Superwall] "Many apps see more than 50% of their revenue being captured during onboarding." The onboarding placement has the most paywall views and lower conversion per view, but the largest absolute revenue. — [Superwall blog](https://superwall.com/blog/the-paywall-growth-lever-framework-how-to-build-smarter-experiments-faster)
- [LARGE VENDOR DATASET, Superwall; ~40M onboarding-placement paywall opens, Feb–May 2026] Multi-page onboarding paywalls converted 12.41% (trial starts plus direct purchases divided by users who saw the paywall) versus 9.07% for single-page, a 37% relative gap. Observational: apps choose their own format, so this is not a randomised comparison. — [Superwall](https://superwall.com/blog/new-postmulti-page-onboarding-paywalls-convert-37-better-than-single-page-heres-why)

**Hard paywall vs freemium**
- [LARGE DATASET, SOSA 2026] Median D35 download-to-paid is 10.7% for hard paywalls versus 2.1% for freemium. Top quartile is above 20.0% versus above 4.5%. Year-one retention of yearly subscribers is 27% (hard) versus 28% (freemium). Revenue per install at Day 60 is $3.09 versus $0.38 (~8x). Hard paywalls show a Day 4–7 conversion spike of 25.7%, likely 7-day trial expiries. Freemium apps get 23% of conversions six or more weeks after download. — [RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026); [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [LARGE DATASET, SOSA 2025] D35 download-to-paid is 12.11% (hard) versus 2.18% (freemium). Hard-paywall conversion therefore fell from ~12.1% to 10.7% between the editions, while freemium held at ~2.1%. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Caveat: hard-paywall versus freemium is an app-level choice, so the ~5x gap is confounded by app type, acquisition channel (paid UA favours hard paywalls) and intent. It is not evidence that switching one app would produce 5x. (Inference based on the observational design stated in the reports.)

**Trial length and trial-to-paid**
- [LARGE DATASET, SOSA 2026] Median trial-to-paid by trial length: ≤4 days 25.5%; 5–9 days 37.4%; 10–16 days 35.4%; 17–32 days 42.5%. Share of trials ≤4 days rose to 46.5% (from 42.1%), and 5–9 day trials fell to 39.9% (from 43.5%). — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [LARGE DATASET, SOSA 2026] Day-0 cancellation share by trial length: 3-day 55.4%, 7-day 39.8%, 14-day 35.7%, 30-day 31.1%. For 3-day trials, 84% of cancellations happen by Day 1 (~51% on Day 0 in 2025). — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps); [RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- [LARGE DATASET, SOSA 2025] 17–32 day trials had a 45.7% median, and a contributor cites 26.8% for shorter trials. 52% of 2024 trials ran 5–9 days. — [SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [LARGE DATASET, SOSA 2026] Trial-to-paid by category (median): Travel 43.5%, **Health & Fitness 37.7%**, Gaming 25.0%, Photo & Video 22.2%. Download-to-trial (D30): Business 9.1%, **Health & Fitness 6.9%**. Download-to-paid (D35): **Health & Fitness 2.9%** (highest), Business 2.6%. — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [LARGE DATASET, SOSA 2025] Health & Fitness trial-to-paid median was 39.9% (top 10%: 68.3%), and H&F D35 download-to-paid P90 was 12.1%. — [SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [LARGE DATASET, Adapty State of In-App Subscriptions 2026 edition (2025 data); the 2025 edition covered 11k+ apps, $1.9B] Health & Fitness has the highest trial-to-paid of any category at 35.0% (Entertainment lowest at 19.1%). For H&F weekly plans with a trial, the funnel is 9.5% install-to-trial, 42.2% trial-to-paid, 67.7% first renewal. H&F has the **lowest first-renewal retention** of any category at 30.3% (Utilities 58.1%). Annual plans make up ~61% of H&F subscription revenue (51% in 2023). — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/); [Adapty 2026 report](https://adapty.io/state-of-in-app-subscriptions/)
- [SECONDARY] Adapty's 2025 summary reportedly said full-funnel conversion in H&F is "under 0.1%". This conflicts with the trial-to-paid figures above and is probably a different denominator. Treat with caution. — [Adapty 2025 in 10 minutes](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)

**Pricing context**
- [LARGE DATASET, SOSA 2026] Median prices: weekly $5.99, monthly ~$10 ($9.99 is the dominant point), yearly $34.80 (up from $31.60). — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)

**Placement experiments (company-reported)**
- [COMPANY-REPORTED TEST, Duolingo] Moving sign-up later, so users take a lesson before creating an account, gave "about a 20% increase in DAUs". Soft (skippable) sign-up walls before a hard wall after several lessons were needed: "without soft walls, hard walls perform significantly worse". Refining soft and hard walls about three years later added 8.2% DAU. This is the closest published evidence for "value before ask", though it concerns sign-up walls, not paywalls. — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- [COMPANY-REPORTED, Cal AI via Superwall case study] 61 experiments on the onboarding paywall. Monthly revenue grew more than 3x in 10 months and trial-to-paid rose 31%. Vendor case study with no controls disclosed. — [Superwall Cal AI](https://superwall.com/case-studies/cal-ai)
- [COMPANY-REPORTED, Adapty travel-app case] "Activation revenue" (onboarding and first session) rose 414%, and total revenue rose ~50%. — [Adapty case study](https://adapty.io/case-studies/travel-app/)
- [ANECDOTE in SOSA 2026] A contributor reports a freemium conversion lift from 0.4% to 4.5% using a "reverse trial". — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)

### Inferences
- For a health, fitness or productivity app, the default should be a paywall (trial offer) at the end of onboarding, because ~80% of trial starts happen on Day 0. A team that defers the first offer to "after first value" on Day 2+ is betting against the base rate. A later paywall should be added as a second placement, not a replacement.
- "After first value" and "end of onboarding" can be merged: build a value moment inside onboarding (personalised plan preview, first mini-workout, first logged meal) and show the paywall straight after it. Duolingo's delayed sign-up result and the Superwall multi-page data both point that way, though neither is a randomised paywall-timing test.
- Trial length: 7 days is the defensible default for H&F. Short (≤4 day) trials convert much worse (25.5% vs 37.4%) and have very high Day-0 cancellation. 14 days offers no median improvement over 5–9 days. 17–32 day trials convert best per trial, but they delay revenue and the figure may be confounded by which apps choose them.
- Benchmarks for an H&F app on the paywall: download-to-trial ~7% median (top decile ~20%); trial-to-paid ~35–40% median; D35 download-to-paid ~3% median (hard paywall ~11%).

### Gaps
- No large-sample, randomised comparison of paywall placement (end of onboarding vs after first workout vs Day 3) was found in RevenueCat, Adapty or Superwall public material.
- No published Lose It!, Calm, Headspace or Duolingo Super paywall-timing test with numbers was found. The Calm reminder "3x retention" claim could not be sourced.
- Trial-to-paid broken down by trial length *within* Health & Fitness, and Productivity trial-to-paid, were not in the accessible pages (they may be in the full PDF reports).
- Business of Apps and Sensor Tower data were not reviewed in this pass.

---

## 2. Does monetising in onboarding hurt retention or long-term value? (refunds, churn, D30)

### Takeaway
The large-dataset evidence suggests hard, early paywalls do **not** materially hurt year-one subscriber retention (27% vs 28%), but they are associated with higher refund rates (5.8% vs 3.4%). Health & Fitness has high refunds and the weakest first-renewal retention of any category. No public dataset reports Day-30 *user* retention split by paywall timing.

### Cited Findings
- [LARGE DATASET, SOSA 2026] Year-one retention of yearly subscribers: hard paywall 27% versus freemium 28%. — [RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- [LARGE DATASET, SOSA 2025] Monthly-plan retention median: hard paywall 12.8% versus freemium 9.3%. Freemium yearly retention varies widely (18.7%–59.0%). — search summary of [SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025) [SECONDARY for exact figures]
- [LARGE DATASET, SOSA 2025] Refund rates: hard paywall 5.8% versus freemium 3.4%. By category: Education 4.86%, **Health & Fitness 4.71%** (second highest), Travel 1.51% (lowest). — [SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [LARGE DATASET, SOSA 2025] Year-one retention by plan: yearly 44.1%, monthly 17.0%, weekly 3.4%. Nearly 30% of annual subscriptions are cancelled in the first month. — [SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- [LARGE DATASET, SOSA 2026] 35% of annual cancellations happen in month 1. Annual plans that cancel within year 1 rose to ~72% (from ~56%). Billing failures cause 31% of cancellations on Google Play and 14% on the App Store. — [RevenueCat 2026 summary](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- [LARGE DATASET, Adapty] H&F first-renewal retention is 30.3%, the lowest of all categories. — [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)
- [COMPANY-REPORTED TEST, Blinkist] A transparent trial timeline (what happens today, reminder before the trial ends, charge date) raised trial sign-ups 23% and **cut subscription complaints 55%**. Trial-period cancellations fell 4%, and push opt-in rose from 6% to 74% (attributed to the promised reminder). No sample size published. — [UX Planet (Blinkist designer)](https://uxplanet.org/how-solving-our-biggest-customer-complaint-at-blinkist-led-to-a-23-increase-in-conversion-b60ad514134b); [Growth.Design](https://growth.design/case-studies/trial-paywall-challenge)
- [COMPANY-REPORTED, Duolingo] Streak-repair purchases versus DAU: a monetisation check found the DAU gain outweighed the revenue lost. This shows the practice of weighing engagement against monetisation in the same test. — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)

### Inferences
- The likely harm from aggressive early monetisation shows up as refunds, Day-0/Day-1 trial cancellations, complaints and chargebacks, not as lower subscriber retention. A test of an earlier or harder paywall should carry refund rate and Day-0 trial-cancel rate as guardrails.
- For free (non-paying) users, an onboarding paywall can still reduce engagement. The relevant guardrail is D1/D7 retention of *all* installs, not just payers. This needs to be measured in-app because no benchmark exists.

### Gaps
- No public dataset reports D30 user retention, refund rate or LTV split by *paywall timing* (onboarding vs later) within the same app. This is the biggest evidence gap. A small team has to test it.
- Apple does not expose refund reasons. Refund data by paywall design was not found.

---

## 3. Pricing display without dark patterns; App Review 3.1.2; FTC and EU rules

### Takeaway
Apple's enforcement tightened in 2026. Free-trial **toggle** paywalls have been rejected under 3.1.2 since mid-January 2026. Rejections also cite trials displayed more prominently than the billed price. The FTC's federal "click to cancel" rule was vacated in July 2025, but state auto-renewal laws still apply. The EU's online "withdrawal function" (Directive 2023/2673) has applied since 19 June 2026. A transparent timeline paywall is both compliant and, in Blinkist's test, higher-converting.

### Cited Findings
- [PLATFORM POLICY, reported via RevenueCat] Since mid-January 2026, Apple has rejected paywalls with a free-trial on/off toggle under 3.1.2. Quoted rejection: "The purchase screen includes a toggle to add or remove a free trial from the subscription purchase. This design is confusing and may prevent users from understanding…" the auto-renewing commitment. Fix: "Remove the toggle" and present "a clear subscription offer that explicitly states whether a free trial is included." Apple has not published a formal policy update. As of 23 April 2026, Flo Health replaced its toggle with a separate 14-day free-trial plan in a multi-plan selector, which appears compliant. The toggle is reportedly still acceptable on Google Play and the web. — [RevenueCat "RIP toggle paywall"](https://www.revenuecat.com/blog/growth/rip-toggle-paywall)
- [PLATFORM POLICY, developer reports] 3.1.2(c) rejection texts include: the app "promotes the free trial or introductory period… more clearly and conspicuously than the billed amount", and it "does not make it clear how long the free trial lasts and the amount that will be billed after the free trial is over." — [Apple Developer Forums](https://developer.apple.com/forums/thread/841626); [RevenueCat community](https://community.revenuecat.com/general-questions-7/rejected-due-to-guideline-3-1-2-business-payments-subscriptions-4775)
- [SECONDARY] A secondary source says the guidelines were updated 8 June 2026 and that 3.1.2(a) requires a subscription period of at least seven days. Unverified against Apple's text. — [builtbyfoundry](https://www.builtbyfoundry.io/blog/apple-subscription-paywall-rules-2026-7-things-sign-up-screen)
- [COMPANY-REPORTED TEST, Fits / Ludwig Henne] A toggle paywall beat a Blinkist-style paywall by 19% ARPU, but the lift came mainly from visual hierarchy (normalised yearly price, "Most Popular" badge, larger annual tile), not the toggle. — [RevenueCat](https://www.revenuecat.com/blog/growth/rip-toggle-paywall)
- [VENDOR GUIDANCE, RevenueCat] Compliant patterns: an honest timeline paywall (today, reminder day, charge day); a multi-package selector with a badge on the plan that includes the trial; a value-first paywall (benefits, social proof); trial messaging shown only to eligible users; exit offers that "should not feel like a trap" (Apple is scrutinising these too); web checkout. — [RevenueCat](https://www.revenuecat.com/blog/growth/rip-toggle-paywall)
- [LEGAL] The Eighth Circuit vacated the FTC's amended Negative Option ("click-to-cancel") Rule in its entirety on 8 July 2025, days before it was due to take effect. The grounds were procedural (no preliminary regulatory analysis under Section 22 of the FTC Act), not the merits. State auto-renewal laws remain relevant. — [Gunderson](https://www.gunder.com/en/news-insights/insights/client-insight-eighth-circuit-vacates-ftcs-click-to-cancel-rule); [National Law Review](https://natlawreview.com/article/eighth-circuit-slams-brakes-ftcs-click-cancel-rule); [Engadget](https://www.engadget.com/big-tech/ftcs-click-to-cancel-rule-has-been-struck-down-by-federal-judges-at-the-eleventh-hour-213503860.html)
- [LEGAL] EU Directive 2023/2673 adds Article 11a to the Consumer Rights Directive. Traders must provide an electronic withdrawal function (a "Cancel my contract"-style button) for distance contracts concluded via online interfaces. It applies from 19 June 2026 (transposition deadline 19 December 2025). National rules such as Germany's § 356a BGB may add detail. How it applies to App Store-billed subscriptions is not established in the sources found. — [Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts); [iubenda](https://www.iubenda.com/en/blog/the-new-online-withdrawal-function-what-eu-directive-2023-2673-means-for-your-business/)

### Inferences
- Paywall checklist: the billed price is at least as prominent as "free"; trial length and the post-trial charge are stated in plain words; a separate plan tile for the trial (no toggle); a visible close or "not now" control; a timeline with a promised reminder (and actually send it); restore purchases; links to Terms and Privacy. This meets 3.1.2 and copies the one published ethical test (Blinkist).
- With the FTC rule vacated, US exposure comes from state laws (e.g. California's auto-renewal law) and general FTC Act deception authority. Legal review is worth doing before a web-checkout funnel, where Apple's cancellation flow does not apply.

### Gaps
- The current text of Apple guideline 3.1.2 (post-June 2026) was not fetched directly. Verify on developer.apple.com.
- No 2026 FTC re-proposal of click-to-cancel was found. Current state-law specifics (California's 2024 amendments, effective July 2025) were not researched in this pass.
- How the EU withdrawal button interacts with App Store and Google Play billing (where the store is the merchant) is unresolved in the sources.

---

## 4. Onboarding funnel metrics and benchmarks (completion per step, activation, D1/D7/D30, trial start)

### Takeaway
The monetisation benchmarks are solid (RevenueCat, Adapty): download-to-trial, trial-to-paid, D35 download-to-paid. Public **onboarding step-completion** and **retention** benchmarks for H&F are weak, inconsistent and mostly secondary. Use them as rough ranges only.

### Cited Findings
- [LARGE DATASET] H&F monetisation funnel benchmarks: see section 1 (download-to-trial 6.9% median; trial-to-paid 37.7%; D35 download-to-paid 2.9%; Day-0 trial share 82.1%). — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [VENDOR DOCS, Adapty] Adapty's onboarding metric definitions: "onboarding revenue" is all transactions after onboarding was shown; "trial conversion" is the share of onboarding views that lead to a trial start. Useful as standard definitions. — [Adapty onboarding metrics docs](https://adapty.io/docs/onboarding-metrics)
- [SECONDARY, conflicting] Cross-industry retention averages are roughly D1 25–26%, D7 11–13%, D30 5–7%. Adjust's own page says ~26% / 13% / 7%. H&F figures from secondary roundups range from D1 20–28%, D7 8–18%, D30 3–9%. One table gives D30 of 3.9% on iOS and 3.4% on Android. — [Adjust](https://www.adjust.com/blog/what-makes-a-good-retention-rate/); [Enable3 roundup](https://enable3.io/blog/app-retention-benchmarks-2025); [UXCam 2026](https://uxcam.com/br/blog/benchmarks-retencao-aplicativos-moveis-industria-2026/)
- [COMPANY-REPORTED, Calm via Iterable] Shortening the onboarding (lifecycle messaging) journey from 27 to 15 days coincided with a 4x increase in revenue from new-member onboarding. Vendor case study with no control described. — [Iterable Calm case study](https://iterable.com/customers/calm)

### Inferences
Recommended metric tree for a small team:
- **North star / outcome:** realised revenue per install at D35–D60, and payer retention at the first renewal.
- **Funnel (per install cohort, daily):** onboarding start, then step N viewed and completed (each step), then onboarding completed, paywall viewed, trial started or purchased, paywall dismissed, then activation event (e.g. first workout or plan completed), D1/D7/D30 return, trial converted, refunded.
- **Diagnostics:** time to complete onboarding (median and p90), drop-off per step, paywall view-to-trial rate, Day-0 trial cancel rate, push opt-in rate, health permission grant rate.
- **Rough targets:** trial-start-per-install ≥7% (median H&F) and ~20% for top decile; trial-to-paid ≥35%. Retention benchmarks are too noisy to set targets, so compare cohorts with your own baseline.

### Gaps
- No credible public benchmark for onboarding step-completion rates or time-to-complete in H&F apps was found.
- AppsFlyer and Adjust primary retention reports for 2025–26 by category were not retrieved, so the H&F retention figures above are secondary and inconsistent.

---

## 5. Finding an activation metric, and the risk of optimising trial starts over long-term value

### Takeaway
The standard method is to find behaviours that correlate with retention in cohort data, then test causality by nudging the behaviour in a randomised experiment. Correlational "aha moments" (Facebook's "7 friends in 10 days") largely reflect user intent. The Headspace and Irrational Labs experiment shows the risk concretely: a quiz doubled course starts but produced **no significant change in actual meditation days**. Proxy wins do not guarantee value.

### Cited Findings
- [COMPANY-REPORTED TEST, Headspace × Irrational Labs × Purchasely] Five onboarding arms for new free-trial users: control, default-to-basics, perceived-fit quiz, personalised-fit quiz, precommitment plan. Course starts went from 31.25% (control) to 62.97% (perceived-fit quiz), roughly double. Precommitment raised app opens 7.5% and unique open days 4%. **Active meditation days: no statistically significant difference for any arm.** Among those who meditated, precommitment's effect faded after 2–3 days. Lesson: measure the value-delivering behaviour, not engagement proxies. Sample size not reported. — [Irrational Labs case study](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- [SECONDARY] Critique of correlational aha moments: "high intent users are more likely to choose to do the aha moments", so the threshold (e.g. 7 friends) is largely arbitrary. The remedy is to run an experiment that nudges users toward the behaviour and check whether retention improves. — [Pragmatic Data Scientists (Medium)](https://medium.com/pragmatic-data-scientists/why-is-aha-moment-wrong-ed96ae493a01); [UXCam](https://blog.uxcam.com/blog/why-most-teams-have-the-wrong-aha-moment)
- [VENDOR GUIDANCE, Statsig] Correlation versus causation guidance for product metrics. — [Statsig](https://statsig.com/blog/correlation-vs-causation-guide)
- [VENDOR GUIDANCE, Amplitude] Steps to measure user onboarding. — [Amplitude](https://amplitude.com/blog/4-steps-to-measure-user-onboarding.md)
- [VENDOR DOCS, RevenueCat] Realised LTV per customer is RevenueCat's recommended primary metric for paywall experiments. Results keep updating for 400 days after a test ends. Since February 2026 there is a predicted 12-month LTV winner. Annual plans and long trials make LTV estimates unstable. — [RevenueCat Experiments results docs](https://revenuecat.com/docs/experiments-results-v1); [RevenueCat changelog](https://www.revenuecat.com/changelog/release/see-predicted-12-month-ltv-winners-in-experiments-2026-02-12); [RevenueCat community](https://community.revenuecat.com/dashboard-tools-52/when-an-experiment-ends-will-realized-ltv-values-continue-5450)
- [LARGE DATASET, SOSA 2026] Short trials and Day-0 cancellations: 55.4% of 3-day-trial cancellations happen on Day 0, showing how trial-start volume can come with low-quality trials. — [SOSA 2026](https://www.revenuecat.com/state-of-subscription-apps)

### Inferences
Activation-metric procedure for an H&F app:
1. Take 4–8 weeks of install cohorts and list candidate Day-0/Day-1 behaviours (completed first workout, logged three meals, connected Apple Health, set a reminder, finished onboarding plan).
2. Compare D30 retention and trial-to-paid for users who did versus did not do each behaviour. Prefer behaviours with a big gap that many users can reach.
3. Pick a threshold where the retention curve flattens.
4. Run a randomised nudge test (e.g. guided first workout in onboarding vs not) and check whether *retention and paid conversion* move, not just the behaviour.
5. Only then adopt it as the activation metric.

Don't make trial starts the primary metric of onboarding or paywall tests. Use trial-to-paid, realised revenue per install (D35+) and refunds or Day-0 cancels as the decision metrics, with trial start as a leading indicator.

### Gaps
- Primary sources for Slack's "2,000 messages", Facebook's "7 friends" derivation, and Reforge's activation framework were not retrieved. They are cited here only through secondary critiques.

---

## 6. A/B testing onboarding properly: sample sizes, sequential testing, holdouts, novelty, guardrails, tools

### Takeaway
Kohavi's guidance is that A/B tests need "thousands, preferably tens of thousands" of users for reasonable effects, and ~200k to detect ~5% changes. Duolingo used a rule of thumb of 100k DAU. A small app can only detect **large** effects (20–30%+ relative). It should limit arms, pre-register metrics, avoid peeking (or use sequential methods), check sample ratio mismatch, and judge paywall tests on revenue that has had time to mature.

### Cited Findings
- [RIGOROUS, via secondary] Kohavi, Deng & Vermeer (2022): A/B tests are useful for reasonable effect sizes with "at least thousands of active users, preferably tens of thousands". Detecting a 5% change at a typical retail conversion rate takes ~200,000 users. Underpowered tests produce exaggerated winners. Primary text: *Trustworthy Online Controlled Experiments* (Kohavi, Tang, Xu, 2020). — [Medium summary of Kohavi](https://medium.com/@shenjiejie2017/lessons-from-ronny-kohavi-on-a-b-testing-039aabed6543); [Lenny's podcast recap](https://kylifornication-code.github.io/lennys-podcast-recapper/episode/ronny-kohavi/); [GrowthBook](https://www.growthbook.io/blog/lessons-learned-from-ronny-kohavi-and-luke-sonnet-running-trustworthy-experiments)
- [COMPANY-REPORTED, Duolingo] Rule of thumb: "at least 100,000 DAUs to run an A/B test". Launch threshold ~1% for a mature product, while new apps should look for 20–30% gains. No more than three arms ("a control and two test conditions"). 5–8 concurrent experiments. Metrics: DAU primary, D7/D14 retention, monetisation as a counter-check. Examples: the "Hi, it's Duo" notification copy gave +5% DAU; the Weekend Amulet gave +2.1% D7 and +4% D14 retention. — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- [VENDOR DOCS, Statsig] Sequential testing adjusts p-values and CIs so teams can look early without inflating false positives. It must be chosen before launch (the analysis type can't be changed mid-test). CUPED uses pre-experiment data to reduce variance and shorten tests. Note that CUPED needs pre-period data, which new installs in onboarding tests don't have. — [Statsig read-results docs](https://cloudflare-docs.statsig.com/experiments-plus/read-results); [Statsig sequential testing](https://statsig.com/blog/sequential-testing-explained); [Statsig CUPED docs](https://docs.statsig.com/stats-engine/methodologies/cuped)
- [SECONDARY] Peeking (stopping when significant) inflates Type I error. A sample ratio mismatch (chi-square p<0.01) should invalidate results until the cause is fixed. Novelty effects bias short tests. Define guardrails before launch. With 20 metrics, about one false positive is expected by chance. — [Unleash](https://www.getunleash.io/blog/what-metrics-important-analyzing-ab-test); [Aakash Gupta](https://www.news.aakashg.com/p/become-an-ab-testing-expert-advanced)
- [VENDOR DOCS, RevenueCat Experiments] Realised LTV per customer is the primary metric, results keep updating for 400 days, a predicted 12-month LTV winner is available (Feb 2026), and wide intervals mean "keep running". — [RevenueCat docs](https://revenuecat.com/docs/experiments-results-v1); [RevenueCat changelog](https://www.revenuecat.com/changelog/release/see-predicted-12-month-ltv-winners-in-experiments-2026-02-12)
- [VENDOR, Superwall] Superwall attributes the initial conversion to the triggering placement and carries it through renewals, so revenue per placement can be compared. — [Superwall revenue attribution](https://superwall.com/features/paywall-revenue-attribution); [How Superwall tests paywalls](https://superwall.com/blog/how-we-test-paywalls-at-superwall-and-how-you-can-too)

### Inferences
- **Sample size arithmetic** (using Kohavi's rule-of-thumb n ≈ 16·p(1−p)/δ² per arm, α=0.05, 80% power; the formula is from the Kohavi book, not separately sourced here):
  - Paywall view-to-trial at 10% baseline, detecting a 20% relative lift (10% to 12%): ~3,600 users per arm.
  - At 7% baseline, detecting a 10% relative lift (7.0% to 7.7%): ~21,000 per arm.
  - Trial-to-paid at 38%, detecting a 10% relative lift: ~2,600 *trial starters* per arm, which is roughly 37k installs per arm at a 7% trial rate.
  - D7 retention at 15%, detecting a 10% relative lift: ~9,000 per arm.
  - So an app with ~5k installs/month can test only big swings (paywall present or absent, trial length, onboarding length), one at a time, with two arms, over 2–6 weeks plus maturation.
- **Protocol for a small team:** write the hypothesis, primary metric, guardrails, MDE and run length before launch; randomise at install (user ID before onboarding); check SRM daily; don't stop early unless using a sequential engine; run whole weeks (to cover weekday effects); for paywall or trial tests, wait for trial expiry plus at least one renewal (or use predicted LTV) before calling; re-check winners after 4–8 weeks for novelty decay.
- **Guardrails for onboarding and paywall tests:** D1/D7 retention of all installs, refund rate, Day-0 trial-cancel rate, onboarding completion rate, crash rate, App Store rating and complaint volume.
- **Holdout:** keep ~5–10% of new installs on the old onboarding for a quarter to measure cumulative impact of shipped winners. This is affordable only once volume allows.
- **Tool fit:** paywall and price tests in RevenueCat Experiments or Superwall (revenue-native, LTV-aware); onboarding UX and flags in Firebase Remote Config + A/B Testing, PostHog, Statsig or Amplitude Experiment (product-event native). Avoid running overlapping onboarding and paywall tests on the same users unless they are deliberately crossed and the tools share a user ID.

### Gaps
- Firebase A/B Testing, PostHog (Bayesian engine) and Amplitude Experiment docs were not fetched in this pass, so their specific statistical methods are unverified here.
- The primary Kohavi 2022 paper text and the Eppo docs were not retrieved directly.
- No published guidance specific to sample sizes for small subscription apps from RevenueCat (minimum duration) was found.

---

## 7. Qualitative methods (session replay, onboarding surveys, five-second tests, interviews)

### Takeaway
Very little directly sourced material was collected in this pass. The strongest example is Blinkist: customer-complaint and user research found the top hesitation ("forgetting to cancel and being charged"), which produced the winning timeline hypothesis. The Headspace post-mortem used qualitative diagnosis to explain a null result.

### Cited Findings
- [COMPANY-REPORTED, Blinkist] User research and complaint analysis found the number-one hesitation at the paywall was fear of forgetting to cancel. That became the hypothesis for the timeline test (+23% trials, −55% complaints). — [UX Planet](https://uxplanet.org/how-solving-our-biggest-customer-complaint-at-blinkist-led-to-a-23-increase-in-conversion-b60ad514134b); [Growth.Design](https://growth.design/case-studies/trial-paywall-challenge)
- [COMPANY-REPORTED, Headspace] Post-test diagnosis of why more course starts did not mean more meditation: returning users couldn't find their course on the Today page (a planned one-click return modal was cut); content didn't match expectations of short breathing exercises; personalisation over-weighted sleep when stress and anxiety were the most common need. — [Irrational Labs](https://irrationallabs.com/case-studies/headspace-doubled-course-starts/)
- [SECONDARY] Quantitative analysis alone can produce a "coincident" rather than causal aha metric, so qualitative checks are recommended. — [Koji aha-moment guide](https://www.koji.so/docs/aha-moment-research)

### Inferences
- Pair each onboarding experiment with (a) a one-question survey at onboarding exit or paywall dismiss ("What stopped you from starting your trial?"), (b) 5–8 moderated sessions on a prototype before building, and (c) session replay of drop-off steps, with health-data fields masked (see section 8).
- Use support tickets, refund requests and App Store reviews as a free complaint corpus, as Blinkist did.

### Gaps
- No sourced benchmarks or method papers on session replay, five-second tests or onboarding surveys for mobile subscription apps were gathered. Another researcher's notes may cover this.

---

## 8. Privacy-respecting analytics for a health app

### Takeaway
Health data must never flow to advertising or analytics SDKs without clear authorisation. Apple prohibits using HealthKit data for advertising or data mining, and the FTC treats unauthorised disclosure to third-party SDKs as a "breach" under the revised Health Breach Notification Rule (in force 2024; GoodRx, Flo and BetterHelp enforcement). Instrument onboarding with event names and coarse properties, not health values.

### Cited Findings
- [PLATFORM POLICY, Apple HealthKit docs] Apps may show ads but cannot use HealthKit data to serve them. They may not sell HealthKit-derived information to ad platforms, data brokers or resellers. Sharing with a third party, even with permission, is allowed only if that party also provides a health or fitness service to the user. — [Apple HealthKit: Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy.md)
- [PLATFORM POLICY, secondary on numbering] The advertising and data-mining ban for health API data sits in guideline 5.1.3(i). 5.1.2 covers data use, sharing and consent generally. Verify against the current guidelines. — [ConductAtlas guideline record](https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-019078/health-and-homekit-api-data-prohibited-for-marketing-or-advertising/)
- [SECONDARY] Third-party SDKs must ship privacy manifests, and Apple compares manifest declarations with privacy nutrition labels. Not confirmed against Apple docs in this pass. — [search summary; secondary guides](https://implexa.ai/s/skills.sh/app-store-review)
- [LEGAL] The FTC's revised Health Breach Notification Rule (final rule 26 April 2024) covers health apps outside HIPAA. "Breach of security" includes unauthorised *disclosures*, not just intrusions. That captures sending health data to analytics or ad SDKs without authorisation. — [BenefitsPro](https://benefitspro.com/2024/05/10/new-ftc-rule-requires-digital-health-apps-to-notify-users-of-data-breaches/?amp=1); [Akerman](https://www.akerman.com/en/perspectives/hrx-ftcs-enforcement-action-against-goodrx-breathes-new-life-into-decade-old-regulation.html)
- [LEGAL, enforcement] GoodRx (2023) was the first HBNR enforcement: health information was shared with third parties, with a $1.5M penalty and a permanent ban on sharing health data for advertising. Flo Health (order finalised June 2021) shared fertility data with Facebook and Google. BetterHelp is also cited as an enforcement target. — [PolicyMed](https://policymed.com/2023/03/goodrx-fined-in-first-violation-of-the-health-breach-notification-rule.html); [Mondaq](https://www.mondaq.com/unitedstates/data-protection/1279036/ftc-seeks-first-ever-health-breach-notification-rule-enforcement-pixel-users-beware)

### Inferences
**Do not log** to third-party analytics:
- HealthKit values (weight, heart rate, cycle data, sleep)
- free-text answers about conditions, injuries, medications or pregnancy
- goal answers that imply a condition (e.g. "manage diabetes")
- precise location
- the raw contents of onboarding quiz answers on health topics

**Log instead:**
- step IDs and completion
- coarse, non-sensitive buckets only where needed for segmentation (e.g. goal category "strength / endurance / general"), after a privacy review
- permission granted or denied (boolean)
- paywall events

Other practices:
- Mask inputs in session replay.
- Prefer first-party or self-hostable analytics (e.g. PostHog self-host) for health-adjacent events.
- Disable ad-network SDK event forwarding of onboarding answers.
- Keep the privacy nutrition label and privacy manifest consistent with what every SDK actually collects.
- If onboarding answers are used to personalise the paywall, process them on-device or first-party.

### Gaps
- The current App Review 5.1.1/5.1.2 text and Apple's privacy-manifest documentation were not fetched directly.
- No source was found on how Apple enforces HealthKit rules against analytics SDKs specifically.
- GDPR special-category data (Art. 9) consent requirements for EU users were not researched in this pass.
