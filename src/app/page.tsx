import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="card">
        <span className="eyebrow">ProcessTwin AI</span>
        <h1>Digital Twin de Processos</h1>
        <p>
          Envie um event log real e transforme dados operacionais em processo reconstruído,
          gargalo, melhoria simulada e impacto mensurável.
        </p>
        <div className="actions"><Link className="button" href="/processes/new">Importar CSV</Link><Link className="button secondary" href="/demo">Ver demonstração</Link></div>
      </section>
    </main>
  );
}
