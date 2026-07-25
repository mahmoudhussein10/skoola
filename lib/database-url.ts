export function normalizeRuntimeDatabaseUrl(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const isSupabaseTransactionPooler =
      url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";

    if (!isSupabaseTransactionPooler) return value;

    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    return url.toString();
  } catch {
    // Preserve Prisma's native invalid connection-string error without exposing credentials.
    return value;
  }
}