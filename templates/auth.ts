// apps/api/src/auth.ts: Better Auth inside the Worker, storing users in D1 (no ORM).
// Tables: see playbook/04-auth.md step 3 (migrations/0001_auth.sql).
import { betterAuth } from "better-auth";
import { anonymous, bearer, magicLink } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { sendEmail } from "./email";
import { deleteUserData, moveUserData } from "./users";

export const auth = betterAuth({
  database: env.DB, // the D1 binding, used directly
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.WEB_ORIGIN, "https://appleid.apple.com"],

  socialProviders: {
    apple: {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      // Required for native iOS idToken sign-in (the token's `aud` is your bundle id).
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  user: {
    // App Store 5.1.1(v): account deletion must be available in the app.
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteUserData(user.id); // D1 rows, R2 files
      },
    },
  },

  plugins: [
    // Try before signing up; data moves to the real account on link.
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await moveUserData(anonymousUser.user.id, newUser.user.id);
      },
    }),
    // Native clients read `set-auth-token` and send `Authorization: Bearer <token>`.
    bearer(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ to: email, subject: "Your sign-in link", text: `Tap to sign in: ${url}` });
      },
    }),
  ],
});
