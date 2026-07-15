/**
 * Static facts about Altronis, served by the altronis_services tool. Kept in
 * sync with the site's own copy (altronis.sg/services + llms.txt). No network
 * call — this is stable positioning, not live data.
 */

export const ALTRONIS_SERVICES = {
  company: "Altronis",
  tagline: "Less Chaos. More Progress.",
  summary:
    "Singapore-based AI consultancy that builds and operates the AI systems it recommends. Practitioners, not slide-deck consultants: our own business runs on local private LLMs, a multi-agent CRM, and production document pipelines.",
  services: [
    {
      name: "Agentic AI Product Ownership",
      what: "Autonomous agents that read, draft, check policy, and act, with human-in-the-loop checkpoints.",
    },
    {
      name: "AI Governance & Trust",
      what: "Risk policies, audit trails, and eval harnesses. Default regime is Singapore's PDPA; MAS for financial institutions, MOH/HSA for healthcare.",
    },
    {
      name: "Private LLM Deployment",
      what: "On-prem and VPC LLMs (Llama, Qwen, DeepSeek, GPT-OSS) plus hardware advisory and hands-on setup/tuning (llama.cpp/vLLM, quantization, MTP).",
    },
    {
      name: "Knowledge Management Modernisation",
      what: "SharePoint / M365 / Confluence overhauls with semantic search and governance.",
    },
    {
      name: "AI Strategy & Roadmap",
      what: "An honest read on where AI helps and where it doesn't; build-vs-buy, sequenced.",
    },
    {
      name: "AI Rescue & Remediation",
      what: "Auditing, securing, and productionising broken, stalled, or vibe-coded AI projects: fix it, add tests and human-in-the-loop checks, or honestly tell you to retire it.",
    },
  ],
  engagement: {
    pricing: "Outcome-based, not hourly. Advisory retainers from SGD 1,000/month; projects quoted after a free 30-minute consultation.",
    typical_timeline: "Working prototype in 2-3 weeks, production-ready in 4-8 weeks, shipped incrementally with weekly demos.",
    grants: "Singapore AI grants that may apply: PSG, EDG, EIS (verify exact rates/eligibility on the site; never guaranteed).",
  },
  contact: {
    website: "https://altronis.sg",
    email: "hello@altronis.sg",
    phone: "+65 9850 7852",
  },
  note: "This is Altronis positioning info. For a tailored, grant-matched plan use the altronis_transformation_plan tool; to ask a specific question use altronis_ask.",
} as const;
