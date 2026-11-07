# 14 · Shipping: dependency updates and deploys

> **Default:** Dependabot opens updates, Claude reviews them, a plain script merges the safe ones. Every API push to `main` deploys itself: staging, then the **released iOS app's own networking code** against staging, then production with a smoke check and automatic rollback.
> **Agent: read this when** setting up CI, deploys, or dependency updates, or before you'd deploy production by hand.

Nobody waits on a deploy, and nothing reaches production that would break an app version people still run. Agents still never deploy production: their way there is a merge to `main`.

Templates in [`templates/github/`](../templates/github/) (copy to `.github/`) and [`templates/LiveAPICompatibilityTests.swift`](../templates/LiveAPICompatibilityTests.swift).

## Dependency updates

[`dependabot.yml`](../templates/github/dependabot.yml):

| Setting | Why |
|---|---|
| Daily, minor + patch grouped | One PR a day, not twenty |
| `cooldown`: 7 days, 30 for majors | A hijacked release is usually caught and pulled first. Security updates skip it |
| `github-actions`, weekly | Keeps the SHA-pinned actions current |
| No iOS packages | Dependabot can't read Xcode projects; SDK updates ship with an App Store release anyway |

[`dependabot-check.yml`](../templates/github/workflows/dependabot-check.yml), three jobs so nothing that reads untrusted text can write:

| Job | Does | Can |
|---|---|---|
| `checks` | Install, `check`, `test` of the updated code | Read-only token, `persist-credentials: false`, no secrets |
| `review` | [Claude Code Action](https://github.com/anthropics/claude-code-action) reads the diff, changelogs and your usage; returns `{verdict, summary}` via `--json-schema` | Read, Grep, `git diff/log`; WebFetch only to changelog hosts. No shell, no writes |
| `decide` | Plain bash: merge only if checks passed **and** verdict is `merge` **and** every bump is patch/minor. Otherwise label `needs-human` with the reasons | Write token. Runs no PR code |

- Every major waits for a human. So do auth/session libraries and the build toolchain (the prompt says hold).
- A merge made with `GITHUB_TOKEN` starts no other workflow, so `decide` dispatches `deploy-api.yml` itself (`actions: write`).
- Actions pinned to commit SHAs.
- Secret: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) under **Dependabot** secrets; Dependabot runs can't read Actions secrets.

## Deploys

[`deploy-api.yml`](../templates/github/workflows/deploy-api.yml), on every push to `main` that touches the API:

```
unit ─▶ staging (D1 migrations + Worker) ─▶ live tests, one per iOS version in use ─▶ production ─▶ smoke check ─┬─▶ done
                                                                                                                  └─▶ wrangler rollback
```

1. **Live tests are the app's own code.** `LiveAPICompatibilityTests.swift` calls the API through the app's real client types: anonymous sign-in, free routes, the paywall response, then with Pro one call per feature, then Delete account.
2. **Every version still in use.** Tag each App Store build `ios/<version>-<build>`. CI takes the newest build of the last `LIVE_API_VERSIONS` versions, checks out each tag, drops in **today's** test file, and runs it against staging on a GitHub Mac runner. A server change that breaks an installed version fails here. Before the first release it tests the current commit.
3. **Test accounts on staging only.** [`live-api-account.sh`](../templates/github/scripts/live-api-account.sh) signs in anonymously and writes a one-hour Pro row into staging `entitlements`; no payment secret needed. It refuses any URL without `staging`.
4. **Smoke check, then rollback.** `/health` must answer `env: "production"` and `/api/auth/get-session` must answer with no session. On failure: `wrangler rollback`.
5. **Migrations are expand-only.** They reach production before the code and are never rolled back: add tables and columns; don't rename or drop anything deployed code reads.
6. **The Cloudflare token only on wrangler steps.** Never on `bun install`, tests or Xcode.
7. **One deploy at a time** (`concurrency`, no cancel). Want an approval button? Add required reviewers to the `production` environment.

## Setup

- [ ] **[AGENT]** Copy the templates, fill every `<placeholder>`, make `/health` return `env` ([`worker.ts`](../templates/worker.ts)), write the live tests against your app's client types, tag the current App Store build.
- [ ] **[HUMAN]** Cloudflare API token (template "Edit Cloudflare Workers" + D1: Edit) → Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **[HUMAN]** `claude setup-token` → Dependabot secret `CLAUDE_CODE_OAUTH_TOKEN`. Enable Dependabot security updates.
- [ ] **[HUMAN]** Branch protection: required checks are fine; a required human review blocks the auto-merge.
- **Done when:** a push that changes the API runs green to production, and a Dependabot PR gets merged or labelled `needs-human` with a summary.

## Lessons from real runs

| What broke | Fix (already in the templates) |
|---|---|
| Smoke check hit a route that needs a session: 401, a good deploy rolled back | Check only routes that need no account; they also never create production data |
| The Mac image had a device-only iOS runtime; `simctl create` failed | Pick the newest general `iOS-N-N` runtime and an iPhone it supports; check the simulator id |
| Grouped and lockfile-only updates have no `update-type`, so every transitive security fix waited for a human | Work out the size from each old → new version pair |
| First draft: one job installed untrusted packages, ran Claude, and held a write token | The three-job split above; secrets only where a step needs them |

## Costs

A Mac runner per deploy (about 10–15 minutes per iOS version tested) plus a few staging AI calls. Standard runners are free on public repos; private repos pay per minute, Mac minutes cost several times Linux ones ([GitHub pricing](https://github.com/pricing)). One Claude review per Dependabot PR.

## Resources

- [Dependabot options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference) · [Automating Dependabot with Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
- [Claude Code Action](https://github.com/anthropics/claude-code-action) · [Security hardening for Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Wrangler `deploy` / `rollback`](https://developers.cloudflare.com/workers/wrangler/commands/) · [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Swift Testing](https://developer.apple.com/documentation/testing)
