# 12 · Costs

> **Default:** benchmark funnel (estimate) = **$2.70** revenue per download; Superwall, Cloudflare, Tinybird, and AI cost about **2.5% of revenue** at every scale.
> **Agent: read this when** estimating budgets or choosing models. Prices checked **Oct 26, 2026**; re-check the links.

## The model

```
downloads × 30% start a trial × 30% pay × $30/year  =  $2.70 revenue per download
```

| | | | | |
|---|---|---|---|---|
| **Downloads** | 1,000 | 10,000 | 100,000 | 1,000,000 |
| **Revenue** | $2,700 | $27,000 | $270,000 | $2,700,000 |
| Superwall (1%) | $27 | $270 | $2,700 | $27,000 |
| Cloudflare | $5 | $20 | $190 | $2,300 |
| Tinybird | $0 | $50 | $275 | $2,500 |
| AI processing | $35 | $350 | $3,500 | $35,000 |

Excludes store fees and marketing.

- Revenue = new $30 yearly subscriptions that month. Subscribers accumulate over 12 months.
- AI: `deepseek/deepseek-v4.1-flash-1017`, $0.15 / $0.60 per 1M tokens via OpenRouter + 5.5% credit fee. 1,500 in + 400 out = **$0.00049** per call. Calls/month: subscriber 60 (2/day), trial 15, non-trial download 2.
- Cloudflare: Workers, D1, R2, KV, Durable Objects, Queues, Email. Per active user/month: 500 requests, 10 MB R2, 3 emails.
- Tinybird: events and errors for all active users, from the free tier.

## Our stack vs. the popular stack\*

Monthly cost **per 1,000 users**, at 100,000 MAU, same usage.

| Job | Our stack | Per 1k users | Popular stack | Per 1k users | Popular costs |
|---|---|---|---|---|---|
| Hosting + API | Cloudflare Workers | $0.21 | Vercel Pro | $3.48 | **~17×** |
| Database | D1 | $0.00 | Supabase Pro (Medium compute) | $0.75 | **∞×** |
| Files + bandwidth | R2 (free egress) | $0.15 | Supabase Storage | $0.87 | **~6×** |
| Auth | Better Auth | $0.00 | Clerk | $10.25 | **∞×** |
| AI (60 calls/user) | DeepSeek V4.1 Flash | $29.43 | OpenAI `gpt-6.1-sol` | $420.00 | **~14×** |
| Analytics | Tinybird | ~$1.45 | PostHog | ~$4.50 | **~3×** |
| Errors | Tinybird (same pipeline) | $0.00 | Sentry Team | $0.47 | **∞×** |
| Email (3/user) | Cloudflare Email | $1.04 | Resend | $2.15 | **~2×** |

\*Estimates from list prices (Oct 26, 2026) and assumed usage.

**Usage per user/month:** 500 API requests, 10 MB stored, 10 MB downloaded, 60 AI calls (1,500 in + 400 out), 100 events, 1 error, 3 emails. Vercel: ~10 s open per streamed AI call, ~0.2 s per other request, 1 GB memory.

- AI: OpenAI `gpt-6-astra` ($10 / $50 per 1M) = **$2,100 per 1k users**, 70× DeepSeek.
- Auth: Clerk is $0.02/user above 50,000. Better Auth is a library in your Worker.
- At 1,000 users: ~**$5/month** ours (excl. AI) vs. **~$45–75/month** popular (Vercel $20 + Supabase $25, + Sentry $29 at a second seat).
- Lovable: $25 per 100 credits on Pro, $50 on Business; hosting and AI share credits.
- PostHog at first-tier anonymous-event rate; identified events ~4× more.

Sources: [Vercel](https://vercel.com/pricing) · [Supabase](https://supabase.com/pricing) · [Clerk](https://clerk.com/pricing) · [OpenAI](https://developers.openai.com/api/docs/pricing) · [PostHog](https://posthog.com/pricing) · [Sentry](https://sentry.io/pricing/) · [Resend](https://resend.com/pricing) · [Lovable](https://lovable.dev/pricing)

## Reading it

1. Trial starts 30% → 40% = +33% revenue.
2. DeepSeek ≈ $0.03 per subscriber/month vs. $2.50 revenue. Frontier on every call ≈ 15× more; use only where evals show users notice ([05](05-ai.md)).
3. Photo and image-gen apps cost more per call. Use real `ai_call.cost_usd` from Tinybird.
4. When one AI workflow keeps a GPU busy, Vast.ai or RunPod is often several times cheaper ([05](05-ai.md)).
5. $2.70 per download is the ceiling for acquisition cost ([11](11-distribution.md)).

## Cost per 1,000 AI calls (1,500 in + 400 out, with the 5.5% fee)

| Model | $/1M tokens, in / out | Per 1k calls |
|---|---|---|
| **`deepseek/deepseek-v4.1-flash-1017`** (default) | $0.15 / $0.60 | **$0.49** |
| `deepseek/deepseek-v4-pro` | $0.78 / $1.56 | $1.89 |
| `google/gemini-3.8-flash` (vision) | $0.825 / $4.125 | $3.05 |
| `anthropic/claude-sonnet-5.5` (frontier) | $2 / $10 | $7.38 |

## Price sources (checked Oct 26, 2026)

| Service | Price | Included | Source |
|---|---|---|---|
| Workers Paid | $5/mo · $0.30/M requests · $0.02/M CPU-ms | 10M requests, 30M CPU-ms | [pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 | $0.001/M rows read · $1/M rows written · $0.75/GB-mo | 25B reads, 50M writes, 5 GB | [pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| R2 | $0.015/GB-mo · **$0 egress** | 10 GB | [pricing](https://developers.cloudflare.com/r2/pricing/) |
| KV | $0.50/M reads · $5/M writes | 10M reads, 1M writes | [pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Durable Objects | $0.15/M requests · $12.50/M GB-s | 1M requests, 400k GB-s | [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Queues | $0.40/M operations | 1M | [pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| Email Service | $0.35 per 1k emails (beta) | 3k/mo | [pricing](https://developers.cloudflare.com/email-service/platform/pricing/) |
| AI Gateway · Turnstile · Hyperdrive | Free on Workers Paid | — | [AI Gateway](https://developers.cloudflare.com/ai-gateway/reference/pricing/) |
| OpenRouter | Model price + 5.5% on credit purchases | — | [pricing](https://openrouter.ai/pricing) |
| Superwall | Free subscription infra; paywalls 1% of revenue (first $10k/mo free)\* | — | [pricing](https://superwall.com/pricing) |
| Tinybird | Free tier; paid from ~$25/mo\* | — | [pricing](https://www.tinybird.co/pricing) |
| PlanetScale Postgres (when you outgrow D1) | from $5/mo · mid-size ~$286–349 | — | [pricing](https://planetscale.com/pricing) |
| Stripe (web) | 2.9% + 30¢ · Billing +0.7% | — | [pricing](https://stripe.com/pricing) |

\*Pricing pages were inconsistent when checked; verify.
