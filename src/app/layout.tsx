import type { Metadata } from "next";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/premium.css";
import "../styles/operations-dark.css";
import "../styles/crm.css";

export const metadata: Metadata = {
  title: "ProcessTwin",
  description: "Gêmeo digital de processos para análise operacional baseada em eventos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
