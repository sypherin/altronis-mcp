/**
 * Library entrypoint for @altronis/altronis-mcp. Re-exports the tool set and
 * the HTTP client so the tools can be embedded in another agent/runtime, not
 * only run as the stdio server or CLI.
 */

export { createTools, type ToolDef } from "./tools.js";
export { getJson, postJson, request, baseUrl } from "./client.js";
export { ALTRONIS_SERVICES } from "./facts.js";
