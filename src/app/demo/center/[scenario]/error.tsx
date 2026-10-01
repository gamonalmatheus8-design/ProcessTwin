"use client";
import Link from "next/link";
export default function DemoError({ reset }: { reset: () => void }) {
  return (
    <main className="fair-page">
      <h1>Não foi possível abrir a demonstração</h1>
      <p>Tente novamente ou escolha outro processo na central.</p>
      <div className="actions">
        <button className="button" onClick={reset} type="button">
          Tentar novamente
        </button>
        <Link className="button secondary" href="/demo/center">
          Voltar à central
        </Link>
      </div>
    </main>
  );
}
