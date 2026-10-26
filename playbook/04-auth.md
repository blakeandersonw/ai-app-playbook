# 04 · Auth: Better Auth on Cloudflare

> **Default:** [Better Auth](https://www.better-auth.com), a library in your Worker storing users in D1 (`database: env.DB`). Anonymous first, then Apple, Google, or email link.
> **Agent: read this when** building sign-in, sessions, account linking, or account deletion.

## Plugins

| Feature | Use |
|---|---|
| [`anonymous`](https://www.better-auth.com/docs/plugins/anonymous) | Use the app before signing up; data moves over on link |
| [Apple](https://www.better-auth.com/docs/authentication/apple) native `idToken` | One-tap Sign in with Apple on iOS |
| [Google](https://www.better-auth.com/docs/authentication/google) `idToken` | Android and web |
| [`magicLink`](https://www.better-auth.com/docs/plugins/magic-link) | Passwordless email via Cloudflare Email Service |
| [`bearer`](https://www.better-auth.com/docs/plugins/bearer) | Token sessions for native apps (web uses cookies) |
| `user.deleteUser` | In-app account deletion (Apple requires it) |

## Setup

1. `bun add better-auth`
2. Copy [`templates/auth.ts`](../templates/auth.ts) to `apps/api/src/auth.ts`.
3. Auth tables as a D1 migration: run `npx @better-auth/cli generate` against a temporary local SQLite config to get SQL for `user`, `session`, `account`, `verification`; save as `migrations/0001_auth.sql`; apply with `wrangler d1 migrations apply`. Or call `getMigrations` from `better-auth/db/migration` once from a protected staging route. ([docs](https://www.better-auth.com/docs/concepts/database))
4. Route it:
   ```ts
   if (url.pathname.startsWith("/api/auth/")) return auth.handler(request);
   const session = await auth.api.getSession({ headers: request.headers });
   ```
5. Secrets: `wrangler secret put BETTER_AUTH_SECRET` (`openssl rand -base64 32`), plus Apple and Google client secrets.
6. Enable `nodejs_compat` (for `AsyncLocalStorage`); on by default with compatibility date 2026-08-04 or later.

## Flows

**Web:** cookie sessions via `createAuthClient` from `better-auth/react`.

**iOS, Sign in with Apple:**
```
1. First launch → POST /api/auth/sign-in/anonymous → save the `set-auth-token` header in the Keychain
2. "Sign in with Apple" (AuthenticationServices) → identityToken + your raw nonce
3. POST /api/auth/sign-in/social   (Authorization: Bearer <anonymous token>)
   { "provider": "apple", "idToken": { "token": "<identityToken>", "nonce": "<rawNonce>" } }
4. Save the new `set-auth-token` and send `Authorization: Bearer <token>` on every request
```
Set `appBundleIdentifier` in the Apple config or native tokens fail the `aud` check.

**Android:** Credential Manager → Google ID token → `signIn.social({ provider: "google", idToken })`, then bearer.

## Rules

1. Anonymous first. Ask for an account at the paywall or for sync. Move data in `onLinkAccount`.
2. Offer Sign in with Apple on iOS whenever you offer Google (guideline 4.8).
3. In-app account deletion (guideline 5.1.1(v)). `beforeDelete` removes D1 rows and R2 files and revokes Apple tokens.
4. Tokens in Keychain or Keystore, never UserDefaults or SharedPreferences.
5. Rate-limit `/api/auth/*`. Turnstile on email sign-up.
6. Entitlements key off `user.id`; purchases carry over when an anonymous user links.
7. No custom crypto or sessions. No hosted auth vendor (Clerk, Auth0, Firebase, Supabase).

## Resources

- [Better Auth docs](https://www.better-auth.com/docs) · [Database (D1)](https://www.better-auth.com/docs/concepts/database) · [Apple](https://www.better-auth.com/docs/authentication/apple) · [Anonymous](https://www.better-auth.com/docs/plugins/anonymous) · [Bearer](https://www.better-auth.com/docs/plugins/bearer)
- [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/) · [Android Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg)
