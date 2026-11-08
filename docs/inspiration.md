# Inspiration log and redesign plan

A running file. Each batch of reference screenshots gets a short log entry, and what it teaches goes into the pattern library and the plan below. We build from this at the end.

Ground rules
- Tabs stay as they are: Today, Goals, Learned, Plan, Progress, Journal. The references shape flow, layout and feel inside those tabs, not the app's structure.
- References are for patterns, not copying. No borrowed names, logos, art, icons or copy.
- Palette: Columbia Blue, white, orange as the highlight.
- Screenshots are not committed to the repo. Entries cite them by batch and position.

Status: batch 1 of about 140 logged (5 of ~700 images).

---

## 1. Palette (draft)

Columbia Blue is very light. On white it reads as a tint, not a color (1.5:1), so it works as surface and atmosphere, never as text. Text needs a deep navy. Orange on white fails for text (2.9:1), so it is a fill and highlight color, with a darker orange for any orange text.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | `#FFFFFF` | Page background | |
| `--columbia` | `#B9D9EB` | Hero surfaces, selected states, charts, gradients | 9.9:1 under navy text |
| `--columbia-wash` | `#E8F3F9` | Card and grouped-list backgrounds | 13:1 under navy text |
| `--ink` | `#0F2A44` | Primary text, primary buttons | 14.6:1 on white |
| `--ink-2` | `#2F5D85` | Secondary text, icons | 6.9:1 on white |
| `--orange` | `#FF6B1A` | The one highlight: streaks, today, the live dot, key numbers on navy | 5.1:1 on navy; fill only on white |
| `--orange-text` | `#C2410C` | Orange words on white (links, warnings) | 5.2:1 on white |

Open: whether a dark mode keeps this palette (navy page, Columbia Blue text accents) or stays light-only. Decide after more batches.

---

## 2. Batch log

### Batch 1: first launch and sign-up (5 screens)
1. Splash: white page, the logo mark centered, nothing else. No spinner, no tagline.
2. Welcome: a soft grey-blue frosted gradient, the mark embossed like glass, one headline ("Your Connected Health Coach"), five page dots, one full-width dark pill button ("Continue") pinned near the bottom.
3. Feature page (Sleep): big left-aligned title, a one-line promise under it, then glassy previews of the real product cards (sleep needed with its breakdown, a deep-sleep hypnogram, a daily report with progress bars). The pitch is the product itself, not illustrations.
4. Privacy, before any account: "Privacy by design", a one-line promise (never sells or shares data), a large tactile vault illustration, links to the terms and policy, "Continue with Apple" as the main button, "Use email instead" as a quiet text link. A round floating back button top left.
5. Email: one question per screen, centered ("What is your email address?"), an underline field with an example as placeholder, the button grey and disabled until the address is valid, keyboard already up.

---

## 3. Pattern library

Grows with every batch. Each entry says where it applies in Logbook.

### Onboarding and first run
- One idea per screen, one button per screen, the button always in the same place. (Batch 1.2 to 1.5) Applies to `/welcome` and `/signup`.
- Sell with the real UI: onboarding pages show live-looking versions of Logbook's own cards (the morning card, a habit orb row, a Learned entry), not stock illustrations. (1.3)
- The splash is the mark on the page color and nothing else. (1.1) Matches what the native splash already does; only the color changes.

### Trust and consent
- State the privacy promise before asking for an account. (1.4) Logbook needs this anyway: Apple requires explicit consent before health data goes to a third-party AI (rule 5.1.2(i)). This screen is where the "Let the assistant read my health data" choice should live, worded plainly.

### Forms
- One field per screen during sign-up, the question as the title, the button disabled until the answer is valid. (1.5)
- Sign in with Apple first, email second. (1.4) New for Logbook: today it is email and password only.

### Navigation chrome
- A round, floating back button on pushed and onboarding screens. (1.4, 1.5) Compare with the current pushed bar before deciding.

### Visual language
- Atmosphere from soft gradients and frosted glass, kept to hero moments (welcome, feature pages). Working screens stay flat and white. (1.2, 1.3)
- Big confident titles, short one-line subtitles, generous empty space. (1.3)

---

## 4. How it maps to Logbook

| Logbook area | What the references suggest so far |
|---|---|
| Splash | Mark on white |
| Welcome and sign-up | 5-page carousel built from real Logbook cards, privacy page, Sign in with Apple, one field per screen |
| Today | (pending) |
| Goals | (pending) |
| Learned | (pending) |
| Plan | (pending) |
| Progress | (pending) |
| Journal | (pending) |
| Settings and connections | (pending) |

---

## 5. Plan (draft, revised as batches arrive)

1. Tokens: move the app from the current dark theme with an electric-blue accent to the light Columbia palette above. One file of tokens, every screen inherits it.
2. First run: rebuild welcome and sign-up as the carousel, privacy and one-question flow from batch 1, and add Sign in with Apple (needs the Apple Developer enrollment).
3. Tabs: one pass per tab once the batches covering them are in.

## 6. Open questions
- Light only, or light plus dark?
- Sign in with Apple: add it at the redesign, or after the enrollment clears?
