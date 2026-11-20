// samgovapi-mcp: a stdio MCP server that forwards to the hosted samgovapi.io MCP server.
// Tool schemas come from the hosted server's tools/list, so they stay in sync with the API.
// Zero dependencies. Independent; not affiliated with GSA, SAM.gov or any U.S. government agency.

export const VERSION = "0.1.0";
export const DEFAULT_UPSTREAM = "https://samgovapi.io/api/mcp";
export const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

/** Work with no key. */
export const KEYLESS_TOOLS = ["search", "fetch", "start_signup", "finish_signup", "give_feedback"];
/** Exposed only when SAMGOVAPI_API_KEY is set. SAMGOVAPI_MCP_TOOLS=all exposes every upstream tool instead. */
export const KEYED_TOOLS = [
  "registration_status", "get_entity", "search_entities", "search_opportunities", "get_opportunity", "exclusion_check",
  "search_awards", "recompetes", "naics_lookup", "size_standard_check", "labor_rates", "expiring_registrations",
];

/** Used only when the hosted server cannot be reached for tools/list, so search and fetch still appear. */
export const FALLBACK_TOOLS = [
  { name: "search", description: "Search the public samgovapi.io lookup pages and docs: companies by name, UEI or CAGE, NAICS codes, open opportunities and guides. No API key needed.", inputSchema: { type: "object", properties: { query: { type: "string", description: "A company name, a UEI, a CAGE code, a NAICS code or a question." } }, required: ["query"] } },
  { name: "fetch", description: "The full text of one search result as markdown, by id such as entity:UAVDK5WWYDZ5 or naics:541512. No API key needed.", inputSchema: { type: "object", properties: { id: { type: "string", description: "An id from search." } }, required: ["id"] } },
];

const INSTRUCTIONS = "SAM.gov entities, CAGE and UEI lookups, contract opportunities, exclusions and USAspending awards from samgovapi.io. "
  + "search and fetch work with no key. Set SAMGOVAPI_API_KEY (free at https://samgovapi.io/sign-up) for the data tools; they take user_request, the current task in one sentence. "
  + "Independent. Not affiliated with, endorsed by or sponsored by GSA, SAM.gov or any U.S. government agency.";

const rpcError = (id, code, message, data) => ({ jsonrpc: "2.0", id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } });
const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });

/** The last JSON-RPC message of a Streamable HTTP reply sent as JSON or as server-sent events. */
export function parseRpcBody(text) {
  const t = text.trimStart();
  if (t.startsWith("event:") || t.startsWith("data:")) {
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
    return JSON.parse(lines[lines.length - 1] ?? "{}");
  }
  return JSON.parse(text);
}

/**
 * createServer({ apiKey, upstream, fetch, toolsMode }) returns { handle(message) }, where handle takes one parsed
 * JSON-RPC message (or a batch array) and resolves to the reply, or undefined for notifications.
 */
export function createServer(options = {}) {
  const apiKey = options.apiKey ?? "";
  const upstream = options.upstream ?? DEFAULT_UPSTREAM;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const toolsMode = options.toolsMode ?? "default";
  const timeoutMs = options.timeoutMs ?? 60000;
  let upstreamId = 0;
  let toolCache = null;

  const exposed = (name) => {
    if (KEYLESS_TOOLS.includes(name)) return true;
    if (!apiKey) return false;
    return toolsMode === "all" || KEYED_TOOLS.includes(name);
  };

  async function forward(method, params) {
    upstreamId += 1;
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "User-Agent": `samgovapi-mcp/${VERSION}` };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(upstream, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: upstreamId, method, params }), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let message;
    try { message = parseRpcBody(text); } catch { throw Object.assign(new Error(`samgovapi.io answered HTTP ${res.status} with a body that is not JSON`), { status: res.status }); }
    if (message && message.error && !message.jsonrpc) throw Object.assign(new Error(message.error.message ?? `HTTP ${res.status}`), { status: res.status, data: message });
    return message;
  }

  async function listTools() {
    if (toolCache) return toolCache;
    try {
      const reply = await forward("tools/list", {});
      const tools = reply?.result?.tools;
      if (!Array.isArray(tools)) throw new Error("no tools in reply");
      toolCache = tools.filter((t) => exposed(t.name));
      return toolCache;
    } catch (error) {
      process.stderr?.write?.(`samgovapi-mcp: tools/list from ${upstream} failed (${error.message}); serving search and fetch only\n`);
      return FALLBACK_TOOLS;
    }
  }

  async function handleOne(msg) {
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return msg && "id" in msg && !("method" in msg) ? undefined : rpcError(msg?.id, -32600, "Invalid Request");
    }
    const isNotification = !("id" in msg) || msg.id === null;
    const { id, method, params = {} } = msg;
    if (isNotification) return undefined;
    switch (method) {
      case "initialize": {
        const asked = params.protocolVersion;
        return rpcResult(id, {
          protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[1],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "samgovapi-mcp", title: "samgovapi.io", version: VERSION, websiteUrl: "https://samgovapi.io" },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: await listTools() });
      case "tools/call": {
        const name = params?.name;
        if (typeof name !== "string") return rpcError(id, -32602, "tools/call needs params.name");
        if (!exposed(name)) {
          const hint = KEYED_TOOLS.includes(name) || !apiKey ? " Set SAMGOVAPI_API_KEY (free at https://samgovapi.io/sign-up) to use the data tools." : "";
          return rpcError(id, -32602, `Unknown tool: ${name}.${hint}`);
        }
        try {
          const reply = await forward("tools/call", { name, arguments: params.arguments ?? {} });
          if (reply?.error) return rpcError(id, reply.error.code ?? -32603, reply.error.message ?? "Upstream error", reply.error.data);
          return rpcResult(id, reply?.result ?? { content: [], isError: true });
        } catch (error) {
          return rpcResult(id, { content: [{ type: "text", text: `samgovapi.io could not be reached: ${error.message}` }], isError: true });
        }
      }
      case "resources/list":
        return rpcResult(id, { resources: [] });
      case "resources/templates/list":
        return rpcResult(id, { resourceTemplates: [] });
      case "prompts/list":
        return rpcResult(id, { prompts: [] });
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  }

  async function handle(message) {
    if (Array.isArray(message)) {
      if (message.length === 0) return rpcError(null, -32600, "Invalid Request");
      const replies = (await Promise.all(message.map(handleOne))).filter(Boolean);
      return replies.length ? replies : undefined;
    }
    return handleOne(message);
  }

  return { handle, listTools };
}

/**
 * Serve newline-delimited JSON-RPC on a readable and a writable stream (stdin and stdout by default).
 * Requests are handled concurrently; each reply is one line on stdout. Logs go to stderr only.
 */
export function serveStdio({ input = process.stdin, output = process.stdout, ...options } = {}) {
  const server = createServer(options);
  let buffer = "";
  const pending = new Set();
  const write = (reply) => { if (reply !== undefined) output.write(JSON.stringify(reply) + "\n"); };
  const onLine = (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { write(rpcError(null, -32700, "Parse error")); return; }
    const job = server.handle(msg).then(write, (error) => write(rpcError(msg?.id, -32603, error.message)));
    pending.add(job);
    job.finally(() => pending.delete(job));
  };
  input.setEncoding?.("utf8");
  input.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      onLine(line);
    }
  });
  const done = new Promise((resolve) => input.on("end", async () => {
    if (buffer.trim()) onLine(buffer);
    await Promise.all([...pending]);
    resolve();
  }));
  return { server, done };
}
