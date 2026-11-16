# Capture in leading iPhone to-do apps (Things 3, Todoist, TickTick, Apple Reminders, Microsoft To Do, Any.do, Structured, Sunsama, Akiflow, Amie, Superlist)

Research date: 2026-11-16. Each finding is labeled **[Maker doc]** (the vendor's help or feature page, which is authoritative on how a feature works but not on whether it is good), **[Review]** (independent editorial), **[User]** (Reddit and similar), **[Vendor marketing]**, or **[Research]**. Older facts carry their date. Coverage is uneven. Things, Todoist, TickTick and Apple Reminders are well sourced. Sunsama, Amie, Structured and Superlist are thin; see Gaps.

## 1. Quick add: where the control sits, taps from closed app to saved task, keyboard and default fields

### Takeaway
The two models people praise are Things' **Magic Plus**: one floating button in the lower right that you tap (to add at the top of the current list) or drag (to add at an exact position, a day in Upcoming, or the Inbox). And Todoist's **single text box Quick Add**: you type everything, including dates, project and priority, into one line. Todoist now also lets you drag its button ("Dynamic Add") to a position, so it has partly adopted Things' gesture. Reviewers rate Things as the most delightful but not the fastest, especially for adding many tasks at once. Todoist gets credit for the best balance of speed and detail.

### Cited Findings
- **Things, Magic Plus position and gestures [Review, May 2017]:** the button sits in the lower right corner by default. Drop it in a Today list to create a task at that spot. Drop it on the Inbox icon in the lower left to create a task in Inbox. Drop it on a day in Upcoming to set that task's start date. Drop it on a project area to create a project. The reviewer calls it "one of the most clever methods of task entry I've seen" and says the Taptic Engine haptics suit picking up and dragging the button. The page carries no date; its image filenames point to May 2017. — [MacStories, Ryan Christoffel, "Things 3: Beauty and Delight in a Task Manager"](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Things, criticism of speed [Review, 2017]:** the same review says task entry in Things "may not be the quickest available – especially when creating tasks in bulk", though still faster than many rivals. It credits Todoist's single-box natural language entry with the best balance of speed and detail. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Things, current behavior [Maker doc]:** you can lift the Magic Plus and drag it to a position in Today, under a heading in a project, or onto a day in Upcoming. To send a to-do to Inbox, drop it on the Inbox target that appears to the button's left. Inside a project, dragging it to the left margin creates a heading. — [Cultured Code, Things features](https://culturedcode.com/things/features/); [Cultured Code support article](https://culturedcode.com/things/support/articles/2803582/)
- **Things, iPhone versus iPad [Review, April 2019]:** on iPhone, a single tap adds a to-do at the top of the current list. Dragging inserts it at any position, and dropping it on the left side sends it to the Inbox. On iPad, tapping the bottom-right button adds the to-do to the list you are viewing, and dragging it to the sidebar creates a project. The guide also documents the older 3D Touch Home Screen action "New To-Do", now a long press. — [The Sweet Setup, Josh Ginter, "A guide to capturing tasks in Things 3 for iPad and iPhone"](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/)
- **Todoist, Dynamic Add [Maker doc, current]:** "Tap or drag the Dynamic Add button to any spot in your project or display." Steps: tap the button, type the task name ("task actions appear as you type"), optionally tap **+** to open the description field, then add. Only the name and description are fields. Everything else is typed with symbols (see section 2). On iOS, the help page recommends the Todoist widget for fast entry. The global Quick Add shortcut (**Q**) is web and desktop only. — [Todoist Help, "Use Task Quick Add"](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)
- **Todoist, reviewer view [Review, last reviewed May 2026]:** you tap the **+** icon to add a task, and "Easy to add tasks quickly" is listed as a pro. New tasks go to a general Inbox unless you give them a project. — [Zapier, "The best to-do list apps for iPhone"](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **TickTick [Review, last reviewed May 2026]:** "press and hold to add using a voice note". Testers noted voice recognition trouble with one tester's Scottish accent. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **TickTick clipboard capture [Maker doc]:** with "Recognize information in clipboard" turned on (Settings > General > Task Quick Add), TickTick offers to turn copied text into a task, including any time in it ("Clipboard Add Task"). — [TickTick Help](https://help.ticktick.com/articles/7055782422935240704)
- **Akiflow [Vendor marketing; Review]:** the App Store listing says you tap + and then dictate or type the task. Third-party reviews describe a widget and a long-press Home Screen shortcut for capture. Reviewers consistently say the mobile app is shallower than the desktop app. — [App Store: Akiflow](https://apps.apple.com/us/app/akiflow-ai-planner-calendar/id1621279084); [efficient.app, best to-do list apps 2026](https://efficient.app/best/todo-list); [dhruvirzala.com, Akiflow review](https://dhruvirzala.com/akiflow-review/)
- **Any.do [Review]:** Zapier praises the mobile app for quick task entry with due dates. A Medium reviewer calls the quick-add flow simple but the app more elaborate than they needed. — [Zapier, best to-do list apps](https://zapier.com/blog/best-todo-list-apps/); [Medium, Gabriel Klingman](https://gabrielklingman.medium.com/i-found-the-perfect-to-do-list-app-1e03be3c0366)
- **Structured [Review, about 2.5 years old]:** one reviewer says it is less a to-do app than a daily scheduler, and found it "overwhelming for quick capture". — [Medium, Gabriel Klingman](https://gabrielklingman.medium.com/i-found-the-perfect-to-do-list-app-1e03be3c0366)

### Inferences
- Taps from a closed app to a saved task, inferred from the documented flows and not measured by any source: Things and Todoist each take 1 tap on the app icon, 1 tap on the floating button, typing, then a tap on Save or Return. That is about 3 taps plus typing. A widget, a Control Center control or the Action Button removes the app-launch tap.
- The floating button in the lower right is the shared convention, and it is within thumb reach. Things adds placement by drag, and Todoist has now copied it. Todoist puts the work in a single text line instead of form fields. Things leaves the title field free of parsing and offers dates through a "When" picker that accepts typing (see section 2).

### Gaps
- No source gives pixel or point sizes for the Things or Todoist add button, or animation timings. The MacStories review says size and animation are not described.
- No source measures taps or seconds from a closed app to a saved task for any app.
- Microsoft To Do: I found no source on where the add field sits on iPhone or its default fields.
- Sunsama, Amie and Superlist: I found no first-hand source on the position of the iPhone add control.
- Things "Quick Entry" on iPhone, the popover reached from the share sheet or URL scheme: its fields are only partly documented. The URL scheme says Quick Entry can open pre-filled (`show-quick-entry`), and the share sheet opens a new-task box with the page title and URL. — [Things URL scheme](https://culturedcode.com/things/support/articles/2803573/); [The Sweet Setup](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/)

## 2. Natural language parsing: what is parsed, how parsed text is shown, how mistakes are undone, mis-parsing complaints

### Takeaway
Todoist has the deepest inline grammar and is the reviewer benchmark: dates and recurrence in plain words, plus `#project /section %label` (with `@` being retired in 2026), `p1-p3`, `!reminder`, `{deadline}` and `+assignee`, all in one box. If a word is wrongly read as a date, you tap it to turn it back into plain text. TickTick parses dates and times in the title. You cancel by pressing Delete or tapping the recognized text, and a setting strips date words out of the title. Users find it weaker than Todoist's parser for complex recurrence. Things parses only inside its date fields ("When" and deadline). Its Jump Start accepts partial words such as "tom" and "Wed 8pm", which avoids mis-parsing titles at the cost of an extra step. Apple Reminders added natural-language dates.

### Cited Findings
- **Todoist grammar [Maker doc, current 2026]:**
  - Dates and recurrence in natural language ("tomorrow at 4 PM", "every other Tuesday starting March 3").
  - Deadline in curly braces, `{march 30}`.
  - Priority `p1`, `p2`, `p3`. The page lists no `p4`.
  - Labels with `%`. "`@` still works but is planned to be retired by the end of 2026."
  - Project `#`, section `/` (for example `#Work /Admin`).
  - Reminder `!` (`!14:00`, `!30 min before`).
  - Assignee `+`, which works only in shared projects, so set the project first.
  - Dates are not supported in Czech or Turkish.
  - Fix: "Just click or tap the word to turn it into plain text." Smart date recognition can be turned off entirely.
  - — [Todoist Help, Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz); [Todoist Help, turn smart date recognition on or off](https://www.todoist.com/ja/help/articles/turn-smart-date-recognition-on-or-off-63WfIr); [Todoist Help, Introduction to dates and time](https://todoist.com/help/articles/205325931)
- **TickTick [Maker doc]:** smart recognition turns typed dates into due dates (example "Meeting at 9 tomorrow"). To cancel, "press the 'Delete' key or click the 'recognized time'". It can be turned off at Settings > General > Smart Recognition > Smart Date Parsing. — [TickTick Help](https://help.ticktick.com/articles/7055782422935240704)
- **TickTick, removing date words from the title [Maker blog, April 2016]:** a "Remove Text in Tasks" option keeps the date words out of the title. Example: "buy ticket tomorrow 8 am" sets tomorrow as the due date and 8 am as the reminder. Smart date parsing first shipped in TickTick 2.7.0 in April 2016. — [TickTick blog, 2.7.0](https://blog.ticktick.com/2016/04/12/ticktick-270-a-new-breakthrough-with-city/)
- **TickTick extra syntax [Third-party guide, August 2020]:** `^list`, `#tag`, `!priority`, and `@user` for assigning. I found no official TickTick page with the full syntax. — [curtismchale.ca, TickTick quick add syntax](https://curtismchale.ca/2020/08/10/ticktick-quick-add-syntax)
- **TickTick mis-parsing complaints [User, r/ticktick, 2025]:** one user calls it sluggish next to Todoist on smart date parsing. Recurring patterns such as "3rd Wednesday of every month" were hard to set through parsing. — [r/ticktick thread "Smart date parsing help" (Redlib mirror)](https://axebps-redlib.hf.space/r/ticktick/comments/1im1vkt/smart_date_parsing_help)
- **Things [Maker doc]:** the "Jump Start" date input parses partial words such as "Tom(orrow)", "Sat(urday)", "in fou(r days)" and "Au(gust 1)", and parses times ("Wed 8pm" sets a reminder). From Jump Start you can add to Today or This Evening, set a reminder, schedule a later date, or move to Someday. The URL scheme's `when` and `deadline` accept phrases such as "in 3 days" or "next tuesday", and these "must be provided in English, regardless of the user's device language." — [Cultured Code, features](https://culturedcode.com/things/features/); [Things URL scheme](https://culturedcode.com/things/support/articles/2803573/)
- **Things versus Todoist, reviewer framing [Review, 2017]:** Todoist's single-box natural language gives the best balance of speed and detail. Things relies on separate entry for its fields. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Apple Reminders [Review, May 2026]:** Apple added "natural language processing for dates". — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **Superlist [Review, 2026]:** you can add tasks by typing (free) or speaking (paid) reminder-style phrases, which it parses automatically. — [efficient.app](https://efficient.app/best/todo-list)
- **Akiflow [Review]:** natural language processing "works pretty well". On iPad, natural-language scheduling feels less polished than on desktop. — [dhruvirzala.com](https://dhruvirzala.com/akiflow-review/); [efficient.app](https://efficient.app/best/todo-list)

### Inferences
- There are three design patterns. (a) Parse inline in the title and let a tap undo each parsed part (Todoist, TickTick). (b) Parse only inside a dedicated date field (Things), which avoids mis-parsing titles such as "Call May" or "Read 1984". (c) Parse speech with AI into several tasks (Todoist Ramble, Superlist voice, Akiflow dictation; see section 3).
- The undo gesture, tapping the highlighted word or pressing Delete just after it is recognized, is the same in Todoist and TickTick. It looks like the expected pattern for inline parsing.

### Gaps
- **Highlight styling:** Todoist's help page does not describe how parsed text is highlighted. My recollection is a colored highlight in the text plus chips under the field, but I could not confirm it in this session.
- No source covered whether Microsoft To Do, Any.do, Structured, Sunsama or Amie parse natural language on iPhone.
- Things: no source confirms whether natural-language dates can be typed in the title field on iPhone. The documents point to Jump Start (the When field) only.
- I found no quantitative data on mis-parse rates.

## 3. Capture from outside the app: share sheet, widgets, interactive widgets, Control Center, Siri and Shortcuts, Watch, Action Button, email

### Takeaway
The biggest capture change in 2025-2026 is voice plus the iOS system surfaces. Todoist's **Ramble** became generally available on iOS in January 2026. It can be bound to the **Action Button** as a Control and placed as a Lock Screen or Home Screen widget, and it creates tasks live as you speak. Apple Reminders gained a **Control Center control** for quick reminders in iOS 26, and Siri is reviewers' favorite way to add to Reminders. Things offers a share extension, Siri and Shortcuts, widgets, Control Center and Lock Screen buttons, Home Screen Quick Actions, Mail to Things, and Watch dictation to Inbox.

### Cited Findings
- **Todoist Ramble [Maker doc; Press, January 21, 2026]:** voice capture that "captures your tasks in real-time as you talk". You end it by saying "that's all" or tapping the checkmark. It is available to all users on iOS, Android, desktop and web from January 21, 2026, in 38 languages. To bind it to the Action Button: Settings > Action Button > swipe to Controls > Choose a Control > Ramble. It can also sit on the Home Screen or Lock Screen as a widget or shortcut. Limits: it cannot yet add to a specific project or add labels and reminders. On iOS it resumes after most interruptions, but not after connection errors. It was first enabled for paid "Experimentalists" through the Quick Add + button and its waveform icon, with the date given by an X post. — [Todoist Help, Ramble](https://www.todoist.com/help/articles/use-ramble-to-add-tasks-by-voice-P1Raq7vVF); [Todoist product update, January 21, 2026](https://www.todoist.com/help/todoist/product-updates/turn-your-scattered-thoughts-into-clear-tasks-ramble-jan-21-2026-HhmP8ue8R); [TechCrunch, January 21, 2026](https://techcrunch.com/2026/01/21/todoists-app-now-lets-you-add-tasks-to-your-to-do-list-by-speaking-to-its-ai/); [Todoist on X](https://x.com/todoist/status/1962815605674799316)
- **Todoist widget [Maker doc]:** the Quick Add help page recommends the iOS widget for fast entry. — [Todoist Help](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz)
- **Things [Maker doc]:** the features page lists these as post-release additions: Siri and Shortcuts, widgets (a Today widget shipped with 3.0), Control Center and Lock Screen buttons, Home Screen Quick Actions, and Mail to Things. The Siri example is "In Things, remind me to call John at 5 AM." New reminders push to other devices immediately through "Fastlane". The page gives no versions or dates for these additions. — [Cultured Code, features](https://culturedcode.com/things/features/)
- **Things share sheet, Siri, Mail to Things [Review, April 2019]:** in Safari, Share > "Add to Things" opens a new-task box with the page title and URL, which saves to the Inbox. Siri accepts commands such as "add Get the HomePod to my To Buy list in Things". Mail to Things gives each user a unique address: the subject becomes the title, the body becomes the note, and forwarded mails link back to the original. — [The Sweet Setup](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/)
- **Things on Apple Watch [Review, 2017]:** Watch dictation adds tasks to the Inbox by default. — [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Apple Reminders [Review, 2025-2026]:**
  - iOS 26 adds a Control Center control for quick reminders.
  - Apple Intelligence suggests tasks, grocery items and follow-ups, and can suggest tasks from an email, link or article shared into the app.
  - "Auto-Categorize" sorts lists into sections.
  - These AI features need Apple Intelligence hardware (iPhone 15 Pro and later).
  - A forum commenter called the update "pretty light on features".
  - — [9to5Mac, August 15, 2025](https://9to5mac.com/2025/08/15/reminders-in-ios-26-has-a-powerful-new-tool-for-organizing-tasks/); [Neowin, iOS 26 Reminders](https://www.neowin.net/news/exploring-ios-26-5-new-features-you-can-find-in-the-reminders-app/); [AppleInsider forums](https://forums.appleinsider.com/discussion/240884); [MacRumors forums](https://forums.macrumors.com/threads/ios-26-whats-new-with-notes-and-reminders.2461629/)
- **Apple Reminders, Siri and widgets [Review, May 2026]:** "Adding tasks with Siri couldn't be easier." "There's great widgets available." It syncs to Apple Watch through iCloud with no setup. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **Akiflow [Review; Vendor marketing]:** a mobile widget and a long-press Home Screen shortcut for capture, plus dictation. Its marketing pitch is that it "pulls tasks in from thousands of apps" into one inbox. — [dhruvirzala.com](https://dhruvirzala.com/akiflow-review/); [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/); [App Store](https://apps.apple.com/us/app/akiflow-ai-planner-calendar/id1621279084)
- **TickTick [Review]:** calendar widgets are a Premium feature. Press and hold to add by voice note. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)

### Inferences
- The fastest capture paths on iPhone in late 2026 skip the app: the Action Button bound to a Control, a Control Center control, a Lock Screen widget, or Siri. Todoist and Apple Reminders document these. Things lists Control Center and Lock Screen buttons.
- Voice with AI parsing into several tasks (Ramble, Superlist voice, Akiflow dictation) is the new frontier. Todoist's documented limits (no project, label or reminder in voice) show that voice capture still trades structure for speed.

### Gaps
- Interactive widgets (iOS 17+, adding or completing tasks inside the widget): no source in this session documents them for any app.
- No source documents Control Center controls (iOS 18+) for Todoist, TickTick or Things beyond the Things features list and Todoist's Ramble control.
- Microsoft To Do, Any.do, Sunsama, Amie, Structured and Superlist: no sourced detail on share sheet, widgets, Siri or Watch capture.
- Email forwarding for Todoist, TickTick and others was not verified in this session. Only Things' Mail to Things is sourced.

## 4. Inbox versus straight to a day

### Takeaway
Things and Todoist send new tasks to an **Inbox** by default unless the user drops or tags them elsewhere. In Things, dragging the Magic Plus straight into Today or onto an Upcoming day gives a capture-to-a-day path without a second step. Microsoft To Do, Any.do, Sunsama, Akiflow and Structured are built around **a day**: My Day, Plan my Day, daily planning or timeboxing. Some of these (Akiflow, Any.do) still have an inbox that feeds the day plan. Reviewers frame this as "fast capture and sort later" versus "guided daily planning", and the evidence on which works better is opinion only.

### Cited Findings
- **Things [Maker doc; Review]:** a to-do added with no `when` or list goes to the Inbox. Watch dictation and the share sheet save to the Inbox. Magic Plus can drop a task directly into Today or onto an Upcoming day. — [Things URL scheme](https://culturedcode.com/things/support/articles/2803573/); [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/); [The Sweet Setup](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/)
- **Todoist [Review]:** new tasks go to a general Inbox unless given a project. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **TickTick [Review]:** the Today list shows tasks due today and tasks marked high priority. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/)
- **Microsoft To Do [Review; Vendor]:** "My Day" works as a daily planner. You pick tasks for it, and the app suggests tasks when you are low on ideas. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/); [App Store](https://apps.apple.com/us/app/microsoft-to-do/id1212616790?see-all=reviews)
- **Any.do [Review]:** its "Plan my Day" makes you schedule when you will do each task. A reviewer notes it also has an inbox. — [Zapier](https://zapier.com/blog/best-todo-list-apps/); [Medium](https://gabrielklingman.medium.com/i-found-the-perfect-to-do-list-app-1e03be3c0366)
- **Akiflow versus Sunsama [Vendor and comparison blogs]:** "Akiflow emphasizes quick capture and daily execution; Sunsama emphasizes guided planning and review", and capture speed is "less central" to Sunsama's identity. The first source is Akiflow's own blog. — [Akiflow blog (vendor)](https://akiflow.com/blog/akiflow-vs-sunsama-comparison); [selfmanager.ai](https://selfmanager.ai/articles/sunsama-vs-akiflow-2026)
- **Structured [Review]:** a daily scheduler, not a capture-first to-do app. — [Medium](https://gabrielklingman.medium.com/i-found-the-perfect-to-do-list-app-1e03be3c0366)
- **Research on planning versus noting [Research, via a secondary source]:** Masicampo and Baumeister (2011) found that making a plan for when, where or how to do an unfinished task reduced intrusive thoughts about it, while simply noting the task did not. The citation comes from a blog; the paper is real, but I did not read it in this session. — [mintedmode.com](https://www.mintedmode.com/blogs/desk-organization/the-real-reason-your-to-do-list-app-keeps-failing-you)

### Inferences
- A hybrid wins on both counts. The default is a zero-decision capture (Inbox or "later"), with a one-gesture path to "today" (Things' drag to Today, Todoist's typed "today"). The Masicampo and Baumeister finding suggests tasks should eventually get a when, but not necessarily at capture time.

### Gaps
- No direct reviewer comparison of Inbox-first versus Today-first capture in terms of outcomes.
- I did not verify the default destination for Apple Reminders (the default list setting), Superlist or Amie.

## 5. Evidence on capture friction and abandonment, versus marketing claims

### Takeaway
I found **no published usage data or controlled study** on quick-add friction in consumer to-do apps. The academic base is older HCI fieldwork on personal task management, such as Bellotti et al. at CHI 2004 and Haraty et al. at GI 2012. Most "friction causes abandonment" claims online are unsourced blogs or unverifiable statistics. The strongest independent signals are qualitative: long-running reviewer consensus (MacStories, The Sweet Setup, Zapier), plus Apple Design Award and editorial praise for Things.

### Cited Findings
- **Bellotti et al., "What a To-Do: Studies of Task Management Towards the Design of a Personal Task List Manager", CHI 2004, pages 735-742 [Research]:** a pilot "snapshot" study, where participants showed every place they kept to-dos, plus a month-long study of seven diverse professionals, used as a basis for designing a to-do manager. I could not read its capture-specific conclusions in this session. — [PDF mirror (RWTH Aachen)](https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p735.pdf); [Stanford HCI seminar abstract](https://hci.stanford.edu/seminar/abstracts/04-05/050415-bellotti.html); [dblp](https://dblp.org/rec/conf/chi/BellottiDGFBD04)
- **Haraty et al., individual differences in personal task management, GI 2012 [Research]:** cites Bellotti as one of the few HCI studies of prospective-memory tasks. Findings were not extracted in this session. — [Haraty et al., GI 2012 PDF](https://www.cs.ubc.ca/~joanna/papers/GI2012_Haraty.pdf)
- **Unverified friction statistics, flagged so the report does not use them:** UX Magazine cites a "Stanford 2024 Friction Index Study" (91% of drop-offs from stacked friction, up to 53% less abandonment), which I could not verify exists. A vendor blog claims apps lose over 70% of users in three days, with no source. A blog says capture friction is the top reason people abandon to-do apps, which is opinion. — [UX Magazine](https://uxmag.com/articles/friction-science-why-users-drop-off); [weareaffective.com](https://weareaffective.com/learning-centre/why-users-abandon-apps-and-how-psychology-fixes-retention); [taskloco.com](https://www.taskloco.com/articles/why-your-to-do-list-app-ends-up-abandoned-and-the-fix.html)
- **Reviewer consensus as evidence [Review]:** Todoist is repeatedly credited with the fastest structured capture, "Easy to add tasks quickly" and the best speed and detail balance. Things is credited with the most delightful but less bulk-friendly entry. Apple Reminders wins on Siri. — [Zapier](https://zapier.com/blog/best-iphone-ipad-to-do-list-apps/); [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)
- **Marketing claims, kept separate:** Akiflow ("pulls tasks in from thousands of apps"; its comparison blog positions itself as the speed leader). Todoist ("Turn your scattered thoughts into clear tasks", the Ramble launch). Apple's iOS 26 Reminders suggestions. None of these come with usage data. — [Akiflow blog](https://akiflow.com/blog/akiflow-vs-sunsama-comparison); [Todoist product update](https://www.todoist.com/help/todoist/product-updates/turn-your-scattered-thoughts-into-clear-tasks-ramble-jan-21-2026-HhmP8ue8R)

### Inferences
- Without usage data, the best evidence for a design decision is convergence. Independent makers have arrived at the same answers: a floating add button in the lower right that can be dragged (Things, then Todoist), tap-to-undo on parsed tokens (Todoist, TickTick), and capture surfaces outside the app (the Action Button and Control Center in Todoist and Reminders).

### Gaps
- No maker interview with figures on Quick Add usage, such as the share of tasks created through Quick Add versus widgets or voice, for any app.
- **Apple Design Award:** my recollection is that Things 3 won in 2017, but I did not fetch Apple's ADA page in this session, so it is unverified here.
- I did not search App Store review themes or the Reddit communities r/thingsapp and r/todoist in depth. The only user evidence is the 2025 r/ticktick parsing thread.
- Wirecutter, The Verge and Six Colors coverage of capture was not retrieved.
- Notion's tasks were not researched. They are likely not relevant for iPhone-first quick capture.
