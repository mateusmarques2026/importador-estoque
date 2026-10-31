import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Lote — Importador de estoque",
  description: "Importe produtos por CSV com validação, prévia e proteção contra duplicidade.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
