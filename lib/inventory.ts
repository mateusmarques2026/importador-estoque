import { env } from "cloudflare:workers";
import { previewCsv, normalizedProducts, contentHash } from "./csv";
export class InventoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB) throw new InventoryError("Banco indisponível.", 503);
  return env.DB;
}
export async function previewImport(owner: string, csv: string) {
  const preview = previewCsv(csv);
  const db = database();
  const existing = await db
    .prepare("SELECT sku FROM products WHERE owner=?")
    .bind(owner)
    .all<{ sku: string }>();
  const skus = new Set(existing.results.map((r) => r.sku));
  const rows = preview.rows.map((r) => ({
    ...r,
    action: r.errors.length ? "invalid" : skus.has(r.sku) ? "update" : "create",
  }));
  const normalized = preview.invalidCount ? null : normalizedProducts(preview);
  const hash = normalized ? await contentHash(normalized) : null;
  const previous = hash
    ? await db
        .prepare("SELECT id,created_at FROM imports WHERE owner=? AND hash=?")
        .bind(owner, hash)
        .first()
    : null;
  return {
    ...preview,
    rows,
    previous,
    newCount: rows.filter((r) => r.action === "create").length,
    updateCount: rows.filter((r) => r.action === "update").length,
  };
}
export async function applyImport(owner: string, csv: string, filename: string) {
  const preview = previewCsv(csv);
  if (preview.invalidCount)
    throw new InventoryError("Corrija todas as linhas inválidas antes de confirmar.", 422);
  const rows = normalizedProducts(preview);
  const hash = await contentHash(rows);
  const db = database();
  const previous = await db
    .prepare("SELECT id,row_count FROM imports WHERE owner=? AND hash=?")
    .bind(owner, hash)
    .first();
  if (previous) return { ...previous, duplicate: true };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(
        "INSERT INTO imports (id,owner,hash,filename,row_count,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, owner, hash, filename, rows.length, now),
  ];
  for (let offset = 0; offset < rows.length; offset += 12) {
    const chunk = rows.slice(offset, offset + 12);
    const marks = chunk.map(() => "(?,?,?,?,?,?)").join(",");
    const values = chunk.flatMap((r) => [owner, r.sku, r.name, r.quantity, r.price, now]);
    statements.push(
      db
        .prepare(
          "INSERT INTO products (owner,sku,name,quantity,price,updated_at) VALUES " +
            marks +
            " ON CONFLICT(owner,sku) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,price=excluded.price,updated_at=excluded.updated_at",
        )
        .bind(...values),
    );
  }
  try {
    await db.batch(statements);
  } catch (error) {
    if (/UNIQUE constraint/i.test(String(error))) {
      const concurrent = await db
        .prepare("SELECT id,row_count FROM imports WHERE owner=? AND hash=?")
        .bind(owner, hash)
        .first();
      if (concurrent) return { ...concurrent, duplicate: true };
    }
    throw error;
  }
  return { id, row_count: rows.length, duplicate: false };
}
