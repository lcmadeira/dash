import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDataGateway } from "../scripts/check-data-gateway.mjs";

test("gateway deployment check validates status routes and dashboard CORS", async () => {
  const response = new Response(JSON.stringify({ service: "dash-data-gateway", routes: [
    "/v1/crypto", "/v1/geopolitics", "/v1/news-pt", "/v1/news-world",
  ] }), { headers: { "Access-Control-Allow-Origin": "https://lcmadeira.github.io" } });
  assert.equal(await checkDataGateway("https://gateway.example", async url => {
    assert.equal(new URL(url).pathname, "/v1/status");
    return response;
  }), 4);
  await assert.rejects(checkDataGateway("https://gateway.example", async () => new Response("{}")), /CORS/);
});
