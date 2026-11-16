# Interaction design, completion feel and visual design of leading iPhone to-do apps

Researched 2026-11-16. Scope: Things 3, Todoist, TickTick, Apple Reminders, Microsoft To Do, Any.do, Structured, Sunsama (mobile), Akiflow, Amie, Superlist. Due is included as the reference for nagging reminders.

How to read the tags on each finding:
- **[Maker]**: the app maker's own help pages or changelog. These are factual about behavior.
- **[Jury]**: Apple Design Award jury text.
- **[Review]**: an independent editorial review (MacStories, iMore, ZDNET and similar), dated where possible.
- **[Critique]**: an academic or UX design critique.
- **[User]**: App Store, Capterra, G2 or forum reviews. These are anecdotes, not data.
- **[Vendor/affiliate]**: comparison pages run by competitors or affiliate sites. Treat these as weak.
- **[Estimate]**: a third party's reconstruction of timings. These are not official values.

Overall caveat: research tools returned little primary material for several apps. Amie, Akiflow, Sunsama mobile and Any.do have almost no independent iPhone design reviews. Accessibility evidence for any of these apps is close to absent. The Gaps sections list what is missing.

## 1. Gestures: swipes, drag and drop, multi-select, quick add, undo

### Takeaway
Things 3 set the pattern: swipe right to schedule, swipe left to select, and a draggable "Magic Plus" button that drops a new to-do exactly where you release it. Todoist lets you configure swipes (Complete, Schedule, Reminders, Delete, and since January 2026 None). TickTick puts several color-coded actions behind one swipe. Reorder by long-press is the common pattern, and it is the most common source of mis-taps (Todoist critique).

