# Goals, reflection and area toggles: teardowns of goal, habit, wellbeing and journaling apps

Research date: 2026-11-12. Scope: iPhone apps, 2024 to 2026 versions where sources allow.

How to read these notes:

- "Primary" means the app maker's own site, help center, release notes or App Store listing, or Apple's own pages. "Reviewer" means a third party (MacStories, 9to5Mac, a design critique, a blog). "Snippet only" means I saw the claim in a search result summary and could not open the page (several help centers returned HTTP 403), so treat it as lower confidence.
- I could not look at the apps themselves. Nothing here is from a screenshot I inspected. Where a source does not describe a screen, I say so in Gaps and do not fill it in.
- Thin coverage: Fabulous, Calm, Way of Life, Strides, Habitify, Glasp. Good coverage: Duolingo, Apple Fitness, Apple Journal, Oura, Whoop, Bevel, Streaks, Gentler Streak, Reflectly, Day One streaks.

## 1. Per app: what the eye lands on first, the one next move, and how much is on the first screen

### Takeaway
The clearest home screens put one thing at the top that answers "how am I doing" (rings, three dials, a path, a short checklist) and make the next move a single, obviously tappable object directly under or inside it (the next circle on a path, the first unchecked item in a list of three, one "+" button). The apps that get called cluttered (Finch, Whoop, Fabulous) are the ones where the core checklist competes with shops, journeys, coaching cards and upsells on the same screen.

### Cited Findings

