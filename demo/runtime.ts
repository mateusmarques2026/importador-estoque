/** Adaptador exclusivo da demonstração estática. Não participa do servidor de produção. */
export class DemoError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function createStore<T>(key: string, seed: () => T) {
  let memory = seed();
  function get(): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* O aviso da demonstração explica que os dados ficam neste navegador. */
    }
    return structuredClone(memory);
  }
  function save(value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      throw new DemoError("Não foi possível salvar neste navegador. Libere o armazenamento local.");
    }
    memory = structuredClone(value);
  }
  function reset() {
    const value = seed();
    save(value);
  }
  return { get, save, reset };
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status });
}
export async function input(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new DemoError("Dados inválidos.");
  }
}
export function text(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max)
    throw new DemoError("Confira o campo " + label + ".");
  return value.trim();
}
export function installDemoApi(handler: (request: Request) => Promise<Response> | Response) {
  const original = window.fetch.bind(window);
  window.fetch = async (resource, options) => {
    const url = new URL(
      resource instanceof Request ? resource.url : String(resource),
      location.href,
    );
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/"))
      return original(resource, options);
    try {
      return await handler(
        resource instanceof Request ? new Request(resource, options) : new Request(url, options),
      );
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Não foi possível concluir." },
        error instanceof DemoError ? error.status : 400,
      );
    }
  };
}
export function handleLinks(navigate: (path: string) => void) {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (
      !target ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      target.target === "_blank"
    )
      return;
    const url = new URL(target.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === "/api/export") {
      event.preventDefault();
      void fetch(url)
        .then(async (response) => {
          if (!response.ok) throw new Error("Não foi possível exportar.");
          const href = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = href;
          link.download = "estoque-demo.csv";
          link.click();
          setTimeout(() => URL.revokeObjectURL(href), 1000);
        })
        .catch((error) => alert(error.message));
    } else if (
      [
        "/",
        "/cliente",
        "/admin",
        "/entrar",
        "/signout-with-chatgpt",
        "/signin-with-chatgpt",
      ].includes(url.pathname)
    ) {
      event.preventDefault();
      navigate(url.pathname);
    }
  });
}
