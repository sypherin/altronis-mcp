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

const SECTORS = ["sport", "manufacturing", "fnb"] as const;

// --- input schemas ---------------------------------------------------------

const AskInput = z.object({
  question: z
    .string()
    .min(3, "question must be at least 3 characters")
    .max(2000, "question is too long (max 2000 chars)")
    .describe("A question about AI for a Singapore business, Altronis's services, private/local LLMs, SG AI grants, or governance."),
});

const PlanInput = z.object({
  sector: z
    .enum(SECTORS)
    .describe("The business sector. Only these have a specialist advisor: 'sport' (gyms, studios, academies), 'manufacturing' (precision, engineering, F&B manufacturing), 'fnb' (food & beverage / food services)."),
  business: z
    .string()
    .min(20, "describe the business in at least 20 characters for a useful plan")
    .max(4000, "business description is too long (max 4000 chars)")
    .describe("A few sentences on the business: what they do, size, biggest pain, current tools, and AI maturity. The more concrete, the better the plan."),
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
        "Ask Agent Lyra, Altronis's AI consultant, a question about applying AI in a Singapore business: our services, private/on-prem LLM deployment, AI governance (PDPA/MAS/MOH), SG AI grants, or build-vs-buy. Returns a short consultant-style answer. Use for open questions; use altronis_transformation_plan when you want a structured, grant-matched plan for a specific business.",
      inputSchema: AskInput,
      handler: async (input: z.infer<typeof AskInput>) => {
        const data = await postJson<{ reply?: string; advisorLink?: string | null }>(
          "/api/chat",
          { messages: [{ role: "user", content: input.question }], sessionId: sessionId() },
        );
        return {
          answer: data.reply ?? "",
          specialist_sector: data.advisorLink ?? undefined,
          source: "altronis.sg/api/chat",
        };
      },
    },
    {
      name: "altronis_transformation_plan",
      description:
        "Generate a quick, grant-matched AI transformation plan for a specific Singapore SME in a supported sector (sport, manufacturing, or fnb). Give the sector and a concrete business description; returns a structured plan (summary, top pain, suggested next steps / tools). This is Altronis's signature advisor flow. For sectors without a specialist, use altronis_ask instead.",
      inputSchema: PlanInput,
      handler: async (input: z.infer<typeof PlanInput>) => {
        const data = await postJson<{ quick?: unknown }>(
          `/api/advisor/${input.sector}/plan-quick`,
          { messages: [{ role: "user", content: input.business }], sessionId: sessionId() },
          60_000,
        );
        return { sector: input.sector, plan: data.quick ?? null, source: `altronis.sg/api/advisor/${input.sector}/plan-quick` };
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
        "What Altronis offers: the six service pillars (agentic AI, AI governance, private LLM deployment, knowledge management, AI strategy, AI rescue), engagement model, pricing shape, and contact details. Static positioning info — no live call. Use to explain who Altronis is or how to engage them.",
      inputSchema: EmptyInput,
      handler: async () => ALTRONIS_SERVICES,
    },
  ];
}
