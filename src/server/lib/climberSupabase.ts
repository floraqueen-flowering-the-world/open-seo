// Read-only PostgREST access to Climber's Supabase project (self-host only).
// Not tenant data: the Climber deployment is one self-hosted workspace, so
// callers gate it only by being signed in.
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

type ClimberSupabaseConfig = { url: string; key: string };

export async function getClimberSupabaseConfig(): Promise<ClimberSupabaseConfig | null> {
  const url = await getOptionalEnvValue("CLIMBER_SUPABASE_URL");
  const key = await getOptionalEnvValue("CLIMBER_SUPABASE_KEY");
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export async function climberRestGet<T>(
  config: ClimberSupabaseConfig,
  path: string,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Climber Supabase read failed (${response.status})`,
    );
  }
  return z.array(schema).parse(await response.json());
}
