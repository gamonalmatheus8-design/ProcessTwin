import type { Metadata } from "next";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/premium.css";
import "../styles/light-theme.css";
import "../styles/enterprise.css";

export const metadata: Metadata = {
  title: "ProcessTwin",
  description: "Análise operacional de processos baseada em eventos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
