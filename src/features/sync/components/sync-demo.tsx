"use client";

import Link from "next/link";
import { useState } from "react";
import type { CoreCycleResult } from "@/core/process/types";
import { ProcessExplorer } from "@/features/process-explorer/process-explorer";
import type { DemoEvent } from "../demo-merge";
import type { SyncResponse } from "../types";
import { SyncResult } from "./sync-result";

export function SyncDemo() {
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [analysis, setAnalysis] = useState<CoreCycleResult | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysisCount, setAnalysisCount] = useState(0);
  async function sync(file: number) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/demo-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, events }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEvents(data.events);
      if (data.analysis) { setAnalysis(data.analysis); setAnalysisCount((count) => count + 1); }
      setResult({ connectorId: "demo", datasetId: "demo-live", analysisExecuted: Boolean(data.analysis), message: data.accepted + data.updated ? "Sincronização concluída." : "Nenhuma mudança detectada.", run: {
        id: "demo-run", connector_id: "demo", dataset_id: "demo-live", filename: `orders-sync-0${file}.csv`, status: "succeeded", started_at: null, completed_at: null,
        fetched_count: data.fetched, accepted_count: data.accepted, updated_count: data.updated, duplicate_count: data.duplicate, invalid_count: data.invalid,
        analysis_status: data.analysis ? "succeeded" : "skipped", analysis_run_id: null, error_message: null,
      } });
    } catch { setError("Não foi possível executar a demonstração. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <main className="app-shell result-stack"><header className="page-header"><div><span className="eyebrow">Demonstração · V1.5A.2</span><h1>Seu processo, sempre atualizado</h1><p>Mesmo evento, uma só linha. Novos eventos são incorporados; correções atualizam o evento existente.</p></div><Link className="button secondary" href="/demo/intake">Universal Intake</Link></header>
    <section className="panel"><h2>CSV recorrente</h2><p>Dados fictícios de pedidos. A demonstração mantém o dataset apenas nesta página, sem persistência no Supabase.</p><p>Identidade: ID único <strong>event_id</strong> · Mapping: pedido_id, etapa, data_evento, responsavel.</p><div className="actions"><button className="button" disabled={busy} onClick={() => void sync(1)}>1. Sincronizar orders-sync-01.csv</button><button className="button" disabled={busy || !events.length} onClick={() => void sync(2)}>2. Sincronizar orders-sync-02.csv</button><button className="button secondary" disabled={busy} onClick={() => { setEvents([]); setAnalysis(null); setResult(null); setAnalysisCount(0); }}>Reiniciar</button></div><p>Primeiro arquivo: 100 novos. Segundo: 123 recebidos, 20 novos, 3 atualizados e 100 duplicados. Total final: <strong>120 eventos</strong>.</p><div className="actions"><a className="text-link" href="/examples/sync/orders-sync-01.csv" download>Baixar CSV 1</a><a className="text-link" href="/examples/sync/orders-sync-02.csv" download>Baixar CSV 2</a></div></section>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {result && <><SyncResult result={result} explorerHref="#live-explorer" /><section className="panel"><h2>Live Dataset: {events.length} eventos</h2><p>{analysisCount} análises executadas. Reenvie o segundo arquivo para verificar que todos os 123 registros são duplicados e nenhuma nova análise é criada.</p></section></>}
    {analysis && <section id="live-explorer"><ProcessExplorer key={analysisCount} data={{ process: { id: "demo", name: "Pedidos · Live Dataset", status: "active" }, dataset: { id: "demo-live", name: "Live Dataset", originalFilename: null, createdAt: "2026-09-30T12:00:00Z" }, analysis: { id: "demo-analysis", createdAt: "2026-09-30T12:00:00Z", completedAt: "2026-09-30T12:00:00Z" }, model: analysis.model, bottlenecks: analysis.bottleneck ? [analysis.bottleneck] : [] }} simulationHrefBase="/demo/simulation" /></section>}
  </main>;
}
