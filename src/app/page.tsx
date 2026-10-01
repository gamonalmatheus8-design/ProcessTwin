import Link from "next/link";

export default function Home() {
  return (
    <main className="pt-home">
      <nav className="pt-home-nav" aria-label="Navegação pública">
        <Link className="pt-home-brand" href="/">
          <span className="pt-brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <strong>ProcessTwin AI</strong>
        </Link>
        <div className="pt-home-nav-actions">
          <Link className="button secondary" href="/demo/center">Ver produto</Link>
          <Link className="button secondary" href="/auth">Entrar</Link>
          <Link className="button" href="/auth?mode=signup">Criar workspace</Link>
        </div>
      </nav>

      <section className="pt-home-hero">
        <div className="pt-home-copy">
          <span className="eyebrow">Operational intelligence for real processes</span>
          <h1>Veja sua operação como ela realmente acontece.</h1>
          <p>
            Conecte dados operacionais, reconstrua fluxos reais, encontre gargalos
            e teste melhorias antes de mudar a operação.
          </p>
          <div className="actions">
            <Link className="button" href="/auth?mode=signup">Começar análise</Link>
            <Link className="button secondary" href="/demo/center">Explorar demonstração</Link>
          </div>
          <div className="pt-proof-line" aria-label="Principais capacidades">
            <span><i /> Process mining</span>
            <span><i /> Live datasets</span>
            <span><i /> Simulation lab</span>
          </div>
        </div>

        <div className="pt-product-frame" aria-label="Prévia do Process Explorer">
          <div className="pt-product-toolbar">
            <span>Order to Cash / Process Explorer</span>
            <span>Live dataset · atualizado agora</span>
          </div>
          <div className="pt-product-canvas">
            <span className="pt-product-line a" />
            <span className="pt-product-line b" />
            <span className="pt-product-line c" />
            <div className="pt-product-node one"><strong>Pedido recebido</strong><small>12.8k cases · 4 min</small></div>
            <div className="pt-product-node two"><strong>Validar pedido</strong><small>12.4k cases · 1.4h</small></div>
            <div className="pt-product-node three"><strong>Aprovar pagamento</strong><small>10.9k cases · 8.7h</small></div>
            <div className="pt-product-node four"><strong>Expedir</strong><small>10.2k cases · 2.1h</small></div>
            <div className="pt-product-insight">
              <span>Critical bottleneck</span>
              <strong>Aprovar pagamento</strong>
              <small>32% dos cases afetados · intervalo médio 8.7h</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
