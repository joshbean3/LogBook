# Day planner and to-do app teardowns: making "today" readable and the next action obvious

Researched 2026-11-12. Scope: iPhone apps, 2024 to 2026 versions where sources allow.

How to read these notes:

- **[Primary]** = the maker's own site, help center, roadmap or Apple's own page, opened and read.
- **[Reviewer]** = a third party's claim, opened and read.
- **[Snippet]** = seen only in a search result summary, page not opened. Treat as a lead, not a fact.
- I could not run the apps. Nothing here is a first-hand screen observation. Where sources did not describe a screen, it is listed under Gaps, not guessed.
- Several older reviews (2017 to 2020) are the only detailed sources for Things 3 and Microsoft To Do. They are dated inline.

Quick map of the fifteen apps (details and sources in the sections below):

| App | How the day is drawn | Daily planning ritual | Limit mechanism | Evidence quality |
|---|---|---|---|---|
| Things 3 | Short list. Calendar events on top, to-dos, then "This Evening" | None in-app. Guide says review Today each morning | Today holds only what you chose. Evening split | Good (maker pages + MacStories 2017) |
| Todoist | List (Overdue, then Today). Optional calendar layout | No guided flow confirmed. Bulk "Reschedule" for overdue | Daily goal (default 5), "Todoist Zero" | Good (help center) |
| TickTick | List sorted by time, habits below | "Plan Your Day": one task at a time | None found | Medium (2020 maker blog, 2025 TidBITS) |
| Structured | One vertical timeline with icons, colors, a "now" marker | None. Replan for missed tasks (Pro) | Gaps show as real space | Good (Apple citation, review) |
| Tiimo | Visual timeline, colors, icons, countdown timer | AI co-planner turns a brain dump into steps | None found | Medium (maker marketing, Apple award) |
| Sunsama | Day column plus calendar | Yes: 4 steps (classic) or describe-then-review (2026 agentic) | Workload counter and threshold warning | Good for desktop, weak for iPhone |
| Akiflow | Inbox plus calendar | Yes, desktop-led | Not confirmed | Weak (reviews only) |
| Amie | Calendar with to-dos | None found | None found | Weak |
| Motion | AI-built schedule | AI does the planning | AI capacity scheduling | Weak for iPhone |
| Apple Reminders | Today list: Overdue, All-Day, Morning, Afternoon, Evening | None | None | Medium (9to5Mac) |
| Fantastical | DayTicker strip plus event and task list | None | None | Weak (old reviews) |
| Notion Calendar | 1, 2, 3-day calendar views | None | None | Weak |
| Any.do | "My Day" list that resets each morning | Yes: Plan My Day prompt, accept or dismiss suggestions | Daily reset, AI load suggestions | Medium (help center, Zapier) |
| Microsoft To Do | "My Day" list that resets each night | Yes: lightbulb suggestions, one tap each | Blank slate daily, manual opt-in | Good (Microsoft support, MacStories 2017) |
| Opal | Three numbers plus an hourly green/red bar chart | None | n/a | Good (maker blog, 2023) |

## 1. Per-app teardown: what the eye lands on in Today, how many elements, and the one primary action

### Takeaway
The apps that reviewers call clearest give Today one dominant shape (a short list in Things, a single vertical line in Structured, three numbers in Opal) and one persistent add control, and they keep everything else off the screen until asked for. I could not confirm exact element counts or button styling for most apps from written sources, so the visual specifics below are limited to what makers and reviewers put in words.

### Cited Findings

