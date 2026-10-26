# AGENTS.md: build a useful, profitable app

You are a coding agent (Claude Code, OpenCode, Codex, …). The human wants to build an app that improves people's lives (fitness, focus, learning, sleep, eating) and makes money, on this stack.

If you were told to clone this repo and read this file: read all of it, then start **Phase 0** by asking the Phase 0 questions.

Walk the human through every phase in order. Do **[AGENT]** steps yourself. Give exact instructions for **[HUMAN]** steps. Don't skip **Gate A**.

---

## Rules

1. **Helpful first.** Deliver what the app promises. Honest trials, easy cancellation, no dark patterns.
2. **UX first.** Pick the faster, simpler option.
3. **Use only this stack:**

| Job | Use |
|---|---|
| Server, data, files, jobs, email, hosting | **Cloudflare**: Workers (plain `fetch` handler), D1 (plain SQL), R2, KV, Durable Objects, Queues, Workflows, AI Gateway, Email Service, Turnstile |
| Auth | **Better Auth** (a library in the Worker) |
| Database at scale | **PlanetScale** via Hyperdrive |
| AI | **OpenRouter**, **DeepSeek** by default. Choose models with **Artificial Analysis** plus your own evals |
| Custom AI workflows at volume | **Vast.ai** / **RunPod** GPUs (ASR, image generation, self-hosted LLMs). Models only; control stays on Cloudflare |
| Payments | **Superwall** (iOS/Android) · **Stripe** (web) |
| Analytics + errors | **Tinybird** |
| Clients | **SwiftUI** for iOS · **React Native** or **Kotlin** for Android · **React + Vite** for web |
| Coding | **Claude Code** (max performance) · **OpenCode + DeepSeek** (efficiency) |

4. **Do not use:** Vercel, Netlify, Lovable, Bolt, v0, Replit (hosting), Bubble, FlutterFlow, Firebase, Supabase, Heroku, Render, Railway, AWS Amplify, Clerk, Auth0, Sentry, PostHog, Next.js, Hono, Drizzle, Prisma. If the stack can't do something, stop and ask.
5. Ask before adding a dependency. Prefer platform APIs (fetch, SQL, CSS variables, SwiftUI).
6. All server logic runs on Cloudflare. Keys never ship in clients.
7. Staging first. Never touch production data or run production deploys or migrations.
8. Before saying done: run checks and tests, and look at the running app.
9. Build fast (chapter 01): core loop end to end on day 1, fake what isn't built, copy flows from references, ship to TestFlight daily, park other ideas in `docs/later.md`.

## Chapters by phase

| Phase | Read |
|---|---|
| 0 Niche | [00 · Find your niche](playbook/00-find-your-niche.md), [12 · Costs](playbook/12-costs.md) |
| 1 Brief | [09 · Design & UX](playbook/09-design-ux.md), [11 · Distribution](playbook/11-distribution.md) |
| 2 Repo | [01 · Building with agents](playbook/01-building-with-agents.md) |
| 3 Backend | [02 · Backend](playbook/02-backend-cloudflare.md), [03 · Database](playbook/03-database.md) |
| 4 Auth | [04 · Auth](playbook/04-auth.md) |
| 5 AI | [05 · AI](playbook/05-ai.md) |
| 6–7 Clients | [06 · Clients](playbook/06-clients.md) |
| 8 Payments | [07 · Payments & pricing](playbook/07-payments-pricing.md) |
| 9 Analytics | [08 · Analytics & errors](playbook/08-analytics-observability.md) |
| 11 Retention | [10 · Retention](playbook/10-retention.md) |
| 12 Launch | [13 · Security & compliance](playbook/13-security-privacy-compliance.md) |
| 13–14 Grow | [11 · Distribution](playbook/11-distribution.md), [12 · Costs](playbook/12-costs.md) |

Templates in [`templates/`](templates/): `AGENTS.app.md`, `worker.ts`, `auth.ts`, `wrangler.jsonc`, `dev.vars.example`. Prefer linked docs over memory. Cloudflare's agent index: <https://developers.cloudflare.com/llms.txt>.

---

## Checklist

Copy into the app's `docs/progress.md`. Update it and show it after every phase.

### Phase 0: Find and validate the niche (1–7 days) · GATE A

