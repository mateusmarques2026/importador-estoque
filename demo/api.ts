import { contentHash, exportProducts, normalizedProducts, previewCsv } from "@/lib/csv";
import { createStore, DemoError, input, json, text } from "./runtime";
type Product = { sku: string; name: string; quantity: number; price: number; updated_at: string };
type Batch = { id: string; filename: string; hash: string; row_count: number; created_at: string };
export const store = createStore<{ products: Product[]; imports: Batch[] }>(
  "lote-pages-v1",
  () => ({ products: [], imports: [] }),
);
export async function handle(request: Request) {
  const url = new URL(request.url),
    route = url.pathname.slice(5),
    state = store.get();
  if (request.method === "GET" && route === "products") {
    const q = (url.searchParams.get("q") ?? "").toLocaleLowerCase("pt-BR");
    return json({
      products: state.products
        .filter((p) => (p.sku + " " + p.name).toLocaleLowerCase("pt-BR").includes(q))
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .slice(0, 500),
      summary: {
        products: state.products.length,
        units: state.products.reduce((n, p) => n + p.quantity, 0),
        value: state.products.reduce((n, p) => n + p.quantity * p.price, 0),
      },
    });
  }
  if (request.method === "GET" && route === "imports")
    return json({ imports: [...state.imports].reverse().slice(0, 50) });
  if (request.method === "GET" && route === "export")
    return new Response(
      exportProducts([...state.products].sort((a, b) => a.sku.localeCompare(b.sku)).slice(0, 500)),
      { headers: { "Content-Type": "text/csv;charset=utf-8" } },
    );
  if (request.method === "POST" && ["preview", "imports"].includes(route)) {
    const body = await input(request),
      csv = text(body.csv, 1, 200000, "arquivo"),
      preview = previewCsv(csv);
    const products = preview.invalidCount ? [] : normalizedProducts(preview);
    const hash = preview.invalidCount ? null : await contentHash(products);
    // Releitura após o hash assíncrono evita perder outra gravação nesta página.
    const current = store.get(),
      previous = current.imports.find((i) => i.hash === hash) ?? null;
    if (route === "preview") {
      const skus = new Set(current.products.map((p) => p.sku));
      const rows = preview.rows.map((r) => ({
        ...r,
        action: r.errors.length ? "invalid" : skus.has(r.sku) ? "update" : "create",
      }));
      return json({
        ...preview,
        rows,
        previous,
        newCount: rows.filter((r) => r.action === "create").length,
        updateCount: rows.filter((r) => r.action === "update").length,
      });
    }
    if (preview.invalidCount)
      throw new DemoError("Corrija todas as linhas inválidas antes de confirmar.", 422);
    if (previous) return json({ ...previous, duplicate: true });
    const now = new Date().toISOString(),
      id = crypto.randomUUID();
    const next = new Map(current.products.map((p) => [p.sku, p]));
    for (const product of products) next.set(product.sku, { ...product, updated_at: now });
    current.products = [...next.values()];
    current.imports.push({
      id,
      filename: text(body.filename ?? "estoque.csv", 1, 120, "nome do arquivo"),
      hash: hash!,
      row_count: products.length,
      created_at: now,
    });
    store.save(current);
    return json({ id, row_count: products.length, duplicate: false }, 201);
  }
  throw new DemoError("Página de demonstração não encontrada.", 404);
}
