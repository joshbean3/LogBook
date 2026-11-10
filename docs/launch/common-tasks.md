# Common tasks for Logbook 1.0

These are the tasks every build is tested against. Apple calls them "common tasks": the app's main jobs plus first launch, sign-in and settings. An Accessibility Nutrition Label may be declared only when every task here works with that feature, and it must be checked again on every release (requirements QUA-36 and QUA-41).

Run them on the TestFlight build, on a real iPhone, launched from the Home Screen with no debugger attached. `docs/launch/qa-matrix.md` lists the conditions to run them under and holds the results.

How to fill it in: copy the "Results" table at the bottom for each build, write the build (for example "1.0.0 (412)"), and mark each task Pass, Fail (with a one-line note and a screenshot) or N/A. A task fails if any step is blocked, a control has no name, text is cut off so the meaning is lost, or the screen shows placeholder text.

## The tasks

| Id | Group | Task | Owner |
|---|---|---|---|
| T1.1 | First launch | Open the app for the first time: the splash shows, then the value pager. Swipe through every page. | Owner |
| T1.2 | First launch | From the pager, open "I already have an account" and come back. | Owner |
| T1.3 | First launch | Read the privacy page in onboarding, open the privacy policy link, come back. | Owner |
| T2.1 | Sign up and sign in | Create an account with a new email: the 18 or older line, the terms and privacy links, a strong password (AutoFill offers one once the server serves the association file). | Owner |
| T2.2 | Sign up and sign in | Sign out, then sign in with the same account (AutoFill suggests the saved password). | Owner |
| T2.3 | Sign up and sign in | Forgot password: ask for the link, open the email, set a new password, sign in with it. | Owner |
| T2.4 | Sign up and sign in | Confirm the email address from the confirmation mail. | Owner |
| T3.1 | Onboarding | Name, goal, training days, the morning step with the before or after work choice. | Owner |
| T3.2 | Onboarding | Habits, the reminder step (allow and, on another run, Not now), the tour. | Owner |
| T3.3 | Onboarding | The plan build and the payoff screen, then Today. An existing account never sees onboarding again. | Owner |
| T3.4 | Onboarding | Settings, Replay setup: runs the steps again without losing data. | Owner |
| T4.1 | Today | Read the status chip and the training card (the gauge, the session, the Morning / Afternoon / No time pill). | Owner |
| T4.2 | Today | Check a habit tile, then undo it. | Owner |
| T4.3 | Today | Plan your day: set the goal, add a to-do, move it into the top three, complete it, undo, unfold the rest. | Owner |
| T4.4 | Today | Open another day from the week strip and come back to today. | Owner |
| T5.1 | Plan | Open the plan card and read its summary. | Owner |
| T5.2 | Plan | Read the week day by day, open a session, mark it done, move a session to another day. | Owner |
| T5.3 | Plan | Ask the assistant for a plan change and accept the proposal (the AI permission step shows first if it was never answered). | Owner |
| T6.1 | Goals | Create a daily, a weekly, a monthly and a yearly goal. Use the Tomorrow and Next week chips. | Owner |
| T6.2 | Goals | Edit a goal, complete it, set a reminder on it. | Owner |
| T7.1 | Learned | Add a lesson and read it back. | Owner |
| T8.1 | Progress | Read the plan versus actual chart, swap Run and Strength. | Owner |
| T8.2 | Progress | Open a strength row, read the trends and the Apple Health tiles (sleep, heart rate variability, resting heart rate). | Owner |
| T9.1 | Journal | Write an entry, edit it, read it again. | Owner |
| T9.2 | Journal | Switch the calendar between Week and Month, pick a past date, open Remember when. | Owner |
| T9.3 | Journal | Share a card and Save Image to Photos. | Owner |
| T10.1 | Assistant | Open the assistant from the Ask bar, ask a question, read the streamed answer, stop one mid-answer. | Owner |
| T10.2 | Assistant | Attach a photo (camera and library) and send it. | Owner |
| T10.3 | Assistant | With the assistant access switches off, the assistant says what it cannot read and nothing is sent. | Owner |
| T11.1 | Settings | Change the name and the training days. Read Settings, About: "Version x (commit)". | Owner |
| T11.2 | Settings | Privacy, Assistant access: turn each switch off and on. | Owner |
| T11.3 | Settings | Data sources, Apple Health: connect (Apple's sheet shows three types), run the reading check, Disconnect Apple Health. | Owner |
| T11.4 | Settings | Reminders and haptics on and off. | Owner |
| T11.5 | Settings | Import and export: Export, and the file saves. | Owner |
| T11.6 | Settings | Change password; change email. | Owner |
| T11.7 | Settings | Open the privacy policy, health data policy, terms, support and acknowledgments pages. | Owner |
| T11.8 | Settings | Sign out: the next account sees nothing of the last one. | Owner |
| T12.1 | Account deletion | Delete account from Settings: the confirmation, the export offer, then the welcome screen. Signing in again fails. | Owner |
| T12.2 | Outside the app | Act on a goal reminder notification: it opens the right screen. | Owner |

## Results

Copy this table for each build. Keep the newest build on top.

### Build: ____ (date ____, phone ____, iOS ____)

| Id | Pass / Fail / N/A | Note |
|---|---|---|
| T1.1 | | |
| T1.2 | | |
| T1.3 | | |
| T2.1 | | |
| T2.2 | | |
| T2.3 | | |
| T2.4 | | |
| T3.1 | | |
| T3.2 | | |
| T3.3 | | |
| T3.4 | | |
| T4.1 | | |
| T4.2 | | |
| T4.3 | | |
| T4.4 | | |
| T5.1 | | |
| T5.2 | | |
| T5.3 | | |
| T6.1 | | |
| T6.2 | | |
| T7.1 | | |
| T8.1 | | |
| T8.2 | | |
| T9.1 | | |
| T9.2 | | |
| T9.3 | | |
| T10.1 | | |
| T10.2 | | |
| T10.3 | | |
| T11.1 | | |
| T11.2 | | |
| T11.3 | | |
| T11.4 | | |
| T11.5 | | |
| T11.6 | | |
| T11.7 | | |
| T11.8 | | |
| T12.1 | | |
| T12.2 | | |
