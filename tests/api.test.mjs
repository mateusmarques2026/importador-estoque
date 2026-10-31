import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.LOTE_TEST_URL ?? "http://127.0.0.1:5175";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Use apenas a prévia local.");
let cookie = "";
async function call(route, method = "GET", body, profile) {
  const response = await fetch(base + "/api/" + route, {
    method,
    headers: {
      cookie,
      origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(profile ? { "x-studio-test-user": profile } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
test("importação atômica, idempotência, correção e isolamento entre contas", async () => {
  assert.equal((await call("products")).status, 401);
  const login = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" });
  cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const sku = "T" + Date.now();
  const csv = "sku;nome;quantidade;preco\n" + sku + ";Produto de teste;7;12,90";
  const input = { csv, filename: "teste.csv" };
  assert.equal((await call("preview", "POST", input)).data.validCount, 1);
  const race = await Promise.all([call("imports", "POST", input), call("imports", "POST", input)]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 201]);
  assert.equal(race.filter((r) => r.data.duplicate).length, 1);
  let stock = await call("products?q=" + sku);
  assert.equal(stock.data.products.length, 1);
  assert.equal(stock.data.products[0].quantity, 7);
  const bad = await call("imports", "POST", {
    csv: csv + "\nX1;Inválido;-1;10",
    filename: "ruim.csv",
  });
  assert.equal(bad.status, 422);
  stock = await call("products?q=" + sku);
  assert.equal(stock.data.products[0].quantity, 7);
  const updated = await call("imports", "POST", {
    csv: csv.replace(";7;12,90", ";9;14,90"),
    filename: "corrigido.csv",
  });
  assert.equal(updated.status, 201);
  stock = await call("products?q=" + sku);
  assert.equal(stock.data.products.length, 1);
  assert.equal(stock.data.products[0].quantity, 9);
  assert.equal(stock.data.products[0].price, 1490);
  const privateStock = await call("products?q=" + sku, "GET", undefined, "alice");
  assert.equal(privateStock.status, 200);
  assert.equal(privateStock.data.products.length, 0, "Use dev:roles para testar isolamento");
  const forged = await call("imports", "POST", { ...input, owner: "outro" });
  assert.equal(forged.status, 400);
});
