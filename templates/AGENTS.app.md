# <App name>: agent guide

> Copy to your app repo root as `AGENTS.md`, add `CLAUDE.md` containing `@AGENTS.md`, fill in every `<…>`.

## App

<One-liner: For [who], [app] turns [input] into [outcome] in [seconds].>
UX references: <2–3 from playbook/09>. Domain watch-outs: <from playbook/00>.
$<30>/year, <3>-day free trial. Benchmarks (estimates): ~30% trial start, ~30% trial → paid.

## Stack (nothing else)

- API: one Cloudflare Worker (`apps/api/src/index.ts`), no router framework
- Data: D1 plain SQL (`apps/api/migrations/*.sql`) · R2 · KV flags · Durable Objects · Queues/Workflows
- Auth: Better Auth (`apps/api/src/auth.ts`), anonymous first, then Apple, Google, email
- AI: DeepSeek via OpenRouter behind AI Gateway (`apps/api/src/ai.ts`), prompts in `apps/api/prompts/`
- Payments: Superwall (mobile), Stripe (web); `entitlements` table is the source of truth
- Analytics and errors: Tinybird via `POST /events`
- iOS: SwiftUI (`apps/ios`) · Android: <React Native | Kotlin> (`apps/android`) · Web: React + Vite (`apps/web`) on Workers static assets

## Commands

| Do | Run |
|---|---|
| Install | `bun install` |
| Dev (API + web) | `bun dev` |
| Typecheck + lint | `bun run check` |
| Tests | `bun test` |
| New migration | `wrangler d1 migrations create DB <name>` |
| Apply migrations (staging) | `wrangler d1 migrations apply DB --env staging --remote` |
| Deploy staging | `bun run deploy:staging` |
| Deploy production | `bun run deploy:production` (**humans only**) |

## Rules

1. Run `bun run check && bun test` before done. UI changes: run the app and look.
2. Ask before adding dependencies or vendors. Never Vercel, Netlify, Lovable, Bolt, v0, Replit, Firebase, Supabase, Clerk, Auth0, Sentry, PostHog, Next.js, Hono, or an ORM.
3. All server logic on Cloudflare.
4. Stream AI. Log every AI call (`ai_call`) with cost.
5. Use existing design tokens and components (`<path>`).
6. Every user-visible feature emits an event.
7. Schema changes are SQL migrations, staging first.
8. Never touch production data, deploy to production, or commit secrets.
9. Decisions go in `docs/decisions/NNNN-title.md`.

## Done means

Works in the running app, checks and tests pass, events fire, PR says how you verified.
