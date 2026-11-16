# How leading to-do and planner apps organize tasks and support daily planning

Scope: Things 3, Todoist, TickTick, Apple Reminders, Microsoft To Do, Any.do, Structured, Sunsama, Akiflow, Amie, Superlist. Research done 2026-11-16. Each item is labeled by source type: **[Maker doc]** (help center or docs: authoritative on behavior, not on outcomes), **[Maker marketing]** (blog or landing page: claims, not evidence), **[Review]** (independent editorial), **[Affiliate review]** (review sites with affiliate or discount links, weigh lower), **[User]** (forum, Reddit or App Store comment: anecdote), **[Study]** (peer-reviewed research), **[Secondary]** (blog summarizing a study, not checked against the paper).

Method note: about 28 searches and fetches. Coverage is uneven. Things, Todoist, Sunsama and Microsoft To Do are well covered from maker docs. TickTick, Apple Reminders, Akiflow, Amie and Superlist are thin (mostly secondary or affiliate sources). Gaps are listed honestly in each section.

---

## 1. Organization models: lists, projects, tags, priorities, dates, and how many concepts a new user must learn

### Takeaway
The apps split into two families. **List managers** (Things, Todoist, TickTick, Reminders, To Do, Superlist) organize by container (project, list, area) plus date-based smart lists. **Day planners** (Sunsama, Structured, Akiflow, Any.do's Plan my day) organize by *the day itself*, usually a timeline or calendar, with a backlog or inbox behind it. Things is the clearest example of separating "when I intend to start" (When) from "when it must be done" (Deadline), and that distinction is what lets its Today list stay short.

### Cited findings

**Things 3 (Cultured Code)**
- [Maker doc] Built-in lists: Inbox, Today, Upcoming, Anytime, Someday, Logbook, plus Quick Find lists Tomorrow, Deadlines, Repeating, All Projects, Logged Projects. A to-do with no When and no list lands in the Inbox: "If neither the `when` nor `list-id` are specified, the to-do will be added to the inbox." — [Things URL scheme docs](https://culturedcode.com/things/support/articles/2803573/)
- [Maker doc] Definitions: Today (with optional **This Evening** section) "lists everything that needs to get done today"; Upcoming holds "all the to-dos you can't work on now but have planned for the future"; Anytime holds what can be done "at any time"; Someday holds items "not clear yet but might become actionable at a later time." The default lists cannot be renamed, removed or reordered. — [Things: Scheduling and deadlines](https://culturedcode.com/things/support/articles/2803579/)
- [Maker doc] **When vs. Deadline**: the When picker has shortcuts for Today, This Evening and Someday; picking a calendar date moves the to-do to Upcoming and it moves into Today when that start date arrives. "Clear" moves it to Anytime. A start date "is not a calendar block with a duration." Deadlines are set with the flag button and are the date by which you must finish. "Tasks with a deadline remain active in the Anytime list. If you need more than one day to finish them, add a start date several days before the deadline." — [Things: Scheduling and deadlines](https://culturedcode.com/things/support/articles/2803579/)
- [User guide, third party] Deadlines display as a countdown ("3 days left") and on the day show "today" in red. — summarized via search from [vanja.io Things 3 complete guide](https://vanja.io/things-3-complete-guide/) (not fetched directly)
- [Maker doc] Hierarchy: areas contain projects; projects contain headings; a project cannot be completed while child to-dos remain; a heading can be archived only once all its to-dos are done or canceled. Tags apply by title. Each to-do can hold a checklist of up to 100 items. Repeating to-dos cannot have When or Deadline updated directly. — [Things URL scheme docs](https://culturedcode.com/things/support/articles/2803573/)
- [Review] Zapier (updated Dec 2025): Things is "gorgeous and great to use," feature-heavy but never cluttered; areas, projects, headers and subtasks are "surprisingly intuitive." Complaints: pricey ($49.99 Mac, $19.99 iPad, $9.99 iPhone) and no Windows or Android. — [Zapier: best to-do list apps](https://zapier.com/blog/best-todo-list-apps/)
- [Review] A 2017 review called the loose, human wording of Today, This Evening and Someday a strength. — [Brooks Review, Aug 2017](https://brooksreview.net/2017/08/things-3)

**Todoist (Doist)**
- [Maker doc] Only tasks with a date appear in Today and Upcoming. Priority 1 tasks "show up at the top of your Today view in red." — [Todoist: Plan your day with the Today view](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs)
- [Review] Organization: Inbox, projects, and (paid) custom filters and labels; natural-language entry ("buy milk Monday"); "balanced between power and simplicity"; complaint: "feels like a web app." Free tier; paid from $7/month. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

**TickTick**
- [Review] Lists, tags, due dates, priorities, subtasks, plus a Pomodoro timer, habit tracker and Eisenhower Matrix view; calendar for time blocking. Feels native per platform but "not always quite as polished as Todoist." Free; paid from $3.99/month. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

**Apple Reminders**
- [Review] Tags, due dates, subtasks, Smart Lists, location reminders, auto-categorized grocery lists, sharing; dated reminders can be checked off from Calendar. "Still not great for managing lots of to-dos and projects"; Apple Intelligence features "more miss than hit." Free. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

**Microsoft To Do**
- [Review] Lists with custom background images to tell them apart at a glance; flagged Outlook emails become tasks. Complaints: "hasn't quite caught up with Microsoft's AI pivot." Free. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

**Any.do**
- [Review] Lists and due dates, AI subtask suggestions; slick on mobile; desktop "not as nice," cluttered and confusing. Free; paid from $7.99/month. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

**Superlist, Amie, Akiflow**
- [Affiliate review] Superlist "looks nice and feels fun but can be buggy"; strong natural-language parsing. — [efficient.app: Akiflow vs Superlist](https://efficient.app/compare/akiflow-vs-superlist)
- [Affiliate review] Amie "used to have calendar and to-do features, but now it's focused on AI notetaking and meeting recording." — [efficient.app: Akiflow vs Amie](https://efficient.app/compare/akiflow-vs-amie). Treat as unconfirmed; I did not find an Amie maker statement.
- [Affiliate review] Akiflow consolidates tasks from many tools into one inbox for time blocking; ratings 4.2 (189 ratings, US App Store), 3.7 (Google Play), 4.4 (Trustpilot); price about $34/month or $19/month annual, no free plan, 7-day trial. — [usecarly / catchagent / efficient.app summaries via search](https://efficient.app/apps/akiflow); [Capterra reviews](https://www.capterra.com/p/232035/Akiflow/reviews/)

**Complexity**
- [User] A long-time Things user (MacPowerUsers forum) complained that This Evening items still show all day, so the section "doesn't actually hide them," and listed missing features: no built-in review, no location reminders, text-only notes. — [MacPowerUsers: To Things or not to Things](https://talk.macpowerusers.com/t/to-things-or-not-to-things-3/14561)
- [Review] Zapier's general stance: AI features "not broadly useful," and AI-generated subtasks could encourage procrastination. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)

### Inferences
- Concept count, by my reading of the docs above (not a measured figure): Things asks a new user to learn about 6 fixed lists, plus When vs. Deadline, plus areas/projects/headings/tags/checklists, about 12 concepts, but the six lists are fixed and named in plain words. Todoist's floor is lower (Inbox, Today, Upcoming, projects) but the ceiling is higher (labels, filters with a query language, P1-P4, sections, deadlines). Day planners (Sunsama, Structured) ask for fewer organizing concepts but more estimating (durations, time slots).
- The When/Deadline split is the single most useful idea for a short daily list: a deadline does not force a task into Today; only an intention to start does. An app that only has "due date" pushes every deadline into Today and creates overdue piles.
- For a personal, one-person app, colors, P1-P4 and nested labels add learning cost with little payoff; Todoist itself reduces its daily guidance to "mark the top three as priority 1."

### Gaps
- No exact, current (2026) concept-count or onboarding complexity data from any maker or study.
- Did not verify whether Things 3 has had a major version change (for example a "Things 4") by late 2026; all Things facts above are from the current Things 3 support pages.
- Todoist "deadline" field (separate from due date) and Todoist's current P1-P4 colors were not confirmed from docs in this pass.
- TickTick, Apple Reminders (iOS 26) and Superlist organization details are from one review each; no maker docs fetched.
- Apple Design Award history for Things (commonly said to have won in 2017) was not confirmed by a fetched source.

---

## 2. Daily planning rituals: what they ask, how long they take, and whether people stick with them

### Takeaway
Rituals range from **passive** (Things' Today fills itself from start dates; Todoist's Today fills from due dates) to **prompted pick-list** (Microsoft To Do's My Day resets nightly and offers suggestions) to **guided ritual** (Sunsama's morning planning and evening shutdown; Any.do's Plan my day) to **timeline** (Structured, Akiflow, Todoist's calendar layout). The trend through 2026 is toward AI doing the ritual for you: Sunsama's planning is now an agent ("Autoplan") that drafts the day in 2 to 4 minutes for review.

### Cited findings

**Things: Today and This Evening**
- [Maker doc] Today fills automatically when a to-do's start date arrives; This Evening is an optional section of Today; a separate Tomorrow list is in Quick Find. No duration, no calendar block. — [Things: Scheduling and deadlines](https://culturedcode.com/things/support/articles/2803579/)
- [Affiliate review] Things shows calendar events beside tasks but does not support time blocking, and task placement does not write back to the calendar. — [Morgen: Todoist vs Things 3 (2026)](https://www.morgen.so/blog-posts/todoist-vs-things-3) (Morgen sells a competing planner)

**Microsoft To Do: My Day**
- [Maker doc] "The My Day smart list resets every night, so you have a blank slate to add the tasks you want to accomplish each day." Add tasks directly or via "Add to My Day." The light-bulb icon shows suggestions. Unfinished tasks "will be saved to your Tasks list and included in your suggestions the following day." — [Microsoft Support: My Day and suggestions](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions)
- [User] Users ask for a configurable reset time (shift workers) and for adding to "My Day tomorrow" to plan the night before. — [Microsoft Tech Community: Add to My Day tomorrow](https://techcommunity.microsoft.com/discussions/to-do/feature-request-add-to-my-day-tomorrow/1930251); [Plan my day the night before](https://techcommunity.microsoft.com/discussions/to-doinsiders_android/feature-request-plan-my-day-the-night-before/401555)

**Sunsama: guided planning and shutdown**
- [Maker doc, current] Planning is now agentic "Autoplan": (1) tell the planning agent what matters today and what is in your way ("a rough list works fine"); (2) click Plan my day; (3) review the plan, answer "judgement calls," undo changes, or chat with the assistant ("Sunny"); (4) optionally share to Slack or Teams, then Get started. "Planning usually takes 2–4 minutes." The agent fits tasks around events and working hours. — [Sunsama: Daily planning](https://help.sunsama.com/docs/daily-planning)
- [Maker doc] Shutdown time gates late planning: planning within 2 hours of (or after) shutdown triggers "You're out of time today," offering to extend today or plan the next workday; after 10 PM the only extension is to midnight. — [Sunsama: Daily planning](https://help.sunsama.com/docs/daily-planning)
- [Affiliate review] The shutdown ritual prompts you to review what you finished, move incomplete tasks, and close the day; if you skip it, next morning's planning makes you review yesterday first. — [juliety.com Sunsama review (20 months)](https://juliety.com/sunsama-review); [efficient.app](https://efficient.app/apps/sunsama) (via search summary)
- [Review, therapist] An ADHD-focused clinician review frames Sunsama as working "with your brain." — [SaskADHD review](https://saskadhd.com/sunsama-review-a-therapists-take-on-the-daily-planner-that-actually-works-with-your-brain/) (title only seen; not fetched)

**Todoist: Today, Upcoming and calendar layout**
- [Maker doc] Calendar layout: dragging a task onto an hour "automatically creates a time slot for the task"; a Plan sidebar shows overdue, all-day and time-blocked tasks. Pro and Business only. Guidance: identify "the three most important tasks you need to complete today" and mark them priority 1. — [Todoist: Plan your day](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs)

**Any.do: Plan my day**
- [Review] "Plan my Day" makes you schedule when you will do each task; suits people who forget their lists; integrates Google and Outlook calendars. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)
- [Maker marketing] Each morning the app prompts you to review tasks, calendar events and pending items from yesterday, and you can drop tasks into free calendar slots. — [Any.do blog: best AI daily planner 2026](https://www.any.do/blog/the-best-ai-daily-planner-app-in-2026-why-any-do-stands-out/). Older maker pages call it "Any.do Moment," where you pick the hour the app turns your tasks into an agenda. — [Any.do Moment page](https://www.any.do/daily-planner-moment-app-for-desktop)

**Structured: timeline of the day**
- [Maker listing] A visual timeline where appointments, events and to-dos come together; an Inbox holds unscheduled tasks to drag into the day. — [App Store: Structured](https://apps.apple.com/app/structured-daily-planner/id1499198946)
- [Review] AppleInsider (v3.0.1, 2023): "no frills, attractive"; Reminders items without a time import into the Inbox; reported sync failures across iPhone, Mac and Watch; no month view. — [AppleInsider Structured 3.0.1 review](https://forums.appleinsider.com/discussion/230281)
- [Review, personal blog] Positive time-blocking write-up. — [Dave Swift: Structured review](https://daveswift.com/structured/)

**Akiflow: time blocking**
- [Affiliate review] One reviewer scored its daily ritual 4/5 because it forces planning instead of reacting; another said "you will still need to manually plan your tasks into your day"; no way to convert tasks into events; sync bugs reported in App Store reviews. — [efficient.app Akiflow](https://efficient.app/apps/akiflow); [usecarly Akiflow review 2026](https://www.usecarly.com/blog/akiflow-review/); [dhruvirzala Akiflow review](https://dhruvirzala.com/akiflow-review/) (all via search summary)

### Inferences
- The ritual that sticks seems to be the short one with a default already filled in. Sunsama itself moved from a multi-step manual ritual to a 2 to 4 minute "review the draft" flow, which suggests the full ritual was a barrier. This is an inference from the product change, not a stated reason.
- Microsoft's nightly blank slate plus suggestions is the cleanest "no guilt" model: yesterday's leftovers come back as *offers*, not as overdue red.
- Timeline planners (Structured, Akiflow, Todoist calendar) add duration estimates, which collide with the planning fallacy (section 4). The apps that warn on total load (Sunsama) partly address that.

### Gaps
- No independent data on retention or ritual adherence for any app. Claims that people "stick with" Sunsama come from personal or affiliate reviews only.
- No current maker doc fetched for Structured, Akiflow, Amie or Superlist planning flows.
- Did not find The Sweet Setup, MacStories, The Verge, Six Colors or Wirecutter coverage in this pass (MacStories' 2017 Things 3 review exists, URL seen in results but not fetched: [MacStories Things 3](https://www.macstories.net/?p=48965)).

---

## 3. Overdue and rollover: what happens to yesterday's unfinished tasks

### Takeaway
Four patterns: **silent carry-forward** (Things: a past start date just keeps the task in Today), **auto rollover with an expiry** (Sunsama: rolls nightly, auto-archives after more than four days by default), **reset and suggest** (Microsoft To Do: My Day empties, leftovers become suggestions), and **red Overdue section with a bulk Reschedule button** (Todoist). Users and Doist's own content describe the overdue-count spiral: counts climb, people avoid the app, then do a big cleanup.

### Cited findings
- [Maker doc] Todoist: overdue tasks sit in an Overdue section; "click Reschedule beside the Overdue section" to move them all at once; the article warns "Don't let overdue tasks build up from one day to the next." — [Todoist: Plan your day](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs). The Reschedule button also appears top-right in Upcoming, and in filters only when grouped by date. — [Todoist: Dates and times](https://www.todoist.com/hc/en-us/articles/205325931) (via search summary). Reschedule with machine-learned date suggestions launched in 2016. — [TechCrunch, Nov 2016](https://techcrunch.com/2016/11/16/todoist-uses-machine-learning-to-predict-your-task-due-dates/)
- [Maker marketing] Doist's own guide names the pattern of postponing day after day into a large backlog, and points to bulk Reschedule and Smart Schedule. — [Doist: How to use Todoist effectively](https://doist.com/blog/how-to-use-todoist-effectively)
- [Maker blog, personal essay] A Todoist-hosted GTD essay: "as overdue tasks started to accumulate, they would simply avoid their task lists until they snowballed out of control." — [Todoist Inspiration: GTD tips](https://todoist.com/inspiration/gtd-tips) (via search summary)
- [User] r/todoist (Feb 2025): overdue items pile up and resurface; one commenter reschedules unfinished tasks at day's end "with no guilt"; another recommends a short daily cap (a "2+8" method) and using Todoist as a future log, not a daily list. — [r/todoist thread via mirror](https://redlib.hbubli.cc/r/todoist/comments/1ith3xj/managing_the_chaos)
- [Maker doc] Sunsama: "all tasks automatically roll over to the next day's task list if they are left incomplete at midnight." Recurring tasks roll over until they collide with the next instance. — [Sunsama: Task rollover basics](https://help.sunsama.com/docs/task-rollover-and-recurring-tasks-the-basics)
- [Maker doc] Sunsama auto-archive: tasks that roll over "more than four days" by default go to the Archive; adjustable 1 to 14 days or disabled; tracking time or completing a subtask resets the count; you cannot archive manually; restore by picking a new day. — [Sunsama: Archive](https://help.sunsama.com/docs/archive)
- [User] Sunsama roadmap request for per-channel rollover settings; a 2025 comment says they "have to pull them out the archive every few days." — [Sunsama roadmap](https://roadmap.sunsama.com/improvements/p/set-task-rollover-days-by-channel)
- [Maker doc] Microsoft To Do: My Day resets nightly; unfinished tasks return as next-day suggestions. — [Microsoft Support](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions)
- [User] Things: users describe Things as automatically moving old to-dos into Today (no overdue state for start dates). — [Griply feedback board comment](https://griply.featurebase.app/p/date-rollover-for-overdue-tasks-not-for-deadlines). Repeating to-dos left in Today move to the next day instead of becoming overdue. — [Medium: Things 3 review](https://medium.com/the-extratextual/things-3-e8f2f704b662) (via search summary)
- [User] Debate in other apps' feedback forums: some want overdue kept separate from Today, others want "keep Today always Today instead of Overdue" or a one-tap "unschedule." — [ClickUp: keep Today as Today](https://feedback.clickup.com/feature-requests/p/allow-option-to-keep-today-always-today-instead-of-overdue); [ClickUp: unschedule overdue](https://feedback.clickup.com/feature-requests/p/unschedule-overdue-tasks); [Akiflow: split past-scheduled from future in Today](https://akiflow.featurebase.app/p/today-view-split-scheduled-on-calendar-for-the-future-from)

### Inferences
- Carry-forward without a red count (Things) and blank-slate-plus-suggestions (Microsoft) both avoid the shame signal; Todoist's red Overdue section is the strongest guilt signal and Doist's own content has to coach users out of the resulting spiral.
- Sunsama's auto-archive is the only documented mechanism that *ends* a pileup on its own. It answers a real problem: a task that rolls for five days is probably not happening.
- The Ovsiankina finding (people tend to resume interrupted tasks, section 4) supports offering leftovers back; the Masicampo and Baumeister finding (a plan quiets the open loop) supports making the "move it" action a real plan (a day), not a dismissal.

### Gaps
- No official Cultured Code statement found on how unfinished Today items behave; the carry-forward behavior is from user comments.
- TickTick and Apple Reminders overdue behavior (iOS 26) not confirmed; searches returned nothing authoritative.
- No study found that directly measures guilt or abandonment from overdue counts in task apps.

---

## 4. Limits and focus, and the research on planning and task completion

### Takeaway
Few apps hard-cap the list. The documented guardrails are Todoist's "three most important tasks as P1" guidance, Sunsama's planned-time total and overload warning, and Sunsama's auto-archive. The research is more useful than the features: specific if-then plans reliably help, but less than the famous figure suggests; people underestimate how long tasks take; and the "unfinished tasks nag you" idea (Zeigarnik) is weaker than pop psychology says, while making a plan for an open task does reduce its mental intrusion.

### Cited findings

**App guardrails**
- [Maker doc] Todoist: identify "the three most important tasks you need to complete today" and mark them P1. — [Todoist: Plan your day](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs)
- [Affiliate review] Sunsama shows a running total of planned time against a limit you set and warns when you are over ("loading up 8 hours of tasks for a 6-hour window, it warns you"); one review says Sunsama advises planning about 5.5 hours for a 9-to-5 with lunch; another puts the alert at "more than 5-6 hours of focused work." Sources disagree on the threshold. — [productivewithchris Sunsama review](https://productivewithchris.com/app-reviews/sunsama-review-2025/); [dupple Sunsama review](https://dupple.com/reviews/sunsama); [efficient.app Sunsama](https://efficient.app/apps/sunsama) (via search summary). The current maker planning doc did not mention a workload warning. — [Sunsama: Daily planning](https://help.sunsama.com/docs/daily-planning)
- [Maker doc] Sunsama auto-archive after more than 4 days of rollover. — [Sunsama: Archive](https://help.sunsama.com/docs/archive)

**Research**
- [Study] Implementation intentions: Gollwitzer and Sheeran (2006), meta-analysis of 94 independent tests (more than 8,000 participants), found if-then plans improved goal attainment with a medium-to-large effect, d = 0.65. *Advances in Experimental Social Psychology*, 38, 69-119. — [Secondary summary](https://howtostopprocrastinating.org/research/gollwitzer-2006-implementation-intentions/); [Secondary summary](https://consistencycalendar.com/science/implementation-intentions)
- [Secondary, not checked against paper] A 2024 update (Sheeran, Listrom and Gollwitzer) covering 642 tests reportedly found a simple average near d = 0.36, falling to about 0.15 after Bayesian bias correction; still positive but smaller and variable. — [goalsandprogress.com summary](https://goalsandprogress.com/implementation-intentions-research/). Verify before citing.
- [Study] Planning fallacy: Buehler, Griffin and Ross (1994), *Journal of Personality and Social Psychology* 67, 366-381. 37 students predicted thesis completion in 33.9 days on average; actual average was 55.5 days; about 30% finished by their predicted date. People were less biased predicting for others. — [Paper PDF](https://bear.warrington.ufl.edu/brenner/mar7588/Papers/buehler-et-al-1994.pdf); figures from [Changing Minds](https://changingminds.org/explanations/theories/planning_fallacy.htm) and [Silicon Canals](https://siliconcanals.com/?p=106590)
- [Study] Plan making and unfinished goals: Masicampo and Baumeister (2011), "Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals," *JPSP* 101(4), 667-683, doi 10.1037/a0024192. Unfulfilled goals caused intrusive thoughts during reading, higher accessibility of goal words, and worse anagram performance; letting participants make a specific plan eliminated these effects. — [Library record](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_918752704); [Psychology Today summary](https://www.psychologytoday.com/us/blog/tech-support/201310/why-your-to-do-list-drives-you-crazy)
- [Study] Zeigarnik and Ovsiankina meta-analysis: Ghibellini and Meier (2025), *Humanities and Social Sciences Communications* (Palgrave), "Interruption, recall and resumption." Found **no general memory advantage** for unfinished tasks (Zeigarnik effect lacks universal validity) but **a general tendency to resume** interrupted tasks (Ovsiankina effect). — [IDEAS/RePEc record](https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html); [Univ. of Bern PDF](https://www.kog.psy.unibe.ch/e48276/e1785865/s41599-025-05000-w1_ger.pdf)
- [Study] To-do practice: Bellotti et al. (2004), "What a to-do," CHI 2004, pp. 735-742. In a pilot, only 14% of participants' counted to-dos were on a list; most reminders lived elsewhere (email, calendar, paper). A month-long study of seven professionals found people were surprisingly skilled at tracking tasks. — [CHI 2004 paper PDF](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf); [Stanford HCI abstract](https://hci.stanford.edu/seminar/abstracts/04-05/050415-bellotti.html)

### Inferences
- Design implications drawn from the research (my inference): (1) a short list of tasks each given a *when* (time of day or slot) is an implementation intention in miniature; (2) any time estimate a user enters should be padded or compared against their history, because people underestimate their own tasks; (3) rescheduling a leftover to a specific day is a "plan" in Masicampo and Baumeister's sense and should quiet it, whereas leaving it red in an Overdue list keeps the loop open; (4) do not lean on Zeigarnik as a justification for showing unfinished counts.
- A "top 3" emphasis is consistent with Todoist's own guidance and with the planning-fallacy evidence that full-day lists will be overestimated, but I found no controlled study showing that a specific cap (3, 5, Ivy Lee's 6) improves completion.

### Gaps
- No peer-reviewed study found that measures completion rate versus to-do list length inside an app.
- The widely repeated "41% of to-do items are never completed" (attributed to iDoneThis) could not be traced to a source. Do not use it.
- Ivy Lee method (six tasks, ranked) has no primary source found here; it is anecdote from productivity writing.
- Cal Newport's time-block planning was not fetched; treat as opinion if used.

---

## 5. Recurring tasks, subtasks, checklists, notes, and calendar integration

### Takeaway
Everyone supports recurrence and some form of subtask. The design difference is the calendar: Things shows events beside Today but does not block time; Todoist (paid), TickTick, Structured, Akiflow and Any.do let you drag tasks onto hours; Sunsama plans tasks around your calendar automatically.

### Cited findings
- [Maker doc] Things: checklists up to 100 items per to-do; repeating to-dos restrict editing When and Deadline; repeating items cannot be duplicated. — [Things URL scheme docs](https://culturedcode.com/things/support/articles/2803573/)
- [Review] Things calendar integration lets you see appointments while planning your day. — [Zapier](https://zapier.com/blog/best-todo-list-apps/). No time blocking, no write-back to calendar. — [Morgen 2026](https://www.morgen.so/blog-posts/todoist-vs-things-3)
- [Maker doc] Sunsama: recurring tasks roll over until they collide with the next instance. — [Sunsama: Task rollover basics](https://help.sunsama.com/docs/task-rollover-and-recurring-tasks-the-basics). Autoplan fits tasks around events and working hours. — [Sunsama: Daily planning](https://help.sunsama.com/docs/daily-planning)
- [Maker doc] Todoist calendar layout creates a time slot when a task is dropped on an hour (Pro and Business). — [Todoist: Plan your day](https://www.todoist.com/help/articles/plan-your-day-with-the-todoist-today-view-UVUXaiSs)
- [Review] TickTick: calendar integration for time blocking, subtasks, habit tracker. Apple Reminders: dated reminders show and can be checked off in Apple Calendar. Any.do: Google and Outlook calendar integration. — [Zapier](https://zapier.com/blog/best-todo-list-apps/)
- [Review] Structured: Reminders import into Inbox; calendar import and recurring tasks reportedly require Pro on iOS. — [AppleInsider](https://forums.appleinsider.com/discussion/230281); [Ellie Planner guide 2026](https://ellieplanner.com/productivity-guides/best-daily-planner-apps-iphone) (competitor-authored)
- [Affiliate review] Akiflow cannot convert tasks into events. — [usecarly Akiflow review](https://www.usecarly.com/blog/akiflow-review/) (via search summary)
- [User] Things notes are text only (no rich media), a long-standing complaint. — [MacPowerUsers](https://talk.macpowerusers.com/t/to-things-or-not-to-things-3/14561)

### Inferences
- For an iPhone app that already has a day timeline, the strongest pattern is Structured's: a single vertical timeline mixing calendar events and timed tasks, with an Inbox of untimed tasks beside it to drag in. Things' model (events listed above an untimed Today) is the low-effort alternative.
- Recurring tasks interact with rollover: Things and Sunsama both avoid stacking duplicate overdue copies of a repeating task, which is the right default.

### Gaps
- Microsoft To Do recurrence and steps, Apple Reminders subtasks and iOS 26 changes, Superlist's nested list model and Amie's current task features were not verified from maker docs.
- No evidence found on whether calendar-visible tasks are completed more often than list-only tasks.
