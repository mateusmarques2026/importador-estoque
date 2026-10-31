import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
export const products = sqliteTable(
  "products",
  {
    owner: text("owner").notNull(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.sku] })],
);
export const imports = sqliteTable(
  "imports",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    hash: text("hash").notNull(),
    filename: text("filename").notNull(),
    rowCount: integer("row_count").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("imports_owner_hash_unique").on(t.owner, t.hash)],
);
