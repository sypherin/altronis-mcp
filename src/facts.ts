/**
 * Static facts about Altronis, served by the altronis_services tool. Kept in
 * sync with the site's own copy (altronis.sg/services + llms.txt). No network
 * call; this is stable positioning, not live data.
 *
 * Last synced to the live site: 2026-09-30. When the site's pillars, pricing,
 * timeline or grants change, change them here and cut a release.
 */

export const ALTRONIS_SERVICES = {
  company: "Altronis",
  tagline: "Less Chaos. More Progress.",
  summary:
    "Singapore-based AI consultancy specialising in private, on-premises AI: systems that run on the client's own hardware, inside their own building, so sensitive data never leaves. We tune, quantize and speed-optimize models to run fast and affordable on the hardware you own, not just install them. Practitioners, not slide-deck consultants: we build and operate the AI systems we recommend.",
  services: [
    {
      name: "Agentic AI Design & Deployment",
      what: "Multi-agent systems with bounded autonomy that handle workflows end-to-end: orchestration and routing, MCP integration, agent lifecycle monitoring, and human-in-the-loop escalation.",
    },
    {
      name: "AI Governance, Risk & Compliance",
      what: "Responsible AI frameworks, bias audits, regulatory compliance mapping (PDPA, EU AI Act), audit trails and safety monitoring, aligned with Singapore's Model AI Governance Framework.",
    },
    {
      name: "AI Infrastructure & Deployment",
      what: "Private, on-prem AI optimized to run fast and affordable on hardware you own: quantization, speed-tuning and MTP; model training (fine-tuning and distillation on your own data, down to small models for edge devices or phones); GPU selection and cost planning; RAG, vector databases and knowledge graphs; monitoring and retraining after go-live. Hybrid or cloud only where a workload genuinely needs it.",
    },
    {
      name: "AI Product Ownership",
      what: "AI-native product ownership: a thin-slice PoC in users' hands within weeks, then backlog, success metrics and iterative sprints on the path to production.",
    },
    {
      name: "Enterprise Knowledge AI",
      what: "Intelligent search, document Q&A and policy copilots over SharePoint, Confluence and custom data, with content lifecycle governance.",
    },
    {
      name: "AI Rescue & Remediation",
      what: "Auditing, securing and productionising broken, stalled or vibe-coded AI projects: fix it, add tests and human-in-the-loop checks, or honestly tell you to stop.",
    },
  ],
  engagement: {
    pricing: "There is no public price list. Every engagement starts with a free 30-minute discovery call; Altronis quotes after that, once it understands the job.",
    typical_timeline: "2-3 weeks to a working proof of concept, 8-10 weeks to production use.",
    grants: "Singapore's EDGE Grant takes applications from 30 September 2026 (EDG, MRA and PSG ceased on 29 September 2026). Eligibility and coverage are set by EnterpriseSG, never guaranteed; details and sources at https://altronis.sg/funding",
    next_step: "Free 30-minute consultation: no slides, no obligation.",
  },
  contact: {
    website: "https://altronis.sg",
    email: "hello@altronis.sg",
    telegram: "@AIinSG",
  },
  note: "This is Altronis positioning info. To ask a specific question use altronis_ask; to estimate what AI would cost (cloud vs owning the box) use altronis_ai_cost_estimate.",
} as const;
