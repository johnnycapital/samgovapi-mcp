#!/usr/bin/env node
// stdio MCP server for samgovapi.io. Usage: npx -y samgovapi-mcp
// Env: SAMGOVAPI_API_KEY (optional; enables the data tools), SAMGOVAPI_MCP_URL (override the hosted endpoint),
// SAMGOVAPI_MCP_TOOLS=all (expose every hosted tool, including alerts and teaming_partners).
import { serveStdio, VERSION } from "../src/server.js";

if (process.argv.includes("--version")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}
if (process.argv.includes("--help")) {
  process.stdout.write("samgovapi-mcp: stdio MCP server for samgovapi.io. search and fetch need no key; set SAMGOVAPI_API_KEY for the data tools.\n");
  process.exit(0);
}

const { done } = serveStdio({
  apiKey: process.env.SAMGOVAPI_API_KEY ?? "",
  upstream: process.env.SAMGOVAPI_MCP_URL || undefined,
  toolsMode: process.env.SAMGOVAPI_MCP_TOOLS === "all" ? "all" : "default",
});
done.then(() => process.exit(0));
