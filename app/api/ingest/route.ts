// app/api/ingest/route.ts
// Next.js API route (Vercel) that accepts POSTed snapshots from teammates
// and serves them back via GET for the dashboard to consume.
//
// HOW TO USE (teammates):
//  - POST single snapshot or an array of snapshots to:
//      https://<your-vercel-domain>/api/ingest
//    Example body (JSON):
//    {
//      "timestamp": 1727520000000,     // optional; server will add Date.now() if missing
//      "source": "srsRAN",             // "srsRAN" | "OAI" | string
//      "ues": [ { "pci":1, "rnti":4601, "downlink":{...}, "uplink":{...} } ]
//    }
//
//  - GET the latest snapshot (or all) from the same endpoint:
//      GET /api/ingest          -> returns the most recent snapshot
//      GET /api/ingest?all=1    -> returns an array of recent snapshots (ring buffer)
//
// NOTE: Storage is in-memory (per serverless instance). Good enough for hackathons.
//       For durable storage, swap this to KV/DB later.

import { NextRequest, NextResponse } from "next/server";

// In-memory ring buffer (per server process)
const MAX_SNAPSHOTS = 1000;
let SNAPSHOTS: any[] = [];

// Basic shape check & normalization
function normalizeSnapshot(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  const s: any = { ...raw };
  if (typeof s.timestamp !== "number") s.timestamp = Date.now();
  if (!Array.isArray(s.ues)) s.ues = [];
  if (typeof s.source !== "string") s.source = "unknown";
  return s;
}

function ok(body: any, init: ResponseInit = {}) {
  return new NextResponse(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...(init.headers || {})
    }
  });
}

export async function OPTIONS() {
  return ok({}, { status: 200 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all");
  if (all) {
    return ok(SNAPSHOTS.slice(-MAX_SNAPSHOTS));
  }
  const latest = SNAPSHOTS[SNAPSHOTS.length - 1];
  return ok(latest ?? null);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return ok({ ok: false, error: "Expected application/json" }, { status: 400 });
    }

    const payload = await req.json();
    const items = Array.isArray(payload) ? payload : [payload];

    let added = 0;
    for (const item of items) {
      const snap = normalizeSnapshot(item);
      if (snap) {
        SNAPSHOTS.push(snap);
        if (SNAPSHOTS.length > MAX_SNAPSHOTS) SNAPSHOTS = SNAPSHOTS.slice(-MAX_SNAPSHOTS);
        added++;
      }
    }

    return ok({ ok: true, added, size: SNAPSHOTS.length });
  } catch (e: any) {
    return ok({ ok: false, error: e?.message || "Invalid JSON" }, { status: 400 });
  }
}