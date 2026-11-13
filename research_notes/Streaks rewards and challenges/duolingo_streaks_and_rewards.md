# Duolingo's streak, reward and quest systems, and what Duolingo has published about why they work (as of November 2026)

Reading notes for the report writer:

- Source labels used below. **[CO]** = company-reported (Duolingo blog, shareholder letter, earnings call, or a Duolingo employee speaking in an interview). No sample sizes, confidence intervals or methods are published for almost any of these. **[IND]** = independent peer-reviewed research. **[3P]** = third-party teardown, fan guide or press. **[OP]** = opinion or first-person commentary.
- Duolingo runs constant A/B tests, so rules differ by account, platform and date. Where only third-party guides describe a rule, it is marked [3P] and should be treated as "observed on some accounts", not as an official rule.
- Duolingo's official help center (duolingo.com/help) is rendered client-side and could not be read by the fetch tool. Exact official wording for freeze caps, repair cost and Streak Society tiers is therefore a gap, filled only by Duolingo blog posts, an employee interview and third-party guides.
- Two Android Authority articles returned HTTP 403 and the Duolingo fan wiki returned HTTP 402. Facts attributed to them come from search-result snippets only and are flagged "(snippet)".

## Exactly how does the streak work today: what counts as extending it, Streak Freeze, streak repair, Weekend Amulet or its successors, the Streak Society, and milestones?

### Takeaway
The streak is "consecutive days with at least one completed lesson" (since 2020 it is not tied to a daily XP goal), protected by a layered forgiveness system: up to two Streak Freezes that are applied automatically on a missed day (two are given free when a streak starts), "Earn Back" (do a few lessons shortly after a break to restore it, which replaced gem-paid Streak Repair as the main path), and extra freezes for long streaks through the Streak Society. The Weekend Amulet and the Streak Wager are retired. Milestones at 7, 30, 100 and 365 days get a full-screen "Fire Duo" phoenix animation and a share card, and the Streak Society attaches perks to the same thresholds.

### Cited Findings

