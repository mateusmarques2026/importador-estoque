import { z, ZodError } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { database, InventoryError, previewImport, applyImport } from "@/lib/inventory";
import { CsvError, exportProducts, type ValidProduct } from "@/lib/csv";
export const dynamic = "force-dynamic";
const input = z
  .object({
    csv: z.string().max(200_000),
    filename: z.string().trim().min(1).max(120).default("estoque.csv"),
  })
  .strict();
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function handle(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) throw new InventoryError("Entre na sua conta para acessar o estoque.", 401);
    const owner = user.userId;
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/api\//, "");
    const db = database();
    let body: unknown;
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) throw new InventoryError("Origem inválida.", 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw new InventoryError("Envie JSON.", 415);
      const text = await request.text();
      if (text.length > 220_000) throw new InventoryError("Arquivo grande demais.", 413);
      try {
        body = JSON.parse(text);
      } catch {
        throw new InventoryError("JSON inválido.");
      }
    }
    if (request.method === "POST" && route === "preview") {
      const v = input.parse(body);
      return json(await previewImport(owner, v.csv));
    }
    if (request.method === "POST" && route === "imports") {
      const v = input.parse(body);
      const result = await applyImport(owner, v.csv, v.filename);
      return json(result, result.duplicate ? 200 : 201);
    }
    if (request.method === "GET" && route === "products") {
      const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
      const term = "%" + query.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
      const results = await db.batch([
        db
          .prepare(
            "SELECT sku,name,quantity,price,updated_at FROM products WHERE owner=? AND (sku LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\') ORDER BY sku LIMIT 500",
          )
          .bind(owner, term, term),
        db
          .prepare(
            "SELECT COUNT(*) AS products,COALESCE(SUM(quantity),0) AS units,COALESCE(SUM(quantity*price),0) AS value FROM products WHERE owner=?",
          )
          .bind(owner),
      ]);
      return json({ products: results[0].results, summary: results[1].results[0] });
    }
    if (request.method === "GET" && route === "imports") {
      const result = await db
        .prepare(
          "SELECT id,filename,row_count,created_at FROM imports WHERE owner=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(owner)
        .all();
      return json({ imports: result.results });
    }
    if (request.method === "GET" && route === "export") {
      const result = await db
        .prepare(
          "SELECT sku,name,quantity,price FROM products WHERE owner=? ORDER BY sku LIMIT 500",
        )
        .bind(owner)
        .all<ValidProduct>();
      return new Response(exportProducts(result.results), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=estoque.csv",
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new InventoryError("Rota não encontrada.", 404);
  } catch (error) {
    if (error instanceof InventoryError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: "Confira o arquivo enviado." }, 400);
    if (error instanceof CsvError) return json({ error: error.message }, 400);
    console.error("Erro de estoque", error instanceof Error ? error.message : "desconhecido");
    return json({ error: "Não foi possível concluir a operação." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
