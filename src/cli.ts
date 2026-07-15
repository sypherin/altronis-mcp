#!/usr/bin/env node
/**
 * CLI for @altronis/altronis-mcp — the same Altronis tools, from your shell.
 *
 *   altronis ask "does on-prem LLM satisfy PDPA?"
 *   altronis plan --sector manufacturing "40-person precision stamping SME, manual QC reports"
 *   altronis events [limit]
 *   altronis news [limit]
 *   altronis ecosystem
 *   altronis services
 *   altronis tool altronis_ask '{"question":"..."}'
 *   altronis list
 *
 * Tool output is JSON on stdout; logs go to stderr.
 */

import { createTools, type ToolDef } from "./tools.js";
import { baseUrl } from "./client.js";

function log(msg: string): void {
  process.stderr.write(`[altronis] ${msg}\n`);
}
function out(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
function die(msg: string): never {
  log(`error: ${msg}`);
  process.exit(1);
}

const HELP = `altronis — Singapore AI consulting, from your shell (base: ${baseUrl()})

Usage:
  altronis ask "<question>"                       Ask the Altronis consultant
  altronis plan --sector <s> "<business>"         Grant-matched AI plan (s = sport|manufacturing|fnb)
  altronis events [limit]                         Upcoming SG AI events
  altronis news [limit]                           Latest SG AI news
  altronis ecosystem                              SG business-formation snapshot
  altronis services                               What Altronis offers
  altronis tool <tool_name> [json_args]           Call any tool by name
  altronis list                                   List all tools

Config: ALTRONIS_BASE_URL (default https://altronis.sg), ALTRONIS_TIMEOUT_MS (default 30000)
`;

/** Pull `--sector <value>` (or `--sector=value`) out of args, returning the
 * value and the remaining args. */
function extractFlag(args: string[], flag: string): { value?: string; rest: string[] } {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === flag) {
      value = args[i + 1];
      i++;
    } else if (a.startsWith(`${flag}=`)) {
      value = a.slice(flag.length + 1);
    } else {
      rest.push(a);
    }
  }
  return { value, rest };
}

async function callTool(tools: Map<string, ToolDef>, name: string, input: unknown): Promise<void> {
  const tool = tools.get(name);
  if (!tool) die(`unknown tool '${name}'. available: ${[...tools.keys()].join(", ")}`);
  let parsed: unknown;
  try {
    parsed = tool!.inputSchema.parse(input ?? {});
  } catch (err) {
    const issues = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues;
    die(
      `invalid arguments: ${
        Array.isArray(issues)
          ? issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
          : (err as Error).message
      }`,
    );
  }
  log(`calling ${name}`);
  out(await tool!.handler(parsed));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const tools = new Map<string, ToolDef>();
  for (const t of createTools()) tools.set(t.name, t);

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    process.exit(0);
  }

  switch (command) {
    case "list":
      out({
        count: tools.size,
        tools: [...tools.values()].map((t) => ({ name: t.name, description: t.description })),
      });
      return;

    case "ask": {
      const question = argv.slice(1).join(" ").trim();
      if (!question) die('provide a question, e.g. altronis ask "what do you do?"');
      return callTool(tools, "altronis_ask", { question });
    }

    case "plan": {
      const { value: sector, rest } = extractFlag(argv.slice(1), "--sector");
      if (!sector) die("provide --sector <sport|manufacturing|fnb>");
      const business = rest.join(" ").trim();
      if (!business) die('provide a business description, e.g. altronis plan --sector fnb "small cafe chain..."');
      return callTool(tools, "altronis_transformation_plan", { sector, business });
    }

    case "events":
    case "news": {
      const toolName = command === "events" ? "altronis_sg_ai_events" : "altronis_sg_ai_news";
      const limitArg = argv[1] ? Number(argv[1]) : undefined;
      return callTool(tools, toolName, limitArg ? { limit: limitArg } : {});
    }

    case "ecosystem":
      return callTool(tools, "altronis_sg_ecosystem", {});

    case "services":
      return callTool(tools, "altronis_services", {});

    case "tool": {
      const toolName = argv[1];
      if (!toolName) die("provide a tool name after 'tool'");
      let jsonArgs: unknown = {};
      if (argv[2]) {
        try {
          jsonArgs = JSON.parse(argv[2]);
        } catch {
          die(`could not parse JSON args: ${argv[2]}`);
        }
      }
      return callTool(tools, toolName, jsonArgs);
    }

    default:
      die(`unknown command '${command}'. run 'altronis --help'`);
  }
}

main().catch((err) => {
  process.stderr.write(
    `[altronis] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