#### Duolingo (home path)
- Primary: Duolingo rebuilt the home screen as a single path "to follow step by step", launched November 1, 2022, because learners said they were not sure they were using the app the "correct" or "best" way. (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/))
- Primary: each circle on the path is one level. Practice and stories were moved into the path so that "Practice is also forward progress." Lessons are "grouped into smaller units" with a unit header that describes the concept in plain words ("get directions" instead of "City 3") and a guidebook button at the top right of each unit. (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/))
- Primary: if you scroll away from your place you "jump back by tapping the floating arrow button in the bottom right corner." Crowns were replaced by seeing "how you're progressing down the path." (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/))
- Primary: monthly challenges and quests were moved off the home screen to a Quests tab, which keeps the home screen to one job. (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/))
- Reviewer and user reaction: the path drew a backlash from existing users who lost the freedom to pick lessons, including a petition. This is anecdotal reporting from a blog, not measured data. (Source: [PiunikaWeb](https://piunikaweb.com/2022/10/13/duolingo-app-update-with-path-ui-faces-backlash-from-users/))
- The Duolingo post does not describe the visual marker for the next lesson (I could not confirm from a primary source how the "START" callout looks), and it reports no measured results. (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/))

#### Finch
- Reviewer: the home screen is "the central hub" holding "the checklist of core tasks" alongside "shops, guided 'journeys,' community spaces, and frequent prompts for premium upgrades." The critique says the checklist visually competes with secondary features and that the cluttered home page "undermines natural mapping." Its recommendation: elevate the daily checklist and move secondary options into a collapsible menu. (Source: [Pratt IXD design critique, Sept 2025](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))
- Reviewer: "Completing a task results in immediate visible responses": the bird gains energy, an animation plays, or a message appears such as "Your Finch feels calmer." Feedback is inconsistent for journaling: "Journaling entries, for example, sometimes fail to trigger animations, leaving users unsure whether their input was recorded." (Source: [Pratt IXD design critique](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))
- Reviewer: another teardown says the primary loop is "incredibly strong" but the home screen "can get busy", and that the pet's adventure after being energized "provides a delightful delayed gratification that encourages users to complete all their daily tasks." (Source: [ScreensDesign showcase](https://screensdesign.com/showcase/finch-self-care-pet))
- Reviewer, snippet only: completing goals earns rainbow stones and energy for the bird; the widget keeps the bird visible as a daily reminder. (Source: [WhistleOut review](https://www.whistleout.com/CellPhones/Guides/finch-self-care-app-review))

#### Fabulous
- Reviewer: the product is organized around routines (morning, afternoon, evening), each a sequence of habits done in order. A chosen challenge is listed on the home screen with the activities to complete. (Source: [CRM.org review](https://crm.org/news/fabulous-app-review))
- Reviewer: a behavioral design critique says the onboarding flow "violates a variety of different Behavioral Design and User Experience (UX) rules." It covers onboarding, not the home screen. (Source: [The Behavioral Scientist](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding))
- Low confidence (auto-generated review summary): many Google Play reviews call the interface confusing and the initial questions overwhelming; most negative feedback is about pricing and billing. (Source: [Kimola report](https://kimola.com/reports/unlock-insights-fabulous-app-user-feedback-report-google-play-154052))

#### Streaks (Crunchy Bagel)
- Reviewer: the main screen is "up to six circles with icons in the center." "Tasks are marked complete by long pressing a goal's icon." Tapping a goal swaps the icon for a mini calendar of streaks plus basic statistics. (Source: [MacStories, Streaks 3 review](https://www.macstories.net/reviews/streaks-3-review/))
- Reviewer: the six-goal cap is "one of the app's most opinionated design decisions from the start", meant to "constrain users to an achievable number of goals." More goals were added by flipping the card to a second set of six, "an elegant solution that preserves Streaks' simplicity." (Source: [MacStories, Streaks 3 review](https://www.macstories.net/reviews/streaks-3-review/))
- Primary (listing mirror): the current listing says up to 24 tasks. The six-per-page layout described above comes from the older 3.0 review and may have changed. (Source: [App Store listing mirror](https://apps.appfollow.io/ios/streaks/963034692?country=mx))
- Reviewer: widgets show up to four tasks each, and the ring fills as tasks are completed. (Source: [MacStories, Streaks 6 review](https://www.macstories.net/reviews/streaks-6-brings-habit-tracking-to-your-home-screen-with-extensively-customizable-widgets/))

#### Headspace (Today tab)
- Primary, snippet only (page returned 403): from early June 2026 Headspace began rolling out a refreshed Today tab "based on feedback from our members", "bringing back the popular 'Checklist' style missed by many." A "Your Essentials" section puts Today's Meditation, The Wake Up and a 1-minute breathing exercise in one place, with an entry point to the Ebb conversation directly below. (Source: [Headspace help center](https://help.headspace.com/hc/en-us/articles/51443842967195-Refreshed-Today-Tab-Experience-June-2026))
- Reviewer: earlier user research led the team to focus the Today tab on one-tap access to sessions of different lengths for morning, afternoon and night. (Source: [Kristen Berman, Irrational Labs](https://kristenberman.substack.com/p/what-design-teams-can-learn-from))
- Primary: Headspace won the 2023 Apple Design Award for Social Impact. (Source: [Apple Newsroom](https://www.apple.com/newsroom/2023/06/apple-announces-winners-of-the-2023-apple-design-awards))

#### Calm
- Primary (Calm Health, the employer and health plan app, US mobile only): Emotions Check-In sits on the Home screen between the "For You" section and "Today's Dailies". (Source: [Calm support](https://support.calm.com/hc/en-us/articles/43355620083739-How-to-Use-Emotions-Check-In-on-the-Calm-Health-App))
- Primary: Calm's blog invites a daily check-in recording how you feel, with reminders under More > Settings > Check-in Reminders (older consumer app path, may be out of date). (Source: [Calm blog](https://blog.calm.com/blog/how-are-you-feeling-a-31-day-challenge))
- Reviewer: check-ins (mood, gratitude, daily reflection) feed recommendations such as "For Your Mood". (Source: [ScreensDesign showcase](https://screensdesign.com/showcase/calm))
- Low confidence: one case-study site says the streak sits on the profile tab, not the home screen. (Source: [Mechanics Playbook](https://mechanics-playbook-next.pages.dev/case-studies/calm/))

#### Strides, Way of Life, Habitify
- Strides, primary: four tracker types (habit, target, average, project with milestones). Target shows a pace line and a green progress bar when on pace. Habit can count per day, week or month with an optional goal streak; a bad habit's limit shows in red. (Source: [Strides site](https://www.stridesapp.com/); [App Store listing](https://apps.apple.com/us/app/id672401817))
- Way of Life, reviewer: a journal-style tracker using red, green and yellow marks on a calendar, with no gamification. (Source: [Habitify comparison page](https://www.habitify.me/compare/way-of-life-vs-streaks); [Unstar roundup](https://unstar.app/blog/streaks-habitica-way-of-life-strides-habit-tracking-apps-ranked-2026)) Both are comparison blogs, low authority.
- Habitify, primary: the Journal view has a Time of Day area that switches between Morning, Afternoon and Evening by the clock, so the list shows only what is relevant now. It is a filter, not a reminder. Periods can be renamed, recolored or deleted in Settings > Time of Day (at least one must remain). (Source: [Habitify help: Time of Day area](https://intercom.help/habitify-app/en/articles/9651548-time-of-day-area); [Habitify help: manage Time of Day](https://intercom.help/habitify-app/en/articles/7990118-time-of-day))

#### Gentler Streak
- Primary: Apple's 2024 Design Award citation (Social Impact): "the app is powered not by insistent reminders but an optimistic and encouraging vibe", it "relies on a subtle and consistently pleasing design language. Its health data is smartly organized, and its Monthly Summary view, which shows how you're doing in relation to your history, is less about hard comparisons and more about progress." (Source: [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Primary: the Activity Path is "a combination of your logged workouts, their intensity and their impact on your fitness", with 1-day, 10-day and 30-day views. Up to two suggested activities for the day appear on the Streak tab; the rest sit behind "Go Gentler" at the top right. (Source: [App Store listing](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102))
- Primary: rest days are among the actions that keep the streak going. A status (active, injured, sick, on a break) can be set, and a status change "removes Activity Path from sight and mind." (Source: [App Store listing](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102))
- Reviewer: weekly recaps were added in November 2025. (Source: [9to5Mac](https://9to5mac.com/2025/11/19/gentler-streak-rolls-out-weekly-recaps/))

#### Apple Fitness (rings, Summary tab)
- Reviewer: the Summary tab opens with the Activity rings at the top, with daily steps and distance just below (iOS 17 layout). (Source: [9to5Mac](https://9to5mac.com/2023/11/29/iphone-fitness-app-whats-new-ios-17))
- Reviewer: in iOS 18 the Summary tab is editable. Scroll to the bottom, tap Edit Summary, the cards jiggle like Home Screen icons. Tap the add control at the top left to pick cards (Steps, Sessions, Trainer Tips, Training Load, Trends, Awards, Running, Cycling, Swimming, Hiking, Walking, Mindfulness and more), tap the minus on a card to remove it, long-press and drag to reorder. (Source: [iDrop News](https://www.idropnews.com/how-to/how-to-customize-your-iphones-fitness-summary/227225))
- Reviewer (search snippets from third-party iOS 18 guides, not confirmed on an Apple page): the Activity rings card at the top cannot be moved or deleted; all others can. (Source: [iPhone in Canada](https://www.iphoneincanada.ca/2025/01/02/customize-your-fitness-app-summary-tab/)) One beta-era article said cards could not be removed, which later guides contradict. (Source: [Digital Trends](https://qa2.www.digitaltrends.com/mobile/how-to-customize-the-apple-fitness-app-in-ios-18))

#### Apple Health (Favorites, now Pinned)
- Reviewer: from iOS 18 the Summary tab's "Favorites" section is called "Pinned". Tap Edit next to Pinned, tick the data types you want, tap Done. Before iOS 18 a star next to each data type did the same job. (Source: [iGeeksBlog](https://www.igeeksblog.com/how-to-use-health-app-on-iphone/))
- Primary (older versions): Apple's guide describes turning on "Add to Favorites" for a data type so it appears on Summary. (Source: [Apple iPhone User Guide, iOS 15](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/15.0); [Apple Support: Use the Health app](https://support.apple.com/104997))

#### Oura
- Primary (October 3, 2024 redesign): five tabs became three: Today, Vitals, My Health. Today opens with Sleep, Readiness and Activity scores as shortcuts at the top, then a daily highlight insight that depends on time of day, then a timeline of the day. Staff PM Laura Furman: "We wanted to make the Today tab like the 'Top Stories' page of a news app." The stated problem was that members "have had to sift through multiple data points to distill the need-to-know insights." (Source: [Oura blog](https://ouraring.com/blog/new-oura-app-experience/))
- Reviewer (October 20, 2025 redesign): Today now leads with one key daily insight called "One Big Thing" that points to the most relevant score for the day, with the other scores at the top of the screen. Parts of the app change color based on biometrics for a quick read. (Source: [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/))

#### Whoop
- Primary, snippet only (page returned 403): the home screen leads with three separate dials for Sleep, Recovery and Strain, each opening a deep-dive page. (Source: [WHOOP: the all-new home screen](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/))
- Reviewer: below the dials come personalized recommendations (for example a target Strain), then a Strain vs Recovery weekly trend, with a "+" action button on every screen for starting a workout or the journal. Praise: "I like the new design, which shows more data on the screen." Criticism: "new users of WHOOP may find the amount of information on the screen daunting" and "navigating to more detailed insights is not always intuitive"; the home screen links to more than 20 other screens. First published March 2023, updated January 2026, so layout details may be stale. (Source: [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/))
- Reviewer: Daily Outlook (WHOOP Coach) puts recovery and sleep-goal status in a short daily summary. (Source: [Gadgets & Wearables](https://gadgetsandwearables.com/2025/01/24/whoop-daily-outlook/))
- User, May 2026: "There are several features and metrics I do not use at all taking up prominent real estate." The user asks to remove or swap them and to strike "Your Daily Outlook" and the "Set Alarm" button. No staff reply. (Source: [WHOOP community](https://www.community.whoop.com/t/ability-to-simplify-home-page-in-app/14960))

#### Bevel
- Reviewer: the home screen centers on recovery, sleep and strain scores with cardio load and a nutrition log below; one reviewer said overnight metrics were visible without scrolling. Criticism: "Bevel just gives you a target strain each day, which you don't really know how to implement", and the journal prompts every morning about the night before. (Source: [Autonomous review](https://www.autonomous.ai/ourblog/bevel-app-review))
- Primary: Home is editable and whole feature areas can be disabled. Details in section 5. (Source: [Bevel help center](https://help.bevel.health/en/articles/10417089))

#### Day One
- Primary: "Each time you open the app, your current streak is proudly displayed at the top, fueling your sense of accomplishment." A calendar view shows the streak status of each day. (Source: [Day One: Journal Streaks](https://dayoneapp.com/features/journal-streaks/))
- Primary: a new writing prompt appears every day and can be turned off in settings. (Source: [Day One guide: Daily Writing Prompts](https://dayoneapp.com/?p=2108))
- Primary: the Streak widget shows entries per day, and tapping a date starts an entry. The Today widget shows photos, location and calendar events from the Today view. (Source: [Day One blog: Introducing widgets](https://dayoneapp.com/blog/introducing-widgets/))

#### Stoic
- Reviewer: the app shows its core loop graphically before asking for input: prepare for the day in the morning, reflect in the evening. Users set morning, daytime and evening reflection times. The mood check-in is called a standout. (Source: [ScreensDesign showcase](https://screensdesign.com/showcase/journal-mental-health-stoic))
- Primary and user reviews (App Store): evening prompts follow up on the morning intention (a user who set a morning focus on reading was asked in the evening what they read). Users complain that prompts repeat within a category and that the mood scale is only sad to happy with no cause. Morning and evening questions can be removed in settings. (Source: [App Store listing](https://apps.apple.com/us/app/stoic/id1312926037))

#### Reflectly
- Reviewer: the flow is a chain of small steps: a mood slider with animated faces, pick reasons from defaults or add your own, an optional "say more" text step ("Making this step optional is important"), then a congratulations screen where you name the entry, then one "daily reflection" question as a reward. Screens captured in December 2018, so details may be out of date. (Source: [Appcues GoodUX](https://goodux.appcues.com/blog/reflectlys-easygoing-daily-journaling))
- Reviewer: the pre-loaded questions "are relevant to almost any day", and answering by slider and icon taps means "it doesn't make going into detail mandatory to log the day." "The motivational messages are the weak link." (Source: [Common Sense Media](https://www.commonsensemedia.org/app-reviews/reflectly-journaldiary))

#### Daylio
- Primary: you log a day by picking a mood and activity icons, with no writing needed. (Source: [App Store listing](https://apps.apple.com/au/app/daylio-journal/id1194023242))
- Reviewer: the two-tap entry "sits at the extreme low-friction end of the market." (Source: [Headway review](https://makeheadway.com/blog/daylio-review/))
- Primary: entries render as a "Year in Pixels" chart colored by mood, with an activity picker. Year in Pixels is listed as a premium feature. (Source: [App Store listing](https://apps.apple.com/au/app/daylio-journal/id1194023242))

#### Apple Journal
- Reviewer: the main screen is a scroll of entry cards behind "a prominent '+' button at the bottom of the screen." The "+" opens a full-screen sheet with journaling suggestions, reflection prompts and a button for an empty entry. A setting can skip the sheet. Praise: "simply beautiful", suggestions are "great starting points", the interface is "welcoming, easy to understand." Criticism: the new entry field is "bare bones, to say the least", and "I don't think this UI will scale well." (Source: [MacStories](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/))
- Reviewer: iOS 18 added an Insights view with current streak, longest streak or gap, total words, days journaled, places visited, and a calendar with a dot on each day journaled. A summary strip at the top of the app opens it. (Source: [MacRumors](https://www.macrumors.com/2024/06/10/ios-18-brings-new-insights-to-journal-app/); [9to5Mac](https://9to5mac.com/2024/06/20/theres-no-ipad-app-yet-but-heres-whats-new-with-journal-in-ios-18/))

#### Readwise (learning log)
- Primary: the 2026 Readwise 2.0 mobile update describes "A beautiful new Home screen: beautiful review cards, intuitive navigation, and a scrollable feed of recent or random highlights" and "A smoother Daily Review: cleaner highlights, smoother interactions, and a completion screen worthy of your streak." (Source: [Readwise update, Aug 2026](https://readwise.io/reader/update-aug2026))
- Primary: the Daily Review resurfaces past highlights using "a decaying algorithm based on a recall probability half-life." (Source: [Readwise docs](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights))

### Inferences
- Count of things above the fold in the best-regarded screens: Apple Fitness (one ring card), Oura 2025 (one "One Big Thing" plus a score strip), Headspace 2026 (three checklist items), Streaks (six circles, nothing else), Apple Journal (one "+"), Duolingo (one path with one current node). The number is small and the first object is both status and entry point.
- Three recurring shapes for "next move": (a) the next node in a sequence (Duolingo), (b) the first unchecked row in a short checklist (Headspace, Finch, Habitify's time-of-day filter), (c) a single persistent primary button (Apple Journal "+", Whoop "+"). Orby's Goals page currently has none of these: two chips, a card, a review row and a list all read as peers.
- Headspace removing the checklist and then bringing it back "missed by many" is the strongest primary evidence in this set that people want a short, finite, tickable list for "today", not a feed.
- Oura's move from several score cards to "One Big Thing" is the same lesson from a data-heavy app: pick the one item that matters today and say it in words.
- For Orby's "What I learned" page, the Readwise wording ("a completion screen worthy of your streak") and Reflectly's congratulations step both put the reward after the save, not before the field. Orby's lightbulb row sits before the box, so the reward is shown before any action.

### Gaps
- I could not open the apps or screenshots. Exact above-the-fold layouts for Finch, Fabulous, Calm, Strides, Way of Life, Habitify, Bevel, Stoic, Daylio and Readwise are not confirmed beyond the quotes above.
- Duolingo's own post does not describe the "next lesson" marker; I did not confirm the current look of the highlighted node or the "START" bubble from a primary source.
- Headspace's help article and Whoop's home screen post returned 403, so those details rest on search snippets.
- No source found for Glasp. Readwise stands in for learning logs.
- Mobbin, Built for Mars and Growth.Design teardowns of these specific home screens were not found or not opened, apart from Mobbin's streak study.
- Streaks is widely described as an Apple Design Award winner (2016), but I did not verify that against an Apple page in this pass.

## 2. Goals at different horizons (today, week, month, year) and goals that are not set yet

### Takeaway
None of the apps studied shows a ladder of empty horizon rows. They show one horizon on the home screen (today), give it a default so it is never blank, and put longer horizons somewhere else: a separate tab, a pace line on a single goal, or a recap that arrives on its own at the end of the week or month. I found no primary source that documents an explicit "not set" state for a goal in any of these apps.

### Cited Findings
- Apple Fitness and Watch, primary: ring goals can be set per day of the week under Change Daily Goal, and "Change for Today" sets a temporary goal for today only. Rings can be paused "for up to 90 days without breaking your award streak." (Source: [Apple Watch User Guide](https://support.apple.com/en-bw/guide/watch/apd29b30023c/watchos))
- Apple Fitness on iPhone, reviewer: in iOS 18 you tap the Activity ring, then Change Goal, and can set goals per weekday; rings can be paused for a day, the rest of the week or month, or a custom time. (Source: [Tom's Guide: daily Move goal](https://www.tomsguide.com/phones/iphones/how-to-adjust-your-daily-move-goal-in-the-ios-18-fitness-app); [Tom's Guide: pause rings](https://www.tomsguide.com/phones/iphones/how-to-pause-your-move-ring-in-the-ios-18-fitness-app))
- Duolingo, primary: longer horizons live off the home screen in a Quests tab. Friends Quests run on a five-day window with a shared target. (Source: [Duolingo blog: new home screen](https://blog.duolingo.com/new-duolingo-home-screen-design/); [Duolingo blog: Friends Quests](https://blog.duolingo.com/friends-quests/))
- Duolingo, low-authority guide: there are three Daily Quests that change every day, usually in order of difficulty, each opening a chest, and quest points feed a monthly badge. The app generates these; the learner does not author them. (Source: [Duolingo Guides](https://duolingoguides.com/what-is-a-quest-in-duolingo/))
- Strides, primary: a goal's horizon is a property of the goal, not a row on a page. A Target goal has a deadline and a pace line with a green bar when on pace; a Habit goal counts per day, week or month; a Project goal has milestones. (Source: [Strides site](https://www.stridesapp.com/); [App Store listing](https://apps.apple.com/us/app/id672401817))
- Gentler Streak, primary: the same Activity Path is viewed at 1, 10 or 30 days, and the Monthly Summary "shows how you're doing in relation to your history" and "is less about hard comparisons and more about progress." (Source: [App Store listing](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102); [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Oura, primary: daily items are on Today, slow-moving metrics on My Health, and weekly, quarterly and yearly reports are generated for the member. (Source: [Oura blog](https://ouraring.com/blog/new-oura-app-experience/))
- Stoic, user review on the App Store listing: the evening routine picks up the morning intention, so a "today" goal turns into the evening's reflection question. (Source: [App Store listing](https://apps.apple.com/us/app/stoic/id1312926037))
- Streaks, reviewer: the cap of six was meant to "constrain users to an achievable number of goals." (Source: [MacStories](https://www.macstories.net/reviews/streaks-3-review/))
- Whoop, reviewer: the home screen gives a target for the day (a target Strain) derived from Recovery, so today's goal is proposed, not blank. (Source: [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/))
- Bevel, reviewer complaint: a daily target with no suggested way to reach it is hard to act on. (Source: [Autonomous review](https://www.autonomous.ai/ourblog/bevel-app-review))
- Finch, reviewer: onboarding reduces goals to doable actions, and users pick daily goals from a preset list or write their own. (Source: [ScreensDesign: Finch onboarding](https://screensdesign.com/articles/finch-app-onboarding-design/); [YourStory review](https://yourstory.com/2022/06/app-review-self-care-pet-finch-gamifies-mental-wellbeing), snippet only)

### Inferences
- The common pattern is "one horizon on the home screen, the rest by pull or by recap". Orby's "Further out" list (This week, November, 2026, all "Not set") plus the "Tomorrow / Next week: Not set" chips shows five empty slots at once, which is the opposite. A redesign consistent with these apps would show today's goal as the hero and collapse the longer horizons into one compact element (a single row or a small ladder that only shows horizons that are set, with one "add" affordance).
- Unset goals are mostly avoided by defaults: Apple assigns ring goals, Duolingo generates quests, Whoop proposes a target. Where the user must author a goal (Strides, Finch), the app offers presets or examples. For Orby this suggests suggested goals (from the training plan, yesterday's unfinished goal, or the assistant) in place of the words "Not set".
- Apple's "Change for Today" is a useful model for a today goal that deviates from the week without editing the week.
- Stoic's morning intention to evening question is a direct model for linking Orby's Goals page to the "What did you learn today?" box: the evening prompt can quote the day's goal.
- Weekly and monthly horizons are shown as review moments (Gentler Streak weekly recap, Oura reports), which fits Orby's existing "review row" better than a list of empty rows.

### Gaps
- I found no source that describes, in words or pictures, the empty state of an unset goal in any of these apps. The claim that they avoid empty rows is an inference from what the sources describe, not a confirmed observation of each screen.
- Apple Fitness default ring goals at setup are not sourced here.
- No detail found on Strava, Garmin, Griply or Notion-style goal ladders; they were outside the app list and not researched.
- The Duolingo Daily Quest details come from a low-authority guide site; the official blog confirms only that all-three completion earns boosted rewards ([Duolingo product highlights](https://blog.duolingo.com/product-highlights/), snippet only).

## 3. Showing progress and streaks: what feels satisfying, what causes guilt or churn

### Takeaway
Satisfying progress visuals share three traits: they fill or grow as a direct, immediate result of an action (ring closes, bird gains energy, circle completes, calendar dot appears), they celebrate at the save moment, and they forgive a miss (freeze, pause, repair, rest days that count). The evidence that a visibly broken streak lowers later engagement is peer reviewed, and Duolingo's own data says flexibility raised activity without encouraging more days off.

### Cited Findings
- Peer reviewed: Silverman and Barasch, "On or Off Track: How (Broken) Streaks Affect Consumer Decisions", Journal of Consumer Research 49(6), 2023. Across seven studies, "intact streaks highlighted via behavioral logs increase consumers' subsequent engagement in that behavior, relative to when broken streaks are highlighted." The effect "depends solely on how that behavior is represented within the log." It is "amplified when consumers attribute a break in the streak to themselves" and "attenuated when consumers can 'repair' a broken streak." (Source: [University of Delaware repository, abstract](https://udspace.udel.edu/items/42ce576b-8e1f-429a-8541-e29e48dbcfbb))
- Secondary report of one study in that paper: about 66 percent chose another exercise when the streak was intact against about 58 percent when broken. Not checked against the paper. (Source: [Psychology Today](https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation))
- Author advice: apps should avoid dwelling on broken streaks and offer easier ways to keep one going. (Source: [University of Delaware, Lerner](https://lerner.udel.edu/seeing-opportunity/lerner-professor-researches-how-streaks-motivate-us/))
- Duolingo, primary: breaking a streak "can have the opposite effect", and "the fear of losing a streak could prevent learners from even attempting one in the first place." Allowing two Streak Freezes at once raised daily active learners by +0.38% and did not lead learners to take more days off. A new animation after extending a streak, "including a particularly awesome animation on select milestone days", raised 7-day retention of new learners by +1.7%. Learners who reach a 7-day streak are "3.6 times more likely to complete their course." (Source: [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit/))
- Reviewer (Mobbin, study of 859 streak designs, method not described): "Breaking a streak rarely just resets the number. It resets the motivation." Streaks count "Not sessions, minutes, or what you actually learned. Just: did you open the app?" Reported Duolingo results: lowering the bar to one lesson kept over 40% more people on a 7-day streak; the CTA "Commit to my goal" in place of "Continue" brought about 10,000 more daily opens. Recovery patterns: Finch shows a hammer on missed days so they can be repaired "rather than displaying a blank or an X"; Paired grants one automatic freeze a month; Alma pauses up to 14 days; Runna moves a missed workout into the current week. (Source: [Mobbin blog](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs))
- Same article, citing Lally's UCL habit study: missing one opportunity to perform the behavior did not materially affect habit formation. (Source: [Mobbin blog](https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs))
- Apple, primary: rings can be paused up to 90 days "without breaking your award streak", and goals can vary by weekday. (Source: [Apple Watch User Guide](https://support.apple.com/en-bw/guide/watch/apd29b30023c/watchos))
- Gentler Streak, primary: rest days count toward the streak, and a sick, injured or break status removes the Activity Path from view. Apple's citation praises it for being "powered not by insistent reminders but an optimistic and encouraging vibe." (Source: [App Store listing](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102); [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Finch, reviewer: the Tamagotchi metaphor "is highly effective", and completion gives "immediate visible responses". The same critique warns that missing feedback on journaling leaves users "unsure whether their input was recorded." (Source: [Pratt IXD design critique](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))
- Day One, primary: the streak is shown at the top on open and per day in the calendar, with copy that celebrates ("Celebrate your resilience") and no loss language. (Source: [Day One: Journal Streaks](https://dayoneapp.com/features/journal-streaks/))
- Apple Journal, reviewer: Insights shows the current streak and also the longest streak or writing gap; the Streaks widget shows daily or weekly streaks "depending on how often you write." (Source: [MacRumors](https://www.macrumors.com/2024/06/10/ios-18-brings-new-insights-to-journal-app/))
- Daylio, primary: the year fills in as colored pixels, one per day. (Source: [App Store listing](https://apps.apple.com/au/app/daylio-journal/id1194023242))
- Apple Journal, reviewer: cards blur as they scroll off screen, an effect the reviewer calls "satisfying". (Source: [MacStories](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/))
- Oura, primary: Rest Mode snoozes Activity score and goals while keeping Sleep and Readiness guidance. Snippet only. (Source: [Oura support](https://support.ouraring.com/hc/lv/articles/8945980160659))

### Inferences
- A seven-slot row (Orby's lightbulb week) is exactly the kind of log Silverman and Barasch studied: an unlit bulb in the middle of the row is a highlighted broken streak. Options consistent with the evidence: show a count of days learned this week or month (a fill, not a chain), let a missed day be repaired by writing a late entry, or use a weekly cadence like Apple Journal's weekly streak for people who do not write daily.
- Fills and growth read as gain; chains read as something to lose. Rings, Year in Pixels, the Finch bird and Readwise's review cards accumulate. For a personal app for one owner with no retention target, the gain-framed visuals fit better than a loss-framed streak.
- The reward belongs at the save moment. Duolingo's post-lesson animation, Reflectly's congratulations screen and Readwise's completion screen all fire after the action. Orby's Save button on the learned box currently has no described payoff.
- Rest days and pauses that count (Gentler Streak, Apple, Oura Rest Mode) matter for the Fitness-off setting too: turning Fitness off should not read as a broken streak anywhere.

### Gaps
- Widely repeated figures (a "2020 CHI study" on streak anxiety, "63% more likely to quit after one missed day", "92% quit within 60 days") had no primary source I could find. Do not use them.
- I did not read the full JCR paper; the abstract and press coverage are the basis here.
- The Duolingo numbers reported by Mobbin (10,000 more opens, 40% more on a 7-day streak, 200,000 more returning) come from Duolingo staff statements relayed by a blog and are not independently verified. The +0.38% and +1.7% figures are from Duolingo's own post.
- No direct App Store or Reddit quotes on ring guilt or streak guilt were collected in this pass.

## 4. Getting a person to write one line a day

### Takeaway
The apps that lower the bar most do four things: they never open on a blank page (a specific prompt, a suggestion built from the day, or a mood tap comes first), they make writing optional after a tap, they mark the save with a small celebration, and they turn the entry into something worth looking back at (a card, a pixel, a calendar dot, a resurfaced highlight). A plain text box with a Save button, as on Orby's page, is what MacStories called "bare bones" in Apple's Journal.

### Cited Findings
- Apple Journal, reviewer: the "+" sheet offers suggestions built from the day's photos, workouts, places, contacts and music, plus reflection prompts and an empty entry. A suggestion can be saved with "Save Without Writing". Suggestions "are great starting points". After saving, items sit in a compact grid so entries "always look great". The reviewer read past entries more often than in Day One. (Source: [MacStories](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/))
- Apple Journal, primary: daily prompts focus on "gratitude, kindness, purpose, and more". (Source: [App Store listing](https://apps.apple.com/app/journal/id6447391597)) A Home Screen widget shows prompts that change through the day. (Source: [9to5Mac](https://9to5mac.com/2024/06/20/theres-no-ipad-app-yet-but-heres-whats-new-with-journal-in-ios-18/))
- Apple Journal, critics: "way too simple" with no throwback view at launch, and no templates. (Source: [The Sweet Setup](https://thesweetsetup.com/our-first-look-at-apples-new-journal-app/); Digital Trends via search snippet)
- Bears Gratitude, primary (Apple Design Award 2024, Delight and Fun): "a warm and welcoming way to establish, and, just as crucially, maintain, a daily gratitude practice." The characters "serve as a welcoming way into the content. And with its thoughtfully considered touchpoints, Bears Gratitude is a simple way to encourage and embrace honest self-reflection." (Source: [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Reflectly, reviewer: breaking open-ended journaling into small steps removes "blank-page syndrome". Sequence: mood slider, reasons by tap, optional text, congratulations and name the entry, then one reflection question. (Source: [Appcues GoodUX](https://goodux.appcues.com/blog/reflectlys-easygoing-daily-journaling))
- Reflectly, reviewer: prompts are chosen from mood and activity tags, not from the text written. (Source: [Macaron review, 2026](https://macaron.im/cs/blog/reflectly-ai-journaling-app-review-2026), low authority)
- Daylio, primary and reviewer: mood plus activity icons, no writing required; the lowest-friction end of the market. (Source: [App Store listing](https://apps.apple.com/au/app/daylio-journal/id1194023242); [Headway review](https://makeheadway.com/blog/daylio-review/))
- Day One, primary: one new prompt per day, answerable any time, can be turned off. (Source: [Day One guide](https://dayoneapp.com/?p=2108)) An App Store reviewer says answering the daily prompt on overwhelming days still counts as journaling for them. (Source: [App Store listing](https://apps.apple.com/ca/app/day-one-daily-journal-diary/id1044867788), snippet only)
- Stoic, user reviews: evening prompts refer back to the morning focus, which users like; repeated or oddly worded prompts are a complaint. (Source: [App Store listing](https://apps.apple.com/us/app/stoic/id1312926037))
- Finch, reviewer: gratitude journaling and reflections are small daily tasks in the checklist, so writing a line is one more tick with the same reward as any goal. Rigid mood categories "turn constraints into limitations"; the critique recommends presets plus optional free text. (Source: [Pratt IXD design critique](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))
- Bevel, reviewer: a journal that prompts every morning about the night before was called confusing to set up. (Source: [Autonomous review](https://www.autonomous.ai/ourblog/bevel-app-review))
- Readwise, primary: what you saved comes back to you in a Daily Review, with a completion screen tied to the streak. (Source: [Readwise update, Aug 2026](https://readwise.io/reader/update-aug2026); [Readwise docs](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights))
- Calm, primary: the Calm Health home screen places the emotions check-in between "For You" and "Today's Dailies", and its result suggests next steps. (Source: [Calm support](https://support.calm.com/hc/en-us/articles/43355620083739-How-to-Use-Emotions-Check-In-on-the-Calm-Health-App))

### Inferences
- For Orby's "What did you learn today?" box, the transferable moves are: (1) seed the field from the day, the way Apple Journal does from photos and workouts. Orby already knows the day's session, habits ticked and today's goal, so the prompt or tappable starters can name them ("From today's run", "About today's goal"). (2) Offer a tap-first start (a starter chip or a topic tag) with typing optional after. (3) Rotate or contextualize the prompt, but keep the wording stable enough to avoid Stoic's "oddly worded" complaint. (4) Confirm the save visibly; Finch is criticized exactly for journaling that saves without feedback. (5) Show what the line becomes: a card in a timeline, the lit bulb, and later a resurfaced "you learned this a month ago" card in the Readwise manner.
- The seven-day row should sit after or beside the action as its result, not as a header above an empty field.
- The save moment and the streak mark can be the same event: the bulb for today lights as the entry is saved.
- A single-line entry should look complete. Apple's grid layout makes even a suggestion saved without writing look finished, which is why one line feels like enough.

### Gaps
- Exact wording of Apple Journal reflection prompts was not found in any source; MacStories describes them only as open questions.
- No source found for Day One's current Today view layout or a dedicated one-line mode.
- Stoic's and Daylio's actual prompt strings and save animations were not confirmed.
- No user-level evidence (reviews or Reddit) was collected on which prompt wordings people respond to best.

## 5. Hiding or reordering home sections, and switching off a whole area

### Takeaway
There are two distinct controls, and the best apps offer both: an edit mode on the home screen for cards (at the bottom of the page, jiggle or minus buttons, drag to reorder, with a fixed hero card), and a separate feature switch in settings that removes an entire area and all its related UI. Bevel is the closest match to Orby's planned Fitness toggle: Customization lets you enable or disable Nutrition, Cycle and Bevel Intelligence, and "doing so also affects their related features and UI."

### Cited Findings
- Bevel, primary: Home Tab > scroll to the bottom > "Edit Home". Minus button at a section's top left hides it; "Add card" > select > "Add to home" restores it; press, hold and drag reorders; "Reset to default" restores the original; every change needs "Save". Separately: tap the profile picture at the top right of Home > "Customization" to enable or disable Bevel Intelligence, Nutrition and Cycle, which also affects their related features and UI. A feature can also be disabled from inside it via a gear icon and a Visibility setting. Troubleshooting note: "If a section does not appear while editing your Home Tab, make sure it is enabled in Customization." (Source: [Bevel help center](https://help.bevel.health/en/articles/10417089))
- Bevel, primary: achievement banners and share prompts can be turned off under Settings > Customization. (Source: [App Store listing](https://apps.apple.com/us/app/bevel-all-in-one-health-app/id6456176249), via search snippet)
- Apple Fitness, reviewer: Edit Summary sits at the bottom of the Summary tab; cards jiggle; add from a list, minus to remove, drag to reorder. (Source: [iDrop News](https://www.idropnews.com/how-to/how-to-customize-your-iphones-fitness-summary/227225)) Third-party guides report that the Activity rings card at the top stays fixed. (Source: [iPhone in Canada](https://www.iphoneincanada.ca/2025/01/02/customize-your-fitness-app-summary-tab/), snippet only)
- Apple Health, reviewer: "Edit" next to Pinned on the Summary tab opens a tick list of data types; Done saves. (Source: [iGeeksBlog](https://www.igeeksblog.com/how-to-use-health-app-on-iphone/))
- Oura, primary, snippet only: the shortcut row at the top of Today is customizable: swipe left on the shortcuts, tap Customize, select and reorder, minimum three. (Source: [Oura support](https://support.ouraring.com/hc/lv/articles/360058599753))
- Oura, primary, snippet only: "Calorie opt out" in the activity goal editor hides all calorie information across the app and shows steps only. (Source: [Oura support](https://support.ouraring.com/hc/lv/articles/8945980160659))
- Oura, reviewer, snippet only: Rest Mode is switched from the menu at the top left of the home screen; it snoozes the Activity score and goals, and a "Rest Mode Is On" banner stays on screen as the way back. (Source: [Tech Advisor](https://www.techadvisor.com/article/3102272/oura-ring-5-4-tips-tricks-hidden-features.html))
- Oura, primary: Cycle Insights appears as a shortcut only if the member has opted in. (Source: [Oura blog](https://ouraring.com/blog/new-oura-app-experience/))
- Whoop, primary and community: More tab > App Settings > Hide Metrics hides Sleep and Recovery (and Weight, Lean Body Mass, Healthspan), framed as temporary, for example on game days. "Customize" next to My Dashboard on Home lets you drag metrics to reorder and remove them into an "Add to my Dashboard" list. (Source: [WHOOP community pro tip](https://www.community.whoop.com/t/pro-tip-did-you-know-you-can-hide-metrics-in-the-app/2174); [WHOOP community: customize home](https://www.community.whoop.com/t/can-i-customize-my-home-screen/570); [WHOOP blog: key metrics](https://www.whoop.com/us/en/thelocker/your-key-whoop-metrics-all-in-one-place/)) All snippet only.
- Whoop, users: the larger home sections cannot be reordered or removed, and people ask for it: a request to move My Plan and My Journal above My Day, and a May 2026 request to remove unused features "taking up prominent real estate". (Source: [WHOOP community request](https://www.community.whoop.com/t/feature-request-make-my-plan-my-journal-movable-above-my-day/14411); [WHOOP community, May 2026](https://www.community.whoop.com/t/ability-to-simplify-home-page-in-app/14960))
- Gentler Streak, primary: setting a status of sick, injured or on a break "removes Activity Path from sight and mind." (Source: [App Store listing](https://apps.apple.com/us/app/gentler-streak-fitness-tracker/id1576857102))
- Bearable, primary: "Customise Homepage" at the bottom of the home page removes whole sections, with drag handles to reorder; the help article frames this as the fix for an overwhelming app and advises concealing everything except what matters now. Steps confirmed for Android only. (Source: [Bearable support](https://bearable.app/support/common-questions/make-bearable-less-overwhelming/); [Bearable help notes](https://bearable.notion.site/Customising-Bearable-2027d0d874b0809daebdfe9ede57cff6))
- Fitbit and Google Health, primary and reviewer: Today has an Edit (pencil) control that opens an editor of all tiles to show, hide and reorder. (Source: [Google Fitbit help](https://support.google.com/fitbit/answer/14237011); [Droid Life, June 2026](https://www.droid-life.com/2026/06/01/heres-the-best-way-to-setup-the-new-google-health-app/)) Snippet only; Android-leaning sources.
- Habitify, primary: default time-of-day blocks can be deleted, but at least one must remain. (Source: [Habitify help](https://intercom.help/habitify-app/en/articles/7990118-time-of-day))
- Stoic, user review: morning and evening questions can be removed in settings. (Source: [App Store listing](https://apps.apple.com/us/app/stoic/id1312926037))
- Day One, primary: daily prompts can be turned off in settings. (Source: [Day One guide](https://dayoneapp.com/?p=2108))
- Apple Journal, reviewer: a setting skips the suggestions sheet so "+" goes straight to a blank entry. (Source: [MacStories](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/))
- Duolingo, primary: Friends Quests can be opted out of in Profile settings. Snippet only. (Source: [Duolingo blog: Friends Quests](https://blog.duolingo.com/friends-quests/))
- Finch: I found no documentation of a setting that hides journeys, shops or other areas. The one design critique found recommends a collapsible menu precisely because none exists. (Source: [Finch help center, features category](https://help.finchcare.com/hc/en-us/categories/37934152903309-Finch-Features); [Pratt IXD design critique](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))

### Inferences
- Model for Orby's Fitness switch, following Bevel: one named switch in a "Customization" style settings group, described by what it removes ("Hides the Fitness tab, training cards on the home screen and training in the assistant"), reversible, with data kept. Bevel also puts a matching Visibility control inside the feature itself, so the switch can be found from either end.
- Keep a fixed hero. Apple fixes the rings card and Oura requires at least three shortcuts, Habitify at least one block. A home screen that can be emptied to nothing has no first thing for the eye. With Fitness off, Orby needs a designated replacement hero (today's goal is the natural candidate) instead of simply shifting the remaining cards up.
- Sources say little about how home "fills in". In the card-based apps the remaining cards close the gap and nothing is promoted. That is acceptable for a grid of equal cards but not for a screen with a single hero, so Orby needs its own rule: which item takes the hero slot, and which secondary items (habits, the learned prompt, the journal) step up in order.
- Two patterns for the way back: Oura's persistent "Rest Mode Is On" banner (good for a temporary state) and Bevel's settings switch plus "Reset to default" (good for a lasting preference). Fitness off in Orby is a lasting preference, so a settings row is the fit; a banner would be noise.
- A temporary variant may be worth separating from the permanent one: Gentler Streak's status (sick, injured, on a break) and Apple's ring pause hide or suspend fitness for a period without declaring the area unwanted.
- Whoop's forum requests show the cost of offering metric-level hiding without section-level hiding: people still feel the screen is not theirs.
- No app in this set documents an onboarding question that chooses which areas exist. Offering the switch in settings (and optionally inside the area) is the documented pattern.

### Gaps
- No source describes what a tab bar looks like after a whole area is turned off in Bevel (whether a tab disappears or only home sections and entry points do). The help text says only that related features and UI are affected.
- No primary Apple page was found for the iOS 18 Fitness "Edit Summary" flow or the fixed rings card; both rest on third-party guides.
- Notion and Finch were named in the brief as possible examples; I found nothing confirming a comparable area toggle in either.
- I found no source on an onboarding step that asks which areas to enable in any of these apps.
- Oura and Whoop details here are snippet-level; their help pages were not opened.

## 6. What reviewers and users praise and complain about

### Takeaway
Praise clusters on restraint and warmth: a small fixed number of things, an encouraging tone, entries and summaries that look good, and characters that act as a way in. Complaints cluster on clutter, guidance that names a target without a next step, feedback that fails to confirm a save, loss of control, and home real estate spent on features the person does not use.

### Cited Findings
- Apple Design Award 2024, Gentler Streak (Social Impact): praised for an "optimistic and encouraging vibe" in place of "insistent reminders", "smartly organized" health data and a Monthly Summary that is "more about progress" than "hard comparisons". (Source: [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Apple Design Award 2024, Bears Gratitude (Delight and Fun): characters that "turn up in delightfully unexpected places" and "serve as a welcoming way into the content", with "thoughtfully considered touchpoints". (Source: [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- Apple Design Award 2023, Headspace (Social Impact), with press describing a minimalist interface and signature illustrations. (Source: [Apple Newsroom](https://www.apple.com/newsroom/2023/06/apple-announces-winners-of-the-2023-apple-design-awards); [MacTech](https://www.mactech.com/2023/06/06/apple-announces-winners-of-the-2023-apple-design-awards/))
- 2024 finalists in the same space, names only: How We Feel and Ahead: Emotions Coach (Social Impact), Tiimo (Inclusivity), Meditate (Visuals and Graphics), SmartGym (Innovation). (Source: [Apple Design Awards 2024](https://developer.apple.com/design/awards/2024/))
- MacStories on Streaks: the six-goal limit keeps goals "achievable"; the flip card is "an elegant solution that preserves Streaks' simplicity." (Source: [MacStories](https://www.macstories.net/reviews/streaks-3-review/))
- MacStories on Apple Journal: "simply beautiful", "welcoming, easy to understand"; but the entry field is "bare bones" and "I don't think this UI will scale well." (Source: [MacStories](https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/))
- Finch: the metaphor "is highly effective" and "its playful design brings joy to self-care"; but the home page is cluttered, onboarding "overwhelms users", feedback is unreliable for journaling, and paywalls mean "the app affords only partial care." (Source: [Pratt IXD design critique](https://ixd.prattsi.org/2025/09/design-critique-finch-ios-app-2/))
- Finch, ethics caution from a teardown: copying the pet or currency "without a credible self-care loop can make the experience feel manipulative." (Source: [ScreensDesign showcase](https://screensdesign.com/showcase/finch-self-care-pet))
- Whoop: "shows more data on the screen" is the praise; "daunting" for new users and non-obvious navigation are the complaints; users ask to remove unused sections. (Source: [the5krunner](https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/); [WHOOP community](https://www.community.whoop.com/t/ability-to-simplify-home-page-in-app/14960))
- Bevel: liked as an all-in-one view; criticized because a daily target comes without a way to act on it and guidance is "vague". (Source: [Autonomous review](https://www.autonomous.ai/ourblog/bevel-app-review))
- Oura: the maker's own diagnosis of the old app was that members had "to sift through multiple data points"; a reviewer says the app was already among the easiest health apps and the 2025 redesign makes data easier to scan. (Source: [Oura blog](https://ouraring.com/blog/new-oura-app-experience/); [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/))
- Duolingo: the maker's reason for the path was that learners did not know if they were using the app the "best" way; long-time users objected to losing choice. (Source: [Duolingo blog](https://blog.duolingo.com/new-duolingo-home-screen-design/); [PiunikaWeb](https://piunikaweb.com/2022/10/13/duolingo-app-update-with-path-ui-faces-backlash-from-users/))
- Headspace: members missed the checklist enough that it was restored in 2026. (Source: [Headspace help center](https://help.headspace.com/hc/en-us/articles/51443842967195-Refreshed-Today-Tab-Experience-June-2026), snippet only)
- Reflectly: design praised as clean and inviting; motivational messages called "the weak link"; an editor's note flags user reviews citing dark patterns around the premium trial. (Source: [Common Sense Media](https://www.commonsensemedia.org/app-reviews/reflectly-journaldiary); [Appcues GoodUX](https://goodux.appcues.com/blog/reflectlys-easygoing-daily-journaling))
- Stoic: evening follow-ups on the morning focus are liked; repeated prompts and a thin mood scale are disliked. (Source: [App Store listing](https://apps.apple.com/us/app/stoic/id1312926037))
- Readwise: users like the daily review habit; the top request is a home screen widget. From an aggregator, low confidence. (Source: [Marlvel report](https://marlvel.ai/apps/readwise))

### Inferences
- The owner's complaint about Orby ("You don't know what's going on") matches the same diagnosis Duolingo, Oura and Headspace each gave of their own earlier screens, and each fixed it the same way: one clear object for today, with everything else moved off the first view or collapsed.
- "A target without a next step" (Bevel) is the nearest published complaint to Orby's "What would make today count?" card: it asks an open question and offers a button, but does not propose anything.
- The praised tone is specific and warm without cheerleading. Reflectly's generic motivational lines are the named weak point, which supports Orby's plain copy rules.
- Characters and illustrations are praised when they are a way into the content (Bears Gratitude, Finch) and criticized when they sit beside shops and upsells. A single visual device tied to the action (a bulb that lights, a ring that fills) carries the benefit without the clutter.
- When simplifying, keep an escape hatch for the experienced user: Duolingo's backlash came from removing choice, and Apple Journal lets people skip the suggestions sheet.

### Gaps
- No direct App Store or Reddit quotes were gathered for Duolingo, Headspace, Calm, Daylio, Day One or Apple Fitness; user sentiment here comes through reviewers and two Whoop forum threads.
- No Built for Mars, Growth.Design, Lenny's Newsletter, Wirecutter or The Verge pieces were opened in this pass. A summary of the Lenny's Podcast episode with Duolingo's retention PM exists ([summary](https://rosetta.to/u/lennyspodcast/behind-the-product-duolingo-streaks-jackson-shuttleworth-group-pm-retention-team)) but I did not read it in full.
- Apple's "Behind the Design" feature on Gentler Streak exists ([Apple Developer, Japanese edition](https://developer.apple.com/jp/news/?id=3m0ht22s)) but I could not open an English copy, so no quotes from the team are included.
- Member reaction to the 2026 Headspace checklist return and to Oura's 2025 redesign was not found.
