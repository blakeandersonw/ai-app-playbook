# 08 · Analytics & errors: all in Tinybird

> **Default:** **[Tinybird](https://www.tinybird.co)** for events, revenue, AI cost, and errors. Workers Observability for raw server logs. No separate error tracker or analytics tool.
> **Agent: read this when** adding a feature (every feature gets an event) or debugging production.

## Pipeline

```
iOS / Android / Web ──▶ POST /events (Worker) ──▶ Queue ──▶ Tinybird Events API ──▶ SQL pipes ──▶ dashboards + alerts
Worker errors ───────────────────────────────────┘
```

- Clients send events and errors to your Worker: one schema, server-side enrichment (user id, plan, country, app version), no ad-blocker loss.
- The Worker batches through **Queues** and posts NDJSON to the [Events API](https://www.tinybird.co/docs/get-data-in/ingest-apis/events-api) with a write-only token.
- Self-hosted option: point the same pipeline at [ClickHouse](https://clickhouse.com/docs).

## Events

```
app_opened              {platform, app_version}
onboarding_step         {step, index}
onboarding_completed
paywall_viewed          {placement, variant}
trial_started           {product_id, price}
subscription_started    {product_id, price, store}
subscription_renewed / subscription_cancelled / refunded
core_action             {feature}            ← the thing your app is for
ai_call                 {feature, model, tokens_in, tokens_out, latency_ms, cost_usd, ok}
share_tapped / referral_sent / review_prompted
error                   {source: api|ios|android|web, message, stack, route, app_version}
```

`snake_case`, same names everywhere. Every user-visible feature ships with its event.

## Errors

- **Worker:** `try/catch` around `fetch`; send an `error` event with `ctx.waitUntil()` ([`templates/worker.ts`](../templates/worker.ts)).
- **Clients:** global handler posts to `/events`, batched, retried next launch if offline. Turn on crash reports in App Store Connect and Play Console.
- **Alerts:** a Cron Trigger queries Tinybird every few minutes (error rate, webhook failures, AI spend per hour) and emails on threshold.

## Daily dashboards

1. Funnel: download → onboarding complete → paywall view → trial start → paid.
2. Revenue: new, refunds, renewals, by paywall variant.
3. Retention: D1 / D7 / D30 by install cohort.
4. AI: cost per subscriber, cost per feature, p95 latency, errors by model.
5. Health: error rate by source and app version.

## Resources

- [Tinybird docs](https://www.tinybird.co/docs) · [Events API](https://www.tinybird.co/docs/get-data-in/ingest-apis/events-api) · [ClickHouse docs](https://clickhouse.com/docs)
- [Workers Observability](https://developers.cloudflare.com/workers/observability/) · [Queues](https://developers.cloudflare.com/queues/)