#### Things 3 (Cultured Code)
- [Primary] The maker frames Today as the single place to look: "Once you've made your plan in the morning, the Today list is your go-to place for all daily activities." ([Cultured Code features](https://culturedcode.com/things/features/))
- [Primary] Calendar events are "grouped at the top of the Today list", "giving an outline of your schedule", and you choose which calendars show. ([Cultured Code features](https://culturedcode.com/things/features/))
- [Primary] "This Evening" is a separate section at the bottom of Today for to-dos that can wait, "so you can see them without being distracted." ([Cultured Code support guide](https://culturedcode.com/things/support/articles/4001304/))
- [Primary] The intended way to pick the next action is order: arrange to-dos by when you will tackle them, then "Pick whatever is at the top when you come back throughout the day." ([Cultured Code support guide](https://culturedcode.com/things/support/articles/4001304/))
- [Primary] If Today gets long, a setting groups it by project or area. ([Cultured Code support guide](https://culturedcode.com/things/support/articles/4001304/))
- [Primary] One add control, the "Magic Plus" button: "The new plus button adds some magic to every interaction." It can be dragged to place a to-do at an exact spot, to the left margin to make a heading, or onto the Inbox target. ([Cultured Code features](https://culturedcode.com/things/features/))
- [Reviewer, May 2017] The Magic Plus button's "default location will always be the lower right corner". Dropping it into Today creates a task "in that exact spot"; dropping it on a day in Upcoming sets the start date. MacStories calls it "one of the most clever methods of task entry I've seen." ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Reviewer, May 2017] Passed calendar events "turn grey in Today once they've passed." ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Reviewer, May 2017] Visual language: "The app is dominated by white space, but it uses bold fonts, lovely icons, and thoughtful splashes of color." ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Reviewer, undated, unverified reconstruction] A design study says Today is marked with a yellow star and This Evening with an indigo moon, and estimates the interface is "95% neutral" with about 5% meaningful color. The author gives no source for the percentages. ([Blake Crosley design study](https://blakecrosley.com/blog/design-study-things))
- [Primary] The Apple Watch complication shows the status of the Today list with a progress ring (reported by MacStories), and projects show progress pies: "See the progress of your projects at a glance and see just how close you are to achieving your goal." ([Cultured Code features](https://culturedcode.com/things/features/); [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))

#### Todoist (Doist)
- [Primary] Today shows "every task scheduled for today across all your projects." Tasks without a date never appear there. ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Primary] Priority 1 tasks appear at the top of the list in red, which is how the list signals what to do first. ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Primary] Overdue tasks get their own section with a single bulk action: on mobile, "tap Reschedule at the top-right." ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Primary] Two layouts: list (drag a task to the bottom of Today to postpone it) and calendar (time-block by dragging; Pro and Business only). ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Primary] A small pie chart in the top-right corner of the account shows daily goal progress: "Peek at your daily goal progress by glancing at the small pie chart." On iOS the Productivity view sits under Browse, then the avatar. ([Todoist Productivity help](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9))
- [Reviewer, May 2017] MacStories said Todoist and 2Do "appear dated after using Things 3." Old, and Todoist has been redesigned since. ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))

#### TickTick
- [Reviewer, Aug 2025] The "main Today screen displays tasks and events", from TickTick or imported from Reminders and Calendar, "sorted by time". Habit entries sit in a section "below the day's open tasks." ([TidBITS](https://talk.tidbits.com/t/ticktick-provides-a-focused-daily-task-list-and-more/31705))
- [Reviewer, Aug 2025] The reviewer's main complaint is breadth: "One challenge with TickTick is the sheer number of features, many of which I don't personally use." He calls the interactive Today widget the most noticeable feature. ([TidBITS](https://talk.tidbits.com/t/ticktick-provides-a-focused-daily-task-list-and-more/31705))
- [Primary, Dec 2020, may be out of date] "Plan Your Day" is "a circle-shaped button on the top of Today." ([TickTick blog](https://blog.ticktick.com/2020/12/08/20-lesser-known-ticktick-features/))

#### Structured (unorderly)
- [Primary, Apple, 2026] Apple Design Awards 2026 finalist, Inclusivity: "Visually sharp and easy to scan, this SwiftUI-built daily planner prioritizes downtime as much as productivity. It excels not just at optimizing open slots on your calendar, but also at helping you find time to take breaks. Members of the neurodivergent community have praised Structured for its simple layout and the way it incorporates the Foundation Models framework to suggest and pre-fill tasks." ([Apple Design Awards](https://developer.apple.com/design/awards/))
- [Primary] "Structured combines all your tasks and to-dos into a single visual timeline." The site claims 15M+ downloads and 600K+ tasks created daily (maker's own numbers). ([structured.app](https://structured.app/))
- [Reviewer, Aug 2026, build 4.5.4] First open shows "today's date, an empty timeline and a plus button." Three elements. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Reviewer, Aug 2026] The day is one vertical column: "Everything you have to do that day sits on it, in order, at the time you said you would do it." "The current moment sits as a marker on the line." Each task carries an icon and a color. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Reviewer, Aug 2026] "Gaps between tasks show as real space, so overcommitting becomes obvious before it becomes a problem." ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Reviewer, Aug 2026] Where it breaks: "Stack a dozen fifteen-minute tasks together and the column compresses into an unreadable ribbon of colour." The design is "optimised for a day with shape, not a day of back-to-back admin." Extra widget rows are "a small tax on the thing that made the app good." ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Primary] An Inbox holds unscheduled thoughts: "store your thoughts in the Inbox - you can sort it out later" (App Store listing, seen in search snippet). ([App Store](https://apps.apple.com/app/structured-daily-planner/id1499198946))

#### Tiimo
- [Reviewer/News, Dec 2025] Apple named Tiimo iPhone App of the Year 2025. Coverage quotes Apple calling it a visual planner and crediting its use of AI to turn goals into next-step tasks. ([TechCrunch](https://techcrunch.com/2025/12/04/ai-finds-its-way-into-apples-top-apps-of-the-year))
- [Primary] The maker's framing of the day view: "Turn your schedule into a visual timeline you can actually follow." Widgets and Live Activities are pitched as "See what's next at a glance. Keep timers and tasks in view. no app opening required." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Primary] Time is made visible with a countdown: "Watch time pass with a countdown that keeps you anchored." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Primary] The entry prompt targets the blank-page problem directly: "Not sure where to start?" and "One click and your thoughts turn into a plan you can actually follow." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Primary] Personalization is part of the pitch: "Choose colors, icons, and layouts that reflect how you work best." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Snippet, competitor-run blogs, weigh with care] Complaints: "customization so endless that it takes too much time to input even something basic", and "Before Tiimo can run your day, you have to build the plan." ([Habi comparison](https://habi.app/insights/best-adhd-planner-apps/); [JustUseApp reviews](https://justuseapp.com/en/app/1480220328/tiimo-visual-daily-planner/reviews))

#### Sunsama
- [Primary, App Store listing, snippet] The iPhone app is positioned as a companion: "You can use the Sunsama mobile app once you've planned your first day from the Sunsama desktop app." ([App Store](https://apps.apple.com/app/id1475755747))
- [Snippet] Reviews rate the phone experience low: Saner.ai gives mobile 4.5/10 and says full planning is not available on mobile; a Feb 2026 App Store review said the "mobile app is near unusable for task editing/addition." ([Saner.ai](https://www.saner.ai/blogs/sunsama-reviews); [App Store](https://apps.apple.com/app/id1475755747))
- Planning ritual and workload warning are covered in section 2 and section 5.

#### Akiflow
- [Snippet] Reviews describe the phone app as a companion: inbox processing, calendar edits, notifications, widgets, share sheet and a "Daily Dashboard"; "you'll do most of your work on desktop" and "can't do full time-blocking on phone." ([efficient.app](https://efficient.app/apps/akiflow); [Dhruvir Zala review](https://dhruvirzala.com/akiflow-review/))
- [Snippet] One 2026 review quotes a user saying dragging tasks onto the calendar was removed from the mobile app. Single report. ([Usecarly review](https://www.usecarly.com/blog/akiflow-review/))

#### Amie
- [Reviewer, Oct 2022, old] "The UI is a breath of fresh air"; the team "put a lot of thought and love into creating joyous interactions and a fluid design system." To-dos can be scheduled "right into my calendar." No screen-level description. ([The Report](https://thereport.substack.com/p/a-joyful-calendar))
- [Snippet] A user review says that on iOS "sometimes the scroll down animation doesn't work" and the design still needs tweaks. ([hunted.space](https://hunted.space/product/amie-5))

#### Motion
- [Snippet] Reviews agree the phone app is secondary: "the mobile app isn't a standalone application", "mobile app features lag behind desktop version", and TechRepublic lists "can be highly buggy" as a con. Auto-scheduling is called "its biggest strength." ([TechRepublic](https://www.techrepublic.com/article/motion-app-review/); [Upbase](https://upbase.io/blog/motion-app-review/))

#### Apple Reminders
- [Reviewer, Aug 2024, iOS 18] Today list default order: "Overdue reminders are listed first", then All-Day, then timed reminders under Morning, Afternoon and Evening (another outlet says "Tonight"). iOS 18 lets you reorder the sections, including moving Overdue to the bottom, via More, then "Edit Sections." ([9to5Mac](https://9to5mac.com/2024/08/15/reminders-in-ios-18-all-the-new-features-coming-this-fall))
- [Reviewer, Aug 2024] Subtasks are now visible inside Today and Scheduled; before iOS 18 they were hidden in Smart Lists, which the author called "a pain." ([9to5Mac](https://9to5mac.com/2024/08/15/reminders-in-ios-18-all-the-new-features-coming-this-fall))

#### Fantastical (Flexibits)
- [Reviewer, 2012 to 2013, old] The signature layout is the DayTicker: a horizontal strip of days at the top, with "the events viewable in the list below correspond[ing] to the currently selected day." ([9to5Mac](https://9to5mac.com/guides/dayticker/); [MacStories](https://www.macstories.net/reviews/fantastical-for-iphone-review/))
- [Snippet] The Sweet Setup describes the current iPhone app as a carousel of day tiles on top with one unified list of events and tasks underneath. ([The Sweet Setup](https://thesweetsetup.com/fantastical-review-calendar-app/))
- Cardhop is a contacts app with no day view. I found nothing relevant and left it out.

#### Notion Calendar
- [Snippet, App Store reviews] Praised as "an aesthetically pleasing calendar for iOS"; "1, 2, 3 day view is great" but there is no 7-day or month view with events. Tasks appear only if the Notion page has a date field. ([App Store](https://apps.apple.com/us/app/notion-calendar/id1607562761); [efficient.app](https://efficient.app/apps/notion-calendar))

#### Any.do
- [Primary] My Day resets daily: "Each morning, your view resets — clearing out yesterday's tasks" (tasks are not deleted; reset time is configurable). ([Any.do help](https://support.any.do/en/articles/8609724-getting-started-with-my-day))
- [Primary] The list is filled from Smart Suggestions (ranked by urgency, due date and relevance; accept or dismiss each with one tap), manual search, calendar events and personal lists. Pinned tasks stay until completed or unpinned. ([Any.do help](https://support.any.do/en/articles/8609724-getting-started-with-my-day))
- [Snippet] A bulk option adds all tasks due today in one tap. ([Any.do daily planner page](https://www.any.do/daily-planner); [Zapier](https://zapier.com/blog/anydo-features))

#### Microsoft To Do
- [Primary] "Use My Day to help focus on daily tasks." The list "resets every night." ([Microsoft support](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions))
- [Primary] The one secondary control is the suggestions icon, a light bulb, at the top of My Day. ([Microsoft support](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions))
- [Reviewer, Apr 2017, old] "Tapping the lightbulb icon in the top-right corner of My Day will bring up a list of suggestions." Each list "is topped by a beautiful header image." MacStories called it "perhaps the best looking task management app I've ever used." ([MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/))

#### Opal (screen time, included as the "or similar" example of a glanceable today screen)
- [Primary, Oct 2023] On open you see three numbers: today's screen time, Focus Score as a percentage ("the percentage of your day where you're not using distracting apps") and pickups. Below them, one hourly bar chart: green for focus, red for distraction. Detail by app is below the fold. ([Opal blog](https://opalapp.com/blog/introducing-the-new-opal-home-screen-track-your-screen-time-and-improve-your-focus))
- [Primary, Oct 2023] The redesign was a response to users finding the earlier score "too complex and hard to read"; the bar chart was tested with a few dozen users before release. ([Opal blog](https://opalapp.com/blog/introducing-the-new-opal-home-screen-track-your-screen-time-and-improve-your-focus))

### Inferences
- The clearest Today screens have one organizing shape that also encodes order. Things uses position in a short list (top item is next). Structured uses position on a time line plus a "now" marker. Todoist uses a red priority band at the top. In each case the next action is answered by where something sits, not by a sentence of help text.
- The add control is a single persistent button, and the maker pages talk about it as a feature in its own right (Things' Magic Plus, Structured's plus). None of the sources describe help paragraphs next to the add control. Orby's current card (prompt, button, help paragraph, add row, link) has five competing elements where Structured's first-run screen has three.
- Splitting the day into named parts is common and cheap: Things (Today, This Evening), Reminders (Morning, Afternoon, Evening), Todoist (Overdue, Today). It gives the eye two or three landmarks without adding controls.
- Color is used sparingly and semantically in the praised apps (Things: one yellow star, calendar colors; Opal: green and red only; Todoist: red for P1). Structured and Tiimo use more color, but each color belongs to one task block, so color equals object.
- Phone versions of the "planning ritual" apps (Sunsama, Akiflow, Motion) are widely reviewed as weak companions. The well-regarded iPhone-first references are Things, Structured, Tiimo, Reminders and Microsoft To Do.

### Gaps
- Exact element and action counts on each Today screen, and the color, size and placement of each primary button in 2026 builds. Written sources rarely state these and I could not open the apps or Mobbin screenshots. A hands-on screenshot pass is needed before quoting numbers.
- Things 3: whether the Magic Plus button is still at lower right on iPhone in the current build (the only placement source is from 2017), and the exact Today header. From memory, not verified: a yellow star beside the "Today" title and a blue circular plus button.
- Todoist: the current iOS Today header layout and the quick-add button's styling. From memory, not verified: a red circular plus at lower right.
- Akiflow, Amie, Motion, Notion Calendar, Fantastical: no current primary source describing the iPhone today screen was found. Treat these five as unverified for any visual claim.
- No Mobbin, Built for Mars, Growth.Design or Lenny's Newsletter teardown of these specific Today screens turned up in search.

## 2. How the day is visualized, and which apps run a daily planning ritual (and in how many steps)

### Takeaway
There are four ways these apps draw a day: a short ordered list, a vertical timeline, a blank slate that you fill from suggestions, and a few headline numbers. Rituals range from one tap per suggestion (Microsoft To Do, Any.do) through one-task-at-a-time triage (TickTick, Any.do Moment) to Sunsama's four named steps, which in 2026 became "describe your day, then review the plan."

### Cited Findings

Visualization:
- [Primary] List with a schedule outline on top: Things puts calendar events at the top of Today to give "an outline of your schedule", then to-dos, then This Evening. ([Cultured Code features](https://culturedcode.com/things/features/))
- [Reviewer] Timeline: Structured draws one column from morning to night with a current-time marker, icons and colors; swiping sideways gives "seven of those columns side by side." ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Primary] Timeline plus countdown: Tiimo's "visual timeline" and a countdown timer that "keeps you anchored." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Primary] Progress count and pie: Todoist's Daily tab shows tasks completed today against the daily goal, with a small pie chart for progress. ([Todoist Productivity help](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9))
- [Primary] Headline numbers plus one chart: Opal's screen time, Focus Score and pickups over an hourly green/red bar chart. ([Opal blog](https://opalapp.com/blog/introducing-the-new-opal-home-screen-track-your-screen-time-and-improve-your-focus))
- [Reviewer] Day strip plus list: Fantastical's DayTicker. ([9to5Mac](https://9to5mac.com/guides/dayticker/))
- [Reviewer] Time-of-day buckets: Apple Reminders' Morning, Afternoon, Evening sections. ([9to5Mac](https://9to5mac.com/2024/08/15/reminders-in-ios-18-all-the-new-features-coming-this-fall))

Rituals:
- [Primary] **Microsoft To Do**: My Day starts empty; "When you first open To Do each day, you'll see an empty My Day list where you can enter the tasks you'd like to focus on for the day" (support text seen in search snippet). Tap the light bulb, then tap suggestions to add them. Unfinished tasks go back to the Tasks list "and appear in your suggestions the next day." Suggestions need at least one day of use. Effective steps: open, tap light bulb, one tap per task. ([Microsoft support: My Day](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions); [Microsoft support: plan and connect](https://support.microsoft.com/en-us/todo/plan-and-connect-with-microsoft-to-do))
- [Reviewer, 2017] Tasks with due dates "show up at the top of your Intelligent Suggestions"; MacStories called suggestions "an interesting, clever twist on the classic 'Today' list." ([MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/))
- [Primary] **Any.do**: "Every morning, Any.do prompts you to review your task list, your calendar events, and any pending items from the day before. You then make conscious decisions about what you will actually do today." The post says the AI flags tasks deferred repeatedly as needing "a decision, not just another delay" and suggests a realistic load from calendar availability. Enabled in settings. Post is roughly early 2026. ([Any.do blog](https://www.any.do/blog/?p=7859))
- [Snippet] Zapier's review describes Any.do's "Moment" (mobile only) as walking through each task with a choice to keep it today with a reminder, reschedule it, or mark it complete, at a notification time you pick. May be dated. ([Zapier](https://zapier.com/blog/anydo-features))
- [Primary, 2020] **TickTick** "Plan Your Day": from the circle button on Today you go through "all overdue and today's tasks one by one", and can reschedule, complete or delete each. ([TickTick blog](https://blog.ticktick.com/2020/12/08/20-lesser-known-ticktick-features/))
- [Primary] **Todoist**: I found no guided "Plan your day" flow in the help center. The documented routine is manual: review Today, sort or group, bulk-reschedule overdue, postpone leftovers so you "end every day at Todoist Zero." ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Primary] **Things 3**: no in-app ritual. The guide says "Ideally, start the day by quickly reviewing the list" and "Today works best if it contains only those to-dos you'll work on today." ([Cultured Code support guide](https://culturedcode.com/things/support/articles/4001304/))
- [Primary, article from 2020, updated May 2026] **Sunsama classic ritual**, four named steps after a quick review of yesterday: "Step 1: Pick what you want to do" (meetings first, then a handful of tasks), "Step 2: What can wait?" (estimate each task, defer or delete the rest), "Step 3: Finalize" (time-block or order the list), "Step 4: Share" (optional post to Slack). Prompted once per day. ([Sunsama planning guide](https://www.sunsama.com/blog/the-official-daily-planning-guide))
- [Primary, 2026] **Sunsama agentic planning** (on by default in new workspaces): press Plan, describe your day in rough words ("what you want to focus on and what's in the way"), click "Plan my day", wait about 2 to 4 minutes, then a "Review Plan" screen lists every action with undo, "Judgement calls to review", an "Undo all" and a "Re-plan"; then a briefing from the agent; then "Get started." Roughly three user actions plus review. This is a desktop flow in the docs. ([Sunsama help](https://help.sunsama.com/docs/usage-guides/daily-planning))
- [Snippet] **Akiflow** has guided Daily Planning and Daily Shutdown rituals that "walk you through recaps, goals, and blocking out the week"; sources do not say these run on iPhone. ([efficient.app](https://efficient.app/apps/akiflow))
- [Snippet] **Structured**: no ritual; "Replan" (Pro, iOS only) reschedules missed tasks with a quick swipe. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk); [App Store](https://apps.apple.com/app/structured-daily-planner/id1499198946))
- [Primary] **Tiimo**: the AI co-planner "builds step-by-step plans and estimates time for you" from typed or spoken thoughts. ([tiimoapp.com](https://www.tiimoapp.com/))

### Inferences
- The lowest-friction ritual pattern is "empty slate plus suggestions": the app proposes yesterday's leftovers and due items, the person accepts each with one tap. Microsoft To Do and Any.do both do this, and it suits a phone because it needs no typing.
- The second pattern is card-by-card triage (TickTick, Any.do Moment): one item on screen, two or three choices. It limits what is visible to one decision at a time.
- Sunsama's direction in 2026 is to replace four steps with one free-text prompt and a reviewable result. For Orby, which already has an assistant, "say what would make today count, get a proposed plan, accept or edit" matches this pattern, with the caveat that Sunsama's version takes minutes and is desktop-first.
- Rituals that depend on the person remembering to start them draw complaints (see section 6, Microsoft To Do). A prompt at a set time or an obvious entry point on the home screen is part of the pattern, not an extra.

### Gaps
- How many screens Any.do's Plan My Day has today, and its exact copy. The help article did not describe the flow.
- Whether TickTick's Plan Your Day still exists in the same form in 2026 (only a 2020 source).
- Sunsama's planning flow on iPhone: reviews say it is limited, but I found no primary description.
- Todoist: I have an unverified memory of AI-assisted planning features in recent releases; nothing in the fetched help pages confirms a guided daily flow.

## 3. What completing an item looks, sounds and feels like, and what "all done" shows

### Takeaway
Makers say little in writing about completion feedback, but users ask for it loudly: Sunsama's request for a more satisfying completion has been open since 2019 with 38 votes, and in 2026 the team shipped a celebration only for finishing everything or finishing a ritual. The confirmed vocabulary is small: a short checkbox animation, a single sound, a strike-and-fade, a filling pie or ring, and a celebration reserved for the whole day.

### Cited Findings
- [Primary] Things: "Everything you do in Things is nicely animated for pop." ([Cultured Code features](https://culturedcode.com/things/features/))
- [Reviewer, 2017] Things uses haptic feedback (iPhone 7 Taptic Engine) for picking up a task, the Magic Plus button and pull-to-search; interactions "give a sense of depth, of meaningful tactile engagement." The review does not describe the completion haptic itself. ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Reviewer, unverified reconstruction] A design study describes Things' completion as "(fill → checkmark → sound) takes 500ms but delivers dopamine": circle fill about 200 ms, checkmark scales in, a soft sound, then the row slides away in about 150 ms. The author does not say how this was measured. Useful as a timing target, not as fact about Things. ([Blake Crosley design study](https://blakecrosley.com/blog/design-study-things))
- [Reviewer, Aug 2026] Structured: "Completed tasks strike through and fade." ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Reviewer, 2017] Microsoft To Do: "The animations for checking off tasks and navigating the app bring delight to the task management experience." ([MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/))
- [Snippet, attribution uncertain] A review says that in Microsoft To Do, after you tap the circle to finish a task, you hear a "ding", which can be turned off in settings. I did not open the source; it is one of these two. ([MobileSyrup](https://mobilesyrup.com/2019/09/22/microsoft-to-do-tasks-management-app-review/); [The Windows Club](https://thewindowsclub.com/microsoft-to-do-on-ios-tips-and-tricks))
- [User comment, Apr 2023] "Todoist 'popping' sound effect feels oddly satisfying." ([Sunsama roadmap thread](https://roadmap.sunsama.com/improvements/p/completing-a-task-should-feel-more-satisfying))
- [Primary] Todoist checks goals "every time you complete a task"; reaching the daily goal (default 5) starts a streak and earns Karma; goal celebrations can be turned on or off in Productivity settings (Karma help, seen in snippet). ([Todoist Karma help](https://www.todoist.com/hc/en-us/articles/206209959-Karma); [Todoist Productivity help](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9))
- [Reviewer, may be dated] Reaching the Todoist daily goal produces a pop-up congratulating you. ([TechRepublic](https://www.techrepublic.com/article/how-to-set-todoist-karma-productivity-goals/))
- [Snippet, single user, 2022] An Apple Community poster says TickTick plays a jingle like the Apple Pay sound when a task is ticked. ([Apple Community](https://discussions.apple.com/thread/253800201))
- [Reviewer, Aug 2025] TickTick: "Tapping a checkbox marks the task as done", reversible when Show Completed is on. ([TidBITS](https://talk.tidbits.com/t/ticktick-provides-a-focused-daily-task-list-and-more/31705))
- [Primary, Feb 2026] Sunsama team reply: "While we haven't built a celebration/animation for when you complete a single task", a celebration can now appear when all tasks are completed, when the daily planning ritual is completed, or when the daily shutdown is completed; configurable under Settings, Display. ([Sunsama roadmap thread](https://roadmap.sunsama.com/improvements/p/completing-a-task-should-feel-more-satisfying))
- [User comments, 2019 to 2026] What users in that thread ask for and cite: "Please add a ding sound... This is the simplest feature ever and so critical for psychological stimulus"; Asana's "occasional unicorn flying across your screen"; Monday.com's "mini spray of confetti"; Morgen's "celebration animation"; Timestripe's confetti when all of the day's tasks are done; and "a box changing color" as a minimal cue. One user notes a whole-day celebration never fires for people who do not use the rituals and asks for per-task celebration as an option. ([Sunsama roadmap thread](https://roadmap.sunsama.com/improvements/p/completing-a-task-should-feel-more-satisfying))
- [Primary] All-done framing: Todoist names the state ("end every day at Todoist Zero"); Things' Watch complication shows a Today progress ring. ([Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs); [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))

### Inferences
- There are two tiers of reward and the apps keep them apart. Tier one, every item: a fast (well under a second), quiet, physical-feeling confirmation such as fill, tick, one sound or tap, then the row leaves. Tier two, the day: a rarer, bigger celebration for all done, goal reached or ritual finished. Sunsama shipped tier two first and users immediately asked for tier one.
- Sound is the cheapest and most-requested cue, and the apps that have it make it optional (Microsoft To Do's ding, Sunsama's display setting, Todoist's celebration toggle).
- A visible progress measure that fills as items complete (Todoist's pie, Things' ring on Watch) turns each completion into movement toward the day's state. That gives the "progress fill" feeling without confetti.
- Occasional or variable celebration (Asana's "occasional" unicorn) is cited fondly by users; nobody in the thread asked for confetti on every task.
- Finishing the planning step is itself celebrated in Sunsama. For a "Plan your day" section, the reward can come at the moment the plan is set, not only at completion.

### Gaps
- No primary source describes Things 3's completion animation, sound or haptic, its Logbook transition, or its empty or finished Today screen. From memory, not verified: the checkbox turns blue with a checkmark and the row stays briefly before moving to the Logbook.
- Todoist's all-done screen. From memory, not verified: an illustration with a congratulatory line and a "#TodoistZero" share link. Not confirmed in any fetched source.
- Apple Reminders' all-done text. From memory, not verified: "All Reminders Completed" in an empty list. Search found no confirmation.
- Tiimo completion feedback (confetti, sounds) and Structured's all-done state: not found.
- No source gives haptic patterns per app. Apple's HIG on haptics was not part of this pass.
- No measured evidence (retention, completion rate) that completion animation or sound changes behavior. Only user requests and reviewer praise.

## 4. Empty states: what they say and show, and how they get the first item added

### Takeaway
The two best-documented empty Todays are deliberate. Microsoft To Do and Any.do empty the list every day on purpose and put suggestions one tap away, so "empty" reads as a fresh start with a ready move. Structured's first screen is just a date, an empty line and a plus. I could not confirm the wording or artwork of any app's empty state from a written source.

### Cited Findings
- [Primary] Microsoft To Do treats empty as the daily default: the list "resets every night", giving a clean slate, and on first open each day "you'll see an empty My Day list where you can enter the tasks you'd like to focus on for the day." ([Microsoft support: My Day](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions); [Microsoft support: plan and connect](https://support.microsoft.com/en-us/todo/plan-and-connect-with-microsoft-to-do))
- [Reviewer, 2017] "This list should be empty every morning when you check it." ([MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/))
- [Primary] The way out of empty is suggestion, not typing: light bulb, then tap. Yesterday's unfinished tasks are first in line because they "appear in your suggestions the next day." ([Microsoft support: My Day](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions))
- [Primary] Any.do: the morning reset clears yesterday "so you're not overwhelmed by backlog" (wording from search snippet of the help center), then Smart Suggestions can be accepted or dismissed with one tap, or all due-today tasks added at once. ([Any.do help](https://support.any.do/en/articles/8609724-getting-started-with-my-day); [Any.do daily planner page](https://www.any.do/daily-planner))
- [Reviewer, Aug 2026] Structured first run: "today's date, an empty timeline and a plus button", and "Opening Structured for the first time feels calm." Adding the first task "takes about four taps": plus, name, start time, duration. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Primary, Apple, 2026] Structured uses on-device models "to suggest and pre-fill tasks — a thoughtful touch that can make staying organized less challenging." ([Apple Design Awards](https://developer.apple.com/design/awards/))
- [Primary] Tiimo's copy for the blank moment: "Not sure where to start?" followed by a one-step brain dump the AI turns into a plan. ([tiimoapp.com](https://www.tiimoapp.com/))
- [Primary] Things answers an empty spot with direct manipulation: drag the plus button to where the to-do should go and it "just need[s] a name filled in" (MacStories wording). ([Cultured Code features](https://culturedcode.com/things/features/); [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))

### Inferences
- A good empty state has three parts in the sources: a reason the list is empty that feels good (fresh start, calm), one obvious control, and pre-made candidates so the first add is a tap, not a blank text field. Orby has natural candidates already: today's planned workout, habits, yesterday's unfinished to-dos, goals.
- First-add cost matters. Structured's four taps is the benchmark a reviewer bothered to count. Suggestions get it to one.
- Empty can be designed as the reward state as well as the start state. Microsoft To Do uses the same blank screen for "new day" and for "nothing left", and the reset means a missed day does not leave a wall of overdue items.
- None of the sources describe an empty state that relies on a paragraph of explanation. Orby's current help paragraph has no counterpart in these apps as far as written sources show.

### Gaps
- Exact empty-state headlines, illustrations and button labels for every app. Not described in any source I could open. From memory, not verified: Microsoft To Do shows a short "Focus on your day" style message with a calendar illustration; Todoist shows rotating illustrations with a line of encouragement.
- Whether any app A/B tested its empty state. No public data found.
- Things 3's empty Today: not described anywhere I looked.

## 5. How they limit choice (top 3, focus, capacity warnings), and evidence that limiting works

### Takeaway
Limits in these apps are mostly soft: a list that only holds what you opted in for today, a daily reset, a capacity counter that warns, a default goal of 5. I found no controlled evidence that a cap of three (or any number) improves follow-through. The best-supported nearby finding is that writing a specific plan for an unfinished goal stops it from intruding on other work.

### Cited Findings
- [Primary] Things: "Today works best if it contains only those to-dos you'll work on today"; This Evening hides later items in plain sight; Upcoming shows the next seven days to "avoid overloading a single day." No numeric cap. ([Cultured Code support guide](https://culturedcode.com/things/support/articles/4001304/))
- [Primary] Microsoft To Do and Any.do: nothing is in My Day unless you put it there, and the list clears each night or morning. ([Microsoft support](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions); [Any.do help](https://support.any.do/en/articles/8609724-getting-started-with-my-day))
- [Primary] Sunsama: a "workload counter" updates as you add time estimates to show your commitment for the day. The company's guide tells you to plan five or six hours of work for an eight-hour day because people underestimate task time. ([Sunsama planning guide](https://www.sunsama.com/blog/the-official-daily-planning-guide))
- [Snippet] Sunsama compares planned time with a workload threshold you set in settings and shows a warning when you exceed it; one reviewer says it warns as you approach the limit and more firmly once over. The help page I opened did not include the threshold wording or colors. ([Sunsama help](https://help.sunsama.com/docs/usage-guides/daily-planning); [efficient.app](https://efficient.app/apps/sunsama))
- [Primary, opinion not data] Sunsama's founder argues that planning less gets more done, that a long unrealistic list leads to passivity, and that finishing what you set out to do beats missing ambitious goals. The article cites no studies. ([Sunsama planning guide](https://www.sunsama.com/blog/the-official-daily-planning-guide))
- [Primary] Todoist: default daily goal of 5 tasks and weekly goal of 25, editable; setting the daily goal to 0 turns it off; days off and vacation mode protect streaks. Priority 1 floats to the top in red. ([Todoist Productivity help](https://www.todoist.com/help/todoist/features/use-the-productivity-view-in-todoist-6S63uAa9); [Todoist help](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs))
- [Reviewer] Structured limits by geometry: a day has finite length on screen and "gaps between tasks show as real space, so overcommitting becomes obvious." ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Primary] Any.do says its AI "suggests realistic task loads based on calendar availability" and flags repeatedly deferred tasks. It calls the approach "grounded in solid productivity research" but cites none. ([Any.do blog](https://www.any.do/blog/?p=7859))
- [Primary, Apple] Apple's citation praises Structured for prioritizing "downtime as much as productivity" and helping people "find time to take breaks." ([Apple Design Awards](https://developer.apple.com/design/awards/))
- [Research] Masicampo and Baumeister (2011), "Consider It Done! Plan Making Can Eliminate the Cognitive Effects of Unfulfilled Goals", Journal of Personality and Social Psychology 101(4), 667 to 683: unfinished goals caused intrusive thoughts and worse performance on unrelated tasks; making a specific plan for the goal removed those effects. The study is about plan making, not list length. ([Library record](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_918752704); summary in [Psychology Today](https://www.psychologytoday.com/us/blog/tech-support/201310/why-your-to-do-list-drives-you-crazy))

### Inferences
- The evidence supports "decide when and how" more than "pick exactly three." A design that gets one specific intention written down each morning has research behind it. A hard top-3 rule is a convention, not a finding.
- Soft limits are the norm in shipping products: opt-in lists, resets, warnings, and a modest default target (Todoist's 5). None of the fifteen apps, as far as sources show, blocks a fourth or sixth item.
- Two limit devices fit a single home-screen card well: (a) one highlighted "main thing" with the rest visually secondary, which mirrors Things' top-of-list rule and Todoist's red P1, and (b) a separate "later" bucket like This Evening so the visible set stays short.
- Streak protection (Todoist's days off and vacation mode) is part of making limits humane. For a training app with rest days this is directly relevant.

### Gaps
- No study found that tests a daily cap of three tasks, a "most important task" rule, or capacity warnings against a control. The search returned only advice posts.
- Choice-overload and planning-fallacy literature was not retrieved in this pass; claims about them should not be attributed to these notes.
- Sunsama's exact warning copy, default threshold and colors: not on the page I opened.
- No app in the set was confirmed to enforce a hard top-3. Apps known for hard limits (for example single-task or three-task apps) were outside the requested list and not researched.

## 6. What reviewers, designers and users praise or complain about

### Takeaway
Praise clusters on calm, scannable screens with one clever add interaction and small tactile rewards. Complaints cluster on three things: planning that needs effort before the app gives anything back, feature and customization sprawl, and weak phone versions of desktop planners.

### Cited Findings

Awards and editorial:
- [Primary, Apple, 2026] Structured, Apple Design Awards 2026 finalist (Inclusivity): "Visually sharp and easy to scan"; praised by "members of the neurodivergent community... for its simple layout" and for suggesting and pre-filling tasks. It is the only planner or to-do app on the 2026 page. ([Apple Design Awards](https://developer.apple.com/design/awards/))
- [News, Dec 2025] Tiimo, iPhone App of the Year 2025 in Apple's App Store Awards. ([TechCrunch](https://techcrunch.com/2025/12/04/ai-finds-its-way-into-apples-top-apps-of-the-year))
- [Primary] Things 3 displays its Apple Design Award and quotes: "Things 3 sets the standard for how apps should be designed and developed to be their best on every device." The award dates from 2017 (year from memory; the page shows the badge without a date). ([Cultured Code features](https://culturedcode.com/things/features/))

Praise:
- [Reviewer, 2017] Things 3: "you would be hard-pressed to find a better looking to-do app"; it "ruined other apps for me." ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Reviewer, 2017] Microsoft To Do: "perhaps the best looking task management app I've ever used"; suggestions are "an interesting, clever twist on the classic 'Today' list." ([MacStories](https://www.macstories.net/reviews/the-successor-to-wunderlist-is-here-microsoft-to-do/))
- [Reviewer, 2026] Structured "feels calm" on first open and makes overcommitment visible. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Primary, testimonial chosen by the maker] Tiimo: "Tiimo makes me feel 'in control' because I'm able to see my day visually." ([tiimoapp.com](https://www.tiimoapp.com/))
- [Reviewer, 2025] TickTick: the interactive Today widget and good future-date options. ([TidBITS](https://talk.tidbits.com/t/ticktick-provides-a-focused-daily-task-list-and-more/31705))
- [Reviewer, 2022] Amie: "a breath of fresh air", "joyous interactions." ([The Report](https://thereport.substack.com/p/a-joyful-calendar))

Complaints:
- [Reviewer, 2017] Things 3: task entry "may not be the quickest available – especially when creating tasks in bulk"; "there's nothing revolutionary being done here." ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/))
- [Snippet] Microsoft To Do: ZDNET's review headline was that the app makes you do too much; a user said My Day "doesn't auto populate which seems rather redundant"; a reviewer noted many people "can't remember to do that on a daily basis." There is a community feature request to auto-fill My Day. ([ZDNET](https://www.zdnet.com.au/article/microsoft-to-do-review/); [Microsoft Tech Community](https://techcommunity.microsoft.com/discussions/to-do/feature-request-auto-fill-my-day/3116274/replies/3511502))
- [Snippet, competitor blogs] Tiimo: setup "requires the executive function ADHD impairs. Before Tiimo can run your day, you have to build the plan"; customization takes too long; bugs versus subscription price. ([Habi comparison](https://habi.app/insights/best-adhd-planner-apps/); [JustUseApp reviews](https://justuseapp.com/en/app/1480220328/tiimo-visual-daily-planner/reviews))
- [Reviewer, 2026] Structured: dense days become "an unreadable ribbon of colour"; recurring tasks behind Pro "grates"; added widget rows dilute the main screen. ([Cool Curation review](https://coolcuration.com/structured-app-review-uk))
- [Reviewer, 2025] TickTick: "the sheer number of features." ([TidBITS](https://talk.tidbits.com/t/ticktick-provides-a-focused-daily-task-list-and-more/31705))
- [Snippet] Sunsama, Akiflow and Motion on iPhone: "surprisingly underfeatured for how costly" (Sunsama, App Store); "serious planning requires desktop" (Akiflow); "mobile app features lag behind desktop" and "can be highly buggy" (Motion). ([App Store](https://apps.apple.com/app/id1475755747); [efficient.app](https://efficient.app/apps/akiflow); [TechRepublic](https://www.techrepublic.com/article/motion-app-review/))
- [User thread, 2019 to 2026] Sunsama: 38 votes and six merged requests for a more satisfying completion, open for over six years. ([Sunsama roadmap thread](https://roadmap.sunsama.com/improvements/p/completing-a-task-should-feel-more-satisfying))
- [Primary, 2023] Opal's own users found the earlier Focus Score "too complex and hard to read", which drove the move to three numbers and one chart. ([Opal blog](https://opalapp.com/blog/introducing-the-new-opal-home-screen-track-your-screen-time-and-improve-your-focus))
- [Snippet] Notion Calendar: missing month and 7-day views are the top complaints; a third-party audit (Apr 2026) reports a 3.99/5 rating from about 21.7k users. ([App Store](https://apps.apple.com/us/app/notion-calendar/id1607562761))

### Inferences
Cross-app patterns, drawn from all six sections, in rough order of how well the sources support them:

1. **One shape for the day.** Each praised app has a single organizing form that can be read in a glance (ordered list, time line, three numbers). Words like "easy to scan", "calm", "white space" recur in praise. Orby's card currently presents a question, a button, a paragraph, a row and a link with similar weight, which is the opposite pattern.
2. **Position tells you what is next.** Top of the list (Things), the "now" marker (Structured), red at the top (Todoist). The next move is shown by placement and one accent color, not explained in text.
3. **Empty is a designed, positive state with one-tap candidates.** Microsoft To Do and Any.do clear the day on purpose and offer suggestions; Structured and Apple pre-fill. The repeated complaint about Microsoft To Do is that you must remember to do the planning yourself, so the entry point has to be prominent or prompted.
4. **Planning effort must be repaid fast.** The Tiimo and Microsoft To Do complaints are both "I have to do work before the app helps." Low-typing planning (accept suggestions, pick from what is already scheduled, speak a brain dump) is the common fix.
5. **Two-tier reward.** Small, fast, optional feedback on every completion; a larger moment for the day or for finishing the plan. Users notice and ask when the small tier is missing.
6. **Soft limits, not hard caps.** Opt-in today lists, resets, an evening or later bucket, a default goal of 5, a capacity warning. Evidence supports making a specific plan, not a specific number.
7. **Progress as a filling shape.** Pies and rings (Things projects, Things Watch ring, Todoist daily goal) give a glanceable state for the day and make each completion visibly count.
8. **Restraint ages better than features.** Sprawl is the standing complaint about TickTick, Tiimo customization and Structured's newer widget rows.

Implications to test for Orby's "Plan your day" section (these are suggestions that follow from the patterns, not findings):
- Give the section one dominant element when empty (the question or a single primary button), with candidates below it as one-tap chips drawn from today's workout, habits, goals and yesterday's leftovers, and drop the help paragraph.
- Once a goal is set, show it as the top item with clear emphasis, with to-dos beneath as a short ordered list and a visible progress shape for the day.
- Reward setting the plan as well as completing items; keep per-item feedback under about half a second and optional for sound.
- Keep any limit soft: a "later" bucket or a gentle note when the list grows, not a block.

### Gaps
- App Store editorial stories (Apple's "Today" tab features) for these apps could not be retrieved; the App Store Awards coverage came through TechCrunch, not Apple Newsroom directly.
- Reddit threads (r/thingsapp, r/todoist, r/ticktick, r/productivity) did not surface in search, so user sentiment here leans on App Store snippets and one roadmap thread.
- The Verge, Wirecutter and The Sweet Setup reviews were not opened in this pass (only a Sweet Setup snippet on Fantastical). Wirecutter's to-do app picks would be worth a follow-up.
- Apple's exact App Store Awards wording for Tiimo: quoted only through secondary coverage, and Tiimo's own award page returned a 404.
- Several of the strongest design quotes are from 2017 launch reviews (Things 3, Microsoft To Do). The principles likely hold but the screens have changed.
- I found no public usage data from any of these makers linking a specific Today-screen design to retention or daily planning rates.
