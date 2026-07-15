/**
 * Live smoke test: exercise every tool against the real altronis.sg (or
 * ALTRONIS_BASE_URL). Prints a pass/fail line per tool and exits non-zero if
 * any failed. This is the integration gate the unit tests can't cover.
 *
 *   npm run smoke
 */

import { createTools, type ToolDef } from "../src/tools.js";
import { baseUrl } from "../src/client.js";

interface Check {
  tool: string;
  args: Record<string, unknown>;
  ok: (result: any) => boolean;
}

const CHECKS: Check[] = [
  { tool: "altronis_services", args: {}, ok: (r) => Array.isArray(r?.services) && r.services.length === 6 },
  { tool: "altronis_sg_ai_events", args: { limit: 3 }, ok: (r) => typeof r?.count === "number" && Array.isArray(r?.events) },
  { tool: "altronis_sg_ai_news", args: { limit: 3 }, ok: (r) => typeof r?.count === "number" && Array.isArray(r?.news) },
  { tool: "altronis_sg_ecosystem", args: {}, ok: (r) => r?.overview != null },
  { tool: "altronis_ask", args: { question: "In one line, what does Altronis do?" }, ok: (r) => typeof r?.answer === "string" && r.answer.length > 0 },
  {
    tool: "altronis_transformation_plan",
    args: { sector: "manufacturing", business: "A 40-person precision metal stamping SME in Singapore. Manual QC reports and quoting are the biggest pain. Uses Excel and WhatsApp." },
    ok: (r) => r?.plan != null,
  },
];

async function main(): Promise<void> {
  const tools = new Map<string, ToolDef>(createTools().map((t) => [t.name, t]));
  process.stderr.write(`[smoke] base=${baseUrl()}\n`);
  let failures = 0;

  for (const c of CHECKS) {
    const t = tools.get(c.tool);
    if (!t) {
      process.stderr.write(`FAIL ${c.tool}: tool not registered\n`);
      failures++;
      continue;
    }
    const started = Date.now();
    try {
      const parsed = t.inputSchema.parse(c.args);
      const result = await t.handler(parsed);
      const ms = Date.now() - started;
      if (c.ok(result)) {
        process.stderr.write(`PASS ${c.tool} (${ms}ms)\n`);
      } else {
        process.stderr.write(`FAIL ${c.tool} (${ms}ms): unexpected shape -> ${JSON.stringify(result).slice(0, 200)}\n`);
        failures++;
      }
    } catch (err) {
      process.stderr.write(`FAIL ${c.tool}: ${(err as Error).message}\n`);
      failures++;
    }
  }

  process.stderr.write(failures === 0 ? `\n[smoke] ALL ${CHECKS.length} PASSED\n` : `\n[smoke] ${failures}/${CHECKS.length} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`[smoke] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