**What counts as extending the streak**
- [CO] Before November 2020 a learner had to reach their self-set daily XP goal to extend the streak ("learners could only extend their streak when they reached this daily goal"). Duolingo split the two: completing one lesson a day extends the streak, and the daily goal is tracked separately. — [Duolingo blog, Anton Yu, 19 Nov 2020](https://blog.duolingo.com/improving-the-streak)
- [CO] In 2017 the streak was defined as consecutive days of meeting the learner's self-set daily goal; missing a day reset it to zero. This is the old rule. — [Duolingo blog, Kai Herng Loh, 10 May 2017](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)
- [CO] Jackson Shuttleworth (Group PM, Retention) says the team tested lowering the bar further, from one lesson to one exercise, and it moved DAU "not one bit": it only pulled in the least engaged users. One completed lesson stays the unit. — [Lenny's Podcast transcript, 15 Dec 2024 (third-party hosted transcript)](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [3P] Teardown: the streak increments in the post-lesson sequence of the first lesson of the day; other sessions that day do not show the streak screen. — [Deconstructor of Fun Duolingo teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)

**Streak Freeze**
- [CO] A Streak Freeze pauses the streak for one missed day. Duolingo "doubled down" by letting learners equip up to two at a time; the blog screenshot shows "0 of 2 equipped" and a "Refill streak freezes" button at 400 gems (so 200 gems each at the time). — [Duolingo blog, Osman Mansur, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- [CO] "When you start a new streak, we give you two streak freezes." Originally "you had to buy them with gems." Shuttleworth calls giving two freezes at streak start one of the team's biggest wins. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [CO] "Three streak freezes was actually no better than two streak freezes", and extra freezes trained users to take longer breaks. The team's stated rule of thumb: more flexibility early in a streak, less later. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [3P] Freezes are applied silently when a day is missed, with no confirmation prompt. The cap is 2 for ordinary users and up to 5 for long-streak users with Streak Society bonuses. Freezes also arrive free through milestone refills, chest drops, Daily Quests and league promotions; for Super subscribers the first Daily Quest of the day grants a freeze when inventory is zero. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [3P] One guide prices a freeze at 200 gems on mobile (10 lingots on web). — [duolingoguides.com (via search snippet)](https://duolingoguides.com/how-much-is-a-streak-freeze-on-duolingo/)
- [3P, snippet] A long-term user reports the Streak Society total "used to give me five total freezes (instead of only two)... But this number seems to have been reduced to three." Conflicts with the 5-freeze figure in other guides, so the current cap for long streaks is uncertain. — [Android Authority (403, snippet only)](https://www.androidauthority.com/reasons-give-up-duolingo-streak-3543009)

**Streak repair and Earn Back**
- [CO] Streak Repair cost gems (and earlier real money). "Earn Back" restores a lost streak if the user completes a set of lessons within a window after the break, and was "such a retention winner". The number of lessons and the window are not stated. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [CO] As far back as 2017 Duolingo sold streak repair as an in-app purchase and accepted that the Weekend Amulet cannibalized it because the DAU gain was worth more. — [First Round Review, Gina Gotthilf, 17 Jul 2017](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- [3P] In 2026 repairs still cost gems on at least some accounts, and "Auto Streak Repair" is described as a subscriber perk. — [duolingoguides.com (via search snippet)](https://duolingoguides.com/how-many-duolingo-lessons-can-i-miss-without-losing-my-streak/)
- [CO] Streak Revival, 1 to 30 June 2026: a one-time event for Duo's birthday. Any learner who had built a streak of 30+ days and lost it could restore their single longest lost streak by completing three lessons, with no gems or payment. — [PocketGamer.biz, 2 Jun 2026](https://www.pocketgamer.biz/duolingo-is-restoring-lost-streaks-for-a-limited-time-aiming-to-recover-lapsed-users/)
- [CO] 15.4 million learners revived a streak, including nearly 8 million who had no active streak when the event began; management said these users "are also showing better retention than a typical reengaged cohort" and called the event one-time. — [Q2 2026 earnings call transcript, Motley Fool, 12 Aug 2026](https://www.fool.com/earnings/call-transcripts/2026/08/12/duolingo-duol-q2-2026-earnings-call-transcript/)

**Weekend Amulet, Streak Wager and their successors (retired)**
- [CO] Weekend Amulet (2017, retired): every Friday a learner could equip an item to keep the streak through a weekend without practicing. Built because DAU "decline by as much as 5-10% on weekends". — [Duolingo blog, 10 May 2017](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)
- [CO] Streak Wager (2017, retired): spend in-game currency to bet you will keep the streak 7 more days; payout was double the stake. — [Duolingo blog, 10 May 2017](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)
- [CO] Streak Challenge (the wager's successor, live in Dec 2022): "Wager gems and keep a 7, 14, or 30 day streak!", with "No Streak Freezes allowed." Current status in 2026 not confirmed. — [Duolingo blog, 19 Dec 2022](https://blog.duolingo.com/tips-for-maintaining-streak/)
- [CO] Streak Goal (the current commitment device, no currency): after a lesson the user picks a streak target. The team tested 14 and 50 day options, settled on starting at 30 with an opt-out to an easier goal; preselecting a harder goal lost because the act of choosing drove the effect. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [3P] Onboarding lets new users commit to a 7, 14 or 30 day goal before signup. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)

**Streak Society**
- [3P] Launched May 2022 as a club for 365+ day streaks, later opened at 7 days. Tiers per this guide (updated Dec 2024): 7 days = 3 days of free Super; 30 days = custom app icon; 100 days = 3 extra streak freezes (total 5), refreshed every 100 days; 365 days = "VIP status", which shows the streak next to the name on leaderboards. — [duolingoguides.com, updated 19 Dec 2024](https://duolingoguides.com/duolingo-streak-society/)
- [3P] Same structure in a second teardown: tiers start at 7 days with a chest at each tier (free Super days, gem packs, extra freezes, collectibles); the 365 day tier unlocks VIP status. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)

**Perfect Streak**
- [CO] If a user has used no freezes, the streak is shown in gold. "There's no reward for doing it." It is a visual distinction only. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [3P] Observed thresholds (vary by A/B arm): 5 consecutive freeze-free days earns Perfect Streak, 7 earns a "Perfect Week"; the visual is a yellow halo on the flame and a continuous bar on the calendar. Gems, Super days and freezes stay tied to the regular streak. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)

**Friend Streak**
- [CO] Launched August 2024. A shared streak with up to five friends, each a separate streak; both must follow each other and the invite must be accepted; each person must do a daily lesson; you can nudge a friend who has not practiced. — [Duolingo blog, 5 Aug 2024](https://blog.duolingo.com/friend-streak/)
- [3P] Friend Streak tiers at 7 (Good Friends), 14 (Great Friends), 30 (Best Friends) and 50 days (Lifelong Friends). — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)

**Milestones and what is shown**
- [CO] Milestones named by Duolingo's designer: "one week, one month, 100 day, or one year streak" and beyond. On those days Duo turns into a phoenix ("Fire Duo"), replacing an older balloon illustration (which showed 50, 100 and 365). A square share card ("I just reached a ___ streak!") can be saved or posted without leaving the app. The team chose the phoenix partly because a flame alone does not read the same in every culture. — [Duolingo blog, Kurt Hartfelder, 21 Jan 2022](https://blog.duolingo.com/streak-milestone-design-animation)
- [CO] December 2025: "We launched fresh animations for Streak milestones, Friend Streaks, and lesson-end screens." — [Duolingo blog, product highlights, 10 Dec 2025](https://blog.duolingo.com/product-highlights/)
- [3P] Regular days get only the counter tick-up; landmark days (7, 30, 100, 365) get custom full-screen animations. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [CO] The streak view was made to look like a calendar ("days on top, little circles") because that tested better. In parts of India the flame did not resonate, so the number was emphasized. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)

**Scale**
- [CO] Over 6 million people on a 7+ day streak (Jan 2022). — [Duolingo blog, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- [CO] "Nearly 8 million learners" with a 365+ day streak (Aug 2024). — [Duolingo blog, 5 Aug 2024](https://blog.duolingo.com/friend-streak/)
- [CO] "Over 9 million users with a year plus streak" (Dec 2024). — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [CO via press] Over 10 million users with a 365+ day streak, about 20% of daily users (Simon Hade at PGC London 2026); the article adds the figure "has since risen to more than 15 million", which is ambiguous and may conflate with the Streak Revival count. — [PocketGamer.biz, 2 Jun 2026](https://www.pocketgamer.biz/duolingo-is-restoring-lost-streaks-for-a-limited-time-aiming-to-recover-lapsed-users/)

### Inferences
- The durable design is a low bar plus layered forgiveness: one small unit of real work per day, automatic protection for one or two misses, and a cheap, effort-based way back after a break. Every softening Duolingo has shipped since 2017 moves in that direction, and the company reports each as a retention win.
- Forgiveness has a ceiling. Duolingo's own result (three freezes no better than two, and more freezes lengthen breaks) suggests a cap of two banked "rest days" is the tested optimum for a daily habit, with more generosity early in a streak than late.
- "Perfect Streak" is how Duolingo keeps strictness for those who want it without punishing those who use protection: forgiveness changes the look of the streak (gold versus normal), not its count.
- Payment-based protection (gems for repair, wagers) has been progressively replaced by effort-based protection (Earn Back, Streak Revival: "do three lessons"). For a personal app with no currency, effort-based recovery is the directly copyable form.
- For a training app, the "one lesson" equivalent matters more than the counter: the unit must be small enough to do on the worst day but still be the real activity (Duolingo's one-exercise test showed that lowering the bar below "real work" adds nothing).

### Gaps
- Official help-center wording could not be read (client-rendered page). Not confirmed from a primary source: the exact current freeze cap for long streaks (5 versus 3), the gem price of a freeze and of a repair in 2026, the number of lessons and the time window for Earn Back, the day boundary rule (local midnight is implied by the "10 PM last chance" notification but not stated in a source read here), and the current Streak Society reward table.
- Whether Streak Challenge (gem wager) still exists in 2026 is unconfirmed.
- An August 2026 press item mentions Duolingo gifting a "Streak Shield" to one user; no official description of such an item was found.
- No source states the exact list of milestone days beyond 7, 30, 100, 365 "and beyond".

## What experiments has Duolingo published about streaks, with effect sizes?

### Takeaway
Duolingo has published about a dozen concrete numbers. The large ones are structural (separating the streak from the daily goal: +3.3% D14 retention and +40% more learners on a 7+ day streak; leaderboards: +17% learning time; the red dot: +6% DAU), while the celebrated polish items are small (milestone animation +1.7% D7 retention for new users; two freezes +0.38% DAU). All are company-reported relative lifts with no published methods, and Duolingo's own leaders warn that the streak-to-retention correlations are partly selection bias.

### Cited Findings

All items in this section are **company-reported [CO]**. Percentages are relative changes unless stated.

| Change | Reported effect | Year | Source |
|---|---|---|---|
| Streak separated from daily XP goal (one lesson extends) | D14 retention +3.3%; DAU +1%; share of daily learners on a streak after 20 days +10.5% (+19% among new learners); learners on a 7+ day streak up over 40%. Tradeoff: fewer learners hit their daily goal | 2020 | [Duolingo blog](https://blog.duolingo.com/improving-the-streak) |
| Share of daily learners with a 7+ day streak | "Just over half", up from about a third a year earlier | 2020 | [Duolingo blog](https://blog.duolingo.com/improving-the-streak) |
| Streak Wager (bet currency on 7 more days, double payout) | Significant lifts in D1, D7, D14 retention; D7 largest at +14% (many secondary sources misquote this as D14) | 2017 | [Duolingo blog](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals) |
| Weekend Amulet | "4% more likely to come back a week later", "5% less likely to lose their streak" | 2017 | [Duolingo blog](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals) |
| Weekend Amulet (same test, as told by Gotthilf) | Retention +2.1% at D7 and +4% at D14 | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| Two Streak Freezes equippable instead of one | Daily active learners +0.38% | 2022 | [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit) |
| Three freezes versus two | No better than two; longer breaks | 2024 | [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| Two free freezes granted when a streak starts | "One of our biggest wins" (no number) | 2024 | [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| New post-lesson streak animation with special milestone-day version | New learners' chance of still being active 7 days later +1.7% | 2022 | [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit) |
| Streak Goal button copy "Continue" changed to "Commit to my goal" | "A massive win" (no number) | 2024 | [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| About eight words explaining how the streak works (roughly "do a lesson to extend your streak, miss a day and it resets", from memory) | "Over 10,000 DAUs" | 2024 | [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| Earn Back (do lessons to restore a lost streak) | "Such a retention winner" (no number) | 2024 | [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| Red dot (badge) on the app icon | DAU +6%; V2 of the dot a further +1.6% | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| Achievement badges V1 | DAU +2.4%; session starts +4.1%; store purchases +13% | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| Practice reminder timing | Sent 23.5 hours after the previous session; beat user-stated reminder times | 2017, reconfirmed 2024 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/); [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md) |
| Notification copy ("Hi, it's Duo") | DAU +5% | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| In-lesson coach with growth-mindset encouragement | D14 return +7.2% | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| Delayed sign-up | DAU about +20%; later soft and hard wall tuning +8.2% | 2017 | [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/) |
| Leaderboards (leagues) | Overall learning time +17%; highly engaged learners (1+ hour a day, 5 days a week) tripled | 2018 to 2019 | [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) |
| Friend Streak | Learners with at least one are "22% more likely to complete their daily lesson" (observational, not an A/B result) | 2024 | [Duolingo blog](https://blog.duolingo.com/product-lessons-friend-streak/) |
| Home-screen widget | "Half of the learners with the widget installed have a streak of at least 6 months"; "far better retention", said to hold after controlling for commitment; no lift number | 2023 | [Duolingo blog](https://blog.duolingo.com/widget-feature/) |
| XP rebalanced toward path lessons | Time Spent Learning Well up about +1.1M minutes/day (partial) and +1.8M (full) | 2024 | [Duolingo blog](https://blog.duolingo.com/time-spent-learning-well/) |
| Streak Revival event | 15.4M streaks revived; better retention than a typical re-engaged cohort | 2026 | [Q2 2026 earnings call](https://www.fool.com/earnings/call-transcripts/2026/08/12/duolingo-duol-q2-2026-earnings-call-transcript/) |

**The CURR model (Jorge Mazal, former CPO)**
- CURR (Current User Retention Rate) is the chance a current user returns; in the daily version a current user is someone active today and at least one other time in the prior 6 days. In a simulation that moved each rate 2% per quarter for three years, "CURR had a gigantic impact on DAU: 5 times the impact of the second-best metric." — [Lenny's Newsletter, Jorge Mazal, Feb 2023](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Over four years: DAU grew 4.5x, CURR rose 21%, daily churn of the best users fell by over 40%, and the share of DAU with a 7+ day streak "increased almost 3 times to more than half of our DAU." — [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- The streak work that Mazal lists: a streak-saver notification (late-night alert to users about to lose a streak), calendar views, animations, streak freezes and streak rewards. — [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Mazal's caveat on the "10-day streak" finding (drop-off falls sharply after a 10-day streak): "a lot of this was simply correlation and selection bias." — [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Failed copies from other games: a Gardenscapes-style moves counter ("No change to our retention. No increase in DAU") and a referral program (new users +3% only). — [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- Notification rule: "protect the channel"; volume increases need CEO approval, gains came from timing and copy. — [Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- CURR in 2026: at "an all-time high, increasing approximately 1 percentage point over the last year"; management says "tiny changes to CURR end up implying pretty large changes in daily active users over time because it really compounds." A third-party summary of the shareholder letter puts it at 84%. — [Q2 2026 earnings call](https://www.fool.com/earnings/call-transcripts/2026/08/12/duolingo-duol-q2-2026-earnings-call-transcript/)

**Other published claims**
- "Over 600 experiments on the streak" in four years; "we shut down about half of our experiments." — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- Retention climbs steeply through the first seven days of a streak and then flattens ("once you get to seven days, loss aversion kicks in, and you retain"), so the team optimizes for getting new users to day 7. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- Correlational claims: learners who reach a 7-day streak are 2.4x more likely to return the next day (2020) and 3.6x more likely to complete their course (2022); learners who follow friends are 5.6x more likely to finish their course. — [Duolingo blog 2020](https://blog.duolingo.com/improving-the-streak); [Duolingo blog 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit); [Duolingo blog, Friends Quests](https://blog.duolingo.com/friends-quests/)
- Framing insight: going from 2 to 3 days is +50%, from 200 to 201 only +0.5%, which is why early days and round milestones get the celebration. — [Duolingo blog, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- The 10 PM "last chance" streak-saver notification is perceived positively by users, per the team. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- A metric win the team refused: showing XP ticking up during the lesson won on metrics but was shut down to keep the lesson a focused learning space. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- Ship threshold in 2017: launch only if a key metric improves at least 1%; "you should have at least 100,000 DAUs to run an A/B test." — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- DAU context: 56.5M in Q1 2026 (+21% YoY) and 58.7M in Q2 2026 (+23%). — [Q1 2026 letter (via search snippet)](https://app.edgar.tools/filing/1562088/0001628280-26-029790/q1fy26duolingo3-31x26share.htm); [Q2 2026 results, GlobeNewswire](https://www.globenewswire.com/fr/news-release/2026/08/05/3339653/0/en/duolingo-reports-second-quarter-2026-results.html)

### Inferences
- Rank order of what moved the numbers: (1) making the streak easier to keep and easier to understand, (2) reminders at the right time, (3) forgiveness, (4) commitment (goal picking), and only then (5) animation polish. The milestone animation, the thing most often copied, is the smallest published effect (+1.7% on new users).
- Many of these effects are percent lifts at tens of millions of users. A one-person app cannot detect or need a 0.38% lift. What transfers is the direction of each result, not its size. Gotthilf's own guidance says small products should only chase changes worth 20 to 30%.
- Cheap copy changes ("Commit to my goal", an eight-word explanation of the rule) were reported as among the biggest wins. Explaining the streak rule in one line where it is shown is the lowest-cost item to copy.
- The selection-bias caveat applies to every "users with X are N times more likely" claim (7-day streak, widget, Friend Streak, friends). Only the A/B results (goal separation, wager, amulet, two freezes, animation, red dot, badges) are causal evidence, and still company-reported.
- Choice is the active ingredient in commitment features: the streak goal worked when the user picked it and failed when preselected.

### Gaps
- No public number for: Earn Back, "Commit to my goal", two free freezes at streak start, the streak-saver notification on its own, the widget (lift), Perfect Streak, Streak Society, or Streak Goal.
- No Duolingo source publishes sample sizes, test durations, confidence intervals or long-run holdouts for any streak experiment.
- Engineering-blog posts on streak infrastructure exist (for example "How we protect learner streaks from site issues") but were not read; they concern reliability, not behavior.
- The Q3 2026 results (due early November 2026) were not checked.
- A widely repeated claim that Streak Freeze "reduced churn by 21% for at-risk users" appears only in a student portfolio with no primary source and should not be used.

## How do XP, XP boosts, gems, hearts or energy, and daily quests interact? What are the quest types, how are they chosen, what are friend quests and the monthly challenge?

### Takeaway
XP is the score that drives leagues; gems are the currency that buys protection and refills; energy (which replaced hearts on mobile from mid-2025) limits free play; and three Daily Quests, ordered easy to hard, pay out chests of gems and timed XP boosts and count toward a monthly, quest-based badge. Duolingo has reworked each loop when it rewarded grinding: the monthly challenge moved from XP to quests, XP was rebalanced toward forward progress, Early Bird and Night Owl chests were retired, and boosts became auto-starting.

### Cited Findings

**XP and leagues**
- [CO] Leagues: a new weekly league starts every Sunday in the user's time zone; there are 10 leagues (5 at launch in 2018); learners are matched with others of similar study habits and time zone across all courses; the top 10 in Diamond qualify for the Diamond Tournament (quarterfinals, semifinals, finals); accounts with "illegitimate XP gains" are removed; opting out means making the profile private. — [Duolingo blog, 3 May 2023](https://blog.duolingo.com/duolingo-leagues-leaderboards/)
- [3P] Cohorts of 30 ranked on 7 days of XP. Tier order: Bronze, Silver, Gold, Sapphire, Ruby, Emerald, Amethyst, Pearl, Obsidian, Diamond. Observed promotions per 30: Bronze 20, Silver 15, Gold 10, Sapphire to Pearl 7, Obsidian 5. Top 3 win gems. A "League Repair" offer at 2,000 gems was observed. Other fan guides give different cutoffs, so these vary by time or test arm. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/leagues)
- [CO] December 2025: friends can now be seen and competed with in leaderboards. — [Duolingo blog, 10 Dec 2025](https://blog.duolingo.com/product-highlights/)
- [CO] Duolingo admits XP invites grinding: leaderboards are "another area where XP grinding can happen", the old Total Sessions metric "was biased towards people who were grinding on shorter, easier sessions", and XP was increased along the path so rewards are "proportionate to effort and learning outcomes". Its quality metric is Time Spent Learning Well = minutes on the path + 0.5 x minutes in other lessons. — [Duolingo blog, Rachel Salvador, 13 Jun 2024](https://blog.duolingo.com/time-spent-learning-well/)

**XP boosts**
- [3P] Early Bird and Night Owl chests (rewards for a lesson in a morning or evening window, paying a timed 2x XP boost, gems or freezes) have "quietly disappeared"; Duolingo support reportedly said they "have been retired". The same report says the triple XP boost no longer starts on demand: it becomes available the next day and "automatically activates the next time you start a lesson", which users dislike. — [TechIssuesToday, 9 Dec 2024](https://techissuestoday.com/duolingo-xp-boost-and-daily-chests-changed)
- [3P] Older mechanics, now removed or changed: Early Bird gave 2x XP in a morning window, Night Owl in an evening window; a weekend "Happy Hour" added bonus XP; the third daily quest chest usually held a 15-minute XP boost. Guides conflict on exact windows. — [duolingoguides.com (via search snippet)](https://duolingoguides.com/duolingo-xp-happy-hour/)
- [OP, snippet] A 2026 critique says XP Boost rewards "turn daily practice into a stressful, ticking-clock countdown" because the timer starts whether or not the user has time. — [Android Authority (403, snippet only)](https://androidauthority.com/duolingo-xp-boost-ux-trap-3674572)
- [CO] Friends Quest chest shown in Duolingo's own post contains gems and a 2x boost potion. — [Duolingo blog, 9 Sep 2022](https://blog.duolingo.com/friends-quests/)

**Gems**
- [CO] Gems buy Streak Freezes (400 gems to refill two in a 2022 screenshot), energy refills, streak wagers and XP boost gifts to friends. — [Duolingo blog 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit); [Duolingo blog, energy](https://blog.duolingo.com/duolingo-energy/); [Duolingo blog, Friends Quests](https://blog.duolingo.com/friends-quests/)
- [3P] Observed prices: full energy refill 750 gems; League Repair 2,000 gems; top-3 league finish pays about 60 gems. — [duolingoguides.com, updated 30 Sep 2026](https://duolingoguides.com/duolingo-energy-system/); [Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/leagues)

**Hearts replaced by Energy**
- [CO] Announced 3 July 2025. Under hearts, "each mistake cost 1 heart for free learners", which was "not the most effective way to support learning"; beginners were "2X more likely to run out of hearts mid-lesson". Energy: start full, "each lesson uses a little bit of energy", "you earn energy when you get multiple answers in a row right", reviewing mistakes at lesson end is free, it "fully recharges in about a day", and it can be topped up with a rewarded ad, a gem refill, perfect lessons, adding a friend and chests. Duolingo says "our data shows it helps more learners complete lessons" (no figure). — [Duolingo blog, 3 Jul 2025](https://blog.duolingo.com/duolingo-energy/)
- [3P] Observed numbers: about 25 units; 1 unit per question right or wrong; +1 to +5 back per 5-correct run; ad gives +3 to +5; subscribers have unlimited energy; web still uses hearts; rolled out broadly on mobile in late 2025. — [duolingoguides.com, updated 30 Sep 2026](https://duolingoguides.com/duolingo-energy-system/)
- [CO] 2026: a "Super Lite" tier test gives "twice as much energy" instead of unlimited; during free trials energy and ads are turned off. — [Q2 2026 earnings call](https://www.fool.com/earnings/call-transcripts/2026/08/12/duolingo-duol-q2-2026-earnings-call-transcript/)
- [3P] Reception was hostile in parts of the user base: change.org petitions to restore hearts and "why I quit" columns. — [Android Authority, "quitting Duolingo energy system" (search result)](https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/)

**Daily Quests**
- [CO] Three Daily Quests per day. "The order of the Quests matters!": the first is meant to "get you going" and is usually the easiest; they "get harder and harder" and typically value activities that move the learner forward (finish a unit, read the next Story). "These are optimized very carefully for TSLW." — [Duolingo blog, 13 Jun 2024](https://blog.duolingo.com/time-spent-learning-well/)
- [CO] December 2025: "boosted rewards for learners who complete all three Daily Quests." — [Duolingo blog, 10 Dec 2025](https://blog.duolingo.com/product-highlights/)
- [3P] Observed quest types include earn N XP, complete N lessons, perfect lessons, accuracy thresholds, time spent, stories and timed challenges; each quest pays a chest. — [lingoly.io, 29 Jul 2026](https://lingoly.io/duolingo-monthly-badge/)
- [3P] Session-end shows a "daily quest update" screen with a progress bar (for example 1 of 2 lessons), a chest and a Continue button. — [ScreensDesign capture library](https://screensdesign.com/apps/duolingo-language-lessons/)

**Friends Quests**
- [CO] Launched September 2022. Each week the app pairs the user with one random mutual-follow friend and assigns a random shared goal (a set amount of XP, or a number of perfect lessons). Assignment happens after 1 p.m. EST on Tuesday if the user has done at least one lesson that week; the pair has five days. Users cannot pick the partner; inactive friends are not paired. Nudges are pre-written messages; XP boosts can be gifted with gems. Mobile only. Can be turned off in settings. — [Duolingo blog, 9 Sep 2022](https://blog.duolingo.com/friends-quests/)
- [CO] December 2025: "a universal matching system so even learners without friends can join in on Friends Quests." — [Duolingo blog, 10 Dec 2025](https://blog.duolingo.com/product-highlights/)
- [3P] Reported rewards on completion: a 30-minute XP boost, 100 gems, and credit worth 5 quests toward the monthly badge. — [duolingoguides.com (via search snippet)](https://duolingoguides.com/what-is-a-quest-in-duolingo/)

**Monthly challenge and badge**
- [CO] The Monthly Challenge was changed from XP-based to Quest-based because XP targets let learners "game the system" by earning XP in bulk near month end. Friends Quests "are worth more Quest Points than daily challenges." — [Duolingo blog, 13 Jun 2024](https://blog.duolingo.com/time-spent-learning-well/); [Duolingo blog, 9 Sep 2022](https://blog.duolingo.com/friends-quests/)
- [3P] Before July 2022 the target was 1,000 XP in the month. Since then each user gets a personalized quest count; observed targets range from 20 to 50 (some reports up to 100), lower for less active users. The badge is themed each month (for example "Earth Month Challenge", "Duo's Chess Match"), is earnable only in its month, and missing it carries no penalty. — [lingoly.io, 29 Jul 2026](https://lingoly.io/duolingo-monthly-badge/)
- [3P] A "Weekend Quest" (short special quest on weekends) appeared for some users in early 2026. — [lingoly.io (via search snippet), Jan 2026](https://lingoly.io/duolingo-weekend-quest/)

### Inferences
- The interaction is a ladder of time scales: one lesson (XP, energy), the day (streak, three quests, chests), the week (league, friends quest), the month (badge). Each short loop feeds the next longer one, so a single lesson moves four meters at once.
- Duolingo's own corrections are the useful lesson: any reward counted in a raw, farmable unit (XP) got gamed, so the long-horizon goals were re-denominated in "quests completed" and quests were pointed at forward progress. For a training app, the monthly goal should count completed planned sessions or habit days, not a points total.
- Time-of-day multipliers and countdown boosts are the least proven and most criticized parts (retired chests, forced auto-start boosts, "ticking clock" complaints). They are the weakest candidates to copy.
- Quest targets are personalized by recent activity (lower targets for less active users, per third-party observation). A personal app can do the same with its own history: set the monthly target from what the person actually did in recent months.
- Hearts punished mistakes and blocked beginners; energy charges for volume instead. Both exist mainly to sell subscriptions, so neither has a role in an app with nothing to sell.

### Gaps
- Duolingo has not published how daily quests are selected per user or how targets are computed. The only primary statement is "ordered easy to hard and optimized for TSLW".
- No primary source for current chest contents (gem amounts, boost length and multiplier), the gem economy, or 2026 boost rules. All numbers are third-party observations and vary by test arm.
- No published experiment results for Daily Quests, Friends Quests, the monthly badge or energy (only "helps more learners complete lessons").
- Official league promotion and demotion cutoffs are not published; fan sources conflict.
- Whether Early Bird and Night Owl are gone for all users in 2026 is not confirmed by Duolingo in writing; the retirement statement is a support reply quoted by a third party.

## What does the lesson-complete celebration consist of, how long does it take, and can it be skipped?

### Takeaway
After a lesson Duolingo shows a short stack of full-screen cards, each dismissed with a button: a lesson-complete card with three stats (total XP, time, accuracy), then on the first lesson of the day the streak screen (flame, counter ticking up, week calendar; a phoenix animation on milestone days), then quest progress with a chest, and sometimes league or promotion screens. Duolingo has published the design intent and one effect size (+1.7%) but nothing on duration, haptics or sound, and third-party reviewers complain that the stack takes too many taps.

### Cited Findings
- [3P] Lesson-complete card: mascot illustration on a bright background, headline (for example "Perfect lesson!"), three stat tiles such as "TOTAL XP 25", "SPEEDY 1:56", "AMAZING 100%", and a "Claim XP" button. — [ScreensDesign capture library](https://screensdesign.com/apps/duolingo-language-lessons/)
- [3P] On the first lesson of the day, after the small celebration and a tap on Continue, the streak increment screen follows with a full-screen flame and counter tick-up. Regular days get only the tick-up; milestone days (7, 30, 100, 365) get custom full-screen animation. — [Deconstructor of Fun teardown, undated](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [3P] A daily quest update screen follows, showing progress toward a quest, a chest and a Continue button. — [ScreensDesign capture library](https://screensdesign.com/apps/duolingo-language-lessons/)
- [CO] The milestone animation was designed like a video-game power-up: Duo becomes a phoenix; timing and energy were tuned over several rough passes; the screen ends in a share card. No duration, tool, haptic or sound details are given. — [Duolingo blog, Kurt Hartfelder, 21 Jan 2022](https://blog.duolingo.com/streak-milestone-design-animation)
- [CO] The new post-lesson streak animation, with the special milestone version, raised new-learner D7 activity by +1.7%. — [Duolingo blog, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- [CO] Haptics are part of the streak moment: "your phone's buzzing, it just feels awesome." The streak screen was iterated toward a calendar look ("days on top, little circles"). — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [CO] The Streak Goal prompt and the widget install prompt are also shown in this post-lesson slot; widget installs "skyrocketed" after an animated explainer was tested after lessons. — [Lenny's Podcast transcript](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md); [Duolingo blog, 29 Aug 2023](https://blog.duolingo.com/widget-feature/)
- [CO] December 2025: new animations for streak milestones, Friend Streaks and lesson-end screens. — [Duolingo blog, 10 Dec 2025](https://blog.duolingo.com/product-highlights/)
- [CO] Inside the lesson, Duolingo deliberately keeps rewards out: XP ticking up during lessons won on metrics but was removed to protect focus. Celebration is concentrated at the end. — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- [CO] Animated icons held learners' attention longer than static illustrations (from Duolingo's art-style post, via search snippet). — [Duolingo blog, shape language](https://blog.duolingo.com/shape-language-duolingos-art-style/)
- [OP] A product-design critique after 400 days of use: the exit takes too many taps ("two obligatory clicks feel excessive"), and XP total and combo bonus could be one animated screen. — [UX Planet (via search snippet)](https://uxplanet.org/analyzing-duolingo-from-product-design-perspective-after-400-days-of-non-stop-practice-c4d4809bdb37)
- [3P] Lessons end with "lively illustrations and character confetti"; character micro-animations (a wing flap after a correct answer, a spin at a milestone) act as feedback cues. — [60fps design newsletter, 29 Dec 2024](https://60fpsdesign.substack.com/p/fun-in-every-frame)

### Inferences
- The structure to copy is "one earned moment at a time": a stats card first (what you just did), then the streak (what it added up to), then progress toward the next reward. The streak screen appears once per day, not once per session, which keeps it special.
- Each card is advanced by a tap, so the user controls the pace; the cards are not timed and cannot be bypassed as a group. That is the main complaint from heavy users. A personal app should keep the daily moment to one or two cards and let a single tap dismiss everything.
- Ordinary days get a counter tick and a haptic; only round milestones get the big animation. Scarcity of the big animation is part of the design.
- The reward moment is also Duolingo's upsell and prompt slot (goal commitment, widget, friend invites). Without a growth agenda, that slot can be used for one useful next step instead (for example tomorrow's planned session).

### Gaps
- No source, Duolingo or independent, gives the duration of the session-end flow, the number of screens on a typical day, or measured time to dismiss. "How long does it take" cannot be answered with a citation; from the descriptions it is 2 to 5 tap-through cards.
- No source confirms a skip control. Third-party descriptions imply each card requires a tap and there is no "skip all"; this is an inference from critiques, not a documented rule.
- Nothing published on the sound design, the haptic patterns, or the animation tooling for the streak flame (Rive or Lottie use is widely discussed in design circles but no primary source was read here).
- Duolingo has not published the logic that orders or caps session-end screens.

## What criticism and independent evidence exist about the streak, and how has Duolingo softened it?

### Takeaway
Independent research supports the core mechanism (a visible intact streak raises later engagement; a visibly broken one lowers it, more so when the person blames themselves, less so when repair is possible) but does not show that streaks improve learning, and it documents costs: people come to value the streak over the activity, and quantification can drain enjoyment. Duolingo's own record agrees with the criticism in practice: nearly every streak change since 2017 has made the streak easier to keep or easier to restore, and the company has repeatedly had to redirect XP and quest rewards away from grinding.

### Cited Findings

**Independent research on streaks [IND]**
- Silverman & Barasch (2023), "On or Off Track: How (Broken) Streaks Affect Consumer Decisions", Journal of Consumer Research 49(6), 1095 to 1117, seven studies. A streak is three or more consecutive performances. Intact streaks highlighted in a log increase later engagement relative to highlighted broken streaks. The effect depends on how the log represents behavior, not on actual past behavior. It is stronger when people blame themselves for the break than when the cause is external, and weaker when a broken streak can be "repaired". Mechanism: people treat keeping the logged streak as a goal in itself. — [University of Delaware repository record](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb)
- Coverage of the same work: "a small, but reliable tendency for people to shift away from a behavior after a streak was broken." — [Psychology Today, Jun 2023](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation)
- Etkin (2016), Journal of Consumer Research 42(6): people do more of what they track, but measurement can reduce enjoyment of activities they already wanted to do (as summarized in a 2026 commentary). — [The Decision Lab, 2 Mar 2026](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- The University of Pennsylvania and UCLA work that Duolingo itself cites: allowing some "slack" in a goal can motivate more than rigid rules. Duolingo uses it to justify the freeze. — [Duolingo blog, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)

**Independent research on Duolingo and learning [IND]**
- Loewen et al. (2019), ReCALL: nine learners studied Turkish on Duolingo for a semester. They improved on L2 measures; there was a positive, moderate correlation between time spent and gains; participants liked the flexibility and gamification but reported variable motivation and frustration with the materials. Very small sample, and the correlate is time, not streak length. — [ReCALL, Cambridge University Press](https://www.cambridge.org/core/journals/recall/article/abs/mobileassisted-language-learning-a-duolingo-case-study/A4D7C8F71782A37D258C19F357DDBCBE)
- Shortt et al. (2021), systematic review of Duolingo literature 2012 to 2020: research emphasizes app design over the process and outcomes of learning, and the link between individual gamification elements and learning outcomes is understudied (from search snippet). — [Computer Assisted Language Learning](https://informahealthcare.com/doi/full/10.1080/09588221.2021.1933540)
- A 2026 study of 191 multilingual Duolingo users on competition beliefs notes that gamification "may also trigger anxiety, reduce self-efficacy, and undermine engagement" (from search snippet; not read in full). — [University of Essex repository](https://repository.essex.ac.uk/43461/1/s10212-026-01157-3.pdf)
- Not independent: efficacy studies with Duolingo staff among the authors (for example Jiang et al. in CALICO Journal on reading and listening at CEFR A2 with 245 learners). — [CALICO Journal](https://journal.equinoxpub.com/Calico/article/view/26704)
- No peer-reviewed study linking streak length to proficiency was found.

**Criticism and commentary [OP / 3P]**
- "Streak Creep" (The Decision Lab, March 2026): streaks are spreading across products so each matters less and feels like obligation; a 566-day Duolingo user says he often picks Duolingo over harder, more useful practice; the app uses guilt copy ("You made Duo sad"); recommendation is to tie gamification to users' own goals, offer real rewards and avoid guilt. Note the article's summary of Silverman & Barasch ("users who break a streak are more likely to quit the platform") is stronger than the abstract. — [The Decision Lab, 2 Mar 2026](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- Independent column: a self-described "Duolingo addict" reports anxiety when the day's lesson is unfinished; a coach quoted says the idea of breaking the streak "can create stress and anxiety". — [The Independent, via AOL](https://www.aol.com/m-duolingo-addict-language-app-063000890.html)
- Android Authority columns (snippets only): reasons to give up the streak; the XP boost as a "stressful, ticking-clock countdown"; a June 2026 request for a vacation mode because "you only get a few" freezes, so anything beyond a long weekend is unprotected. — [Android Authority](https://www.androidauthority.com/reasons-give-up-duolingo-streak-3543009); [Android Authority](https://androidauthority.com/duolingo-xp-boost-ux-trap-3674572); [Android Authority](https://www.androidauthority.com/duolingo-changes-i-want-to-see-3671847/)
- A parenting guide describes "performative learning" in children who care about the number more than the language. Low-authority source. — [Screenwise guide](https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids)

**Duolingo's own admissions and softening over time [CO]**
- 2017: Weekend Amulet, accepting lost streak-repair revenue for retention. — [First Round Review](https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/)
- 2020: streak no longer requires the daily XP goal; one lesson is enough. Duolingo found almost 40% of learners active two days running with no streak had the "intense" goal: the strict rule was denying streaks to its most ambitious daily users. — [Duolingo blog, 19 Nov 2020](https://blog.duolingo.com/improving-the-streak)
- 2022: two freezes equippable. Duolingo states the principle: strict rules can backfire by discouraging learners after a break, and flexibility helps people return quickly after missing a day or two. — [Duolingo blog, 31 Jan 2022](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- By 2024: two free freezes at the start of every streak; Earn Back replaces paying; Perfect Streak marks freeze-free streaks with a gold look only. The team also holds a line: "I don't want all of these users to stop caring about their streak", and one colleague is described as "the keeper... of the sanctity of the streak". — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)
- 2024: Duolingo says "If all a learner can do on one day is extend their streak, that's OK!", and acknowledges XP farming in monthly challenges and leagues, which it corrected by switching to quests and rebalancing XP. — [Duolingo blog, 13 Jun 2024](https://blog.duolingo.com/time-spent-learning-well/)
- 2026: Streak Revival restores lost 30+ day streaks for three lessons, after "tens of thousands" of public requests across more than 80 countries. — [PocketGamer.biz, 2 Jun 2026](https://www.pocketgamer.biz/duolingo-is-restoring-lost-streaks-for-a-limited-time-aiming-to-recover-lapsed-users/)
- Employees themselves do late-night lessons to save streaks, and a bug that wiped an employee's four-month perfect streak is told as proof of how much people care. Bing Gordon's line, quoted by Shuttleworth: "The reason why users care about your streak so much is because you care about your streak so much." — [Lenny's Podcast transcript, 15 Dec 2024](https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/episodes/jackson-shuttleworth/transcript.md)

### Inferences
- What is proven (independently): showing an intact run motivates; showing a broken run demotivates, especially when it feels like the person's own fault; a repair path softens the blow. Design consequence: never show a bare zero after a miss. Show the repair path, the longest run, or totals, and attribute planned rest to the plan, not to failure.
- What is proven (company A/B, at scale): a low bar, timely reminders, two units of forgiveness, effort-based restoration, and user-chosen goals each raise retention.
- What is not proven: that streak length improves the underlying skill. Duolingo's "3.6x more likely to complete the course" and similar figures are correlations, and its own former CPO calls such findings selection bias. For a training app the streak should count the thing that produces the outcome (the planned session or the habit), so that engagement and outcome cannot drift apart the way XP and learning did.
- A daily streak is a poor fit for training with planned rest days. Duolingo's Weekend Amulet, freezes and vacation-mode requests all exist because a strict daily rule collides with real life. A plan-aware streak (rest days count as kept) solves at the rule level what Duolingo solves with consumables.
- Guilt copy and loss-framed notifications are the most criticized element and the least necessary for a single-user app whose user chose the goals.
- The Silverman & Barasch repair result cuts both ways: repair reduces the damage of a break but also reduces how much the streak motivates. Duolingo's "three freezes no better than two" is consistent with that. Forgiveness should be limited and visible.

### Gaps
- No independent, peer-reviewed measurement of "streak anxiety" prevalence among Duolingo users was found. Evidence is first-person columns, small self-report studies and forum posts.
- No independent replication of any Duolingo A/B result exists; outsiders cannot access the data.
- No study, independent or company, tests whether Duolingo streak length causes better proficiency.
- Major-outlet reporting (Wall Street Journal, The Guardian, The Atlantic) on streak anxiety was searched for and not surfaced; coverage found was The Independent, Android Authority and trade press.
- The full text of several academic items was not read (Shortt et al. 2021, the 2026 Essex study, Etkin 2016); they are cited from abstracts, snippets or secondary summaries as marked.
