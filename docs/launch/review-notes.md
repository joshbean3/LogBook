# App Review notes for Orby 1.0

A draft of the Notes field in App Store Connect, App Review Information (owner task 32). The field holds 4,000 characters; the text between the lines below is under that. Replace the three values in angle brackets, then paste.

Before pasting, check on the build you submit:

- The demo account signs in and does not expire (owner task 31).
- Sign-up is open on the production server.
- The four links at the end open signed out.
- If a later build ships Strava, add this sentence: "The server reports whether Strava is configured; that flag can hide Strava during an outage but cannot show a feature that is not in the build."

---

```
SIGN IN
A demo account is in the sign-in fields above. It has a training plan, habits, goals, journal entries and sample sleep, heart rate variability and resting heart rate numbers on Progress. Those health numbers are sample data added by us so the screens can be reviewed on a phone with no Apple Watch.

WHY AN ACCOUNT
Orby keeps a person's training plan, habits, goals and journal on our server so they are backed up and can be restored on a new phone. Nothing in the app works without that data, so the app asks for an account first. Sign-up needs only an email address and a password. The app is free, with no purchases, subscriptions or ads.

AI ASSISTANT (Guideline 5.1.2)
The assistant, the plan builder, the goal review, "Remember when" on Journal and the daily pick on Reads use Claude, an AI model made by Anthropic. Our server calls Anthropic's API; Anthropic acts as our processor and does not train on the data.
Nothing is sent until the person allows it. The permission step appears before sign-up ("Allow" or "Not now"), again the first time the assistant or the plan builder is opened if it was skipped, and at any time in Settings > Privacy > Assistant access, which has one switch for each kind of data. With "Not now", nothing is sent to Anthropic and the rest of the app works. The demo account has not answered yet, so you will see the step when you open the assistant.
The assistant is labeled as AI wherever it appears. It proposes changes to the plan; nothing changes until the person taps Apply, and Apply can be undone.

APPLE HEALTH (Guidelines 5.1.3, 2.5.1)
Read only. Orby asks for three types: Sleep, Heart Rate Variability and Resting Heart Rate, and shows each on the Progress tab. To connect: on Today tap the round button with the initial (Settings) > Data sources > Apple Health > Connect. Readings are saved to the person's Orby account on our server so Progress can show them. They are never used for advertising, never sold, never stored in iCloud and never sent to the AI. Orby does not write to Apple Health. To disconnect and delete the saved readings: the same screen > Disconnect Apple Health.

DELETE ACCOUNT (Guideline 5.1.1(v))
Settings > Account (the row with the email address) > Delete account. It deletes the account and all of its data at once, in the app, with no email or call needed.

NOT MEDICAL
Orby is a fitness and wellness app. It gives no diagnosis or treatment advice and says so in the app and in the terms.

EXTERNAL SERVICES AND FEATURES
Every external service the app uses: our own server (hosted by <hosting company>), Anthropic's Claude API (called from our server, only with permission), Apple Health (on the device, read only) and email for password reset and address confirmation (sent from our server). There is no analytics, advertising or tracking SDK.
No server setting turns on a feature that is not in this build. Strava is not in this build: the binary holds no Strava code, screens or URL scheme.

OTHER
iPhone only, portrait. United States only. For people 18 or older.
The reminders the app can send are local notifications, set on the phone. No push notifications.
Privacy Policy: https://<host>/legal/privacy.html
Consumer Health Data Privacy Policy: https://<host>/legal/health-privacy.html
Terms of Use: https://<host>/legal/terms.html
Support: https://<host>/legal/support.html

Contact for questions during review: <name, email, phone>
```

---

## What each paragraph answers

| Paragraph | Guideline | Finding |
|---|---|---|
| Sign in, sample health numbers | 2.1 (a working demo account) | gap-sub-48, critic-09 |
| Why an account | 5.1.1(v) (account not required unless the app needs it) | gap-rev-11 |
| AI assistant | 5.1.2(i) (disclose third-party AI and get permission first) | auth-03, critic-02 |
| Apple Health | 5.1.3, 2.5.1, 5.1.1(iii) | ios-03, copy-legal-30 |
| Delete account | 5.1.1(v) | settings items in ws-10 |
| External services and features | 2.5.19 (no dormant or hidden features), 2.3.1 | gap-rev-11, critic-06 |
