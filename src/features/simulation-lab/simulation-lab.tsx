"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { SimulationResult } from "@/core/process/types";
import {
  AGGRESSIVE_NOTICE,
  MODEL_NOTICE,
  buildOpportunityCard,
  effectiveFactor,
  formatDuration,
  formatPercentagePoints,
  formatPercent,
  isAggressiveScenario,
} from "./helpers";
import type {
  SimulationExecution,
  SimulationHistoryItem,
  SimulationLabData,
  SimulationPayload,
} from "./types";

function ComparisonBar({ baseline, simulated }: { baseline: number; simulated: number }) {
  const max = Math.max(baseline, simulated, 1);
  return (
    <div className="comparison-bars" aria-label="Comparação visual entre atual e simulado">
      <div><span>Atual</span><i style={{ width: `${(baseline / max) * 100}%` }} /></div>
      <div><span>Simulado</span><i className="simulated" style={{ width: `${(simulated / max) * 100}%` }} /></div>
    </div>
  );
}

function ResultPanel({ payload, result }: { payload: SimulationPayload; result: SimulationResult }) {
  return (
    <section className="simulation-result" aria-live="polite">
      <div className="simulation-section-heading">
        <div>
          <span className="eyebrow">Atual × Simulado</span>
          <h2>Impacto estimado</h2>
        </div>
        <span className="sla-chip">SLA usado: {formatDuration(result.impactSummary.slaThresholdSeconds)}</span>
      </div>

      <div className="simulation-kpis">
        <article>
          <span>Ciclo médio</span>
          <dl><div><dt>Atual</dt><dd>{formatDuration(result.baseline.avgCycleSeconds)}</dd></div><div><dt>Simulado</dt><dd>{formatDuration(result.simulated.avgCycleSeconds)}</dd></div></dl>
          <strong>{formatPercent(result.deltas.avgCyclePct, true)}</strong>
          <ComparisonBar baseline={result.baseline.avgCycleSeconds} simulated={result.simulated.avgCycleSeconds} />
        </article>
        <article>
          <span>P95</span>
          <dl><div><dt>Atual</dt><dd>{formatDuration(result.baseline.p95CycleSeconds)}</dd></div><div><dt>Simulado</dt><dd>{formatDuration(result.simulated.p95CycleSeconds)}</dd></div></dl>
          <strong>{formatPercent(result.deltas.p95CyclePct, true)}</strong>
          <ComparisonBar baseline={result.baseline.p95CycleSeconds} simulated={result.simulated.p95CycleSeconds} />
        </article>
        <article>
          <span>SLA</span>
          <dl><div><dt>Atual</dt><dd>{formatPercent(result.baseline.slaCompliancePct)}</dd></div><div><dt>Simulado</dt><dd>{formatPercent(result.simulated.slaCompliancePct)}</dd></div></dl>
          <strong>{formatPercentagePoints(result.deltas.slaPercentagePoints)}</strong>
          <ComparisonBar baseline={result.baseline.slaCompliancePct} simulated={result.simulated.slaCompliancePct} />
        </article>
      </div>

      <div className="impact-strip">
        <div><span>Throughput potencial</span><strong>{formatPercent(result.deltas.throughputGainPct, true)}</strong></div>
        <div><span>Tempo economizado / case</span><strong>{formatDuration(result.impactSummary.secondsSavedPerCase)}</strong></div>
        <div><span>Horas economizadas / 100 cases</span><strong>{result.impactSummary.hoursSavedPer100Cases.toFixed(1)}h</strong></div>
      </div>

      <article className={result.impactSummary.secondsSavedPerCase > 0 ? "opportunity-card" : "neutral-box"}>
        <span className="eyebrow">Oportunidade</span>
        <p>{buildOpportunityCard(payload, result)}</p>
      </article>
    </section>
  );
}

