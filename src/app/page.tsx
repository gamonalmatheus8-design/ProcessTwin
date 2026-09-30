import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="card">
        <span className="eyebrow">ProcessTwin AI</span>
        <h1>Digital Twin de Processos</h1>
        <p>
          Conecte dados operacionais, reconstrua processos reais, encontre
          gargalos e simule melhorias antes de mudar a operação.
        </p>
        <div className="actions home-actions">
          <Link className="button" href="/auth?mode=signup">
            Criar conta
          </Link>
          <Link className="button secondary" href="/auth">
            Entrar
          </Link>
          <Link className="button secondary" href="/demo">
            Ver demonstração
          </Link>
        </div>
      </section>
    </main>
  );
}
