import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import Inventory from "./inventory";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  const local = env.LOCAL_PREVIEW === "1";
  if (!user)
    return (
      <main className="entry">
        <span className="wordmark">
          LOTE<span>/</span>
        </span>
        <p className="eyebrow">IMPORTAÇÃO DE ESTOQUE</p>
        <h1>
          Da planilha
          <br />
          para o estoque.
        </h1>
        <p>Confira os produtos, corrija as linhas com erro e importe com segurança.</p>
        <a className="button primary" href={chatGPTSignInPath("/")} target="_top">
          {local ? "Entrar com conta de teste" : "Entrar com ChatGPT"} →
        </a>
        {local && (
          <small>Ambiente local: será usada uma conta fictícia. Nenhuma senha é solicitada.</small>
        )}
      </main>
    );
  return <Inventory name={user.fullName ?? user.email} email={user.email} local={local} />;
}
