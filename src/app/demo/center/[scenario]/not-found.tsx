import Link from "next/link";
export default function DemoNotFound() {
  return (
    <main className="fair-page">
      <h1>Demonstração não encontrada</h1>
      <p>Escolha matrículas, mensalidades ou chamados empresariais.</p>
      <Link className="button" href="/demo/center">
        Voltar à central
      </Link>
    </main>
  );
}
