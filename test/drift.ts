/**
 * Drift check: does what this server says about Altronis still match the live
 * site? The smoke test proves every endpoint answers; this proves the static
 * facts (src/facts.ts) and the site's own description of the MCP (/mcp) have
 * not gone stale after a site change.
 *
 * Run after every altronis.sg deploy (the deploy script runs it with smoke).
 * Exit 0 = no impact, nothing to do. Exit 1 = the site moved: patch facts.ts or
 * tools.ts, cut a release, publish.
 *
 *   npm run drift
 */

import { ALTRONIS_SERVICES } from "../src/facts.js";
import { createTools } from "../src/tools.js";
import { baseUrl } from "../src/client.js";

// The site's bot filter 403s unknown agents on some routes; read it as a browser would.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

async function page(path: string): Promise<string> {
  const res = await fetch(`${baseUrl()}${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.text();
}

const unescape = (html: string) =>
  html.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');

interface Result { name: string; ok: boolean; detail: string }

async function main(): Promise<void> {
  const [llms, services, mcp] = await Promise.all([page("/llms.txt"), page("/services"), page("/mcp")]);
  const servicesText = unescape(services);
  const mcpText = unescape(mcp);
  const facts = ALTRONIS_SERVICES;
  const out: Result[] = [];
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });

  // Pillars: every name we serve must be on /services and in llms.txt, and the
  // site must not have grown or lost one.
  for (const s of facts.services) {
    const onServices = servicesText.includes(s.name);
    const inLlms = llms.includes(s.name);
    check(`pillar "${s.name}"`, onServices && inLlms, `/services=${onServices} llms.txt=${inLlms}`);
  }
  const sitePillars = (services.match(/Discuss this service/g) ?? []).length;
  check("pillar count", sitePillars === facts.services.length, `site=${sitePillars} facts=${facts.services.length}`);

  // Engagement terms.
  for (const span of facts.engagement.typical_timeline.match(/\d+-\d+ weeks/g) ?? []) {
    check(`timeline "${span}"`, llms.includes(span), `in llms.txt=${llms.includes(span)}`);
  }
  const price = facts.engagement.pricing.match(/SGD [\d,]+\/month/)?.[0] ?? "(none in facts)";
  check(`pricing "${price}"`, llms.includes(price), `in llms.txt=${llms.includes(price)}`);
  const grant = /\bEDGE\b/.test(facts.engagement.grants);
  check("grant scheme EDGE", grant && /\bEDGE\b/.test(llms), `facts=${grant} llms.txt=${/\bEDGE\b/.test(llms)}`);

  // Contact + tagline.
  check(`email ${facts.contact.email}`, llms.includes(facts.contact.email), "");
  check(`telegram ${facts.contact.telegram}`, llms.includes(facts.contact.telegram), "");
  check(`tagline "${facts.tagline}"`, mcpText.includes(facts.tagline) || llms.includes(facts.tagline) || servicesText.includes(facts.tagline), "");

  // The /mcp page must advertise exactly the tools this server registers.
  const served = createTools().map((t) => t.name).sort();
  const advertised = [...new Set(mcpText.match(/altronis_[a-z_]+/g) ?? [])].sort();
  const missing = served.filter((t) => !advertised.includes(t));
  const extra = advertised.filter((t) => !served.includes(t));
  check("/mcp tool list", missing.length === 0 && extra.length === 0,
    `missing on page=[${missing.join(",")}] on page but not served=[${extra.join(",")}]`);

  let failures = 0;
  for (const r of out) {
    if (!r.ok) failures++;
    process.stdout.write(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `  (${r.detail})`}\n`);
  }
  process.stdout.write(`[drift] ${out.length - failures}/${out.length} match ${baseUrl()}\n`);
  if (out.length < 10) {
    process.stdout.write("[drift] FAIL: fewer checks ran than expected, the instrument is broken\n");
    process.exit(1);
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write(`FAIL drift check could not run: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
