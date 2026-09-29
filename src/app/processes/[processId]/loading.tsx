export default function ProcessLoading() {
  return (
    <main className="app-shell">
      <section className="panel explorer-loading" aria-busy="true">
        <span className="eyebrow">ProcessTwin AI</span>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-graph" />
      </section>
    </main>
  );
}
