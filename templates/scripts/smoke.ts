// Copy to apps/api/scripts/smoke.ts (playbook/14-shipping.md). rollout.ts runs it at 0%, through the
// version override, before any user reaches a new version. It signs in the way the app does
// (anonymous, bearer token), reads what a free account reads, then deletes the account. No Pro and
// no model calls: it writes only that one account, and deletes it.
//   smoke("https://api.example.com", { "Cloudflare-Workers-Version-Overrides": '<worker>="<version id>"' })

type Step = { name: string; status: number };

/** Runs the flow; returns null when every step answered as expected, else what went wrong. */
export async function smoke(url: string, headers: Record<string, string>, log: (m: string) => void = console.log): Promise<string | null> {
  const call = (path: string, init: RequestInit = {}, token?: string) =>
    fetch(url + path, {
      ...init,
      headers: { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(20_000),
    });
  const steps: Step[] = [];
  const expect = (name: string, res: Response, ok: boolean) => {
    steps.push({ name, status: res.status });
    if (!ok) throw new Error(`${name} answered ${res.status}`);
  };

  let token: string | undefined;
  let problem: string | null = null;
  try {
    const signIn = await call("/api/auth/sign-in/anonymous", { method: "POST", body: "{}" });
    token = signIn.headers.get("set-auth-token") ?? undefined;
    const userId = ((await signIn.json().catch(() => ({}))) as { user?: { id?: string } }).user?.id;
    expect("anonymous sign-in", signIn, signIn.ok && !!token && !!userId);

    const session = await call("/api/auth/get-session", {}, token);
    const body = (await session.json().catch(() => null)) as { user?: { id?: string } } | null;
    expect("GET /api/auth/get-session", session, session.ok && body?.user?.id === userId);

    const entitlements = await call("/me/entitlements", {}, token);
    expect("GET /me/entitlements", entitlements, entitlements.ok);

    // Add the free routes your app calls on first launch (a catalog, onboarding content, …),
    // each with a check on what it returns. Keep them read-only and free of model calls.
  } catch (err) {
    problem = err instanceof Error ? err.message : String(err);
  }
  // Always delete the account; if the new version can't, the previous one must, so nothing is left.
  // Better Auth's account deletion (deleteUser enabled in templates/auth.ts); use your own route if you have one.
  if (token) {
    const remove = (h: Record<string, string>) =>
      fetch(`${url}/api/auth/delete-user`, {
        method: "POST",
        headers: { ...h, authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(20_000),
      }).then((r) => r.status, () => 0);
    const deleted = await remove(headers);
    steps.push({ name: "delete account", status: deleted });
    if (deleted !== 200) {
      problem ??= `delete account answered ${deleted}`;
      const again = await remove({});
      log(again === 200 ? "smoke: deleted the test account through the previous version" : "::warning::smoke: the test account could not be deleted");
    }
  }
  log(`smoke: ${steps.map((s) => `${s.name} ${s.status}`).join(", ")}`);
  return problem;
}
