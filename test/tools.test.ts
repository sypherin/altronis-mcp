/**
 * Unit tests for the Altronis MCP tools + client. Zero network: global.fetch is
 * stubbed so we assert exactly what each tool sends and how it parses/handles
 * responses (success, non-2xx, non-JSON, timeout, schema rejection).
 *
 *   npm test        # tsx --test test/*.test.ts
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createTools } from "../src/tools.js";
import { getJson, baseUrl } from "../src/client.js";

const realFetch = globalThis.fetch;
const tools = new Map(createTools().map((t) => [t.name, t]));
function tool(name: string) {
  const t = tools.get(name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}

interface Call { url: string; method: string; body: any }
type Reply = { status?: number; json?: unknown; text?: string; throws?: string };

function mockFetch(reply: Reply | ((url: string, init: any) => Reply)): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const r = typeof reply === "function" ? reply(String(url), init) : reply;
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : undefined });
    if (r.throws) {
      const e = new Error(r.throws);
      e.name = r.throws === "AbortError" ? "AbortError" : "Error";
      throw e;
    }
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (r.json === undefined) throw new Error("not json");
        return r.json;
      },
      text: async () => r.text ?? "",
    } as Response;
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  process.env.ALTRONIS_BASE_URL = "https://test.altronis.sg";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ALTRONIS_BASE_URL;
});

// --- client ----------------------------------------------------------------

test("client: baseUrl honors env + strips trailing slash", () => {
  process.env.ALTRONIS_BASE_URL = "https://x.example/";
  assert.equal(baseUrl(), "https://x.example");
  process.env.ALTRONIS_BASE_URL = "  ";
  assert.equal(baseUrl(), "https://altronis.sg"); // blank -> default
});

test("client: non-2xx throws with status + snippet", async () => {
  mockFetch({ status: 503, text: "upstream down" });
  await assert.rejects(getJson("/api/news"), /HTTP 503.*upstream down/);
});

test("client: non-JSON body throws", async () => {
  mockFetch({ status: 200, json: undefined, text: "<html>" });
  await assert.rejects(getJson("/api/news"), /non-JSON body/);
});

test("client: timeout (AbortError) throws a timeout message", async () => {
  mockFetch({ throws: "AbortError" });
  await assert.rejects(getJson("/api/news"), /timed out/);
});

// --- altronis_ask ----------------------------------------------------------

test("ask: POSTs /api/chat with the question + returns reply", async () => {
  const calls = mockFetch({ json: { reply: "we deploy private LLMs" } });
  const res: any = await tool("altronis_ask").handler({ question: "private llm?" });
  assert.equal(calls[0].url, "https://test.altronis.sg/api/chat");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body.messages, [{ role: "user", content: "private llm?" }]);
  assert.ok(calls[0].body.sessionId, "sends a sessionId");
  assert.equal(res.answer, "we deploy private LLMs");
  assert.equal(res.source, "altronis.sg/api/chat");
});

test("ask: missing reply -> empty answer", async () => {
  mockFetch({ json: {} });
  const res: any = await tool("altronis_ask").handler({ question: "hello there" });
  assert.equal(res.answer, "");
});

test("ask: schema rejects too-short question", () => {
  assert.throws(() => tool("altronis_ask").inputSchema.parse({ question: "hi" }));
  assert.throws(() => tool("altronis_ask").inputSchema.parse({}));
});

// --- cost tools ------------------------------------------------------------

test("cost_estimate: POSTs the inputs to /api/tco/estimate", async () => {
  const calls = mockFetch({ json: { cloud_only: { basis_monthly_sgd: 2579 } } });
  const res: any = await tool("altronis_ai_cost_estimate").handler({ preset: "law-firm", horizon: 24 });
  assert.equal(calls[0].url, "https://test.altronis.sg/api/tco/estimate");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { preset: "law-firm", horizon: 24 });
  assert.equal(res.cloud_only.basis_monthly_sgd, 2579);
});

test("cost_estimate: schema rejects negative users + bad mode", () => {
  const s = tool("altronis_ai_cost_estimate").inputSchema;
  assert.throws(() => s.parse({ power: -1 }));
  assert.throws(() => s.parse({ mode: "lease" }));
  assert.doesNotThrow(() => s.parse({ power: 2, medium: 5, light: 10, mode: "seat" }));
});

test("cost_presets: GETs /api/tco/presets", async () => {
  const calls = mockFetch({ json: { presets: [{ id: "law-firm" }] } });
  const res: any = await tool("altronis_ai_cost_presets").handler({});
  assert.equal(calls[0].url, "https://test.altronis.sg/api/tco/presets");
  assert.equal(calls[0].method, "GET");
  assert.equal(res.presets[0].id, "law-firm");
});

// --- events / news ---------------------------------------------------------

test("events: GETs /api/events, clamps to default 10", async () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));
  const calls = mockFetch({ json: { items } });
  const res: any = await tool("altronis_sg_ai_events").handler({});
  assert.equal(calls[0].url, "https://test.altronis.sg/api/events");
  assert.equal(calls[0].method, "GET");
  assert.equal(res.count, 10);
  assert.equal(res.events.length, 10);
});

test("news: respects an explicit limit + tolerates missing items", async () => {
  mockFetch({ json: {} }); // no items field
  const empty: any = await tool("altronis_sg_ai_news").handler({});
  assert.equal(empty.count, 0);
  mockFetch({ json: { items: [1, 2, 3, 4, 5] } });
  const three: any = await tool("altronis_sg_ai_news").handler({ limit: 3 });
  assert.equal(three.count, 3);
});

test("events: schema rejects limit out of range", () => {
  const s = tool("altronis_sg_ai_events").inputSchema;
  assert.throws(() => s.parse({ limit: 0 }));
  assert.throws(() => s.parse({ limit: 999 }));
  assert.doesNotThrow(() => s.parse({}));
});

// --- ecosystem / services --------------------------------------------------

test("ecosystem: GETs /api/sg-ecosystem + tags source", async () => {
  const calls = mockFetch({ json: { overview: { total_formations: 78146 } } });
  const res: any = await tool("altronis_sg_ecosystem").handler({});
  assert.equal(calls[0].url, "https://test.altronis.sg/api/sg-ecosystem");
  assert.equal(res.overview.total_formations, 78146);
  assert.equal(res.source, "altronis.sg/api/sg-ecosystem");
});

test("services: static, makes NO network call", async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return {} as Response;
  }) as typeof fetch;
  const res: any = await tool("altronis_services").handler({});
  assert.equal(called, false);
  assert.equal(res.company, "Altronis");
  assert.equal(res.services.length, 6);
  const names = res.services.map((x: any) => x.name);
  assert.ok(names.includes("AI Infrastructure & Deployment"));
  assert.ok(!names.some((n: string) => /strategy/i.test(n)), "Strategy pillar was retired");
  assert.match(res.engagement.grants, /\bEDGE\b/, "EDGE replaced PSG/EDG on 30 Sep 2026");
  assert.doesNotMatch(res.engagement.grants, /may apply: PSG/, "PSG/EDG are no longer on offer");
  assert.equal("phone" in res.contact, false, "site no longer publishes a phone number");
});

// --- registry sanity -------------------------------------------------------

test("registry: 7 tools, unique names, all altronis_-prefixed, no lead/mutation tool", () => {
  const names = [...tools.keys()];
  assert.equal(names.length, 7);
  assert.equal(new Set(names).size, 7);
  assert.ok(names.every((n) => n.startsWith("altronis_")));
  assert.ok(!names.some((n) => /lead|capture|contact|submit|create|update|delete/i.test(n)));
});
