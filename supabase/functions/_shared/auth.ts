import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-gateway-key, x-worker-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyGatewayOrWorkerRequest(
  req: Request,
  supabase: SupabaseClient,
  allowedRoles: Array<"gateway" | "worker"> = ["gateway", "worker"]
): Promise<{ authorized: boolean; role?: "gateway" | "worker" | "service" }> {
  const gwHeader = req.headers.get("x-gateway-key") || "";
  const wkHeader = req.headers.get("x-worker-token") || "";
  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (serviceKey && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (constantTimeEqual(bearer, serviceKey)) {
      return { authorized: true, role: "service" };
    }
  }

  const keysToFetch: string[] = [];
  if (allowedRoles.includes("gateway") && gwHeader) keysToFetch.push("gateway_api_key_hash");
  if (allowedRoles.includes("worker") && wkHeader) keysToFetch.push("worker_cron_token_hash");
  if (keysToFetch.length === 0) {
    return { authorized: false };
  }

  const { data: rows } = await supabase
    .from("system_kv")
    .select("key, value")
    .in("key", keysToFetch);

  const hashByKey = new Map<string, string>();
  for (const r of rows || []) {
    const h = (r.value as { sha256?: string } | null)?.sha256;
    if (h) hashByKey.set(r.key, h);
  }

  if (allowedRoles.includes("gateway") && gwHeader) {
    const expected = hashByKey.get("gateway_api_key_hash") || "";
    const actual = await sha256Hex(gwHeader);
    if (expected && constantTimeEqual(actual, expected)) {
      return { authorized: true, role: "gateway" };
    }
  }

  if (allowedRoles.includes("worker") && wkHeader) {
    const expected = hashByKey.get("worker_cron_token_hash") || "";
    const actual = await sha256Hex(wkHeader);
    if (expected && constantTimeEqual(actual, expected)) {
      return { authorized: true, role: "worker" };
    }
  }

  return { authorized: false };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