### Cited Findings
**Things 3**
- [Review, MacStories, May 2017] Swipe right on a to-do to reschedule it. Swipe left to select it. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- [Review, MacStories, 2017] Multi-select: swipe left to enter selection mode, then tap rows. You can also swipe up or down across the selection circles to select or deselect a run of rows in one stroke. The selection can then be rescheduled, deleted or moved. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- [Review, MacStories, 2017] The Magic Plus button sits bottom right. You can drag it onto the project list to create a project, into a Today list at a spot to insert a to-do there, onto the Inbox icon (bottom left) to create an Inbox item, or onto a day in Upcoming to set the start date. The reviewer calls the Upcoming drop "my personal favorite." Only a name is needed to save. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- [Maker, App Store listing] Describes Magic Plus as dragging the + to "insert to-dos anywhere in a list." — [App Store](https://apps.apple.com/us/app/things-3/id904237743)
- [Review, MacStories, 2017] Long-press lifts a to-do so you can drag it. This reorders Today or reschedules into a future date, but drag cannot change a to-do's project or area. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- [Review, iMore] Swipe right to schedule "with just a swipe," with no multi-step date picker. — [iMore](https://www.imore.com/all-things-i-absolutely-love-about-things-3-and-few-things-i-dont)
- Conflict: a wiki-style source and one review describe the left swipe differently (select vs complete). MacStories (select) is the more authoritative source. — [Grokipedia](https://grokipedia.com/page/Things_3); [iGeeksBlog](https://www.igeeksblog.com/things-3-app-review/)

**Apple Reminders**
- [Review, how-to, iOS 13 era] Two-finger swipe down over reminders selects many at once for batch edits. This is the system multi-select gesture introduced in iOS 13. I found no iOS 26 source confirming it is unchanged. — [Gadget Hacks](https://ios.gadgethacks.com/how-to/edit-multiple-ios-reminders-once-0343054)
- [Review, MacStories iOS 26 review, Sept 2025] iOS 26 added a New Reminder control for Control Center, the Lock Screen and the Action button. It is an interactive snippet with keyboard input, where you set list, date, location and flag. The reviewer called it "fantastic" and faster than the third-party Remind Me Faster app. He also notes it uses private APIs, so Things and Todoist cannot match it. — [MacStories](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/16)
- [Review, MacStories iOS 26] Swipe left on a recent call in the Phone app to create a callback reminder. — [MacStories](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/16)
- [Review, roundup] iOS 26 adds "Auto-Categorize" in the list's more menu, which sorts a list into sections itself. — [MacRumors](https://www.macrumors.com/guide/ios-26-notes-app-reminders-app/); [9to5Mac](https://9to5mac.com/2025/06/17/heres-everything-new-in-reminders-with-ios-26/)

**Todoist**
- [Maker, help page updated 2026-08-24] Swipe actions are configurable under Browse > gear > General > Swipe Actions. On iOS the options are Complete, Schedule, Reminders or Delete. Select is Android only. — [Todoist help](https://todoist.com/help/articles/how-to-change-your-swipe-actions)
- [Maker, 2026 changelog] January 2026 added "None" to turn swipe gestures off. An April 2026 iOS fix stopped neighboring checkboxes flickering when you swipe to complete. — [Todoist 2026 changelog](https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd)
- [Critique, IXD@Pratt, Jan 2024] Reordering by long-press is "finicky." Holding a task can open detail options or complete it by accident. The author suggests a drag handle and notes it would add clutter. Long-press gives a light haptic bump plus a color change. — [IXD@Pratt](https://ixd.prattsi.org/2024/01/design-critique-todoist-ios-app/)
- [Critique, IXD@Pratt] Quick add comes from the large orange plus button, or from a Home Screen icon long-press Quick Action. — [IXD@Pratt](https://ixd.prattsi.org/2024/01/design-critique-todoist-ios-app/)

**TickTick**
- [Maker blog, about 2013] Four color-coded swipe actions: complete and archive, set priority, set due date, move to list. — [TickTick blog](https://blog.ticktick.com/post/68144453517/get-your-finger-ready-to-swipe-tasks)
- [Review, GIGAZINE, 2015] A long left swipe shows a blue band with deadline, list, priority and delete icons. Both sources are old, so the current layout may differ. — [GIGAZINE](https://gigazine.net/gsc_news/en/20150714-ticktick-review/)

### Inferences
- The strongest gesture idea in the category is position as meaning: Things' Magic Plus decides where and when a new item goes from where you drop it. This removes a form step. It suits a single-user app with a small number of lists.
- Swipe right means "when" (schedule) in Things. In Todoist the user picks it. There is no category standard, so whichever direction an app picks must be stated once on first use.
- Long-press reorder is fragile when the same press also opens menus or completes. A visible handle, or a press-and-hold threshold that differs from the menu's, is the usual fix.

### Gaps
- No current (2025 to 2026) primary source for Things' iPhone gestures. Cultured Code's support page on iPhone gestures did not come back in searches (the page I fetched was the URL scheme doc). The MacStories review is from 2017.
- Undo: I found no source on shake to undo, undo toasts or snackbar timing for any of these apps. Todoist is widely believed to show an "Undo" toast after completing, but I did not verify this.
- Pull-to-search or pull-to-add: no source for any app. From memory only, unverified: Things shows a search field when you pull down on a list. Treat this as unconfirmed.
- No current source on Reminders swipe actions on iOS 26 (left swipe for Details, Flag, Delete is the long-standing pattern but was not verified here).
- No sourced detail on drag between days in Structured, Sunsama, Akiflow or Amie timelines.

## 2. Completion feel: animation, sound, haptics, delay, rewards

### Takeaway
The leaders split into calm (Things, Reminders) and rewarding (Todoist Karma, Superlist's varied sounds, Microsoft To Do's chime). Things pairs a short check animation with a soft sound and a light haptic. Todoist runs a full points, levels and streak system that you can turn off. Good evidence that rewards improve task completion does not exist. The studies are small and short.

### Cited Findings
**Things 3**
- [Estimate, third-party design study] Completion takes about 500 ms: the circle fills over about 200 ms, the checkmark bounces with a spring, then the row slides away over about 150 ms, with a soft "plink" sound and a light iOS haptic. The author's code values (22 pt circle, spring response 0.3, damping 0.5) are a reconstruction, not Cultured Code's numbers. — [Blake Crosley design guide](https://blakecrosley.com/guides/design/things)
- [Review, MacStories, 2017] Haptic feedback on iPhone makes interactions feel "that much more real". The reviewer misses it on iPad. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- Delay before items leave for the Logbook: no source returned. See Gaps.

**Todoist**
- [Maker, Karma help] Karma points come from adding tasks, completing them on time, using advanced features (labels, recurring dates, reminders), hitting daily or weekly goals, and keeping streaks. You lose points when tasks are 5 or more days overdue. — [Todoist Karma help](https://www.todoist.com/help/articles/introduction-to-karma-OgWkWy)
- [Maker] There are 8 levels: Beginner (0), Novice (500), Intermediate (2,500), Professional (5,000), Expert (7,500), Master (10,000), Grand Master (20,000), Enlightened (50,000+, which unlocks a mystery theme). — [Todoist Karma help](https://www.todoist.com/help/articles/introduction-to-karma-OgWkWy)
- [Maker] Safety valves: choose days off, a Vacation mode that keeps streaks, setting goals to 0 to disable them, a toggle for goal celebrations, and a full Karma toggle in Settings > Productivity. Pro and Business users can ask to restore their most recently broken streak. — [Todoist Karma help](https://www.todoist.com/help/articles/introduction-to-karma-OgWkWy)
- [Review, The Next Web, 26 March 2013] At launch, Karma rewarded creating and completing tasks and gave negative karma for postponing or piling up undone tasks. — [The Next Web](https://thenextweb.com/news/todoist-now-gamifies-your-task-management-activity-with-todoist-karma)
- [Maker] There is a completion sound toggle, separate for Mobile and for Desktop and Web. A July 2026 fix stopped Quick Add settings tying the desktop sound to the mobile preference. — [MakeUseOf](https://www.makeuseof.com/how-to-remove-sound-effects-todoist/); [Todoist 2026 changelog](https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd)
- [Critique, 2024] Haptics are a "very subtle haptic bump" on the plus button and on submit, and the haptic is not configurable. — [IXD@Pratt](https://ixd.prattsi.org/2024/01/design-critique-todoist-ios-app/)
- [Vendor/affiliate, weak] User complaint pattern: the Karma score sits on the main screen and clashes with a wish for a minimal UI. That page also says hiding it needs Pro, which conflicts with Todoist's own help page describing a Karma toggle. Prefer the maker page. — [unstar.app](https://unstar.app/blog/todoist-ticktick-things-3-microsoft-todo-apple-reminders-todo-apps-ranked-2026)

**Microsoft To Do**
- [User, App Store] Users say they "absolutely LOVE the chime sound" on completion, while others say it is too loud. There is a "Play completion sound" toggle in Settings. — [Microsoft Tech Community](https://techcommunity.microsoft.com/discussions/to-do/microsoft-to-do-problems-with-the-bell-sound/2264104/replies/2878826); [JustUseApp reviews](https://justuseapp.com/en/app/1212616790/microsoft-to-do/reviews)
- [Review] Microsoft added the completion sound to the Android widget too. — [OnMSFT](https://onmsft.com/?p=212885)

**Superlist**
- [User/review sites] Praise for "the satisfying noises it makes as you tick something off," with a completion sound that "changes each time," plus playful squiggly lines. These sources are affiliate-style, so treat them as indicative only. — [efficient.app](https://efficient.app/apps/superlist); [realme Community review](https://c.realme.com/in/post-details/1766474414183968768); [efficient.app compare](https://efficient.app/compare/sunsama-vs-superlist)

**Evidence on whether rewards help**
- [Academic] Kappen et al. (2013) say studies of gamified task managers are lacking. They argue routine tasks "need to be completed, but do not tend to be intrinsically motivating," so shallow points rarely carry them. — [Deconstructing Gamified Task Management Applications](https://www.academia.edu/4678172/Deconstructing_Gamified_Task_Management_Applications)
- [Academic] Lessel et al., CHI 2016, ran a 12-day study (N=20) of a "bottom-up" gamified task app. Participant feedback in related work said the app was too simple to engage long term and that they wanted more rewards and individual achievements. The search excerpt did not include completion results. — [Lessel preprint](https://umtl.cs.uni-saarland.de/paper_preprints/p2026-lessel.pdf); [core.ac.uk](https://core.ac.uk/download/219375734.pdf)
- [Weak, do not cite] Blog claims of a "20%" or "15%" lift in completion from gamification could not be traced to real studies. — [psicosmart blog](https://blogs.psicosmart.net/blog-what-are-the-psychological-effects-of-gamification-in-productivity-man-234012)

### Inferences
- The best-loved completion moments are short (about half a second), use more than one sense (visual, then sound, then haptic) and can be muted. Every app with a sound also has a toggle, which suggests sound is divisive. Microsoft To Do's reviews show both "love" and "too loud."
- Todoist's off switches (vacation, days off, goal 0, celebrations toggle, Karma off) show a maker that met real users who felt punished by streaks and points. If Orby uses rewards, it needs the same safety valves from day one.
- The academic evidence does not support big claims that rewards raise completion. Calm confirmation is the lower-risk default, and rewards work better as opt-in.

### Gaps
- Things' delay before a checked to-do leaves the list, and the setting for when completed items move to the Logbook. From memory only, unverified: Things keeps checked items visible briefly, and Settings has an option to move completed items to the Logbook immediately or daily. No source came back to confirm this.
- Exact durations from any maker for completion animations. All timings above are third-party estimates.
- Apple Reminders' completion feel (the circle fills, and the item hides after a short pause if "show completed" is off): not sourced.
- TickTick's completion sound: no source. Its stats and achievement features were not researched.
- What Todoist's goal celebration looks like (confetti or not): the help page does not say.

## 3. Visual design: whitespace, type, color, priority, density, dark mode

### Takeaway
Things 3 is the category's reference for calm design. Reviewers call it "dominated by white space" with bold type and "thoughtful splashes of color." A third-party study puts it at about 95% neutral, with color reserved for meaning (yellow Today, red deadline, indigo Evening, blue tags, green completion). Structured is the reference for color-coded timelines and is a 2026 Apple Design Award finalist. Todoist and TickTick show priority with colored flags or checkboxes (red, orange or yellow, blue or gray).

### Cited Findings
**Awards**
- [Jury/maker] Things won an Apple Design Award for the Things 3 iPhone app in 2017. It was Cultured Code's second ADA after the Mac app in 2009. The brief's "2017/2018" is not supported: I found only the 2017 award for Things 3. — [Wikipedia](https://en.wikipedia.org/wiki/Things_(software)); [Apple Meet the Developer story](https://apps.apple.com/us/story/id1462498106)
- [Jury, Apple Design Awards 2026] Structured (unorderly GmbH) was a finalist in Inclusivity. The jury text says: "Visually sharp and easy to scan, this SwiftUI-built daily planner prioritizes downtime as much as productivity... Members of the neurodivergent community have praised Structured for its simple layout and the way it incorporates the Foundation Models framework to suggest and pre-fill tasks." No other app from the brief's list appears among 2026 winners or finalists. — [Apple Design Awards](https://developer.apple.com/design/awards/)
- [Maker interview] Werner Jainek: "We attached great importance to Things being very simple despite its versatility." He calls "unrivaled simplicity" the key to Things 3. A WWDC 2017 interview says Things 3 took about three and a half years as a full redesign. — [Apple developer story](https://apps.apple.com/us/story/id1462498106); [Sspai interview (Chinese)](https://sspai.com/post/39724)

**Things 3**
- [Review, MacStories, 2017] The app is "dominated by white space" with "bold fonts" and "thoughtful splashes of color." Areas are bold in the sidebar, with projects in lighter type beneath. A project's note sits under its title like a subheading. Calendar events show in their calendar's color and turn gray in Today once past. Today has a "This Evening" section. Praise: "you would be hard-pressed to find a better looking to-do app than Things." The reviewer says it "ruined other apps for me." — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- [Estimate] The color scheme is about 95% neutral. Yellow marks Today (the star), red marks deadlines and overdue, indigo marks Evening (the moon), blue marks tags, and green the completion. Hierarchy: Area > Project > Heading > To-do > Checklist. Hex values on that page are the author's own, not Things'. — [Blake Crosley design guide](https://blakecrosley.com/guides/design/things)

**Structured**
- [Review sites, 2026] One vertical timeline mixes tasks, calendar events and habits, each a colored, icon-tagged block. Visible gaps make overbooking easy to spot. Reviewers call the look "journal-like" and approachable, but say busy days with many short tasks collapse into a hard-to-read stack of color. Pro unlocks unlimited colors. — [MakerStack review](https://makerstack.co/reviews/structured-review/); [Saner.ai review](https://blog.saner.ai/structured-review/); [Dave Swift review](https://daveswift.com/structured/)
- [Review, AppleInsider] Called a "no frills, attractive daily planner." — [AppleInsider](https://forums.appleinsider.com/discussion/230281)

**Todoist**
- [Critique, 2024] Today has the largest type for the header, then the date, then a task list ordered by priority, with labels beside tasks and a bottom bar (Inbox, Search, Browse). The author calls it "a straightforward, efficient, intuitive display." The brand accent is an orange plus button. — [IXD@Pratt](https://ixd.prattsi.org/2024/01/design-critique-todoist-ios-app/)
- Priority display (red, orange, blue checkbox ring for P1 to P3, gray for P4) is widely known but was not verified by a source this session. See Gaps.

**TickTick**
- [User/review] Priority is color-coded. Sources disagree on low priority: red, yellow and gray in one source; red, yellow and blue in another. Users name the colored priorities as a favorite but ask to change all colors. The App Store rating is about 4.9 from about 45 to 47k ratings. — [freeappsforme](https://freeappsforme.com/ticktick-things-tasks-to-do-app-review/); [Capterra](https://www.capterra.com/p/170641/TickTick/reviews/); [App Store](https://apps.apple.com/us/app/ticktick-to-do-list-calendar/id626144601)

**Superlist, Amie, Any.do, Microsoft To Do**
- [Review/affiliate] Superlist is called "a beautifully designed personal task manager" with "playful interactions." Its brand uses hand-drawn scribbles and rotated overlapping cards. — [efficient.app](https://efficient.app/best/todo-list); [Fudge design analysis](https://design.withfudge.com/share/app.superlist.com-design); [Medium UX write-up](https://medium.com/@mariamomiteru/live-web-wednesdays-real-websites-real-ui-ux-907383ffca37)
- [Review/user] Amie: "almost everyone agrees that the app looks beautiful," and its iOS interface is "very novel." But it has only a 3.1 App Store rating from about 40 ratings, and complaints about iPhone performance and Apple Calendar integration. — [Ellie review](https://ellieplanner.com/comparisons/amie-calendar-review); [App Store](https://apps.apple.com/us/app/amie-todos-calendar/id1548277133); [Product Hunt](https://www.producthunt.com/products/amie-2/reviews)
- [Review] Any.do is "well known for its bright, colorful user interface that makes it beginner-friendly". One user found the list cluttered. — [Cloudwards](https://www.cloudwards.net/any-do-review/); [Capterra](https://www.capterra.com/p/173614/Any-do/reviews/?page=7)
- [Review, MacStories] Microsoft To Do is "a beautiful, simple task management tool" and a worthy Wunderlist successor. Its App Store rating is 4.7 from about 257k ratings. — [MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/); [App Store](https://apps.apple.com/ae/app/microsoft-to-do/id1212616790)

### Inferences
- The praised apps use color as meaning, not decoration. Things keeps one hue per concept and leaves everything else neutral. Structured lets the user pick colors but becomes hard to read when many small blocks pile up. For a single-user app with its own palette, a small fixed set of semantic colors follows the Things model and avoids Structured's busy-day failure.
- Priority shown as a colored check ring (Todoist) or flag (TickTick) adds a color per row. Things has no priority field at all, and uses order plus the Today and deadline signals instead. That is a design choice worth weighing.
- The 2026 ADA jury praised Structured for being "easy to scan" and for helping neurodivergent users, not for decoration. Clarity and inclusion are what recent awards reward.

### Gaps
- Row heights, type sizes and fonts for any app from a primary source. Things almost certainly uses the system font (SF Pro) with custom weights, but this is unverified.
- Dark mode details for any app: none sourced. Things has a dark mode and Todoist has themes (Karma's Enlightened level unlocks a theme), but neither was described this session.
- Apple Reminders' list colors (a fixed palette of 12 colors plus glyphs) and badge use: not sourced.
- Todoist's P1 to P4 colors and Today count badge: not verified.
- Akiflow and Sunsama mobile visual design: no design-specific sources.

## 4. Empty states and onboarding

### Takeaway
Evidence here is thin. Todoist redesigned its empty screens to be "more delightful" and to give a contextual tip toward the next step, and uses illustrations on empty, onboarding and login screens. I found no source on Things' "Meet Things" project or its empty-Today wording, nor on Reminders' empty state.

### Cited Findings
- [Maker interview, Adobe XD, Todoist Foundations redesign, undated, likely 2019] "we're redesigning our 'empty screens' — not just to make the app more delightful to use, but also to provide helpful, contextual tips to users." — [Adobe XD Ideas](https://xd.adobe.com/ideas/perspectives/interviews/reimagining-an-app-from-the-ground-up-behind-the-scenes-of-todoists-redesign)
- [Maker release notes via aggregator, about Oct 2026] Illustrations on empty screens, onboarding, login and settings now reserve their space while loading. This confirms Todoist still uses illustrated empty states. — [Releasebot](https://releasebot.io/updates/todoist)
- [Design library] The Todoist Inbox empty screen has a central illustration and the floating add button. — [ScreensDesign](https://screensdesign.com/apps/todoist-to-do-list-calendar/?vs=250337)
- [Review, MacStories, Foundations] Todoist Foundations refined the whole app (context for the redesign). — [MacStories](https://www.macstories.net/?p=61316)
- [Jury] Structured's 2026 ADA text praises its Foundation Models feature that "suggest[s] and pre-fill[s] tasks." This is a form of onboarding help on an empty day. — [Apple Design Awards](https://developer.apple.com/design/awards/)
- [Review] Microsoft To Do's My Day starts empty each day. A lightbulb button opens Suggestions (overdue, due today, earlier items). One user says they "cant remember to do that on a daily basis." — [ZDNET](https://www.zdnet.com.au/article/microsoft-to-do-review/); [Microsoft Tech Community](https://techcommunity.microsoft.com/tag/Completion%20sound)

### Inferences
- Two models exist for an empty Today. One is reward: an illustration that says you are done (Todoist). The other is next step: a prompt to pull in suggestions (Microsoft To Do My Day, Structured's pre-fill). The user complaint about My Day suggests a daily manual "pull in" step fails unless the app offers it at the moment of need.

### Gaps
- Things' "Meet Things" tutorial project and its empty-Today screen: no source returned. From memory only, unverified: Things installs a sample project that teaches gestures, and shows a faint icon on an empty list.
- Todoist's tutorial or "Getting Started" project and the exact wording of its empty-Today message: not verified.
- Apple Reminders' and TickTick's first open: no source.

## 5. Accessibility: Dynamic Type, VoiceOver, Reduce Motion, contrast

### Takeaway
I found no independent accessibility review of any of these apps from blind or low-vision users. The only accessibility evidence is the 2026 ADA Inclusivity finalist status of Structured, praised by neurodivergent users for its simple layout.

### Cited Findings
- [Jury] Structured: 2026 Inclusivity finalist, "simple layout," praised by the neurodivergent community. — [Apple Design Awards](https://developer.apple.com/design/awards/)
- [Community] AppleVis's 2025 report card found blind, DeafBlind and low-vision users' satisfaction with Apple's accessibility fell versus 2024. This is platform-level, not about specific apps. — [AppleVis](https://www.applevis.com/comment/204734)
- [User, comparable app] A blind NotePlan user praised VoiceOver hints and rotor support, and flagged an unlabeled button. This is the kind of issue custom to-do UIs often have. — [NotePlan feedback](https://feedback.noteplan.co/board/p/voiceover-quality-of-life-improvements-and-navigation)

### Inferences
- Gesture-heavy designs (Magic Plus drag, swipe-to-select, two-finger multi-select) need VoiceOver custom actions as an alternative. No source shows how the leaders do this, so Orby should follow Apple HIG directly rather than copy any app.

### Gaps
- VoiceOver handling of drag to reorder, swipe actions and the Magic Plus button in Things, Todoist or TickTick: no source.
- Dynamic Type support levels, Reduce Motion behavior (does the completion animation get simpler?) and contrast audits: no source for any app.

## 6. Reminders and notifications

### Takeaway
Apple Reminders leads on capture (the iOS 26 Control Center and Lock Screen control) and on location and time-zone reminders. Due is the reference for nagging: it auto-snoozes 5 times by default (up to 10, at 1 to 60 minute intervals) until you act. Users love it, and some complain of double alerts. Any.do users praise its notifications.

### Cited Findings
- [Maker, App Store] Due: auto snooze repeats 5 times by default, configurable up to 10, at intervals of 1, 5, 10, 15, 30 or 60 minutes. Overdue items can auto-snooze indefinitely when you open the app or act on a notification. — [App Store](https://apps.apple.com/gb/app/id390017969)
- [User] Due: "its constant nagging is the best feature!", and it nags "with the nagging tenacity of a two-year-old wanting ice cream." One complaint: two nags firing together, with even Apple's notification limits unable to "shut it up." The developer replied that iOS fires the alerts. — [App Store](https://apps.apple.com/gb/app/id390017969); [AppFollow](https://apps.appfollow.io/ios/due-reminders-timers/390017969?country=au)
- [Review, MacStories iOS 26] Reminders gains per-reminder time zones and a global "Set Manually" time-zone override in Settings > Apps > Reminders. — [MacStories](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/16)
- [Review] Reminders supports location reminders (arrive or leave). — [iGeeksBlog](https://www.igeeksblog.com/how-to-set-location-based-reminders/)
- [Maker] Todoist swipe options include "Reminders," and Karma rewards using reminders. — [Todoist help](https://todoist.com/help/articles/how-to-change-your-swipe-actions); [Todoist Karma help](https://www.todoist.com/help/articles/introduction-to-karma-OgWkWy)
- [User] Any.do: notifications are "better than other apps" one reviewer had used. — [Capterra](https://www.capterra.com/p/173614/Any-do/reviews/?page=9)
- [User] Microsoft To Do: due-soon items show at the top of My Day Suggestions rather than being added automatically. A user reports "terrible sync issues" with My Day. — [ZDNET](https://www.zdnet.com.au/article/microsoft-to-do-review/)

### Inferences
- Nagging is loved by people who chose it and hated as noise when it is not chosen. Due makes repeat count and interval explicit settings. The useful pattern is per-item opt-in nagging, with an easy finish from the notification.

### Gaps
- Notification actions (complete or snooze from the banner) for Things, Todoist and TickTick: not sourced.
- Data on notification fatigue or uninstall due to noise in to-do apps: none found.

## 7. What reviewers and juries praise, and what users complain about, per app

### Takeaway
Praise centers on calm visual polish (Things, Superlist, Amie, Structured) and fast capture (Reminders' iOS 26 control, Things' Magic Plus). Complaints center on weak mobile apps for the desktop-first planners (Sunsama, Akiflow, Amie), finicky reorder (Todoist), gamification clutter (Todoist Karma), and busy timelines (Structured).

### Cited Findings
- [Review/user] Sunsama: its mobile app is the most criticized part. A February 2026 App Store review says: "Mobile app is near unusable for task editing/addition." Toolfinder says iOS trails desktop. — [Usecarly](https://www.usecarly.com/blog/sunsama-review/); [Toolfinder](https://toolfinder.com/best/to-do-list-apps); [Saner.ai](https://www.saner.ai/blogs/sunsama-vs-akiflow)
- [Review] Akiflow: the mobile app "is just a companion," and its mobile experience is called inconsistent. — [Dhruvir Zala review](https://dhruvirzala.com/akiflow-review/); [The Business Dive](https://thebusinessdive.com/akiflow-vs-sunsama)
- [Review/user] Superlist: praised for design and playful completion, but described as buggy, with collaboration "not ready." It is free for individuals. — [efficient.app](https://efficient.app/compare/sunsama-vs-superlist); [Toolfinder](https://toolfinder.com/best/to-do-list-apps)
- [User] Amie: beautiful, but slow on iPhone, with a disappointing Apple Calendar integration and sync gaps. 3.1 stars from about 40 ratings. — [App Store](https://apps.apple.com/us/app/amie-todos-calendar/id1548277133)
- [Review] Structured: no monthly view, and occasional sync issues. — [MakerStack](https://makerstack.co/reviews/structured-review/)
- [Review, MacStories 2017] Things: the main criticism was the lack of a web API, which limited automation. Cultured Code's long-standing slowness on repeating-task fixes was addressed in a 2026 update, according to iDrop News. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/); [iDrop News](https://www.idropnews.com/news/things-3-repeating-tasks-update-2026/267466/)
- [Vendor/affiliate, weak] Todoist: a major UI overhaul drew backlash, and Karma reads as clutter for minimal-UI users. — [unstar.app](https://unstar.app/blog/todoist-ticktick-things-3-microsoft-todo-apple-reminders-todo-apps-ranked-2026)
- [Review, ZDNET] Microsoft To Do: the My Day widget is praised, but the headline criticism is that the app "makes you do too much." — [ZDNET](https://www.zdnet.com.au/article/microsoft-to-do-review/)

### Inferences
- Pretty apps that are slow or flaky on iPhone (Amie, Superlist) earn low ratings despite design praise. Feel depends on speed and reliability as much as on visuals.
- Desktop-first planners fail on the phone mainly at editing and adding. An iPhone-first app wins by making capture and edit one-handed and fast.

### Gaps
- No systematic App Store review-theme analysis (counts by theme) for any app. Only anecdotes.
- Reddit threads (r/thingsapp, r/todoist, r/ticktick) did not come back in searches, so community sentiment is under-represented.
- The source for Things' 2026 repeating-task update (iDrop News) was not fetched to confirm what changed.
