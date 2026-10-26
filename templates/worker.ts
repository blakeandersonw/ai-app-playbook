// apps/api/src/index.ts: the whole API as one fetch handler. No router framework.
import { auth } from "./auth";
import { scan } from "./ai";
import { entitlementsFor, handleStripeWebhook, handleSuperwallWebhook } from "./billing";
import { enqueueEvents, track } from "./events";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/auth/")) return auth.handler(request);

      switch (`${request.method} ${url.pathname}`) {
        case "GET /health":
          return Response.json({ ok: true });
        case "POST /webhooks/stripe":
          return handleStripeWebhook(request, env);
        case "POST /webhooks/superwall":
          return handleSuperwallWebhook(request, env);
        case "POST /events":
          return enqueueEvents(request, env);
      }

      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
      const user = session.user;

      switch (`${request.method} ${url.pathname}`) {
        case "GET /me/entitlements":
          return Response.json(await entitlementsFor(env, user.id));
        case "POST /ai/scan":
          return scan(request, env, ctx, user); // streams; enforces quota; logs ai_call
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    } catch (err) {
      // Errors go to Tinybird with every other event. No separate error tracker.
      ctx.waitUntil(track(env, "error", {
        source: "api",
        route: url.pathname,
        message: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }));
      return Response.json({ error: "internal" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
