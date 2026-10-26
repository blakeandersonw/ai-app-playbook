# 03 · Database: D1 → PlanetScale

> **Default:** D1, plain SQL, Wrangler migrations. **Scale path:** PlanetScale Postgres via Hyperdrive. No ORM.
> **Agent: read this when** adding tables, writing migrations, or deciding whether to migrate.

## Where data goes

| Data | Store |
|---|---|
| Users, subscriptions, app records | **D1** |
| One chat / room / user's live state | **Durable Object** (SQLite) |
| Config, flags, cached reads | **KV** |
| Photos, audio, media | **R2** (key in D1) |
| Embeddings | **Vectorize** |

## Plain SQL

```ts
const meals = await env.DB
  .prepare("SELECT id, calories, created_at FROM meals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
  .bind(user.id)
  .all();
```

- Always `prepare().bind()`. No string-built SQL.
- `env.DB.batch([...])` for multi-statement writes.
- Queries live next to the feature (`meals.ts`), one typed function each.

## Migrations

```bash
wrangler d1 migrations create DB add_meals           # creates migrations/000N_add_meals.sql
wrangler d1 migrations apply DB --local               # dev
wrangler d1 migrations apply DB --env staging --remote
wrangler d1 migrations apply DB --env production --remote   # humans only
```

Every schema change is a migration in git. Never hand-edit production.

## Starter tables

```sql
-- Better Auth creates: user, session, account, verification (see 04 · Auth)
CREATE TABLE entitlements (
  user_id TEXT NOT NULL, entitlement TEXT NOT NULL,         -- 'pro'
  source TEXT NOT NULL,                                     -- 'app_store' | 'play' | 'stripe'
  product_id TEXT, status TEXT NOT NULL,                    -- trialing | active | grace | expired | refunded
  current_period_end INTEGER, original_transaction_id TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, entitlement)
);
CREATE TABLE usage_ledger (                                 -- append-only: AI calls, credits
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, feature TEXT NOT NULL,
  units INTEGER NOT NULL, cost_micros INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX usage_user_day ON usage_ledger (user_id, created_at);
```

ULIDs or UUIDv7 for ids. Never expose auto-increment ids.

## Move to PlanetScale when

- D1 is near its size limit or writes queue.
- You need Postgres features: rich joins, JSONB, `pgvector`, heavy analytics.
- You need zero-downtime schema changes on big tables or branches per PR.

Otherwise stay on D1.

## How to move

1. **[HUMAN]** Create a [PlanetScale Postgres](https://planetscale.com/docs/postgres) database.
2. Put **[Hyperdrive](https://developers.cloudflare.com/hyperdrive/)** in front of it.
3. Query with [`postgres`](https://github.com/porsager/postgres) over `env.HYPERDRIVE.connectionString`, plain SQL.
4. Port migrations to Postgres; use PlanetScale branches for staging.
5. Dual-write, backfill, verify parity per table, cut over. Keep D1 until parity is proven.

## Resources

- [D1 docs](https://developers.cloudflare.com/d1/) · [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [PlanetScale docs](https://planetscale.com/docs) · [Hyperdrive + Postgres](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)
