export class CsvError extends Error {}
export const MAX_ROWS = 200;
export const MAX_CHARS = 200_000;
export type CsvRow = {
  line: number;
  sku: string;
  name: string;
  quantity: number | null;
  price: number | null;
  errors: string[];
};
export type ValidProduct = { sku: string; name: string; quantity: number; price: number };
export type CsvPreview = {
  rows: CsvRow[];
  validCount: number;
  invalidCount: number;
  delimiter: string;
};
export function parsePrice(raw: string): number | null {
  let value = raw
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!value) return null;
  if (value.includes(",")) {
    if (!/^\d+(,\d{1,2})?$/.test(value) && !/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value))
      return null;
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 10_000_000 ? cents : null;
}
function detectDelimiter(text: string) {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted) {
      if (c === "\n") break;
      if (c === ",") commas++;
      if (c === ";") semicolons++;
    }
  }
  return semicolons > commas ? ";" : ",";
}
function records(text: string, delimiter: string) {
  const result: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let start = 1;
  function finishCell() {
    cells.push(cell.trim());
    cell = "";
    closed = false;
  }
  function finishRecord() {
    finishCell();
    if (cells.some((c) => c !== "")) result.push({ cells, line: start });
    cells = [];
    start = line + 1;
    if (result.length > MAX_ROWS + 1) throw new CsvError("O limite é de 200 produtos por arquivo.");
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === "\n") line++;
      }
      continue;
    }
    if (c === delimiter) {
      finishCell();
      continue;
    }
    if (c === "\n") {
      finishRecord();
      line++;
      continue;
    }
    if (closed) {
      if (/\s/.test(c)) continue;
      throw new CsvError("Há conteúdo após o fechamento de aspas na linha " + line + ".");
    }
    if (c === '"') {
      if (cell.trim() !== "") throw new CsvError("Aspas inválidas na linha " + line + ".");
      cell = "";
      quoted = true;
    } else cell += c;
  }
  if (quoted) throw new CsvError("Há um campo com aspas não fechadas na linha " + start + ".");
  if (cell !== "" || cells.length || closed) finishRecord();
  return result;
}
function header(value: string) {
  const key = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<string, string> = {
    codigo: "sku",
    produto: "nome",
    descricao: "nome",
    qtd: "quantidade",
    estoque: "quantidade",
    valor: "preco",
  };
  return aliases[key] ?? key;
}
export function previewCsv(raw: string): CsvPreview {
  if (raw.length > MAX_CHARS) throw new CsvError("O arquivo é grande demais. Use até 200 KB.");
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!text.trim()) throw new CsvError("O arquivo está vazio.");
  const delimiter = detectDelimiter(text);
  const parsed = records(text, delimiter);
  if (parsed.length < 2) throw new CsvError("Inclua o cabeçalho e pelo menos um produto.");
  const keys = parsed[0].cells.map(header);
  const expected = ["sku", "nome", "quantidade", "preco"];
  if (keys.length !== 4 || new Set(keys).size !== 4 || !expected.every((k) => keys.includes(k)))
    throw new CsvError(
      "Use exatamente as colunas sku, nome, quantidade e preco. A ordem pode variar.",
    );
  const rows: CsvRow[] = parsed.slice(1).map((record) => {
    const get = (key: string) => (record.cells[keys.indexOf(key)] ?? "").trim();
    const sku = get("sku").toUpperCase();
    const name = get("nome");
    const quantityRaw = get("quantidade");
    const quantity = /^\d+$/.test(quantityRaw) ? Number(quantityRaw) : null;
    const price = parsePrice(get("preco"));
    const errors: string[] = [];
    if (record.cells.length !== 4) errors.push("Quantidade de colunas diferente do cabeçalho.");
    if (!/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(sku))
      errors.push("SKU: use de 2 a 32 letras, números, ponto, hífen ou sublinhado.");
    if (name.length < 2 || name.length > 100) errors.push("Nome: informe de 2 a 100 caracteres.");
    if (
      quantity === null ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 1_000_000
    )
      errors.push("Quantidade: informe um inteiro entre 0 e 1.000.000.");
    if (price === null)
      errors.push("Preço: use um valor de 0 a 100.000 reais, com até duas casas decimais.");
    return { line: record.line, sku, name, quantity, price, errors };
  });
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.sku, (counts.get(row.sku) ?? 0) + 1);
  for (const row of rows)
    if ((counts.get(row.sku) ?? 0) > 1) row.errors.push("SKU repetido no mesmo arquivo.");
  const invalidCount = rows.filter((r) => r.errors.length > 0).length;
  return { rows, validCount: rows.length - invalidCount, invalidCount, delimiter };
}
export function normalizedProducts(preview: CsvPreview): ValidProduct[] {
  if (preview.invalidCount) throw new CsvError("Corrija as linhas inválidas antes de importar.");
  return preview.rows
    .map((r) => ({ sku: r.sku, name: r.name, quantity: r.quantity!, price: r.price! }))
    .sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}
export async function contentHash(rows: ValidProduct[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function safeCell(value: string) {
  let text = value;
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function exportProducts(rows: ValidProduct[]) {
  return (
    "\uFEFFsku;nome;quantidade;preco\r\n" +
    rows
      .map((r) =>
        [
          safeCell(r.sku),
          safeCell(r.name),
          String(r.quantity),
          String(r.price / 100).replace(".", ","),
        ].join(";"),
      )
      .join("\r\n")
  );
}
export const SAMPLE_CSV =
  "sku;nome;quantidade;preco\nCAF-01;Café especial 250g;18;29,90\nFIL-02;Filtro de papel;40;8,50\nCAN-03;Caneca cerâmica;12;34,90";
