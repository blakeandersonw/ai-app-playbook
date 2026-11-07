// Copy to apps/api/scripts/rollout.ts (playbook/14-shipping.md). deploy-api.yml runs it after the D1 migrations:
//   1. upload the new version without traffic (`wrangler versions upload`)
//   2. deploy it at 0% and probe it through a version override until it answers as itself, then
//      run the account smoke test (smoke.ts) through the same override
//   3. wait until Cloudflare's analytics show the probes, so the watch below can see this version
//   4. each ROLLOUT_STEPS step (percent:minutes): give it that share, probe it, and judge its errors
//      against the previous version's in the same window
//   5. 100%, triggers (crons, queue consumers, custom domains), a check without the override
// Any failure puts 100% back on the previous version and exits 1.
//   bun scripts/rollout.ts --env staging|production --worker <name> --url https://… [--tag <sha>] [--message <text>]
//   bun scripts/rollout.ts --env production --worker <name> --restore    back to the version saved before the rollout
// Needs CLOUDFLARE_API_TOKEN (Workers Scripts: Edit, Account Analytics: Read) and CLOUDFLARE_ACCOUNT_ID,
// and /health answering { ok, env, version } (templates/worker.ts, `version_metadata` in wrangler.jsonc).
// Thresholds come from the workflow (ROLLOUT_*); never deploy production with this by hand.
import { $ } from "bun";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smoke } from "./smoke";

export type AnalyticsRow = {
  dimensions: { scriptVersion: string; httpResponseStatus: number; status: string };
  sum: { requests: number };
};
export type Tally = { requests: number; bad: number };
export type Limits = { maxErrors: number; maxRateDelta: number };

/** A bad invocation: the Worker threw or ran out of resources, or answered 5xx. A client hanging up is not. */
export const isBad = (r: AnalyticsRow["dimensions"]) =>
  !["success", "clientDisconnected"].includes(r.status) || r.httpResponseStatus >= 500;

export function tally(rows: AnalyticsRow[], version: string): Tally {
  const t = { requests: 0, bad: 0 };
  for (const row of rows) {
    if (row.dimensions.scriptVersion !== version) continue;
    t.requests += row.sum.requests;
    if (isBad(row.dimensions)) t.bad += row.sum.requests;
  }
  return t;
}

const rate = (t: Tally) => (t.requests ? t.bad / t.requests : 0);

/**
 * Roll back when the new version has more than `maxErrors` bad invocations AND its bad rate is more
 * than `maxRateDelta` above the previous version's over the same window. The count keeps one stray
 * upstream 502 from failing a deploy at low traffic; the rate keeps a busy day's few normal errors
 * from failing one later.
 */
export function verdict(next: Tally, previous: Tally, limits: Limits): { ok: boolean; reason: string } {
  const line = `new ${next.bad}/${next.requests} bad (${(rate(next) * 100).toFixed(1)}%), previous ${previous.bad}/${previous.requests} (${(rate(previous) * 100).toFixed(1)}%)`;
  const ok = !(next.bad > limits.maxErrors && rate(next) > rate(previous) + limits.maxRateDelta);
  return { ok, reason: line };
}

/** "10:5,50:5" → [{percent: 10, minutes: 5}, …]; every percent in 1–99, rising. */
export function parseSteps(spec: string): { percent: number; minutes: number }[] {
  const steps = spec.split(",").map((s) => {
    const [percent, minutes] = s.split(":").map(Number);
    return { percent: percent!, minutes: minutes! };
  });
  let last = 0;
  for (const s of steps) {
    if (!Number.isInteger(s.percent) || s.percent <= last || s.percent >= 100 || !(s.minutes >= 0)) throw new Error(`bad ROLLOUT_STEPS: ${spec}`);
    last = s.percent;
  }
  return steps;
}

/** The version holding most traffic: the one to go back to. */
export function stableOf(deployment: { versions: { version_id: string; percentage: number }[] }): string {
  const top = [...deployment.versions].sort((a, b) => b.percentage - a.percentage)[0];
  if (!top) throw new Error("the Worker has no deployed version");
  return top.version_id;
}

if (import.meta.main) await main();

