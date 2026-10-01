import Link from "next/link";

const bars = [
  ["Triagem", 38],
  ["Validação", 62],
  ["Análise", 51],
  ["Aprovação", 78],
  ["Correção", 92],
  ["Revisão", 57],
  ["Concluído", 34],
] as const;

export default function Home() {
  return (
    <main className="pt-home">
      <nav className="pt-home-nav" aria-label="Navegação pública">
        <Link className="pt-home-wordmark" href="/">ProcessTwin</Link>
        <div className="pt-home-nav-actions">
          <Link className="pt-home-nav-link" href="/demo/center">Demonstrações</Link>
          <Link className="pt-home-nav-link" href="/pilot">Piloto</Link>
          <Link className="button secondary" href="/auth">Entrar</Link>
          <Link className="button" href="/auth?mode=signup">Criar conta</Link>
        </div>
      </nav>

      <section className="pt-home-hero">
        <div className="pt-home-copy">
          <span className="pt-section-label">Process intelligence · Digital twin</span>
          <h1>Veja como o processo realmente acontece.</h1>
          <p>
            Conecte dados operacionais, reconstrua o fluxo real, identifique gargalos
            e compare cenários de melhoria antes de alterar a operação.
          </p>
          <div className="actions">
            <Link className="button" href="/auth?mode=signup">Criar workspace</Link>
            <Link className="button secondary" href="/demo/center">Explorar demonstrações</Link>
          </div>
          <div className="pt-home-proof" aria-label="Capacidades da plataforma">
            <span><i aria-hidden="true" /> Process Mining determinístico</span>
            <span><i aria-hidden="true" /> Dataset vivo</span>
            <span><i aria-hidden="true" /> Simulação explicável</span>
          </div>
        </div>

        <section className="pt-dashboard-preview" aria-label="Preview sintético do workspace ProcessTwin">
          <header className="pt-dashboard-preview-head">
            <div>
              <span>PROCESS OVERVIEW</span>
              <strong>Atendimento de Chamados</strong>
            </div>
            <span className="pt-dashboard-preview-status"><i aria-hidden="true" /> Preview sintético</span>
          </header>

          <div className="pt-dashboard-preview-kpis">
            <div><span>Cases</span><strong>1.284</strong></div>
            <div><span>Eventos</span><strong>8.921</strong></div>
            <div><span>Ciclo médio</span><strong>4h 32m</strong></div>
            <div><span>Retrabalho</span><strong>12,4%</strong></div>
          </div>

          <div className="pt-dashboard-preview-body">
            <div className="pt-dashboard-preview-chart">
              <header>
                <strong>Volume por atividade</strong>
                <span>Event log</span>
              </header>
              <div className="pt-preview-bars" aria-label="Distribuição sintética de eventos">
                {bars.map(([label, height]) => (
                  <div key={label}>
                    <i style={{ height: `${height}%` }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="pt-dashboard-preview-side">
              <header>
                <strong>Operational signals</strong>
                <span>Agora</span>
              </header>
              <div className="pt-preview-alert">
                <span>Gargalo principal</span>
                <strong>Correção</strong>
                <small>Maior intervalo observado no fluxo atual, com recorrência em múltiplos cases.</small>
              </div>
              <div className="pt-preview-activity">
                <div><span>Process health</span><strong>Attention</strong></div>
                <div><span>Variantes</span><strong>17</strong></div>
                <div><span>Última análise</span><strong>Agora</strong></div>
                <div><span>Fonte</span><strong>Live dataset</strong></div>
              </div>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}
