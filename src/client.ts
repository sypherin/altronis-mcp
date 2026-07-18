/**
 * Thin HTTP client for the public altronis.sg endpoints.
 *
 * Every tool goes through here, so this is the single place that owns the base
 * URL, timeouts, headers, and error shape. Configurable via env so the package
 * is testable and self-hostable:
 *   ALTRONIS_BASE_URL   default https://altronis.sg (trailing slash stripped)
 *   ALTRONIS_TIMEOUT_MS default 30000
 */

import { VERSION } from "./version.js";

const DEFAULT_BASE = "https://altronis.sg";
const DEFAULT_TIMEOUT_MS = 30_000;

export function baseUrl(): string {
  const raw = process.env["ALTRONIS_BASE_URL"];
  const b = raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_BASE;
  return b.replace(/\/+$/, "");
}

function timeoutMs(): number {
  const raw = Number(process.env["ALTRONIS_TIMEOUT_MS"]);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** A stable-ish per-process session id so multi-call flows group together. */
const SESSION_ID = `mcp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export function sessionId(): string {
  return SESSION_ID;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeout?: number;
}

/**
 * Perform a JSON request against altronis.sg. Throws a descriptive Error on
 * timeout, network failure, non-2xx status, or a non-JSON body. Callers (the
 * tools) let these propagate; the MCP server turns them into an McpError and
 * the CLI prints them to stderr.
 */
export async function request<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const ms = opts.timeout ?? timeoutMs();
  const timer = setTimeout(() => controller.abort(), ms);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": `altronis-mcp/${VERSION} (+https://altronis.sg)`,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === "AbortError") {
      throw new Error(`Altronis request timed out after ${ms}ms: ${method} ${url}`);
    }
    throw new Error(`Altronis request failed: ${method} ${url} — ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Altronis API returned HTTP ${res.status} for ${method} ${url}${snippet ? ` — ${snippet}` : ""}`,
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Altronis API returned a non-JSON body for ${method} ${url}`);
  }
}

export const getJson = <T = unknown>(path: string, timeout?: number): Promise<T> =>
  request<T>(path, { method: "GET", timeout });

export const postJson = <T = unknown>(path: string, body: unknown, timeout?: number): Promise<T> =>
  request<T>(path, { method: "POST", body, timeout });
