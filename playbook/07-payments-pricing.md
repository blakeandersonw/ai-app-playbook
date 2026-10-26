# 07 · Payments & pricing

> **Default:** **Superwall** on iOS/Android, **Stripe** on web, **one entitlements table** in D1. About **$30/year with a free trial**.
> **Agent: read this when** building paywalls, purchases, webhooks, or any "is this user Pro?" check.

## Funnel (benchmark estimates, not targets)

```
downloads ──30%──▶ start a free trial ──30%──▶ pay $30/year
                 ≈ 9% of downloads become paying subscribers ≈ $2.70 per download
```

Measure your own ([12](12-costs.md)).

## Infra and fees (Oct 2026)

| Platform | Use | Fees |
|---|---|---|
| iOS / Android | **[Superwall](https://superwall.com)**: remote paywalls and A/B tests | Free to $10k/mo paywall revenue, then 1%\* |
| Web | **[Stripe](https://stripe.com)**: Checkout + Billing + Customer Portal | 2.9% + 30¢, plus 0.7% for Billing |
| iOS web checkout | **[Superwall web checkout](https://superwall.com/docs/web-checkout)** (Stripe) | As above |
| **Apple** | Subscriptions | **15%** in the [Small Business Program](https://developer.apple.com/app-store/small-business-program/) (≤ $1M/yr). Otherwise 30% year one, 15% after |
| **Google Play** | Subscriptions | **10% + 5% billing** in US, EEA, UK (since Jun 30, 2026). 15% elsewhere |

\*Superwall's pricing pages disagreed. Confirm at [superwall.com/pricing](https://superwall.com/pricing).

- **[HUMAN] Enroll in Apple's Small Business Program on day one.**
- US storefront apps may link to web checkout. Apple's commission on those is still in court (Oct 2026). Test it.

## Pricing

1. Lead with yearly, ~$30/year, shown per week ("$0.58/week").
2. At most one short option (weekly or monthly).
3. Always a free trial (3 or 7 days) with a reminder before it ends.
4. Hard paywall after the aha moment: onboarding → personalized result → paywall. Any free tier is capped daily.
5. One abandon offer: a discounted yearly, shown once.
6. Localize prices by storefront.
7. Test price, trial length, and design in Superwall.

## Entitlements

The `entitlements` table ([03](03-database.md)) is written **only** by verified webhooks:
- `POST /webhooks/stripe`: verify with `stripe.webhooks.constructEventAsync`.
- `POST /webhooks/superwall`: App Store and Play events via Superwall. Verify the signature.

Writes are idempotent (keyed by event id). All clients call `GET /me/entitlements`, so a purchase on any platform unlocks all.

## Paywall checklist (App Store review)

- [ ] Price, period, trial length, "auto-renews until cancelled" shown
- [ ] Links to Terms (EULA) and Privacy
- [ ] **Restore Purchases**
- [ ] Visible close button, no dark patterns
- [ ] Trial-ending reminder scheduled
- [ ] `paywall_viewed`, `trial_started`, `subscription_started` fire with the variant id

## Resources

- [Superwall docs](https://superwall.com/docs) · [Superwall paywall gallery](https://superwall.com/applications) · [Superwall blog](https://superwall.com/blog)
- [Stripe Billing](https://docs.stripe.com/billing) · [Stripe webhooks](https://docs.stripe.com/webhooks)
- [App Store subscriptions](https://developer.apple.com/app-store/subscriptions/)
