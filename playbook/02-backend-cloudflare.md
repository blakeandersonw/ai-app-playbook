# 02 · Backend: all-in on Cloudflare

> **Default:** one Cloudflare account for API, data, files, jobs, email, AI routing, and web. Workers `fetch` handler, no framework.
> **Agent: read this when** creating or changing anything server-side.

One account, one CLI ([Wrangler](https://developers.cloudflare.com/workers/wrangler/)), one bill. $5/month covers a real app; R2 has no egress fees ([12 · Costs](12-costs.md)).

## Building blocks

| Need | Use |
|---|---|
| HTTP API | **[Workers](https://developers.cloudflare.com/workers/)**, one `fetch` handler ([`templates/worker.ts`](../templates/worker.ts)) |
| Relational data | **[D1](https://developers.cloudflare.com/d1/)**, later PlanetScale ([03](03-database.md)) |
| Per-user / per-chat state, realtime | **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** (SQLite) |
| Multi-step AI pipelines | **[Workflows](https://developers.cloudflare.com/workflows/)** |
| Background jobs | **[Queues](https://developers.cloudflare.com/queues/)** |
| Scheduled tasks | **[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)** |
| Files, photos, audio | **[R2](https://developers.cloudflare.com/r2/)** |
| Flags, config, cache | **[KV](https://developers.cloudflare.com/kv/)** |
| Embeddings / memory | **[Vectorize](https://developers.cloudflare.com/vectorize/)** |
| AI routing, caching, logs | **[AI Gateway](https://developers.cloudflare.com/ai-gateway/)** → OpenRouter ([05](05-ai.md)) |
| Auth | **Better Auth** in the Worker ([04](04-auth.md)) |
| Email | **[Email Service](https://developers.cloudflare.com/email-service/)** |
| Bot protection | **[Turnstile](https://developers.cloudflare.com/turnstile/)** |
| Rate limits | **[Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)** |
| Web hosting | **[Workers static assets](https://developers.cloudflare.com/workers/static-assets/)** |

## Repo layout

```
apps/
  api/        Worker: src/index.ts (routes), auth.ts, ai.ts, billing.ts, events.ts; migrations/*.sql
  web/        React + Vite, deployed as static assets
  ios/        SwiftUI
  android/    Kotlin/Compose or React Native
docs/         brief.md, progress.md, decisions/
```

Start from [`templates/worker.ts`](../templates/worker.ts) and [`templates/wrangler.jsonc`](../templates/wrangler.jsonc).

## Routing

```ts
const route = `${request.method} ${url.pathname}`;
switch (route) {
  case "GET /health": return Response.json({ ok: true });
  case "POST /ai/scan": return scan(request, env, user);
}
```

Use [`URLPattern`](https://developer.mozilla.org/docs/Web/API/URLPattern) for path params like `/items/:id`.

## Rules

1. Stream every AI response (SSE or WebSocket).
2. Workers are stateless. State lives in D1, Durable Objects, KV, or R2.
3. Separate `env.staging` and `env.production`, each with its own resources and secrets.
4. Secrets via `wrangler secret put`; local ones in gitignored `.dev.vars`.
5. Await or `ctx.waitUntil()` every promise.
6. Verify every webhook signature (Stripe, Superwall/App Store).
7. Make jobs idempotent; Queues and Workflows retry.
8. All server logic runs on Cloudflare. No side servers.
9. Heavy CPU work goes in Workflows or Queues, not a request.
10. KV is eventually consistent. Use Durable Objects or D1 for counters, credits, quotas.
11. D1 writes go to one region per database. Outgrowing that is the signal to move ([03](03-database.md)).

## Resources

- [Workers docs](https://developers.cloudflare.com/workers/) · [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) · [Wrangler config](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) · [Workflows](https://developers.cloudflare.com/workflows/) · [Agents SDK](https://developers.cloudflare.com/agents/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
