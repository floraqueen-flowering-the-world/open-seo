// PostgREST access to Climber's Supabase project (self-host only).
// Not tenant data: the Climber deployment is one self-hosted workspace, so
// callers gate it only by being signed in. Reads go to views and tables; the
// one write is a change-category approval (climberRestPatch).
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

type ClimberSupabaseConfig = { url: string; key: string };

// Supabase caps every PostgREST response at 1000 rows.
const PAGE_ROWS = 1000;

export async function getClimberSupabaseConfig(): Promise<ClimberSupabaseConfig | null> {
  const url = await getOptionalEnvValue("CLIMBER_SUPABASE_URL");
  const key = await getOptionalEnvValue("CLIMBER_SUPABASE_KEY");
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

function headers(
  config: ClimberSupabaseConfig,
  extra?: Record<string, string>,
) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    Accept: "application/json",
    ...extra,
  };
}

async function failed(response: Response, verb: string): Promise<never> {
  throw new AppError(
    "INTERNAL_ERROR",
    `Climber Supabase ${verb} failed (${response.status})`,
  );
}

export async function climberRestGet<T>(
  config: ClimberSupabaseConfig,
  path: string,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "GET",
    headers: headers(config),
  });
  if (!response.ok) await failed(response, "read");
  return z.array(schema).parse(await response.json());
}

/** Every row of a query, 1000 at a time, up to `maxRows`. The path must carry an `order`. */
export async function climberRestGetAll<T>(
  config: ClimberSupabaseConfig,
  path: string,
  schema: z.ZodType<T>,
  maxRows = 20_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE_ROWS) {
    const page = await climberRestGet(
      config,
      `${path}&limit=${PAGE_ROWS}&offset=${offset}`,
      schema,
    );
    rows.push(...page);
    if (page.length < PAGE_ROWS) break;
  }
  return rows;
}

/** Row count of a query without reading the rows (aggregates are off on this project). */
export async function climberRestCount(
  config: ClimberSupabaseConfig,
  path: string,
): Promise<number> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "HEAD",
    headers: headers(config, { Prefer: "count=exact", Range: "0-0" }),
  });
  if (!response.ok) await failed(response, "count");
  const total = response.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}

export async function climberRestPatch<T>(
  config: ClimberSupabaseConfig,
  path: string,
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: headers(config, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) await failed(response, "write");
  return z.array(schema).parse(await response.json());
}

/** PostgREST `in.(...)` list; values are quoted so URLs with commas survive. */
export function inList(values: Array<string | number>) {
  const items = values.map((v) =>
    typeof v === "number" ? String(v) : `"${v.replace(/"/g, '\\"')}"`,
  );
  return `in.(${encodeURIComponent(items.join(","))})`;
}
