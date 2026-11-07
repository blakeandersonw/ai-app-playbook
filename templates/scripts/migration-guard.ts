// Copy to apps/api/scripts/migration-guard.ts (playbook/14-shipping.md). Fails when a migration would
// destroy or rewrite data, or when a migration that may already be applied was edited. Production keeps
// serving the old Worker while and after migrations run, and D1 never undoes one, so only additive
// migrations go through by themselves.
//   bun scripts/migration-guard.ts [--allow] migrations/0023_x.sql …        new migrations to read
//   bun scripts/migration-guard.ts --edited migrations/0005_y.sql …         applied ones that changed
// --allow (the PR has the `destructive-migration` label) turns the failures into warnings.
import { relative, resolve } from "node:path";

/** SQL without comments and string contents, so `-- drop table` or 'DELETE' never counts. */
export function stripSql(sql: string): string {
  // One pass, so an apostrophe in a comment ("-- don't") never opens a string.
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:[^']|'')*'/g, (m) => (m.startsWith("'") ? "''" : " "));
}

const RULES: { name: string; test: (s: string) => boolean }[] = [
  { name: "DROP TABLE", test: (s) => /^DROP\s+TABLE\b/.test(s) },
  { name: "ALTER TABLE … DROP COLUMN", test: (s) => /^ALTER\s+TABLE\s+\S+\s+DROP\b/.test(s) },
  { name: "ALTER TABLE … RENAME", test: (s) => /^ALTER\s+TABLE\s+\S+\s+RENAME\b/.test(s) },
  { name: "DELETE", test: (s) => /\bDELETE\s+FROM\b/.test(s) },
  // `INSERT … ON CONFLICT DO UPDATE SET` touches one row and has no table name before SET.
  { name: "UPDATE without WHERE", test: (s) => /\bUPDATE\s+(?:OR\s+\w+\s+)?[^\s(]+\s+SET\b/.test(s) && !/\bWHERE\b/.test(s) },
];

/** Every destructive statement in a migration, as "RULE: statement". */
export function destructiveStatements(sql: string): string[] {
  const found: string[] = [];
  for (const raw of stripSql(sql).split(";")) {
    const statement = raw.replace(/\s+/g, " ").trim().toUpperCase();
    if (!statement) continue;
    for (const rule of RULES) if (rule.test(statement)) found.push(`${rule.name}: ${statement.slice(0, 160)}`);
  }
  return found;
}

if (import.meta.main) {
  const args: string[] = process.argv.slice(2);
  const allow = args.includes("--allow");
  const editedAt = args.indexOf("--edited");
  const files = args.filter((a, i) => !a.startsWith("--") && (editedAt < 0 || i < editedAt));
  const edited = editedAt < 0 ? [] : args.slice(editedAt + 1).filter((a) => !a.startsWith("--"));
  const level = allow ? "warning" : "error";
  let problems = 0;
  const report = (file: string, message: string) => {
    problems++;
    console.log(`::${level} file=${relative(process.env.GITHUB_WORKSPACE ?? process.cwd(), resolve(file))}::${message}`);
  };

  for (const file of files) {
    const hits = destructiveStatements(await Bun.file(file).text());
    for (const hit of hits) report(file, `destructive migration (${hit}). The running Worker still reads what this removes; add the column or table first, ship code that stops reading the old one, then remove it in a later PR with the destructive-migration label.`);
    if (!hits.length) console.log(`ok  ${file}`);
  }
  for (const file of edited) report(file, "an existing migration changed. D1 never re-runs an applied migration, so the edit reaches no database that already has it: write a new migration instead.");

  if (problems && !allow) {
    console.log(`\n${problems} problem(s). If this is intended, add the "destructive-migration" label to the PR (playbook/14-shipping.md).`);
    process.exit(1);
  }
  console.log(problems ? `\n${problems} problem(s), allowed by the destructive-migration label.` : "\nNo destructive migrations.");
}
