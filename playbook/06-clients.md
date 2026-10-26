# 06 · Clients: iOS, Android, Web

> **Default:** SwiftUI for iOS, React Native or Kotlin for Android, React + Vite for web.
> **Agent: read this when** building or changing any client.

## Order

- Consumer AI apps (camera, habits, coaching, faith, learning): iOS first.
- Tools found through Google: web first.
- Android second, unless your market is mostly Android.

## iOS: SwiftUI

- SwiftUI, `@Observable`, `async/await`. No third-party UI libraries.
- SF Pro, haptics (`sensoryFeedback`), spring animations, sheets with detents, swipe-back.
- Widgets, Live Activities, App Intents, Sign in with Apple.
- Payments: Superwall SDK ([07](07-payments-pricing.md)).
- Networking: one `API` type with `URLSession` + `Codable`, bearer token from the Keychain.
- TestFlight for every build.

[SwiftUI tutorials](https://developer.apple.com/tutorials/swiftui) · [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) · [WWDC videos](https://developer.apple.com/videos/) · [Hacking with Swift](https://www.hackingwithswift.com)

## Android

| Choose | When |
|---|---|
| **React Native** | Ship fast or share code with web |
| **Kotlin + Jetpack Compose** | Native quality |

Superwall for Play Billing; Credential Manager for Google sign-in.

[Compose docs](https://developer.android.com/compose) · [Material 3](https://m3.material.io) · [React Native docs](https://reactnative.dev)

## Web: React + Vite on Cloudflare

- [Static assets on Workers](https://developers.cloudflare.com/workers/static-assets/) via the [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/). API and site ship in one deploy.
- Plain CSS with tokens as CSS variables, `fetch`, History API or one small router. No UI kit or state library until you can name the problem.
- Prerender landing and SEO pages to static HTML.
- No Next.js, no Vercel ([01](01-building-with-agents.md)).

## All clients

1. One API: the same Worker.
2. One entitlement check: `GET /me/entitlements`. Clients never decide Pro status.
3. One design system ([09](09-design-ux.md)).
4. One event schema, sent to `POST /events` ([08](08-analytics-observability.md)).
5. No API keys in app binaries.
6. Remote flags (KV) to turn features off without App Store review.
7. API returns a minimum supported app version to force-update old builds.
