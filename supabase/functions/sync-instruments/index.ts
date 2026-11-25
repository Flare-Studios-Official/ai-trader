import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyGatewayOrWorkerRequest, jsonResponse, CORS_HEADERS } from "../_shared/auth.ts";

const TARGET_OPT_NAMES = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"]);
const INDEX_TOKENS = new Set(["99926000", "99926009", "99926037", "99926074", "99919000", "99919012"]);
const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
};

function parseExpiryDate(exp: string): string | null {
  if (!exp || exp.length < 9) return null;
  const day = exp.slice(0, 2);
  const mon = MONTH_MAP[exp.slice(2, 5).toUpperCase()];
  const year = exp.slice(5, 9);
  if (!mon || !/^\d{2}$/.test(day) || !/^\d{4}$/.test(year)) return null;
  return `${year}-${mon}-${day}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const auth = await verifyGatewayOrWorkerRequest(req, supabase, ["gateway", "worker"]);
  if (!auth.authorized) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const includeEquities = url.searchParams.get("equities") !== "false";

  const srcRes = await fetch(
    "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
    { headers: { "User-Agent": "AITrader-Mumbai/2.0" } }
  );

  if (!srcRes.ok || !srcRes.body) {
    return jsonResponse({ error: `Failed to fetch ScripMaster: ${srcRes.status}` }, 502);
  }

  const reader = srcRes.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let totalScanned = 0;

  const optRows: any[] = [];
  const baseRows: any[] = [];
  const eqRows: any[] = [];

  const todayIst = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  const processObjectStr = (rawObj: string) => {
    totalScanned++;
    const isOpt = rawObj.includes('"OPTIDX"');
    const isEq = includeEquities && rawObj.includes('"NSE"') && rawObj.includes('-EQ"');
    const isIdx = rawObj.includes('"AMXIDX"');

    if (!isOpt && !isEq && !isIdx) return;

    let item: any;
    try {
      item = JSON.parse(rawObj);
    } catch {
      return;
    }

    const exch = item.exch_seg;
    const tok = String(item.token || "");
    const sym = String(item.symbol || "");
    const name = String(item.name || "");
    const itype = String(item.instrumenttype || "");

    if (isIdx && ((exch === "NSE" || exch === "BSE") && INDEX_TOKENS.has(tok))) {
      baseRows.push({
        exch_seg: exch,
        token: tok,
        symbol: sym,
        name: name,
        instrumenttype: "AMXIDX",
        expiry: "",
        expiry_date: null,
        strike: -1,
        option_type: null,
        lotsize: 1,
        tick_size: 0.05,
        updated_at: new Date().toISOString()
      });
      return;
    }

    if (isEq && exch === "NSE" && sym.endsWith("-EQ")) {
      eqRows.push({
        exch_seg: "NSE",
        token: tok,
        symbol: sym,
        name: name,
        instrumenttype: "EQ",
        expiry: "",
        expiry_date: null,
        strike: -1,
        option_type: null,
        lotsize: parseInt(item.lotsize || "1", 10) || 1,
        tick_size: (parseFloat(item.tick_size || "5") || 5) / 100,
        updated_at: new Date().toISOString()
      });
      return;
    }

    if (isOpt && itype === "OPTIDX" && (exch === "NFO" || exch === "BFO") && TARGET_OPT_NAMES.has(name)) {
      const ed = parseExpiryDate(String(item.expiry || ""));
      if (!ed || ed < todayIst) return;
      const optType = sym.endsWith("CE") ? "CE" : (sym.endsWith("PE") ? "PE" : null);
      const strike = Math.round(((parseFloat(item.strike || "0") || 0) / 100) * 100) / 100;
      optRows.push({
        exch_seg: exch,
        token: tok,
        symbol: sym,
        name: name,
        instrumenttype: "OPTIDX",
        expiry: String(item.expiry || ""),
        expiry_date: ed,
        strike,
        option_type: optType,
        lotsize: parseInt(item.lotsize || "1", 10) || 1,
        tick_size: (parseFloat(item.tick_size || "5") || 5) / 100,
        updated_at: new Date().toISOString()
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let pos = 0;
    while (true) {
      const start = buf.indexOf("{", pos);
      if (start === -1) {
        buf = "";
        break;
      }
      const end = buf.indexOf("}", start);
      if (end === -1) {
        buf = buf.slice(start);
        break;
      }
      processObjectStr(buf.slice(start, end + 1));
      pos = end + 1;
    }
  }

  const keptExpiriesByName = new Map<string, Set<string>>();
  for (const name of TARGET_OPT_NAMES) {
    const exps = Array.from(new Set(optRows.filter(r => r.name === name).map(r => r.expiry_date))).sort().slice(0, 3);
    keptExpiriesByName.set(name, new Set(exps));
  }
  const filteredOpts = optRows.filter(r => keptExpiriesByName.get(r.name)?.has(r.expiry_date));

  const allRows = [...baseRows, ...filteredOpts, ...eqRows];
  const dedupMap = new Map<string, any>();
  for (const r of allRows) {
    dedupMap.set(`${r.exch_seg}:${r.token}`, r);
  }
  const uniqueRows = Array.from(dedupMap.values());

  let upserted = 0;
  for (let i = 0; i < uniqueRows.length; i += 500) {
    const chunk = uniqueRows.slice(i, i + 500);
    const { error } = await supabase
      .from("instrument_master")
      .upsert(chunk, { onConflict: "exch_seg,token" });
    if (error) {
      return jsonResponse({ error: error.message, upserted_so_far: upserted }, 500);
    }
    upserted += chunk.length;
  }

  await supabase.from("system_kv").upsert({
    key: "scripmaster_last_sync",
    value: {
      synced_at: new Date().toISOString(),
      scanned: totalScanned,
      indices: baseRows.length,
      options: filteredOpts.length,
      equities: eqRows.length,
      total_upserted: upserted
    },
    updated_at: new Date().toISOString()
  });

  return jsonResponse({
    success: true,
    scanned: totalScanned,
    indices: baseRows.length,
    options: filteredOpts.length,
    equities: eqRows.length,
    total_upserted: upserted
  });
});