export function SimulationLab({
  data,
  executionUrl,
  demo = false,
}: {
  data: SimulationLabData;
  executionUrl: string;
  demo?: boolean;
}) {
  const initialIsBottleneck = data.primaryBottleneck?.activity === data.initialActivity;
  const [activity, setActivity] = useState(data.initialActivity);
  const [waitReductionPct, setWaitReductionPct] = useState(initialIsBottleneck ? 30 : 0);
  const [capacityMultiplier, setCapacityMultiplier] = useState(1);
  const [slaMode, setSlaMode] = useState<"automatic" | "manual">("automatic");
  const [slaHours, setSlaHours] = useState(8);
  const [slaMinutes, setSlaMinutes] = useState(0);
  const [name, setName] = useState(`Melhoria em ${data.initialActivity}`);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resultPayload, setResultPayload] = useState<SimulationPayload | null>(null);
  const [history, setHistory] = useState(data.history);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => data.activities.find((node) => node.activity === activity) ?? data.activities[0],
    [activity, data.activities],
  );
  const aggressive = isAggressiveScenario(waitReductionPct, capacityMultiplier);

  function loadHistoryItem(item: SimulationHistoryItem, duplicate = false) {
    setActivity(item.activity);
    setWaitReductionPct(item.waitReductionPct);
    setCapacityMultiplier(item.capacityMultiplier);
    setSlaMode(item.slaThresholdSeconds === undefined ? "automatic" : "manual");
    if (item.slaThresholdSeconds !== undefined) {
      setSlaHours(Math.floor(item.slaThresholdSeconds / 3600));
      setSlaMinutes(Math.floor((item.slaThresholdSeconds % 3600) / 60));
    }
    setName(duplicate ? `Cópia de ${item.name}` : item.name);
    setDescription(item.description ?? "");
    setError(null);
    if (duplicate) {
      setResult(null);
      setResultPayload(null);
      setSelectedScenarioId(null);
    } else {
      setResult(item.result);
      setResultPayload({
        name: item.name,
        description: item.description ?? undefined,
        activity: item.activity,
        waitReductionPct: item.waitReductionPct,
        capacityMultiplier: item.capacityMultiplier,
        ...(item.slaThresholdSeconds === undefined
          ? {}
          : { slaThresholdSeconds: item.slaThresholdSeconds }),
      });
      setSelectedScenarioId(item.scenarioId);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const payload: SimulationPayload = {
      name,
      description: description || undefined,
      activity,
      waitReductionPct,
      capacityMultiplier,
      ...(slaMode === "manual"
        ? { slaThresholdSeconds: slaHours * 3600 + slaMinutes * 60 }
        : {}),
    };
    setIsPending(true);
    try {
      const response = await fetch(executionUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as SimulationExecution | { error?: string };
      if (!response.ok || !("result" in body)) {
        throw new Error("error" in body && body.error ? body.error : "Falha ao simular o cenário.");
      }
      setResult(body.result);
      setResultPayload(body.payload);
      setSelectedScenarioId(body.scenarioId);
      if (!demo) {
        setHistory((current) => [
          {
            scenarioId: body.scenarioId,
            runId: body.runId,
            name: body.payload.name,
            description: body.payload.description ?? null,
            createdAt: body.createdAt,
            activity: body.payload.activity,
            waitReductionPct: body.payload.waitReductionPct,
            capacityMultiplier: body.payload.capacityMultiplier,
            slaThresholdSeconds: body.payload.slaThresholdSeconds,
            result: body.result,
          },
          ...current.filter((item) => item.scenarioId !== body.scenarioId),
        ].slice(0, 10));
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Não foi possível executar a simulação.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="simulation-lab">
      <header className="simulation-header">
        <div>
          <nav aria-label="Breadcrumb">
            <Link href={demo ? "/demo/explorer" : `/processes/${data.process.id}/explorer`}>
              Process Explorer
            </Link>
            <span>→</span><strong>Simulation Lab</strong>
          </nav>
          <span className="eyebrow">Simulation Lab · V1.3</span>
          <h1>{data.process.name}</h1>
          <p>
            Dataset {data.dataset.originalFilename ?? data.dataset.name} · análise base {new Date(data.analysis.completedAt ?? data.analysis.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>
        {demo && <span className="demo-badge">Demo pública · sem persistência</span>}
      </header>

      <div className="model-notice" role="note">{MODEL_NOTICE}</div>

      <div className="simulation-workspace">
        <form className="hypothesis-card" onSubmit={submit}>
          <span className="eyebrow">Configuração</span>
          <h2>Hipótese</h2>

          <label>Atividade alvo
            <select value={activity} onChange={(event) => setActivity(event.target.value)}>
              {data.activities.map((node) => <option key={node.activity}>{node.activity}</option>)}
            </select>
          </label>
          {selectedNode && (
            <div className="activity-context">
              <span>{selectedNode.caseCount} cases</span><span>{selectedNode.eventCount} eventos</span><span>{formatDuration(selectedNode.avgIncomingWaitSeconds)} de intervalo médio</span>
              {data.primaryBottleneck?.activity === selectedNode.activity && <strong>Gargalo principal</strong>}
            </div>
          )}

          <label>Redução estimada de atraso <strong>{waitReductionPct}%</strong>
            <input aria-label="Redução estimada de atraso" type="range" min="0" max="80" step="5" value={waitReductionPct} onChange={(event) => setWaitReductionPct(Number(event.target.value))} />
            <small>Quanto do intervalo observado antes desta atividade poderia ser reduzido?</small>
          </label>

          <label>Capacidade relativa <strong>{capacityMultiplier.toFixed(1)}x</strong>
            <input aria-label="Capacidade relativa" type="range" min="1" max="3" step="0.1" value={capacityMultiplier} onChange={(event) => setCapacityMultiplier(Number(event.target.value))} />
            <small>Hipótese relativa; não equivale diretamente a contratar pessoas.</small>
          </label>

          <fieldset>
            <legend>SLA</legend>
            <label className="radio-row"><input name="sla-mode" type="radio" checked={slaMode === "automatic"} onChange={() => setSlaMode("automatic")} /> Automático (P75 do baseline)</label>
            <label className="radio-row"><input name="sla-mode" type="radio" checked={slaMode === "manual"} onChange={() => setSlaMode("manual")} /> Manual</label>
            {slaMode === "manual" && <div className="sla-inputs"><label>Horas<input type="number" min="0" max="8760" value={slaHours} onChange={(event) => setSlaHours(Number(event.target.value))} /></label><label>Minutos<input type="number" min="0" max="59" value={slaMinutes} onChange={(event) => setSlaMinutes(Number(event.target.value))} /></label></div>}
          </fieldset>

          <label>Nome do cenário<input maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Descrição opcional<textarea maxLength={1000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>

          {aggressive && <div className="warning-banner">{AGGRESSIVE_NOTICE}</div>}
          {!data.canRun && <div className="warning-banner">Seu perfil pode consultar cenários, mas não executar uma nova simulação.</div>}
          {error && <div className="error-banner" role="alert">{error}</div>}
          <button className="button" disabled={!data.canRun || isPending} type="submit">
            {isPending ? "Simulando…" : "Simular impacto"}
          </button>
        </form>

        <section className="simulation-preview">
          {result && resultPayload ? (
            <ResultPanel payload={resultPayload} result={result} />
          ) : (
            <div className="preview-card">
              <span className="eyebrow">Preview da hipótese</span>
              <h2>{activity}</h2>
              <p>Intervalo observado: <strong>{formatDuration(selectedNode?.avgIncomingWaitSeconds ?? 0)}</strong></p>
              <dl className="hypothesis-summary">
                <div><dt>Redução estimada</dt><dd>-{waitReductionPct}%</dd></div>
                <div><dt>Capacidade relativa</dt><dd>{capacityMultiplier.toFixed(1)}x</dd></div>
                <div><dt>Fator efetivo</dt><dd>{effectiveFactor(waitReductionPct, capacityMultiplier).toFixed(2)}</dd></div>
              </dl>
              <p className="formula">intervalo simulado = intervalo observado × (1 − redução) ÷ capacidade relativa</p>
              <div className="model-notice">Estimativa proporcional sobre intervalos observados.</div>
            </div>
          )}
        </section>
      </div>

      {!demo && (
        <section className="simulation-history">
          <div className="simulation-section-heading"><div><span className="eyebrow">Baseline atual</span><h2>Histórico de cenários</h2></div><span>{history.length} de 10</span></div>
          {history.length ? (
            <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Data</th><th>Atividade</th><th>Redução</th><th>Capacidade</th><th>Ciclo simulado</th><th>Throughput</th><th>Ações</th></tr></thead><tbody>
              {history.map((item) => <tr className={selectedScenarioId === item.scenarioId ? "selected-row" : ""} key={item.scenarioId}><td><button className="history-link" onClick={() => loadHistoryItem(item)} type="button">{item.name}</button></td><td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td><td>{item.activity}</td><td>{item.waitReductionPct}%</td><td>{item.capacityMultiplier.toFixed(1)}x</td><td>{formatDuration(item.result.simulated.avgCycleSeconds)}</td><td>{formatPercent(item.result.deltas.throughputGainPct, true)}</td><td><button className="button secondary compact" onClick={() => loadHistoryItem(item, true)} type="button">Duplicar cenário</button></td></tr>)}
            </tbody></table></div>
          ) : <p>Nenhum cenário concluído para esta análise base.</p>}
        </section>
      )}
    </div>
  );
}
