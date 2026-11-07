# 14 · Shipping: dependency updates and deploys

> **Default:** Dependabot opens updates, Claude reviews them, a plain script merges the safe ones. Claude reviews every API PR against the iOS builds in use. Every API push to `main` deploys itself: staging, then the **released iOS app's own networking code** against staging, then a **gradual production rollout** (0% probes → 10% → 50% → 100%) that goes back to the previous version on errors.
> **Agent: read this when** setting up CI, deploys, migrations or dependency updates, or before you'd deploy production by hand.

Nobody waits on a deploy or approves one, and nothing reaches all users that would break an app version people still run. Agents still never deploy production: their way there is a merge to `main`.

Templates: [`templates/github/`](../templates/github/) (copy to `.github/`), [`templates/scripts/`](../templates/scripts/) (copy to `apps/api/scripts/`) and [`templates/LiveAPICompatibilityTests.swift`](../templates/LiveAPICompatibilityTests.swift).

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

## Before merge

| Workflow | Checks | Fails when | Way past |
|---|---|---|---|
| [`migration-guard.yml`](../templates/github/workflows/migration-guard.yml) + [`migration-guard.ts`](../templates/scripts/migration-guard.ts) | New migrations, ignoring comments and strings | `DROP TABLE`, `DROP COLUMN`, `RENAME`, `DELETE`, `UPDATE` without `WHERE`, or an edited migration | `destructive-migration` label |
| [`api-review.yml`](../templates/github/workflows/api-review.yml) | Claude reads the diff and how each iOS build in use (its `ios/*` tag) calls the changed routes, plus migrations and your `AGENTS.md` rules. One PR comment, updated each push | Blocking concerns: a broken installed build, lost data, a broken domain rule, a shipped key, production data | `review-override` label, with a comment saying why |

