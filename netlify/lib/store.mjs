import { getStore } from "@netlify/blobs";
import SEED from "../../data/seed.mjs";

export const STORE_NAME = "perf-dashboard";
export const MAX_HISTORY = 500;

export function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function loadData(s) {
  const d = await s.get("data", { type: "json" });
  return d || JSON.parse(JSON.stringify(SEED));
}

export async function loadHistory(s) {
  const h = await s.get("history", { type: "json" });
  return Array.isArray(h) ? h : [];
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") throw new Error("숫자가 아닙니다");
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("숫자가 아닙니다");
  return n;
}
