import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewCsv,
  normalizedProducts,
  contentHash,
  parsePrice,
  exportProducts,
  SAMPLE_CSV,
} from "../lib/csv.ts";
test("lê CSV brasileiro e guarda preço em centavos", () => {
  const p = previewCsv(SAMPLE_CSV);
  assert.equal(p.validCount, 3);
  assert.equal(p.rows[0].price, 2990);
  assert.equal(p.delimiter, ";");
});
test("aceita BOM, CRLF, ordem de colunas e aliases", () => {
  const p = previewCsv("\uFEFFpreço;produto;qtd;codigo\r\n19,90;Café;2;ab-1\r\n");
  assert.equal(p.rows[0].sku, "AB-1");
  assert.equal(p.rows[0].price, 1990);
});
test("campos entre aspas, separador dentro do nome e aspas escapadas", () => {
  const p = previewCsv('sku,nome,quantidade,preco\nAB-1,"Café, tipo ""A""",2,19.90');
  assert.equal(p.rows[0].name, 'Café, tipo "A"');
});
test("aceita nome multilinha e preserva numeração física", () => {
  const p = previewCsv('sku;nome;quantidade;preco\nA1;"Café\nespecial";2;10\nB1;Filtro;1;2');
  assert.equal(p.rows[1].line, 4);
});
test("SKU repetido invalida todas as ocorrências", () => {
  const p = previewCsv("sku;nome;quantidade;preco\nA1;Café;1;10\na1;Filtro;2;5");
  assert.equal(p.invalidCount, 2);
});
test("relata quantidade negativa e preço inválido", () => {
  const p = previewCsv("sku;nome;quantidade;preco\nA1;Café;-1;texto");
  assert.equal(p.invalidCount, 1);
  assert.equal(p.rows[0].errors.length, 2);
});
test("rejeita arquivo vazio, cabeçalhos ambíguos e aspas abertas", () => {
  assert.throws(() => previewCsv(""));
  assert.throws(() => previewCsv("sku;nome;nome;preco\nA1;AA;1;2"));
  assert.throws(() => previewCsv('sku;nome;quantidade;preco\nA1;"ab;1;2'));
});
test("normaliza preços sem usar ponto flutuante no banco", () => {
  assert.equal(parsePrice("1.299,90"), 129990);
  assert.equal(parsePrice("19.9"), 1990);
  assert.equal(parsePrice("0"), 0);
  assert.equal(parsePrice("-1"), null);
  assert.equal(parsePrice("1e3"), null);
  assert.equal(parsePrice("2,999"), null);
});
test("mesmo conteúdo normalizado gera o mesmo hash", async () => {
  const a = normalizedProducts(
    previewCsv("sku;nome;quantidade;preco\nA1;Café;2;19,90\nB1;Filtro;3;5"),
  );
  const b = normalizedProducts(
    previewCsv("nome,sku,preco,quantidade\nFiltro,B1,5.00,3\nCafé,A1,19.90,2"),
  );
  assert.equal(await contentHash(a), await contentHash(b));
});
test("bloqueia arquivos acima de 200 produtos", () => {
  assert.throws(() =>
    previewCsv(
      "sku;nome;quantidade;preco\n" +
        Array.from({ length: 201 }, (_, i) => "A" + i + ";Produto;1;1").join("\n"),
    ),
  );
});
test("neutraliza fórmulas na exportação para planilhas", () => {
  const result = exportProducts([{ sku: "A1", name: '=HYPERLINK("x")', quantity: 1, price: 100 }]);
  assert.ok(result.includes("'=HYPERLINK"));
});
