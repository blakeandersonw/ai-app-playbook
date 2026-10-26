# 09 · Design & UX

> **Priority #1.** UX comes before every other decision here.
> **Agent: read this when** building any screen, flow, or animation. First pick reference apps for this product type from the table below, write them into `docs/brief.md`, and study their flows.

## Reference apps

Pick 2–3 that match your product.

| Product | Study | Copy |
|---|---|---|
| **Snap / scan → result** | Cal AI, Yuka, PictureThis, Photomath | Instant camera; ~1s result; big score; color-coded verdicts |
| **Daily habit / learning** | Duolingo, Finch, Speak | Streaks, character, celebration, sound, short session, next lesson queued |
| **Plan / coaching** | Ladder, Cal AI's plan screen, Flo | Plan reveal, "today" home, progress rings, check-ins |
| **AI chat / companion** | [EcoGPT](https://ecogpt.com), ChatGPT, Speak | Streaming text, instant navigation, suggested prompts, voice |
| **Photo / creative** | Remini, Lensa, CapCut | Before/after slider, short wait with progress, one-tap share and save |
| **Faith / mindfulness** | Hallow, Headspace, Calm | Calm palette, audio-first, daily ritual, gentle reminders |
| **Focus / productivity** | Opal, Structured, Things | Visual timeline, satisfying completion, widgets |
| **Marketplace / jobs** | SideShift, Airbnb, Depop | Swipeable cards, trust signals, one-tap apply or buy |
| **Money** | Cleo, Copilot Money | Personality in copy, clear charts, weekly recaps |
| **Looks / style** | Umax, skincare scanners | Selfie flow, score breakdown, routine plan, kind wording |

Screens: **[Mobbin](https://mobbin.com)**, **[Screens Design](https://screensdesign.com)**. Paywalls: **[Superwall gallery](https://superwall.com/applications)**.

## Finding UI to replicate (agent steps)

1. **List the leaders** with Apple's Search API (no key):
   ```bash
   curl "https://itunes.apple.com/search?term=calorie+tracker&entity=software&country=us&limit=25"
   ```
   Sort by `userRatingCount` and `averageUserRating`. Results include `screenshotUrls`, `description`, `trackViewUrl`.
2. **Save screenshots** to `docs/references/<app>/`.
3. **Get full flows** (onboarding, paywall, home, settings) from [Mobbin](https://mobbin.com), [Screens Design](https://screensdesign.com), and the [Superwall gallery](https://superwall.com/applications). The human can also drop screen recordings in `docs/references/`.
4. **Check TikTok and Instagram** for "[app name]" and "[category] app" to see which moments creators film.
5. **Write a teardown** per reference in `docs/references/<app>.md`: flow, layout, visual (type, spacing, radius, palette, light/dark), motion, copy.
6. **Pick one reference per screen**, not per app.
7. **Rebuild in your design system** and compare side by side (SwiftUI previews or a phone-width browser) until it matches.

Copy patterns, not assets: no logos, illustrations, icons, characters, copywritten text, or brand names.

## Principles

1. Fast: optimistic UI, skeletons, streaming text, tap response under 100 ms.
2. One primary action per screen.
3. Value before signup ([04](04-auth.md)).
4. Spring animations; haptics on important taps.
5. Celebrate progress: streaks, rings, "you did it".
6. Native conventions per platform.
7. Accessible: Dynamic Type, contrast, VoiceOver labels, 44 pt tap targets.
8. Honest: real trials, easy cancel, no fake urgency.

## Onboarding (Cal AI / Duolingo pattern)

1. Hook: one promise, one button.
2. 5–15 personal questions with a progress bar.
3. Social proof partway through.
4. "Building your plan…" with animated steps.
5. Personalized result (the aha moment).
6. Account (one-tap Apple) if needed.
7. Paywall: free trial, highlighted yearly.
8. First win within 60 seconds.

Track each step ([08](08-analytics-observability.md)).

## Design system

- Tokens: color (light and dark), type scale, 4/8 pt spacing, radius, shadows, motion durations.
- Kit: Button, Card, Sheet, ListRow, Input, Paywall, EmptyState, Toast.
- Same tokens in SwiftUI, Compose, and CSS variables.
- App icon and first 3 screenshots drive most store conversion.

## Resources

- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/) · [Material 3](https://m3.material.io) · [Laws of UX](https://lawsofux.com)
- [Mobbin](https://mobbin.com) · [Screens Design](https://screensdesign.com) · [Superwall paywall gallery](https://superwall.com/applications)
- [SF Symbols](https://developer.apple.com/sf-symbols/) · [Rive](https://rive.app) (interactive animation)
