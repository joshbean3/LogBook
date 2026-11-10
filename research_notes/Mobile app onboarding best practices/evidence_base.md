# Evidence base for mobile app onboarding (activation, retention, behaviour change), focused on health, fitness, habit and productivity apps

Notes compiled 10 Nov 2026. Each finding is tagged with its source type:
- **[PR]** peer-reviewed
- **[IND]** industry dataset with a stated method
- **[CO]** company-reported A/B test or result
- **[VC]** vendor claim, anecdote or secondary blog

Pre-2015 work is flagged **(foundational)**. Where a figure reached me only through a secondary summary rather than the primary text, I say so.

Note on method: a few classic papers (IKEA effect, goal-gradient, generation and testing effects, Eysenbach's law of attrition) are cited from their published bibliographic records (DOI or journal URL) because they are well-established. I did not re-fetch those papers in this session. They are marked "(bibliographic record)".

---

## 1. Retention and activation benchmarks (D1, D7, D30) and how well early retention predicts later retention

### Takeaway
Health & fitness apps keep roughly a quarter to a third of installers on day 1, about 12–15% on day 7, and roughly 3–8% on day 30. The figure depends heavily on the vendor, the year and the metric definition. Peer-reviewed panel data on mental-health apps puts median day-30 retention at only 3.3%. Health & fitness is a strong subscription category once users reach a trial. The only "early retention predicts later retention" rule I could trace (Amplitude's 7% day-7 rule) is vendor-published, and its day-90 correlation figures could not be verified.

### Cited Findings
- **[PR]** Baumel et al. 2019, *JMIR* 21(9):e14567. 93 Android mental-health apps (anxiety, depression, wellbeing) with 10,000+ installs (median 100,000), usage measured through a third-party panel. Median 15-day retention was **3.9% (IQR 10.3%)** and median 30-day retention **3.3% (IQR 6.2%)**. Day-30 medians by technique: peer support 8.9% (n=2), trackers 6.1%, mindfulness/meditation 4.7%, breathing exercises 0.0%. The authors conclude that "only a small portion of users actually used the apps for a long period of time." — [JMIR / PMC6785720](https://pmc.ncbi.nlm.nih.gov/articles/PMC6785720)
  - A secondary summary says the paper shows apps lose more than 80% of users within 10 days. I did not find that figure in the primary text, so do not cite it. — [Textbook of Digital Health](https://www.textbookofdigitalhealth.com/references/baumel2019engagement.html)
- **[PR]** Meyerowitz-Katz et al. 2020, *JMIR* 22(9):e20283. Systematic review and meta-analysis of app-based chronic-disease interventions: 17 studies included out of 833 screened (9 RCTs, 8 observational). Pooled dropout was **43% (95% CI 29–57)**: 49% in observational studies vs 40% in RCTs. Heterogeneity was I² > 99%. The preprint said 47%; the published figure is 43%. — [JMIR 2020](https://www.jmir.org/2020/9/e20283)
- **[PR] (foundational)** Eysenbach 2005, "The Law of Attrition", *JMIR* 7(1):e11. Argues that high dropout and non-usage are inherent features of eHealth trials and should be measured and reported as outcomes in their own right (bibliographic record). — [JMIR 2005](https://www.jmir.org/2005/1/e11/)
- **[IND, via secondary]** Business of Apps, citing Adjust: health & fitness had **27% D1 and about 8% D30** retention. Citing AppsFlyer, it gives about **3% D30**. The page appears to use 2023-era data. — [Business of Apps: Health & Fitness benchmarks](https://businessofapps.com/data/health-fitness-app-benchmarks)
- **[IND, via secondary]** Adjust-based 2024 figures: the cross-industry average was 25.3% D1 and 5.7% D30, and health & fitness was 27% / 13% / 8% for D1 / D7 / D30. — [Sonar blog summarising Adjust](https://trysonar.app/blog/app-user-retention-benchmarks-and-what-moves-it.md)
- **[VC]** Phiture's blended cross-industry planning ranges are about 25–26% D1, 11–13% D7 and 5–7% D30, drawn from Adjust, AppsFlyer, Statista and Business of Apps. — [Phiture](https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/)
- **[VC]** Sahha (May 2026) puts the average fitness app at 3–4% day-30 retention. No method is stated. — [Sahha](https://sahha.ai/blog/health-app-churn-retention/)
- **[IND]** RevenueCat, *State of Subscription Apps 2025*: Health & Fitness, Business and Productivity convert well because they meet habitual, long-term needs. — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025/)
  - Secondary write-ups report a median trial-to-paid conversion of about **39.9%** for health & fitness, and **26.8%** for trials of 4 days or less. Across categories, longer trials convert better. — [SaaStr summary](https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps/); [Subscription Insider](https://subscriptioninsider.com/article-type/news/revenuecats-state-of-subscription-apps-2025-report-ais-dominance-retention-challenges-and-the-shift-away-from-pure-subscriptions)
  - Adapty's 2026 data gives a much higher 62% trial-to-paid for health & fitness. The methods differ, so the two figures should not be compared directly. Same search results as above.
- **[VC/IND, method only partly stated]** Amplitude's "7% retention rule": products where at least 7% of a new cohort returns on day 7 are said to be in the **top 25% for activation**. Amplitude says this "correlates strongly" with 3-month retention and attributes it to its *2025 Product Benchmark Report* covering more than 2,600 companies. The retrieved page did not show the actual day-90 correlation figures. — [Amplitude blog](https://www.amplitude.com/blog/7-percent-retention-rule)
- **[VC]** Amplitude (2020) notes that "N-day" retention suits apps used daily, while bracket or unbounded retention gives higher numbers. Metric choice therefore drives benchmark comparisons. — [Amplitude docs](https://amplitude.com/docs/en/analytics/charts/retention-analysis/retention-analysis-interpret)

### Inferences
- Benchmarks disagree by about 2–3x (D30 runs from 3% to 8%) because of the vendor's client mix, organic vs paid installs, the N-day vs unbounded definition, and the year. Pick one source and one definition, and track your own trend over time rather than chasing a cross-vendor number.
- Peer-reviewed mHealth data (3.3% median D30) sits at the bottom of the industry range. The industry figures likely over-represent larger, better-funded apps that use attribution SDKs.
- For subscription health apps, the main early bottleneck looks like install-to-trial rather than trial-to-paid: trial-to-paid is around 40% once a trial starts. This is where onboarding has the most leverage.

### Gaps
- I could not access the primary 2025/2026 Adjust, AppsFlyer, Sensor Tower or Mixpanel benchmark PDFs. All Adjust and AppsFlyer numbers above are second-hand. Productivity-specific D1/D7/D30 numbers from a primary source were not found.
- I found no peer-reviewed study quantifying how well D1 or D7 retention predicts D90 or D365 in consumer apps. Amplitude's correlation claim is unverified.
- RevenueCat's 2026 report (if published) was not retrieved. The 2025 figures above are the most recent I could trace.

---

## 2. Time-to-value and "aha moment" activation metrics

### Takeaway
The famous activation thresholds are company folklore relayed second-hand. That includes Facebook's "7 friends in 10 days" and Slack's "2,000 messages". They are correlational cut-offs found by mining retained vs churned cohorts, not causal results from experiments. The best-documented time-to-value experiment I found is Duolingo moving sign-up after the first lesson: an executive reported about a 20% DAU lift. I found no rigorous evidence on a specific deadline (in seconds or minutes) for reaching value.

### Cited Findings
- **[CO, executive interview]** Duolingo's former growth lead, Gina Gotthilf, said that letting users try a lesson before signing up, and moving the sign-up screen back a few steps, produced roughly a **20% increase in DAUs**. Later tuning of "hard" vs "soft" sign-up walls added **+8.2% DAUs**. A hard wall did worse without soft prompts first. The team tracked several metrics so that a gain in one did not hide losses in learning. — [cur.at interview](https://cur.at/PL7mtg9?m=web); [Intercom podcast with Gotthilf](https://www.intercom.com/blog/?p=15014); [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker)
  - A secondary source restates this as a "20% jump in next-day retention". That conflicts with the executive's DAU framing, so treat it as unreliable. — [StriveCloud](https://strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- **[VC]** Facebook's "7 friends in 10 days" is usually credited to Chamath Palihapitiya and his growth team. Secondary sources disagree on the details (some say "10 friends in 7 days" and attribute it to Andrew Chen) and on the retention multiplier (one says about 3x). None of these come from a primary source. Commentators note the metric is correlational: users who were already engaged add more friends. — [Caroline Frost, "Facebook's 7 friends metric is dead"](https://carolinefrost.github.io/2021/11/16/facebooks-7-friends-metric-is-dead); [Frost, how to build an activation metric](https://carolinefrost.github.io/2021/11/01/how-to-build-an-activation-metric)
- **[VC]** Slack's "2,000 messages" is a team-level threshold that secondary sources tie to Slack disclosures around 2015–16, with claimed 93% retention past it. I found no primary Butterfield statement. — [Frost activation post](https://carolinefrost.github.io/2021/11/01/how-to-build-an-activation-metric); search results from 2026-11-10
- **[VC/IND]** Amplitude presents the day-7 return rate as an activation proxy (see §1). — [Amplitude](https://www.amplitude.com/blog/7-percent-retention-rule)

### Inferences
- The method that holds up is not "copy Facebook's number". It is to find the early behaviour that best separates retained from churned users in your own data, then test whether pushing users toward it causes retention (the step most companies skip). For a habit or fitness app, candidate activation events are things like "first logged workout or habit check-in within day 0" or "N check-ins in the first 7 days".
- Duolingo's result supports a "value before account" order: deliver a core experience (a lesson, a first workout or a first check-in) before asking for registration, permissions or payment.

### Gaps
- I found no peer-reviewed study that defines a time-to-value threshold for mobile apps. Common vendor claims (for example, that users decide within N seconds or that most users leave after one use) could not be traced to a method, so they are omitted.
- Duolingo's "first lesson" was not documented as a formal activation-metric study. No sample sizes or confidence intervals were published.

---

## 3. Length and pacing of onboarding

### Takeaway
The rigorous evidence does not show that long onboarding is bad in itself. It shows that front-loaded instruction (tutorial decks) adds nothing, and that asking for commitment before delivering value (Duolingo's sign-up wall) costs users. The claim that long personalised quiz flows (Noom, Lose It!, Flo, BetterMe) convert well is widely repeated but rests on anecdote. I found no public A/B data with a stated method.

### Cited Findings
- **[IND, UX research with stated method]** NN/g (8 Mar 2020) ran a between-subjects remote unmoderated test with **n=70** (35 read the tutorial, 35 skipped it) on 4 iOS apps with deck-of-cards tutorials (Movesum, Brainsparker, Launch Center Pro, Sketch.Book).
  - **Task success:** 91% for readers vs 94% for skippers (p=0.443, not significant).
  - **Ease rating (SEQ, 1–7):** 4.92 vs 5.49, favouring skippers (**p=0.047**).
  - **Task time:** 93.49 s vs 85.17 s (geometric means, p>0.1).
  - The tutorial gave no benefit and was associated with lower perceived ease.
  - — [NN/g, Mobile tutorials](https://www.nngroup.com/articles/mobile-tutorials/)
- **[VC/expert guidance]** NN/g's position is that onboarding users must digest before use "requires attention and effort, reducing usability", so it should be skipped where possible and contextual help preferred. — [NN/g video: Onboarding, skip it when possible](https://www.nngroup.com/videos/onboarding-skip-it-when-possible/)
- **[CO]** Duolingo: moving the sign-up wall later (fewer gates before value) gave about +20% DAU. See §2. — [cur.at](https://cur.at/PL7mtg9?m=web)
- **[PR] (foundational)** Labour illusion (Buell & Norton 2011, *Management Science* 57(9):1564–1579). Across 5 experiments simulating online travel and dating services, visible signals of effort raised perceived value. People sometimes preferred sites with longer waits that showed work being done over instant results. — [EconBiz record](https://www.econbiz.de/Record/the-labor-illusion-how-operational-transparency-increases-perceived-value/10009293054); [full text, CORE](https://core.ac.uk/download/28952418.pdf)

### Inferences
- When length helps, it plausibly helps through personal relevance plus effort justification and the labour illusion: answering questions and watching a "building your plan" screen raises the perceived value of the output. When length hurts, it plausibly does so through instruction (tutorial screens), gates before value (account or paywall before any payoff) and questions with no visible use.
- A practical rule consistent with the evidence: every screen should either collect data that visibly changes what the user gets, or deliver a piece of value. Pure explanation screens are the ones the evidence says to cut.
- The "long quizzes convert" pattern in weight-loss apps is confounded. These flows usually end in a paywall with a personalised plan, so high conversion may reflect a highly motivated paid-acquisition audience rather than length itself.

### Gaps
- I found no published, method-stated data on per-screen drop-off in onboarding funnels for health apps, and no public A/B tests from Noom, Lose It!, Flo or BetterMe on flow length. Vendor claims (for example "each extra screen loses X%") could not be traced and are omitted.
- No peer-reviewed study directly compares short and long personalised onboarding on long-term retention.

---

## 4. Personalisation questions and behavioural-science levers (IKEA effect, effort, endowed progress, commitment, goal gradient, fresh start) plus a replication caution

### Takeaway
Several levers have solid foundational evidence: endowed progress, labour illusion, fresh start and implementation intentions. All of it comes from lab or field contexts other than app onboarding, and effect sizes shrink under scrutiny. Implementation intentions fall from d=0.65 to roughly d=0.15–0.35 after bias correction. The "sign at the top" honesty finding was retracted for fabricated data. Treat these as hypotheses to test in your app, not guaranteed lifts.

### Cited Findings
- **[PR] Implementation intentions.**
  - Gollwitzer & Sheeran 2006 (94 tests) reported an average **d = 0.65** (foundational). — [Sage/APA record](https://journals.sagepub.com/doi/10.1037/a0015319); [search summary](https://www.thebehavioralscientist.com/glossary/implementation-intentions)
  - Sheeran, Listrom & Gollwitzer (online 2024; *European Review of Social Psychology* vol. 36, 2025; doi 10.1080/10463283.2024.2334563) synthesised **642 tests**. After correcting for publication bias, trim-and-fill gives **d ≈ 0.35** and robust Bayesian meta-analysis gives **d ≈ 0.15 (95% CI 0.08–0.22)**. These bias-corrected figures reached me via a secondary summary; the bibliographic record is at Konstanz. — [Konstanz repository](https://kops.uni-konstanz.de/handle/123456789/69905); [The Behavioral Scientist summary](https://www.thebehavioralscientist.com/glossary/implementation-intentions)
- **[PR] Mental contrasting with implementation intentions (MCII).** A meta-analysis is available (Wang et al., *Frontiers in Psychology* 2021) as a related, more onboarding-relevant variant. I did not retrieve its effect sizes here. — [PMC8149892](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/)
- **[PR] (foundational) Endowed progress (Nunes & Drèze 2006, *JCR* 32(4):504–512).** A car-wash field experiment with 300 loyalty cards compared 8 stamps needed with 10 needed but 2 pre-filled. Redemption was **34% for endowed cards vs 19%**, and the endowed group also completed faster. Secondary sources report the effect collapses when the head start looks arbitrary, so give a reason for it. — [Coglode summary](https://www.coglode.com/nuggets/endowed-progress-effect); [Wikipedia: Goal pursuit](https://en.wikipedia.org/wiki/Goal_pursuit)
- **[PR] (foundational) Goal-gradient (Kivetz, Urminsky & Zheng 2006, *JMR* 43(1):39–58).** Effort speeds up as people approach a reward. This was shown with coffee-card purchase frequency and with web users rating songs (bibliographic record). — [doi:10.1509/jmkr.43.1.39](https://doi.org/10.1509/jmkr.43.1.39)
- **[PR] Fresh start effect (Dai, Milkman & Riis 2014, *Management Science*).** Gym visits, Google searches for "diet" and commitment-contract sign-ups all rise after temporal landmarks: new week, month, year or semester, birthdays (except the 21st) and holidays. Sources disagree on the gym sample size, so check the PDF before quoting it. — [Paper PDF, Wharton](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf); [Knowledge@Wharton](https://knowledge.wharton.upenn.edu/article/need-fresh-start-heres-begin/)
- **[PR] (foundational) Labour illusion (Buell & Norton 2011).** See §3. — [CORE full text](https://core.ac.uk/download/28952418.pdf)
- **[PR] (foundational) IKEA effect (Norton, Mochon & Ariely 2012, *Journal of Consumer Psychology* 22(3):453–460).** People value things they assembled themselves more, but only when they complete the task (bibliographic record). Caution: Ariely is a co-author of the retracted Shu et al. paper below, though the IKEA work itself has not been retracted. — [doi:10.1016/j.jcps.2011.08.002](https://doi.org/10.1016/j.jcps.2011.08.002)
- **[PR, RETRACTED] Caution: "sign at the top" honesty pledge (Shu, Mazar, Gino, Ariely & Bazerman, *PNAS* 2012).** The central claim was that signing an honesty statement at the top of a form reduced dishonesty, based partly on a car-insurance field study of more than 13,000 policyholders. The original authors failed to replicate it in *PNAS* 2020. Data Colada showed the odometer data were fabricated, and the paper was **retracted in September 2021**. Responsibility is disputed. — [PMC retraction context](https://pmc.ncbi.nlm.nih.gov/articles/PMC8463784); [Harvard Crimson](https://thecrimson.com/article/2021/9/1/hbs-research-submitted-for-retraction); [Reason/Volokh](https://reason.com/volokh/2021/08/22/a-big-study-on-honesty-turns-out-to-be-based-on-fake-data/)

### Inferences
- Asking questions upfront has the most defensible rationale when the answers create a plan the user can see (labour illusion, IKEA effect) and when the user commits to a specific when, where and how (implementation intentions). In the onboarding flow, the "when and where will you do this" question is likely worth more than demographic questions.
- Expect real-world effects much smaller than the textbook numbers. For implementation intentions, plan around d ≈ 0.15–0.35, not 0.65.
- Endowed progress is cheap to implement, for example a setup checklist that starts partly complete with a reason ("Account created ✓"). The evidence says the head start must look earned or explained.
- Fresh-start framing suggests timing prompts and goal-setting for Mondays, the first of the month or after a lapse ("start fresh this week").
- The pattern across retracted and shrunken findings is that single striking studies in this area often fail. Prefer meta-analyses and your own A/B tests.

### Gaps
- I found no peer-reviewed study testing upfront personalisation questions against no questions in a mobile health app onboarding with retention as the outcome.
- Goal-gradient and IKEA findings were not re-verified against full text in this session, and their effect sizes are not reported here.

---

## 5. Progressive (contextual, just-in-time) onboarding vs upfront tours and carousels

### Takeaway
The best controlled evidence (NN/g, n=70) found that deck-of-cards tutorials did not improve task success or speed, and that users who read them rated tasks as harder. Learning science strongly favours active doing over passive reading (generation and testing effects), which supports interactive, learn-by-doing onboarding. I found no direct mobile A/B test comparing contextual tips with tours on retention.

### Cited Findings
- **[IND, stated method]** NN/g 2020: no benefit from tutorials; ease ratings were lower for readers (p=0.047); many participants skip tutorials. NN/g recommends contextual help and interactive methods over "a polished manual". — [NN/g](https://www.nngroup.com/articles/mobile-tutorials/)
- **[VC/guidance]** Apple's Human Interface Guidelines (via a translation) say tutorials should be skippable and should not reappear for returning users. — [Translated HIG summary](https://kde.hateblo.jp/entry/2020/06/24/013143)
- **[PR] (foundational) Testing / retrieval-practice effect (Roediger & Karpicke 2006, *Psychological Science* 17(3):249–255).** Practising retrieval beats re-studying for delayed retention (bibliographic record). — [doi:10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x)
- **[PR] (foundational) Generation effect (Slamecka & Graf 1978; meta-analysis Bertsch et al. 2007, *Memory & Cognition* 35:201–210).** Information people produce themselves is remembered better than information they read. Bertsch et al. report a mean effect of about d = 0.40 (bibliographic record). — [doi:10.3758/BF03193441](https://doi.org/10.3758/BF03193441)

### Inferences
- Replace explanatory carousels with a first real action the user performs: log a first habit, do a 1-minute session, set a first reminder time. Explain features in context the first time a user meets them.
- Show a carousel only if it does persuasion work (value proposition before a paywall), not teaching work. The evidence says it does not teach.

### Gaps
- No controlled study with retention as the outcome compared progressive and upfront onboarding in health or fitness apps. The NN/g study measured immediate usability, not retention.
- The generation and testing effects come from verbal-learning experiments. Transfer to UI learning is plausible but not directly demonstrated in the sources found.

---

## 6. Habit formation evidence for habit apps (Lally, streaks, reminders, small wins)

### Takeaway
Habits take weeks to months to form and vary a lot between people (median 66 days, range 18 to a projected 254). Missing a single day does not derail formation. Time-based reminders increase repetition but can undermine automaticity, whereas event-based cues (implementation intentions tied to existing routines) build it. Intact streaks raise engagement and broken streaks lower it. That harm is reduced when a streak can be repaired, and Duolingo's company tests show measurable lifts from streak mechanics.

### Cited Findings
- **[PR] (foundational) Lally, van Jaarsveld, Potts & Wardle 2010, *EJSP* 40(6), doi:10.1002/ejsp.674.** 96 participants chose a daily health behaviour tied to a cue and did it for 84 days. Median time to 95% of plateau automaticity was **66 days, range 18 to 254** (the upper end is a model projection beyond the 84 days observed). Complex behaviours took longer. — [BPS Research Digest](https://bps.org.uk/research-digest/how-form-habit)
  - **Missing one opportunity did not significantly affect habit formation**, but very inconsistent performers did not form habits. — [UCL news 2009](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit)
  - A secondary critique says the 66-day median rests on the subset with good model fit (39 participants), and that more than half did not show the expected curve. This needs checking against the paper. — [The Behavioral Scientist](https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit)
  - Lally (2026 interview) cautions that 66 days is not a universal rule. — [University of Surrey](https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally)
- **[PR] Stawarz, Cox & Blandford 2015, CHI '15, pp. 2653–2662, "Beyond Self-Tracking and Reminders".**
  - A functionality review of **115 habit apps** found that they focus on self-tracking and reminders and do not support event-based cues.
  - In a **4-week study**, reminders supported repetition but **hindered habit development**. Event-based cues (implementation intentions) increased automaticity, and positive reinforcement was ineffective.
  - — [UCL Discovery](https://discovery.ucl.ac.uk/id/eprint/1468224/); [paper PDF](https://researchgate.net/profile/Katarzyna-Stawarz/publication/278405715_Beyond_Self-Tracking_and_Reminders_Designing_Smartphone_Apps_That_Support_Habit_Formation/links/55803b6c08ae15c822d24253/Beyond-Self-Tracking-and-Reminders-Designing-Smartphone-Apps-That-Support-Habit-Formation.pdf)
- **[PR] Stawarz et al., CHI 2014, "Don't Forget Your Pill!"** A review of 229 medication-reminder apps found they rely on timer reminders and ignore the support that existing routines give. — [UCL Discovery](https://discovery.ucl.ac.uk/id/eprint/1418104)
- **[PR] Silverman & Barasch 2023, "On or Off Track: How (Broken) Streaks Affect Consumer Decisions", *JCR* 49(6):1095–1117, doi:10.1093/jcr/ucac029.**
  - Across **7 studies**, highlighting an intact streak in a behaviour log increased later engagement compared with highlighting a broken streak.
  - The effect depends on how the log represents behaviour, not on the behaviour itself: people treat keeping the streak as a goal in itself.
  - The harm of a broken streak is **amplified when users blame themselves** and **attenuated when the streak can be repaired**.
  - — [CU Boulder](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions); [UDel repository](https://udspace.udel.edu/handle/19716/34160)
- **[CO]** Duolingo **Streak Wager** (bet in-app currency on keeping a 7-day streak) produced statistically significant increases in D1, D7 and D14 retention, with **D7 +14%** (relative). No sample size or confidence interval was published. — [Duolingo blog via search](https://blog.duolingo.com/improving-the-streak)
- **[CO]** Duolingo separating the daily goal from the streak: **+3.3% D14 retention, +1% daily active learners**. — [Duolingo blog: Improving the streak](https://blog.duolingo.com/improving-the-streak)
- **[CO]** Duolingo engineering overview of how streaks keep learners committed. — [making.duolingo.com](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)
- **[VC]** Weekend Amulet (weekend streak protection) reportedly gave a 4% higher chance of returning after a week and a 5% lower chance of losing the streak. The streak-freeze cap rising from 1 to 2 reportedly gave +0.38% daily active learners. Both are secondary only and unverified. — [Econsultancy](https://econsultancy.com/six-a-b-tests-used-by-duolingo-to-tap-into-habit-forming-behaviour/); [Viblo](https://viblo.asia/p/duolingo-streak-vi-sao-nguoi-hoc-co-giu-chuoi-ymJXDZ0qJkq)

### Inferences
- Onboarding for a habit app should anchor each habit to an existing routine ("after I pour my morning coffee"), not only to a clock-time push notification. Use reminders as scaffolding that fades, not as the habit trigger.
- Design streaks so that breaks are repairable (freezes, grace days, "repair" actions) and avoid self-blame framing. Silverman & Barasch and Lally both suggest a single miss should not reset meaningful progress.
- Set expectations honestly. Habits take about 2–3 months on average and vary widely, so "21 days" claims are not supported. Retention by day 30 (see §1) is far shorter than the time it takes to form a habit, which is why the first month needs other motivation (value, small wins, social support).

### Gaps
- Evidence on the "what-the-hell" (abstinence-violation) effect after streak breaks comes mainly from older dieting literature, which I did not retrieve in this session. Silverman & Barasch is the streak-specific evidence.
- No peer-reviewed study of "small wins" in habit-app onboarding was found. Endowed progress and goal-gradient (§4) are the closest evidence.
- The Stawarz 2015 study's sample size and effect sizes were not retrieved (it was a small, 4-week qualitative and quantitative field study).

---

## 7. Motion, delight and haptics

### Takeaway
Controlled studies suggest haptic feedback reliably improves subjective ratings (satisfaction, perceived quality, preference) more than objective speed or accuracy, and some users prefer no feedback at all. I found no rigorous evidence that celebration animations or haptics improve onboarding completion or retention. Such claims are vendor marketing.

### Cited Findings
- **[PR] CHI 2019 study of tapping and dragging on flagship phones:** haptic confirmation helped most when the finger hid the target. Subjective experience of haptics was more positive than measured time or accuracy gains. — [Univie HCI course reading list (PDF)](https://teaching.vda.univie.ac.at/hci/20s/materials/Lit-Tests/4TouchscreenHaptics.pdf)
- **[PR] York University, MobileHCI 2013, text entry:** nearly half of respondents preferred no aural or haptic feedback, and feedback mode had **no significant effect on entry speed or accuracy**. — [York University](https://www.yorku.ca/mack/mhci2013d.html)
- **[PR] KAIST (N=80, between-subjects):** touchscreen panel type significantly affected perceived control, ease of use, satisfaction and viewing quality. — [KAIST DSpace](https://dspace.kaist.ac.kr/handle/10203/194673?mode=full)
- **[VC, vendor-funded]** Immersion (a haptics licensor) reports that haptics improve app experience and that "HD" haptics are preferred. This carries a clear conflict of interest. — [Immersion white paper](https://immersion.com/wp-content/uploads/2017/08/tactile-feedback-in-mobile-consumer-attitudes-about.pdf)

### Inferences
- Use haptics and celebration motion for confirmation (a habit checked off, a step completed) and perceived polish, keep them subtle, and let users turn them off. Do not expect them to move retention by themselves.
- Animation that shows work being done (for example "building your plan") may draw on the labour illusion (§3–4). That is better grounded than "delight" claims, but it is still untested in onboarding.

### Gaps
- I found no peer-reviewed or method-stated industry study linking onboarding animation, celebration screens or haptics to activation or retention. Any vendor figure of the form "X% lift from micro-interactions" could not be traced and is omitted.
- The haptics findings above come from search-result abstracts. Full texts and effect sizes were not reviewed.