async function main() {
  const args: string[] = process.argv.slice(2);
  const opt = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
  const env = opt("env");
  if (env !== "staging" && env !== "production") throw new Error("--env staging|production");
  const worker = opt("worker"); // the Worker's name in that env (wrangler.jsonc env.<env>.name)
  if (!worker) throw new Error("--worker <name>");
  const stateFile = join(process.env.RUNNER_TEMP ?? tmpdir(), `rollout-${env}.json`);
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
  const cwd = new URL("..", import.meta.url).pathname;
  const sleep = (s: number) => Bun.sleep(s * 1000);
  const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
  const summary = (m: string) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, m + "\n");

  /** Wrangler for this env; its output only shows when it fails. */
  const wrangler = async (...a: string[]) => {
    const r = await $`bunx wrangler ${a} --env ${env}`.cwd(cwd).quiet().nothrow();
    if (r.exitCode !== 0) throw new Error(`wrangler ${a.slice(0, 2).join(" ")} failed: ${r.stderr}${r.stdout}`.slice(0, 2000));
    return r.stdout.toString();
  };
  const current = async () => JSON.parse(await wrangler("deployments", "status", "--json"));
  const deploy = async (specs: string[], message: string) => {
    log(`deploy ${specs.join(" ")}`);
    await wrangler("versions", "deploy", ...specs, "--message", message.slice(0, 100), "-y");
  };

  if (args.includes("--restore")) {
    if (!existsSync(stateFile)) return log("no rollout started; nothing to restore");
    const { stable } = JSON.parse(readFileSync(stateFile, "utf8"));
    const now = await current();
    if (now.versions.length === 1 && now.versions[0].version_id === stable) return log(`already on ${stable}`);
    await deploy([`${stable}@100`], "deploy-api: restore after a cancelled or failed rollout");
    return summary(`Restored 100% to the previous version \`${stable}\`.`);
  }

  const url = opt("url");
  if (!url) throw new Error("--url");
  const steps = parseSteps(process.env.ROLLOUT_STEPS ?? "10:5,50:5");
  const limits = { maxErrors: Number(process.env.ROLLOUT_MAX_ERRORS ?? 1), maxRateDelta: Number(process.env.ROLLOUT_MAX_RATE_DELTA ?? 0.01) };
  const probeEvery = Number(process.env.ROLLOUT_PROBE_SECONDS ?? 60);
  const analyticsLag = Number(process.env.ROLLOUT_ANALYTICS_LAG_SECONDS ?? 180);

  const stable = stableOf(await current());
  writeFileSync(stateFile, JSON.stringify({ stable }));
  log(`previous version ${stable}`);

  // 1. Upload. Wrangler writes the new id to its output file.
  const out = join(mkdtempSync(join(tmpdir(), "rollout-")), "wrangler.ndjson");
  const tag = opt("tag")?.slice(0, 25);
  const message = (opt("message") ?? "deploy-api").slice(0, 100);
  await $`bunx wrangler versions upload --env ${env} ${tag ? ["--tag", tag] : []} --message ${message}`
    .cwd(cwd).env({ ...process.env, WRANGLER_OUTPUT_FILE_PATH: out });
  const uploaded = readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.type === "version-upload");
  const next: string | undefined = uploaded?.version_id;
  if (!next) throw new Error("wrangler versions upload wrote no version id");
  log(`new version ${next}`);
  summary(`### ${env} rollout\n\n- previous version \`${stable}\`\n- new version \`${next}\``);

  const override = { "Cloudflare-Workers-Version-Overrides": `${worker}="${next}"` };
  /** Routes that need no account, so probes never write data: answers as this env and version, auth, the 401 and 404 paths. */
  async function probe(): Promise<string | null> {
    const get = (path: string) => fetch(url + path, { headers: override, signal: AbortSignal.timeout(15_000) });
    try {
      const health = await get("/health");
      const body = (await health.json()) as { ok?: boolean; env?: string; version?: string };
      if (!health.ok || body.ok !== true || body.env !== env) return `/health answered ${health.status} ${JSON.stringify(body)}`;
      if (body.version !== next) return `/health answered as version ${body.version}, not ${next}`;
      const session = await get("/api/auth/get-session");
      if (session.status !== 200) return `/api/auth/get-session answered ${session.status}`;
      const me = await get("/me/entitlements"); // any route that needs a session
      if (me.status !== 401) return `/me/entitlements without a session answered ${me.status}, not 401`;
      const missing = await get("/rollout-probe-404");
      if (missing.status !== 404) return `an unknown path answered ${missing.status}, not 404`;
      return null;
    } catch (err) {
      return `probe failed: ${err}`;
    }
  }

  async function analytics(since: Date): Promise<AnalyticsRow[]> {
    const query = `query($a: string!, $w: string!, $s: Time!, $e: Time!) { viewer { accounts(filter: {accountTag: $a}) {
      workersInvocationsAdaptive(limit: 10000, filter: {scriptName: $w, datetime_geq: $s, datetime_leq: $e}) {
        dimensions { scriptVersion httpResponseStatus status } sum { requests } } } } }`;
    const variables = { a: accountId, w: worker, s: since.toISOString(), e: new Date().toISOString() };
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json()) as { data?: any; errors?: { message: string }[] | null };
    if (!res.ok || json.errors?.length) throw new Error(`analytics query failed (${res.status}): ${JSON.stringify(json.errors)}. The token needs Account Analytics: Read.`);
    return json.data.viewer.accounts[0].workersInvocationsAdaptive;
  }

  const judge = async (since: Date) => {
    const rows = await analytics(since);
    const v = verdict(tally(rows, next), tally(rows, stable), limits);
    log(`watch: ${v.reason}`);
    if (!v.ok) throw new Error(`the new version's errors are over the limit: ${v.reason}`);
    return v.reason;
  };

  try {
    // 2. 0%: only requests with the override reach it.
    const uploadedAt = new Date(Date.now() - 60_000);
    await deploy([`${next}@0`, `${stable}@100`], `deploy-api: ${next} at 0% for probes`);
    let problem: string | null = "not probed yet";
    for (let i = 0; i < 12 && problem; i++) {
      problem = await probe();
      if (problem) { log(`waiting for the override: ${problem}`); await sleep(10); }
    }
    if (problem) throw new Error(`the new version failed its probes at 0%: ${problem}`);
    for (let i = 0; i < 3; i++) {
      const p = await probe();
      if (p) throw new Error(`the new version failed its probes at 0%: ${p}`);
    }
    log("probes pass at 0%");
    const smoked = await smoke(url, override, log);
    if (smoked) throw new Error(`the new version failed the account smoke test at 0%: ${smoked}`);
    summary("- account smoke test passed at 0%");

    // 3. Analytics must see this version before its numbers can mean anything.
    let seen = 0;
    for (let waited = 0; waited <= 360 && !seen; waited += 30) {
      seen = tally(await analytics(uploadedAt), next).requests;
      if (!seen) { log("waiting for analytics to show the probes"); await sleep(30); }
    }
    if (!seen) throw new Error("Cloudflare analytics never showed the new version's probes, so the watch would be blind");
    log(`analytics see ${seen} probe request(s)`);

    // 4. Steps.
    const splitAt = new Date();
    for (const step of steps) {
      await deploy([`${next}@${step.percent}`, `${stable}@${100 - step.percent}`], `deploy-api: ${next} at ${step.percent}%`);
      const until = Date.now() + step.minutes * 60_000;
      while (Date.now() < until) {
        await sleep(Math.min(probeEvery, Math.max(1, (until - Date.now()) / 1000)));
        const p = await probe();
        if (p) throw new Error(`the new version failed its probes at ${step.percent}%: ${p}`);
        await judge(splitAt);
      }
    }
    // Analytics lag a few minutes; judge the whole window once the last requests have landed.
    if (steps.length) {
      log(`waiting ${analyticsLag}s for analytics to catch up`);
      await sleep(analyticsLag);
      summary(`- watch: ${await judge(splitAt)}`);
    }

    // 5. All traffic, then the triggers `versions upload` leaves alone.
    await deploy([`${next}@100`], `deploy-api: ${next} at 100%`);
    await wrangler("triggers", "deploy");
    let health: { env?: string; version?: string } = {};
    for (let i = 0; i < 12 && health.version !== next; i++) {
      if (i) await sleep(5);
      health = await fetch(`${url}/health`).then((r) => r.json()).catch(() => ({})) as typeof health;
    }
    if (health.env !== env || health.version !== next) throw new Error(`after 100%, /health answered ${JSON.stringify(health)}`);
    log(`${env} runs ${next}`);
    summary(`- 100% on \`${next}\``);
  } catch (err) {
    console.log(`::error::${err instanceof Error ? err.message : err}; putting 100% back on ${stable}`);
    await deploy([`${stable}@100`], "deploy-api: rollout failed, back to the previous version");
    summary(`- **rolled back** to \`${stable}\`: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
