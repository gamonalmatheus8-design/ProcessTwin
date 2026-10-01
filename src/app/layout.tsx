import type { Metadata } from "next";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/premium.css";
import "../styles/light-theme.css";

export const metadata: Metadata = {
  title: "ProcessTwin AI",
  description: "Operational intelligence for business processes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