- [ ] **[AGENT]** Ask in one message: Who do you know or belong to? What do they paste into ChatGPT? What do they complain about? Which apps do they pay for?
- [ ] **[AGENT]** Propose 3 niches (chapter 00): one-liner, 2–3 reference apps, domain watch-outs, scorecard (7 criteria, 1–5 each).
- [ ] **[AGENT]** Top candidate: read competitors' 1–3★ App Store reviews, write 10 short-form video hooks, draft a waitlist site (Worker + D1).
- [ ] **[HUMAN]** Post the videos and waitlist for one week.
- [ ] **[AGENT]** Run chapter 12 unit economics at the human's price.
- **Gate A, build only if:** scorecard ≥ 25/35 with no 1s · demand signal (saves, shares, "what app is this?", waitlist ≥ 10% of visitors) · revenue per download (chapter 12) well above cost per download.

### Phase 1: Brief

- [ ] **[AGENT]** Reference UI (chapter 09): category leaders via the App Store Search API, screenshots in `docs/references/`, flows from Mobbin and Screens Design, a teardown each. One reference per screen.
- [ ] **[AGENT]** `docs/brief.md`: one-liner, core action, aha moment, onboarding outline, paywall placement, price (default **$30/year, 3-day trial**), 2–3 reference apps, domain watch-outs, distribution plan (chapter 11), cost estimate (chapter 12).
- **Done when:** the human approves the brief.

### Phase 2: Accounts & repo

