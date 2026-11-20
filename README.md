# samgovapi-mcp

A stdio MCP server for [samgovapi.io](https://samgovapi.io?utm_source=npm&utm_medium=readme&utm_campaign=samgovapi-mcp): SAM.gov entity registrations, UEI and CAGE lookups, contract opportunities, exclusions and USAspending prime awards, for Claude Desktop, Claude Code, Cursor, VS Code and any other MCP client.

- `search` and `fetch` work with **no API key**.
- Set `SAMGOVAPI_API_KEY` and the data tools appear too: `registration_status`, `get_entity`, `search_entities`, `search_opportunities`, `get_opportunity`, `exclusion_check`, `search_awards`, `recompetes`, `naics_lookup`, `size_standard_check`, `labor_rates`, `expiring_registrations`.
- Zero dependencies, Node 18+. It forwards JSON-RPC to the hosted server at `https://samgovapi.io/api/mcp`, so tool schemas always match the live API.

Independent. Not affiliated with, endorsed by or sponsored by GSA, SAM.gov or any U.S. government agency. Registering in SAM.gov is free at sam.gov.

## Use it

Claude Desktop (`claude_desktop_config.json`), Cursor (`.cursor/mcp.json`) and most clients take the same block:

```json
{
  "mcpServers": {
    "samgovapi": {
      "command": "npx",
      "args": ["-y", "samgovapi-mcp"],
      "env": { "SAMGOVAPI_API_KEY": "sg_..." }
    }
  }
}
```

Leave out `env` to run keyless. Claude Code:

```bash
claude mcp add samgovapi -e SAMGOVAPI_API_KEY=sg_... -- npx -y samgovapi-mcp
```

A client that speaks Streamable HTTP can skip this package and point at the hosted server directly: `https://samgovapi.io/api/mcp`, with an optional `Authorization: Bearer sg_...` header.

Free keys: [samgovapi.io/sign-up](https://samgovapi.io/sign-up?utm_source=npm&utm_medium=readme&utm_campaign=samgovapi-mcp). The data tools take `user_request`, the current task in one sentence.

## Environment

| Variable | Effect |
| --- | --- |
| `SAMGOVAPI_API_KEY` | Optional. Enables the keyed data tools and sends `Authorization: Bearer` upstream. |
| `SAMGOVAPI_MCP_TOOLS=all` | Expose every hosted tool, including `teaming_partners` (Pro) and the alerts tools. |
| `SAMGOVAPI_MCP_URL` | Override the upstream endpoint (used by the tests). |

## Real run

The published bin, run over stdio with no key on 15 Nov 2026:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"readme","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search","arguments":{"query":"Booz Allen Hamilton"}}}' \
  | npx -y samgovapi-mcp
```

Output, one JSON-RPC reply per line (the notification gets none):

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"samgovapi-mcp","title":"samgovapi.io","version":"0.1.0","websiteUrl":"https://samgovapi.io?utm_source=npm&utm_medium=readme&utm_campaign=samgovapi-mcp"},"instructions":"SAM.gov entities, CAGE and UEI lookups, contract opportunities, exclusions and USAspending awards from samgovapi.io. search and fetch work with no key. Set SAMGOVAPI_API_KEY (free at https://samgovapi.io/sign-up?utm_source=npm&utm_medium=readme&utm_campaign=samgovapi-mcp) for the data tools; they take user_request, the current task in one sentence. Independent. Not affiliated with, endorsed by or sponsored by GSA, SAM.gov or any U.S. government agency."}}
```

```text
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"search","description":"Search the public samgovapi.io lookup pages and docs: companies by name, UEI or CAGE, NAICS codes, open opportunities, guides and data fields. Needs no key. Then call fetch with a result id.","inputSchema":{"type":"object","properties":{"query":{"type":"string","description":"Words to look for: a company name, a UEI, a NAICS code or a question."}},"required":["query"]}},{"name":"fetch","description":"The full text of one search result as markdown: a company's registration and awards, an opportunity, a NAICS code, a doc or a field. Needs no key. Quote the data-as-of date when you state a fact.", ...
```

(2,903 bytes in full; the five keyless tools listed are `search`, `fetch`, `start_signup`, `finish_signup`, `give_feedback`.)

```json
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"results\":[{\"id\":\"entity:UAVDK5WWYDZ5\",\"title\":\"BOOZ ALLEN HAMILTON INC (UEI UAVDK5WWYDZ5)\",\"url\":\"https://samgovapi.io/entity/UAVDK5WWYDZ5\"},{\"id\":\"entity:QDFNQQ83G946\",\"title\":\"BOOZ ALLEN HAMILTON INC. (UEI QDFNQQ83G946)\",\"url\":\"https://samgovapi.io/entity/QDFNQQ83G946\"},{\"id\":\"entity:ELFANDP17M48\",\"title\":\"BOOZ ALLEN HAMILTON INC. (UEI ELFANDP17M48)\",\"url\":\"https://samgovapi.io/entity/ELFANDP17M48\"},{\"id\":\"entity:CZ26THPKFPJ9\",\"title\":\"BOOZ ALLEN HAMILTON INC. (UEI CZ26THPKFPJ9)\",\"url\":\"https://samgovapi.io/entity/CZ26THPKFPJ9\"},{\"id\":\"entity:FRFTWN17QUF3\",\"title\":\"BOOZ ALLEN HAMILTON INC (UEI FRFTWN17QUF3)\",\"url\":\"https://samgovapi.io/entity/FRFTWN17QUF3\"}]}"}],"isError":false}}
```

Then `fetch` with `{"id":"entity:UAVDK5WWYDZ5"}` returns that registration as markdown: status, expiration date, NAICS codes, exclusion flag, the data-as-of date and links to the SAM.gov and USAspending records.

## Plans and credits

The keyless tools are rate limited per client and cost nothing. With a key: Free is 100 credits a month and 20 requests a minute with no card; Developer $49 a month, Pro $149, Scale $499; a $9 top-up adds 1,000 credits. A lookup costs 1 credit, a search 1 per 100 rows, award history 3x, and errors cost nothing.

## Coverage

As of 15 Nov 2026: 881,370 entities from the 1 Nov 2026 SAM.gov monthly extract, 74,420 opportunity notices (nightly), 169,191 exclusions (daily) and 114,954 USAspending prime awards with action dates from 1 Oct 2026. Award history before FY2027 is not loaded yet.

## Tests

```bash
npm test                    # offline: JSON-RPC loop with a mocked upstream, plus a stdio run against a local fake server
SAMGOVAPI_LIVE=1 npm test   # also lists tools and runs search and fetch on the hosted server
```

## Registry

`server.json` describes this package (npm, stdio) and the hosted Streamable HTTP endpoint for the official MCP registry. `package.json` carries the matching `mcpName`.

## License

MIT, Copyright (c) 2026 Stunning Couches LLC.

## Links

- Product: https://samgovapi.io
- Docs: https://samgovapi.io/docs
- Hosted MCP endpoint (Streamable HTTP): `https://samgovapi.io/api/mcp`
- npm: https://www.npmjs.com/package/samgovapi-mcp
- MCP Registry name: `io.github.samgovapi/samgovapi`

## Gemini CLI

```sh
gemini extensions install https://github.com/johnnycapital/samgovapi-mcp
```
