import Link from "next/link";

export default function Home() {
  return (
    <main className="pt-home pt-home-enterprise">
      <nav className="pt-home-nav" aria-label="Navegação pública">
        <Link className="pt-home-wordmark" href="/">ProcessTwin</Link>
        <div className="pt-home-nav-actions">
          <Link className="pt-home-nav-link" href="/demo/center">Produto</Link>
          <Link className="pt-home-nav-link" href="/pilot">Piloto</Link>
          <Link className="button secondary" href="/auth">Entrar</Link>
          <Link className="button" href="/auth?mode=signup">Criar conta</Link>
        </div>
      </nav>

      <section className="pt-enterprise-hero">
        <div className="pt-enterprise-copy">
          <span className="pt-section-label">Análise de processos baseada em eventos</span>
          <h1>Reconstrua o processo real a partir dos dados da operação.</h1>
          <p>
            O ProcessTwin transforma registros operacionais em fluxo, tempos,
            retrabalho, gargalos e cenários de melhoria para apoiar decisões de processo.
          </p>
          <div className="actions">
            <Link className="button" href="/auth?mode=signup">Criar workspace</Link>
            <Link className="button secondary" href="/demo/center">Ver demonstração</Link>
          </div>
        </div>

        <section className="pt-operations-preview" aria-label="Exemplo de visão operacional">
          <header>
            <div>
              <span>Pedidos</span>
              <strong>Visão geral do processo</strong>
            </div>
            <small>Dados de demonstração</small>
          </header>
          <div className="pt-preview-stats">
            <div><span>Cases</span><strong>12.842</strong></div>
            <div><span>Ciclo médio</span><strong>18h 24min</strong></div>
            <div><span>Retrabalho</span><strong>8,2%</strong></div>
            <div><span>Eventos</span><strong>67.419</strong></div>
          </div>
          <div className="pt-preview-section">
            <div className="pt-preview-section-head">
              <strong>Etapas com maior intervalo</strong>
              <span>Intervalo médio</span>
            </div>
            <div className="pt-preview-row"><span>Aprovar pagamento</span><strong>8h 42min</strong></div>
            <div className="pt-preview-row"><span>Validar pedido</span><strong>3h 18min</strong></div>
            <div className="pt-preview-row"><span>Separar expedição</span><strong>2h 07min</strong></div>
          </div>
          <div className="pt-preview-footer">
            <span>Última análise</span>
            <strong>Hoje, 14:32</strong>
          </div>
        </section>
      </section>
    </main>
  );
}
