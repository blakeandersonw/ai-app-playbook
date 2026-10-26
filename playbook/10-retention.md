# 10 · Retention

> **Default:** yearly subscribers renew only if the app is a habit.
> **Agent: read this when** building notifications, streaks, widgets, email, or win-back.

**Habit loop:** trigger (push at their usual time, widget, streak at risk) → one small action → reward (progress, insight) → investment (history, streaks, plan).

| Tool | How |
|---|---|
| **Push** | APNs and FCM from a Worker. Ask **after the first win**, never on launch |
| **Smart timing** | Cron Triggers + per-user schedule in D1, at the user's usual hour |
| **Streaks** | Include a streak freeze |
| **Widgets / Live Activities** | Daily progress on the home screen |
| **Lifecycle email** | Cloudflare Email Service via Queues: welcome, day-3 tip, **trial ending**, win-back |
| **Review prompt** | `SKStoreReviewController` / Play In-App Review after a win |
| **Win-back** | Superwall campaigns and App Store win-back offers |
| **Weekly recap** | "This week you…", also a share card |

**Rules:** every push useful · respect time zones and quiet hours · user controls frequency · measure opt-in and push → open, test copy · **always send the trial-ending reminder**.

## Resources

- [User Notifications (APNs)](https://developer.apple.com/documentation/usernotifications) · [WidgetKit](https://developer.apple.com/documentation/widgetkit) · [ActivityKit](https://developer.apple.com/documentation/activitykit)
- [Firebase Cloud Messaging HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api) (FCM only, nothing else from Firebase)
