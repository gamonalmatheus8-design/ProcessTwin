import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcessTwin AI",
  description: "Digital twins for business processes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