- Agents merge most PRs, and nobody reads an advisory comment, so blocking concerns fail a `gate` check. A review that errors or is skipped never fails it.
- The review uses an **Actions** secret `CLAUDE_CODE_OAUTH_TOKEN` (the Dependabot one can't be read here) and skips itself without one. Same-repo PRs only; forks get no secrets.
- A label change re-runs only the gate, from the level the workflow's own bot posted for that commit, so nobody passes it by writing a comment.
- Removing something takes two PRs: one that stops reading it, then one, labelled, that removes it.

## Deploys

[`deploy-api.yml`](../templates/github/workflows/deploy-api.yml), on every push to `main` that touches the API:

```
unit ─▶ staging: guard, migrations, short rollout ─▶ live tests, one per iOS version in use
     ─▶ production (main only): guard, Time Travel bookmark, migrations, rollout ─┬─▶ 100%
                                                                                   └─▶ back to the previous version
```

1. **Live tests are the app's own code.** `LiveAPICompatibilityTests.swift` calls the API through the app's real client types: anonymous sign-in, free routes, the paywall response, then with Pro one call per feature, then Delete account.
2. **Every version still in use.** Tag each App Store build `ios/<version>-<build>`. CI takes the newest build of the last `LIVE_API_VERSIONS` versions, checks out each tag, drops in **today's** test file, and runs it against staging on a GitHub Mac runner. Before the first release it tests the current commit.
3. **Test accounts on staging only.** [`live-api-account.sh`](../templates/github/scripts/live-api-account.sh) signs in anonymously and writes a one-hour Pro row into staging `entitlements`; no payment secret needed. It refuses any URL without `staging`.
4. **Production rolls out by [Workers versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)** ([`rollout.ts`](../templates/scripts/rollout.ts)):
   1. `wrangler versions upload`, then the new version at **0%**.
   2. Probes through the `Cloudflare-Workers-Version-Overrides` header, so only they reach it: `/health` answers as production **and as the new version id**, `get-session` 200, a session route 401, an unknown path 404. Then [`smoke.ts`](../templates/scripts/smoke.ts): anonymous sign-in, free reads, Delete account. No Pro row, no model calls.
   3. Cloudflare's per-version analytics must show those probes, or it stops rather than watching blind.
   4. **10% for 5 min, 50% for 5 min**, probing every minute. Roll back when the new version has more than 1 bad invocation (5xx or thrown) **and** a bad rate over 1 point above the old version's in the same window.
   5. 100%, `wrangler triggers deploy` (crons, queue consumers and domains aren't part of a version), then `/health` must name the new version.
   Any failure, or a cancelled job, puts 100% back on the previous version.
5. **Staging runs the same rollout** with one 1-minute 50% step, so every deploy proves the upload, the override, the analytics query and the token before production.
6. **Migrations are additive** and run before the code; D1 never undoes one. The guard runs again before staging and production on what each database hasn't applied. A **D1 Time Travel bookmark** is taken first, with the restore command in the job summary. Restoring drops every write since, so a human decides.
7. **Production only from `main`.** A manual run from another branch tests staging and stops.
8. **The Cloudflare token only on wrangler steps.** Never on `bun install`, tests or Xcode.
9. **One deploy at a time** (`concurrency`, no cancel). Want an approval button? Add required reviewers to the `production` environment.

## Setup

- [ ] **[AGENT]** Copy the templates, fill every `<placeholder>`, add `version_metadata` ([`wrangler.jsonc`](../templates/wrangler.jsonc)) and the `/health` version ([`worker.ts`](../templates/worker.ts)), add your app's free routes to `smoke.ts`, write the live tests against your app's client types, tag the current App Store build.
- [ ] **[HUMAN]** Cloudflare API token (template "Edit Cloudflare Workers" + D1: Edit + Account Analytics: Read) → Actions secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **[HUMAN]** `claude setup-token` → secret `CLAUDE_CODE_OAUTH_TOKEN`, once under **Dependabot** and once under **Actions**. Enable Dependabot security updates.
- [ ] **[HUMAN]** Branch protection: require `gate` and `Migration guard`. A required human review blocks the Dependabot auto-merge.
- **Done when:** a push that changes the API runs green to 100% in production, a destructive migration fails its PR, and a Dependabot PR gets merged or labelled `needs-human` with a summary.

## Lessons from real runs

| What broke | Fix (already in the templates) |
|---|---|
| Smoke check hit a route that needs a session: 401, a good deploy rolled back | Probe only account-free routes; the account smoke test makes and deletes its own free account |
| The Mac image had a device-only iOS runtime; `simctl create` failed | Pick the newest general `iOS-N-N` runtime and an iPhone it supports; check the simulator id |
| Grouped and lockfile-only updates have no `update-type`, so every transitive security fix waited for a human | Work out the size from each old → new version pair |
| First draft: one job installed untrusted packages, ran Claude, and held a write token | The three-job split; secrets only where a step needs them |
| A new Worker went to 100% at once after one health check | 0% probes and a smoke test through the version override, then 10% and 50% judged on per-version analytics |
| At low traffic, 10% for a few minutes sees one or two real requests | The 0% probes catch what can't answer at all; the 50% step gives the watch enough to judge |
| A dispatch from any branch would have deployed that branch to production | Production runs only from `main` |

## Costs

A Mac runner per deploy (about 10–15 minutes per iOS version tested), about 15 minutes of rollout on production and 3–4 on staging, plus a few staging AI calls. Standard runners are free on public repos; private repos pay per minute, and Mac minutes cost several times Linux ones ([GitHub pricing](https://github.com/pricing)). One Claude review per Dependabot PR and per API PR push.

## Resources

- [Dependabot options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference) · [Automating Dependabot with Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
- [Claude Code Action](https://github.com/anthropics/claude-code-action) · [Security hardening for Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/) · [Version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/) · [Workers GraphQL analytics](https://developers.cloudflare.com/analytics/graphql-api/)
- [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/) · [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) · [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Swift Testing](https://developer.apple.com/documentation/testing)
