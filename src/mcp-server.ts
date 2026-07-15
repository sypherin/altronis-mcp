#!/usr/bin/env node
/**
 * stdio MCP server for @altronis/altronis-mcp.
 *
 * Published as the `altronis-mcp` binary — `npx @altronis/altronis-mcp` boots
 * this. Speaks JSON-RPC over stdio (Model Context Protocol) and exposes the
 * read-only Altronis tools to any MCP client (Claude Desktop, Claude Code,
 * Cursor, etc.).
 *
 * stdout is reserved for MCP traffic — ALL logs go to stderr.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodError } from "zod";

import { createTools, type ToolDef } from "./tools.js";
import { baseUrl } from "./client.js";

function log(msg: string): void {
  process.stderr.write(`[altronis-mcp] ${msg}\n`);
}

/** zod -> JSON Schema for MCP clients; strip the $schema header, force object. */
function toolInputJsonSchema(tool: ToolDef): Record<string, unknown> {
  try {
    const schema = zodToJsonSchema(tool.inputSchema, {
      $refStrategy: "none",
      target: "jsonSchema7",
    }) as Record<string, unknown>;
    delete schema["$schema"];
    if (schema["type"] == null) schema["type"] = "object";
    return schema;
  } catch (err) {
    log(`warn: failed to convert schema for ${tool.name}: ${(err as Error).message}`);
    return { type: "object" };
  }
}

async function main(): Promise<void> {
  const tools = createTools();
  const byName = new Map<string, ToolDef>();
  for (const t of tools) byName.set(t.name, t);

  const server = new Server(
    { name: "altronis-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toolInputJsonSchema(t),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;
    const tool = byName.get(name);
    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool "${name}". Known tools: ${[...byName.keys()].join(", ")}`,
      );
    }

    let parsedInput: unknown;
    try {
      parsedInput = tool.inputSchema.parse(rawArgs ?? {});
    } catch (err) {
      const zerr = err as ZodError;
      const issues = Array.isArray(zerr?.issues)
        ? zerr.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
        : (err as Error).message;
      throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for "${name}": ${issues}`);
    }

    try {
      const result = await tool.handler(parsedInput);
      return {
        content: [
          {
            type: "text" as const,
            text:
              result === undefined
                ? ""
                : typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, `Tool "${name}" failed: ${msg}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`ready (base=${baseUrl()}, tools=${tools.length})`);

  const shutdown = (signal: string) => {
    log(`shutting down on ${signal}`);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  process.stderr.write(
    `[altronis-mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
