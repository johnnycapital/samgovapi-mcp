// Opt-in live test against the hosted server: SAMGOVAPI_LIVE=1 node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

test("live keyless tools/list, search and fetch", { skip: process.env.SAMGOVAPI_LIVE !== "1" && "set SAMGOVAPI_LIVE=1 to call samgovapi.io" }, async () => {
  const s = createServer({ apiKey: "" });
  const list = await s.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.ok(list.result.tools.some((t) => t.name === "search"));
  const found = await s.handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { query: "Booz Allen Hamilton" } } });
  const hit = JSON.parse(found.result.content[0].text).results.find((r) => r.id.startsWith("entity:"));
  assert.ok(hit);
  const doc = await s.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "fetch", arguments: { id: hit.id } } });
  assert.match(doc.result.content[0].text, /UEI/);
});