- [ ] **[HUMAN]** Create accounts (send only the ones needed):
  [Cloudflare](https://dash.cloudflare.com/sign-up) (Workers Paid + domain) · [GitHub](https://github.com) · [OpenRouter](https://openrouter.ai) (credits + key) · [Apple Developer](https://developer.apple.com/programs/enroll/) (start first; takes days) + [Small Business Program](https://developer.apple.com/app-store/small-business-program/) · [Google Play Console](https://play.google.com/console/signup) · [Superwall](https://superwall.com) · [Stripe](https://dashboard.stripe.com/register) · [Tinybird](https://www.tinybird.co)
- [ ] **[HUMAN]** Run `npx wrangler login` and `gh auth login`.
- [ ] **[AGENT]** Scaffold `apps/api` (from `templates/worker.ts` + `templates/wrangler.jsonc`), `apps/web` (`npm create cloudflare@latest -- apps/web --framework=react`), `apps/ios`, `apps/android`, `docs/decisions`. Copy `templates/AGENTS.app.md` to `AGENTS.md` and fill it in; add `CLAUDE.md` containing `@AGENTS.md`. Root scripts: `dev`, `check`, `test`, `deploy:staging`, `deploy:production`. Gitignore `.dev.vars*`, `.wrangler`, `node_modules`, `DerivedData`.
- **Done when:** `bun run check && bun test` passes and the first commit is pushed.

### Phase 3: Backend + database

- [ ] **[AGENT]** D1, KV, R2 for staging and production; ids in `wrangler.jsonc`.
- [ ] **[AGENT]** Migrations (plain SQL, chapter 03): Better Auth tables, `entitlements`, `usage_ledger`, core tables.
- [ ] **[AGENT]** `GET /health`, JSON errors with an `error` event to Tinybird, CORS for `WEB_ORIGIN`. Deploy to staging.
- **Done when:** `curl https://api-staging.<domain>/health` returns 200 and migrations are applied on staging.

### Phase 4: Auth

- [ ] **[AGENT]** `auth.ts` from the template: anonymous, Apple (native idToken), Google, magic link, bearer.
- [ ] **[HUMAN]** Create the Apple Services ID + key and Google OAuth client; set secrets with `wrangler secret put` (agent gives the commands).
- [ ] **[AGENT]** In-app account deletion, rate limits on `/api/auth/*`, Turnstile on email sign-up.
- **Done when:** on staging: anonymous sign-in, link Apple or Google, cookies on web, bearer on native, account deletion.

### Phase 5: AI

- [ ] **[HUMAN]** Create an AI Gateway; set `OPENROUTER_API_KEY` with `wrangler secret put`.
- [ ] **[AGENT]** `ai.ts`: DeepSeek through AI Gateway, streaming, timeout + fallback model, `ai_call` event with cost, server-side quotas (trial vs. subscriber).
- [ ] **[AGENT]** Pick models with Artificial Analysis (chapter 05): cheapest near the top per task (text, image, video, speech), then eval.
- [ ] **[AGENT]** `evals/`: 20+ real inputs and a scoring script. Use a pricier model only if DeepSeek fails.
- **Done when:** the core feature streams on staging, `ai_call` events show cost, and the quota blocks over-limit calls.

### Phase 6: Web app

- [ ] **[AGENT]** Design tokens first (chapter 09), then landing page, core feature, settings (with account deletion), Stripe checkout in **test mode**.
- **Done when:** a staging visitor can land, try the core action, sign in, and reach checkout, at phone width.

### Phase 7: iOS (then Android)

- [ ] **[AGENT]** SwiftUI: onboarding, core feature, settings, Sign in with Apple → Better Auth, API client, Superwall placements (`onboarding_end`, `feature_gate`, `settings_upgrade`).
- [ ] **[HUMAN]** In App Store Connect, create the app and a **$29.99/year subscription with a free trial**; connect Superwall; sign into Xcode.
- [ ] **[AGENT]** Android (Kotlin or React Native), same flows.
- **Done when:** the Simulator runs against staging, onboarding completes, the paywall shows, and a **sandbox** trial lands in `entitlements`.

### Phase 8: Payments & entitlements

- [ ] **[AGENT]** `/webhooks/stripe` and `/webhooks/superwall`: verified signatures, idempotent writes. `GET /me/entitlements` is the only Pro check.
- [ ] **[AGENT]** Paywall disclosures, Restore Purchases, trial-ending reminder.
- **Done when:** a web test purchase and an iOS sandbox purchase each unlock Pro on both platforms for the same user.

### Phase 9: Analytics & errors

- [ ] **[AGENT]** `POST /events` → Queue → Tinybird, with chapter 08 events from every client, including `error`.
- [ ] **[AGENT]** Tinybird pipes and dashboards: funnel (trial start %, trial → paid %), revenue, D1/D7/D30 retention, AI cost per subscriber, error rate. Cron alert on error and spend spikes.
- **Done when:** a staging run-through shows every event and a thrown test error appears in Tinybird.

### Phase 10: Onboarding, paywall & polish

- [ ] **[AGENT]** Full onboarding funnel (chapter 09), modeled on the brief's reference apps.
- [ ] **[AGENT]** Loading, empty, and error states, haptics, animation, dark mode, Dynamic Type, VoiceOver.
- [ ] **[HUMAN]** Use it on a real phone. Taste is the human's call.
- **Done when:** the human signs off on a device.

### Phase 11: Retention

- [ ] **[AGENT]** Push after the first win (APNs/FCM directly), streaks, a widget if it fits, lifecycle email (welcome, trial ending, win-back), review prompt after a win.
- **Done when:** a staging user gets the welcome email and a test push, and the trial reminder is scheduled.

### Phase 12: Launch

- [ ] **[AGENT]** Chapter 13 compliance table, store listing (chapter 11 ASO checklist), privacy labels.
- [ ] **[HUMAN]** Publish Privacy Policy and Terms, upload screenshots, submit for review, run the production deploy (agent prepares commands and a rollback plan).
- **Done when:** the app is approved and the production health check is green.

### Phase 13: First 1,000 downloads

- [ ] **[AGENT]** Share cards, referrals, universal links, a 30-day content plan (5 formats × daily posts), a creator brief, launch posts (X, LinkedIn).
- [ ] **[AGENT]** Outreach list (chapter 11): creators on [SideShift](https://apps.apple.com/us/app/sideshift-earn-money/id6481115809) and [Trybe](https://apps.apple.com/us/app/trybe-creators/id6759299465), plus niche influencers and meme pages on Instagram and TikTok. Draft DMs and briefs, one tracking link each.
- [ ] **[HUMAN]** Post daily, send the DMs, hire 10+ creators, launch.
- **Done when:** content is live and tracked links show downloads. Then compare trial and paid rates to the 30% / 30% benchmark.

### Phase 14: Grow to profit (weekly)

- [ ] **[AGENT]** Weekly report: downloads, trial start %, trial → paid %, revenue, AI cost per subscriber, D7/D30 retention, top errors, best and worst content.
- [ ] **[AGENT]** Propose one onboarding or paywall experiment and one product improvement from reviews and support.
- [ ] **[AGENT]** When one AI workflow's bill (LLM, ASR, image generation) is large and steady, propose moving it to **Vast.ai / RunPod** GPUs, with cost math and automatic API fallback (chapter 05).
- [ ] **[HUMAN]** Scale what works: more creators and pages, then paid ads.

---

## Report format (end of every phase)

```
Phase N: <name>: ✅ done | ⚠️ partially done | ⛔ blocked
Done: <what changed>
Verified: <the exact checks you ran and their result>
Your turn: <numbered human steps with links>, or "nothing, starting Phase N+1"
Money: <any new recurring cost> · <funnel numbers, from Phase 13 on>
```
