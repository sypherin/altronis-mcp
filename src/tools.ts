/**
 * The Altronis MCP tool set. Each tool wraps a public altronis.sg endpoint (or
 * static facts) and is read-only — nothing here mutates state or captures leads.
 * Descriptions are written for the calling LLM: they say WHEN to reach for the
 * tool, that the scope is Singapore + Altronis, and what comes back.
 */

import { z, type ZodSchema } from "zod";

import { getJson, postJson, sessionId } from "./client.js";
import { ALTRONIS_SERVICES } from "./facts.js";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  handler: (input: any) => Promise<unknown>;
}

// --- input schemas ---------------------------------------------------------

const AskInput = z.object({
  question: z
    .string()
    .min(3, "question must be at least 3 characters")
    .max(2000, "question is too long (max 2000 chars)")
    .describe("A question about AI for a Singapore business, Altronis's services, private/local LLMs, SG AI grants, or governance."),
});

const ListInput = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Max items to return (default 10)."),
});

const EmptyInput = z.object({});

const TcoEstimateInput = z.object({
  power: z.number().int().min(0).optional().describe("Power users: all-day heavy/agentic use (coding, deep research)."),
  medium: z.number().int().min(0).optional().describe("Medium users: daily but bounded use."),
  light: z.number().int().min(0).optional().describe("Light users: occasional questions."),
  preset: z.string().optional().describe("Industry/company-type id from altronis_ai_cost_presets (e.g. 'law-firm', 'software-startup', 'solopreneur'). Fills the user mix when power/medium/light are omitted."),
  horizon: z.number().int().min(1).max(120).optional().describe("Months to project over (default 36)."),
  mode: z.enum(["api", "seat"]).optional().describe("'api' = pay-per-token API pricing (default), 'seat' = per-person monthly subscriptions."),
  model: z.string().optional().describe("Specific cloud model to price against (e.g. 'Claude Sonnet 5.5', 'GPT-6 Astra'). Default: a mainstream capable model, with budget + frontier options shown for range."),
  plan: z.string().optional().describe("Specific subscription plan name when mode='seat'."),
  bizMix: z.record(z.number()).optional().describe("Optional percentage mix of the work: general, support, dev, legal, sales, delivery (should sum to ~100)."),
});

// --- helpers ---------------------------------------------------------------

function clampItems<T>(items: T[] | undefined, limit: number | undefined): T[] {
  const arr = Array.isArray(items) ? items : [];
  return arr.slice(0, limit ?? 10);
}

// --- tools -----------------------------------------------------------------

export function createTools(): ToolDef[] {
  return [
    {
      name: "altronis_ask",
      description:
        "Ask Agent Lyra, Altronis's AI consultant, a question about applying AI in a Singapore business: our services, private/on-prem LLM deployment, AI governance (PDPA/MAS/MOH), SG AI grants, or build-vs-buy. Returns a short consultant-style answer. Use for open questions; use altronis_ai_cost_estimate when the question is what AI would cost or whether to own the hardware.",
      inputSchema: AskInput,
      handler: async (input: z.infer<typeof AskInput>) => {
        const data = await postJson<{ reply?: string }>(
          "/api/chat",
          { messages: [{ role: "user", content: input.question }], sessionId: sessionId() },
        );
        return {
          answer: data.reply ?? "",
          source: "altronis.sg/api/chat",
        };
      },
    },
    {
      name: "altronis_sg_ai_events",
      description:
        "List upcoming AI events, meetups, and conferences in Singapore, curated by Altronis. Returns event title, date (SGT), venue, city, and a link. Use when someone asks what AI events are happening in Singapore.",
      inputSchema: ListInput,
      handler: async (input: z.infer<typeof ListInput>) => {
        const data = await getJson<{ items?: unknown[] }>("/api/events");
        const items = clampItems(data.items, input.limit);
        return { count: items.length, events: items, source: "altronis.sg/api/events" };
      },
    },
    {
      name: "altronis_sg_ai_news",
      description:
        "Latest curated Singapore-relevant AI news headlines, aggregated by Altronis. Returns headline, source URL, and id. Use when someone asks for recent AI news in or affecting Singapore.",
      inputSchema: ListInput,
      handler: async (input: z.infer<typeof ListInput>) => {
        const data = await getJson<{ items?: unknown[] }>("/api/news");
        const items = clampItems(data.items, input.limit);
        return { count: items.length, news: items, source: "altronis.sg/api/news" };
      },
    },
    {
      name: "altronis_sg_ecosystem",
      description:
        "Singapore business-formation and industry-mix snapshot (from SingStat) that Altronis uses to frame the SG AI ecosystem: total new company formations and the top industries by formation count. Use for context on Singapore's business landscape.",
      inputSchema: EmptyInput,
      handler: async () => {
        const data = await getJson<Record<string, unknown>>("/api/sg-ecosystem");
        return { ...data, source: "altronis.sg/api/sg-ecosystem" };
      },
    },
    {
      name: "altronis_services",
      description:
        "What Altronis offers: the six service pillars (agentic AI design & deployment, AI governance/risk/compliance, AI infrastructure & deployment incl. model optimization and training, AI product ownership, enterprise knowledge AI, AI rescue & remediation), engagement model, pricing shape, grants, and contact details. Static positioning info — no live call. Use to explain who Altronis is or how to engage them.",
      inputSchema: EmptyInput,
      handler: async () => ALTRONIS_SERVICES,
    },
    {
      name: "altronis_ai_cost_estimate",
      description:
        "Estimate the real monthly + multi-year cost of AI for a business, and whether to use the cloud, own a private on-prem box, or run the recommended hybrid (box + a lean cloud sub). Use WHENEVER someone asks what AI would cost, whether to buy their own hardware/server/GPU, 'own vs rent', 'is a private box worth it', how much per month/year, or 'what AI setup/hardware should we get'. Give the team as a MIX: power (all-day heavy/agentic), medium (daily bounded), light (occasional) — or pass an industry `preset` (see altronis_ai_cost_presets). Returns cloud cost (with a budget->frontier range), box capex + running cost, the hybrid monthly, the breakeven month, and a plain-English recommendation — all in SGD, on live model prices. Directional planning estimate, not a quote. Same engine as the calculator at altronis.sg/tools/tco.",
      inputSchema: TcoEstimateInput,
      handler: async (input: z.infer<typeof TcoEstimateInput>) => {
        return await postJson("/api/tco/estimate", input, 30_000);
      },
    },
    {
      name: "altronis_ai_cost_presets",
      description:
        "List the ~50 industry / company-type presets the Altronis AI cost calculator ships (id, name, sector, and default user mix). Call this when someone names an industry or company type but not a precise user breakdown, then pass the closest id to altronis_ai_cost_estimate as `preset`.",
      inputSchema: EmptyInput,
      handler: async () => await getJson("/api/tco/presets"),
    },
  ];
}
