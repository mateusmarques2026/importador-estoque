"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  ArrowUpRight,
  Check,
  AlertCircle,
  Search,
  Download,
  RotateCw,
  Package,
  History,
  UserRound,
  X,
} from "lucide-react";
import { SAMPLE_CSV, type CsvPreview } from "@/lib/csv";
type Product = { sku: string; name: string; quantity: number; price: number; updated_at: string };
type Batch = { id: string; filename: string; row_count: number; created_at: string };
type Preview = Omit<CsvPreview, "rows"> & {
  rows: (CsvPreview["rows"][number] & { action: string })[];
  newCount: number;
  updateCount: number;
  previous: { id: string; created_at: string } | null;
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);
const datetime = (v: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(v));
async function api<T>(route: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/" + route, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
  return data;
}
export default function Inventory({
  name,
  email,
  local,
}: {
  name: string;
  email: string;
  local: boolean;
}) {
  const [view, setView] = useState<"import" | "products" | "history">("import");
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("estoque.csv");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [imports, setImports] = useState<Batch[]>([]);
  const [summary, setSummary] = useState({ products: 0, units: 0, value: 0 });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const token = ++requestId.current;
    setLoading(true);
    try {
      const [stock, history] = await Promise.all([
        api<{ products: Product[]; summary: typeof summary }>(
          "products?q=" + encodeURIComponent(query),
        ),
        api<{ imports: Batch[] }>("imports"),
      ]);
      if (token === requestId.current) {
        setProducts(stock.products);
        setSummary(stock.summary);
        setImports(history.imports);
      }
    } catch (e) {
      if (token === requestId.current) setError((e as Error).message);
    } finally {
      if (token === requestId.current) setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [load]);
  function changeCsv(text: string, label = filename) {
    setCsv(text);
    setFilename(label);
    setPreview(null);
    setError("");
    setNotice("");
  }
  async function readFile(file: File) {
    if (file.size > 200_000) {
      setError("Use um arquivo CSV de até 200 KB.");
      return;
    }
    changeCsv(await file.text(), file.name);
  }
  async function validate() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Preview>("preview", "POST", { csv, filename });
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    setPending(true);
    setError("");
    try {
      const result = await api<{ duplicate: boolean; row_count: number }>("imports", "POST", {
        csv,
        filename,
      });
      setNotice(
        result.duplicate
          ? "Este conteúdo já foi importado. Nenhum produto foi duplicado."
          : result.row_count + " produtos importados. O estoque foi atualizado.",
      );
      setPreview(null);
      setCsv("");
      await load();
      setView("products");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const good = preview && !preview.invalidCount && !preview.previous;
  return (
    <>
      <header className="app-header">
        <a className="wordmark" href="/">
          LOTE<span>/</span>
        </a>
        <span className="header-caption">CONTROLE DE ESTOQUE</span>
        <details className="account">
          <summary>
            <UserRound size={16} />
            <span>{name}</span>
          </summary>
          <div>
            <strong>{name}</strong>
            <p>{email}</p>
            {local && <small>Conta fictícia · ambiente local</small>}
            <a href="/signout-with-chatgpt?return_to=/">Sair da conta</a>
          </div>
        </details>
      </header>
      <div className="shell">
        <nav aria-label="Menu principal">
          <button className={view === "import" ? "active" : ""} onClick={() => setView("import")}>
            <Upload size={17} />
            Importar CSV
          </button>
          <button
            className={view === "products" ? "active" : ""}
            onClick={() => setView("products")}
          >
            <Package size={17} />
            Produtos<span>{summary.products}</span>
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
            <History size={17} />
            Histórico
          </button>
        </nav>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">SEU ESTOQUE, CONFERIDO.</span>
              <h1>
                {view === "import"
                  ? "Importar produtos."
                  : view === "products"
                    ? "Seu estoque."
                    : "Histórico de lotes."}
              </h1>
              <p>
                {view === "import"
                  ? "Revise o arquivo antes de gravar. Cada SKU identifica um produto."
                  : view === "products"
                    ? "Quantidades e preços da última importação de cada produto."
                    : "Um registro para cada conteúdo importado, sem duplicações."}
              </p>
            </div>
            {view === "products" && (
              <a className="button secondary" href="/api/export">
                <Download size={16} />
                Exportar CSV
              </a>
            )}
            {view === "history" && (
              <button className="button secondary" onClick={() => void load()} disabled={loading}>
                <RotateCw size={15} />
                Atualizar
              </button>
            )}
          </div>
          <section className="metrics" aria-label="Resumo do estoque">
            <div>
              <span>Produtos cadastrados</span>
              <strong>{summary.products.toString().padStart(2, "0")}</strong>
            </div>
            <div>
              <span>Unidades em estoque</span>
              <strong>{summary.units}</strong>
            </div>
            <div>
              <span>Valor do estoque</span>
              <strong>{money(summary.value)}</strong>
            </div>
          </section>
          {error && (
            <div className="message error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dispensar erro">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dispensar confirmação">
                <X size={16} />
              </button>
            </div>
          )}
          {view === "import" ? (
            <div className="import-layout">
              <section className="import-main">
                <div className="section-heading">
                  <span>01</span>
                  <h2>Selecione seu arquivo</h2>
                  <small>CSV · até 200 KB · 200 produtos</small>
                </div>
                <div
                  className="drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) void readFile(e.dataTransfer.files[0]);
                  }}
                >
                  <FileSpreadsheet size={33} strokeWidth={1.4} />
                  <h3>Arraste sua planilha para cá.</h3>
                  <p>Ou escolha um arquivo no computador.</p>
                  <button
                    className="button primary"
                    disabled={pending}
                    onClick={() => input.current?.click()}
                  >
                    Escolher arquivo
                    <ArrowUpRight size={16} />
                  </button>
                  <input
                    ref={input}
                    type="file"
                    accept=".csv,text/csv"
                    aria-label="Selecionar arquivo CSV"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void readFile(e.target.files[0]);
                    }}
                  />
                </div>
                <div className="csv-editor">
                  <label htmlFor="csv-text">
                    Conteúdo do arquivo <span>{filename}</span>
                  </label>
                  <textarea
                    id="csv-text"
                    value={csv}
                    disabled={pending}
                    onChange={(e) => changeCsv(e.target.value)}
                    rows={7}
                    spellCheck={false}
                    placeholder={"sku;nome;quantidade;preco\nCAF-01;Café especial;10;29,90"}
                  />
                  <div>
                    <button
                      className="text-button"
                      disabled={pending}
                      onClick={() => changeCsv(SAMPLE_CSV, "exemplo-estoque.csv")}
                    >
                      Carregar exemplo
                    </button>
                    <button
                      className="text-button muted"
                      disabled={pending}
                      onClick={() =>
                        changeCsv(
                          "sku;nome;quantidade;preco\nCAF-01;Café especial;-2;29,90\nCAF-01;Café repetido;4;texto",
                          "exemplo-com-erros.csv",
                        )
                      }
                    >
                      Exemplo com erros
                    </button>
                  </div>
                </div>
                <button
                  className="button primary validate-button"
                  disabled={pending || !csv.trim()}
                  onClick={() => void validate()}
                >
                  {pending ? "Conferindo…" : "Conferir arquivo"}
                  <ArrowUpRight size={16} />
                </button>
                {preview && (
                  <section className="preview">
                    <div className="section-heading">
                      <span>02</span>
                      <h2>Confira o resultado</h2>
                    </div>
                    <div className="preview-summary">
                      <span>
                        <strong>{preview.validCount}</strong> válidos
                      </span>
                      <span className={preview.invalidCount ? "invalid" : ""}>
                        <strong>{preview.invalidCount}</strong> com erro
                      </span>
                      <span>
                        {preview.newCount} novos · {preview.updateCount} atualizações
                      </span>
                    </div>
                    {preview.previous && (
                      <div className="message neutral">
                        <Check size={17} />
                        <span>
                          Conteúdo já importado em {datetime(preview.previous.created_at)}.
                        </span>
                      </div>
                    )}
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>SKU / Produto</th>
                            <th>Qtd.</th>
                            <th>Preço</th>
                            <th>Validação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((r) => (
                            <tr key={r.line} className={r.errors.length ? "invalid-row" : ""}>
                              <td className="mono">{r.line}</td>
                              <td>
                                <strong>{r.sku || "Sem SKU"}</strong>
                                <small>{r.name || "Sem nome"}</small>
                              </td>
                              <td>{r.quantity ?? "—"}</td>
                              <td>{r.price === null ? "—" : money(r.price)}</td>
                              <td>
                                {r.errors.length ? (
                                  <ul>
                                    {r.errors.map((message) => (
                                      <li key={message}>{message}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="tag">
                                    {r.action === "create" ? "Novo" : "Atualizar"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="confirm-row">
                      <p>
                        {preview.invalidCount
                          ? "Corrija o conteúdo e confira novamente. Nada foi gravado."
                          : preview.previous
                            ? "Este conteúdo já está no histórico."
                            : "A confirmação grava o lote inteiro em uma única transação."}
                      </p>
                      <button
                        className="button primary"
                        disabled={!good || pending}
                        onClick={() => void confirm()}
                      >
                        {pending ? "Importando…" : "Confirmar importação"}
                        <Check size={16} />
                      </button>
                    </div>
                  </section>
                )}
              </section>
              <aside className="format-guide">
                <span className="eyebrow">FORMATO DO ARQUIVO</span>
                <h2>
                  Quatro colunas.
                  <br />
                  Um estoque certo.
                </h2>
                <dl>
                  <div>
                    <dt>sku</dt>
                    <dd>Código único do produto.</dd>
                  </div>
                  <div>
                    <dt>nome</dt>
                    <dd>Descrição com até 100 caracteres.</dd>
                  </div>
                  <div>
                    <dt>quantidade</dt>
                    <dd>Número inteiro, a partir de zero.</dd>
                  </div>
                  <div>
                    <dt>preco</dt>
                    <dd>Valor em reais. Ex.: 29,90.</dd>
                  </div>
                </dl>
                <p>
                  Aceita vírgula ou ponto e vírgula como separador, campos entre aspas e arquivos
                  UTF-8.
                </p>
                <div className="guide-note">
                  <strong>Já existe esse SKU?</strong>
                  <p>
                    O produto é atualizado. A quantidade representa o saldo final, não uma entrada
                    adicional.
                  </p>
                </div>
              </aside>
            </div>
          ) : view === "products" ? (
            <section className="products">
              <div className="table-toolbar">
                <h2>Produtos cadastrados</h2>
                <label>
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar SKU ou produto"
                    aria-label="Buscar SKU ou produto"
                  />
                </label>
              </div>
              {loading ? (
                <p className="empty">Carregando estoque…</p>
              ) : !products.length ? (
                <div className="empty">
                  <Package size={29} />
                  <h3>
                    {query ? "Nenhum produto encontrado." : "Seu estoque começa com uma planilha."}
                  </h3>
                  <button className="text-button" onClick={() => setView("import")}>
                    Importar produtos
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Preço unitário</th>
                        <th>Atualizado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.sku}>
                          <td className="mono">{p.sku}</td>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>{p.quantity}</td>
                          <td>{money(p.price)}</td>
                          <td className="subtle">{datetime(p.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <small className="table-footnote">
                Até 500 produtos por consulta. A exportação considera os primeiros 500 SKUs.
              </small>
            </section>
          ) : (
            <section>
              <div className="table-toolbar">
                <h2>Importações confirmadas</h2>
                <span>{imports.length} lotes recentes</span>
              </div>
              {!imports.length ? (
                <div className="empty">
                  <History size={29} />
                  <h3>Nenhum lote importado.</h3>
                  <p>Os arquivos confirmados aparecerão aqui.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Arquivo</th>
                        <th>Produtos</th>
                        <th>Data</th>
                        <th>Identificador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imports.map((batch) => (
                        <tr key={batch.id}>
                          <td>
                            <strong>{batch.filename}</strong>
                          </td>
                          <td>{batch.row_count}</td>
                          <td>{datetime(batch.created_at)}</td>
                          <td className="mono subtle">{batch.id.slice(0, 8)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          <footer>
            <span>LOTE / Importação de estoque</span>
            <span>{local ? "Ambiente local · conta de teste" : "Dados privados da sua conta"}</span>
          </footer>
        </main>
      </div>
    </>
  );
}
