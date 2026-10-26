# 13 · Security, privacy & store compliance

> **Default:** secrets out of clients, spend caps on AI, store rules met before review.
> **Agent: read this when** touching auth, payments, user data, or AI tools, or preparing a release.

## Security

1. Secrets: `wrangler secret put` and `.dev.vars` (gitignored). Never in clients or git. Rotate leaks.
2. Auth on every route except health checks and webhooks. Webhooks verify signatures.
3. Rate-limit auth, AI, and uploads per user and IP.
4. Turnstile on sign-up and free-usage endpoints.
5. Per-user AI quotas, hourly-spend alert, kill switch (KV flag).
6. Validate input. SQL only via `prepare().bind()`.
7. Uploads: presigned R2 URLs with size and type limits.
8. Model-read content is data. Acting tools need user confirmation.
9. Few dependencies, pinned, updated.

## Privacy

- Collect the minimum. Don't keep raw prompts with personal data longer than needed.
- Privacy Policy and Terms on your domain, served from Workers (stores and Stripe require them).
- GDPR/CCPA: export and deletion on request, no data selling, EU consent for non-essential tracking.
- Sensitive data: restrict OpenRouter to zero-data-retention providers.
- Minors: read COPPA and age-assurance rules before launch.

## App Store review

| Requirement | Do this |
|---|---|
| **Account deletion** (5.1.1(v)) | Delete Account in Settings, deletes server data too |
| **Login services** (4.8) | Sign in with Apple wherever you offer Google |
| **Restore Purchases** | On the paywall and in Settings |
| **Subscription disclosure** | Price, period, trial, auto-renew, Terms and Privacy links |
| **Privacy labels** | Accurate, including your `/events` pipeline |
| **AI content** | Moderate output, report button for user content, no impersonating real people |
| **Health / finance claims** | No diagnosis or guaranteed outcomes. Disclaimers |
| **Reviewer access** | Anonymous use works, or a demo account |

Google Play: Data safety form, account deletion (in-app + web URL), target API level deadlines.

## Resources

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play policy center](https://play.google.com/about/developer-content-policy/) · [OWASP Top 10 for LLM apps](https://genai.owasp.org/llm-top-10/)
