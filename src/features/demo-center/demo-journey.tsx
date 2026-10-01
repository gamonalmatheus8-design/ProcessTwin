"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { simulateImprovement } from "@/core/process/simulation";
import { ProcessGraph } from "@/features/process-explorer/process-graph";
import { VariantsPanel } from "@/features/process-explorer/variants-panel";
import {
  formatDateTime,
  formatDuration,
  formatPct,
} from "@/features/process-explorer/formatters";
import { DEMO_NOTICE, demoSteps, stepIds } from "./datasets";
import type { getDemo } from "./model";

type Demo = ReturnType<typeof getDemo>;
function Comparison({
  simulation,
}: {
  simulation: ReturnType<typeof simulateImprovement>;
}) {
  const rows = [
    {
      label: "Ciclo médio",
      before: simulation.baseline.avgCycleSeconds,
      after: simulation.simulated.avgCycleSeconds,
      unit: "duration",
    },
    {
      label: "P95 do ciclo",
      before: simulation.baseline.p95CycleSeconds,
      after: simulation.simulated.p95CycleSeconds,
      unit: "duration",
    },
    {
      label: "Casos dentro do prazo",
      before: simulation.baseline.slaCompliancePct,
      after: simulation.simulated.slaCompliancePct,
      unit: "percent",
    },
  ];
  return (
    <div className="fair-comparison" data-testid="scenario-comparison">
      {rows.map((row) => (
        <article key={row.label}>
          <h3>{row.label}</h3>
          <dl>
            <div>
              <dt>Atual</dt>
              <dd>
                {row.unit === "duration"
                  ? formatDuration(row.before)
                  : formatPct(row.before)}
              </dd>
            </div>
            <div>
              <dt>Estimado</dt>
              <dd>
                {row.unit === "duration"
                  ? formatDuration(row.after)
                  : formatPct(row.after)}
              </dd>
            </div>
          </dl>
          <p className="fair-small">
            {row.unit === "duration"
              ? `${formatDuration(Math.max(0, row.before - row.after))} de redução (${formatPct(row.before ? ((row.before - row.after) / row.before) * 100 : 0)})`
              : `${(row.after - row.before).toFixed(1)} pontos percentuais de diferença`}
          </p>
          <div className="fair-bars" aria-hidden="true">
            <i
              style={{
                width: `${(row.before / Math.max(row.before, row.after, 1)) * 100}%`,
              }}
            />
            <i
              style={{
                width: `${(row.after / Math.max(row.before, row.after, 1)) * 100}%`,
              }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
export function DemoJourney({
  demo,
  initialStep,
}: {
  demo: Demo;
  initialStep: number;
}) {
  const { dataset, result, teams, period } = demo;
  const [step, setStep] = useState(initialStep);
  const [activity, setActivity] = useState(
    result.bottleneck?.activity ?? result.model.nodes[0]?.activity ?? "",
  );
  const [reduction, setReduction] = useState(30);
  const [capacity, setCapacity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const simulation = useMemo(
    () =>
      simulateImprovement(dataset.records, {
        name: "Cenário demonstrativo",
        activityAdjustments: {
          [activity]: {
            waitReductionPct: reduction,
            capacityMultiplier: capacity,
          },
        },
        slaThresholdSeconds: dataset.slaHours * 3600,
      }),
    [dataset.records, dataset.slaHours, activity, reduction, capacity],
  );
  const selectedNode = result.model.nodes.find(
    (node) => node.activity === activity,
  );
  function navigate(next: number) {
    setStep(next);
    window.history.replaceState(
      null,
      "",
      `/demo/center/${dataset.id}?step=${stepIds[next]}`,
    );
    requestAnimationFrame(() => heading.current?.focus());
  }
  function reset() {
    setReduction(30);
    setCapacity(1);
    setActivity(
      result.bottleneck?.activity ?? result.model.nodes[0]?.activity ?? "",
    );
    setSelectedVariant(null);
    navigate(0);
  }
  return (
    <main className="fair-page fair-journey">
      <nav className="fair-topbar" aria-label="Navegação da demonstração">
        <Link href="/demo/center">← Central de demonstrações</Link>
        <button className="button secondary" type="button" onClick={reset}>
          Reiniciar apresentação
        </button>
      </nav>
      <header className="fair-journey-header">
        <span className="eyebrow">
          {dataset.organization} · organização fictícia
        </span>
        <h1>{dataset.name}</h1>
        <p>{dataset.question}</p>
      </header>
      <p className="fair-notice">
        {DEMO_NOTICE} Nenhum dado pessoal real é utilizado.
      </p>
      <div className="fair-scope">
        <span>
          {result.metrics.caseCount} {dataset.caseLabel}
        </span>
        <span>{result.metrics.eventCount} eventos</span>
        <span>
          {formatDateTime(period.start)} a {formatDateTime(period.end)} · UTC
        </span>
      </div>
      <nav aria-label="Etapas da apresentação" className="fair-step-nav">
        <ol>
          {demoSteps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                aria-current={index === step ? "step" : undefined}
                onClick={() => navigate(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section className="fair-stage" aria-labelledby="stage-heading">
        <h2 id="stage-heading" tabIndex={-1} ref={heading}>
          {
            [
              "O ponto de partida: registros operacionais",
              "O processo descoberto nos eventos",
              "Onde investigar primeiro",
              "Teste uma hipótese de melhoria",
              "Da hipótese à decisão",
            ][step]
          }
        </h2>
        {step === 0 ? (
          <>
            <p>
              Uma linha representa um evento de um caso. O motor usa
              identificação, atividade e data para reconstruir cada caminho.
              Equipe, prioridade e categoria dão contexto.
            </p>
            <div className="fair-data-header">
              <span>
                Amostra: 12 de {dataset.records.length} eventos · exportação
                completa disponível
              </span>
              <a
                className="button secondary"
                href={`/api/demo-center/${dataset.id}/csv`}
              >
                Baixar CSV sintético
              </a>
            </div>
            <div className="table-wrap">
              <table>
                <caption>
                  Registros sintéticos de {dataset.name.toLowerCase()}
                </caption>
                <thead>
                  <tr>
                    {[
                      "Caso",
                      "Atividade",
                      "Data e hora (UTC)",
                      "Equipe",
                      "Prioridade",
                      "Categoria",
                    ].map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.records.slice(0, 12).map((record) => (
                    <tr key={record.eventId}>
                      <td>{record.caseId}</td>
                      <td>{record.activity}</td>
                      <td>{formatDateTime(record.timestamp)}</td>
                      <td>{record.resource}</td>
                      <td>{record.priority}</td>
                      <td>{record.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fair-small">
              A exportação pode ser usada no fluxo de importação do ProcessTwin.
              Identidades de eventos são estáveis; linhas não identificam
              eventos.
            </p>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <p>
              {result.model.nodes.length} atividades,{" "}
              {result.model.edges.length} transições e{" "}
              {result.model.variants.length} variantes descobertas. Selecione
              uma atividade ou destaque uma variante.
            </p>
            <ProcessGraph
              nodes={result.model.nodes}
              edges={result.model.edges}
              variants={result.model.variants}
              bottleneck={result.bottleneck}
              selectedActivity={activity}
              selectedVariantIndex={selectedVariant}
              onSelectActivity={setActivity}
            />
            {selectedNode ? (
              <p className="fair-selection">
                <strong>{selectedNode.activity}</strong> ·{" "}
                {selectedNode.eventCount} ocorrências · intervalo médio de
                entrada: {formatDuration(selectedNode.avgIncomingWaitSeconds)}
              </p>
            ) : null}
            <VariantsPanel
              variants={result.model.variants}
              totalCases={result.metrics.caseCount}
              selectedIndex={selectedVariant}
              onSelect={setSelectedVariant}
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            {result.bottleneck ? (
              <article className="fair-bottleneck">
                <span className="eyebrow">Prioridade calculada pelo motor</span>
                <h3>{result.bottleneck.activity}</h3>
                <p>
                  Intervalo médio observado antes desta atividade:{" "}
                  <strong>
                    {formatDuration(result.bottleneck.avgWaitSeconds)}
                  </strong>
                  , em {result.bottleneck.affectedCases} casos. A priorização
                  combina intervalo, abrangência e repetição da atividade.
                </p>
              </article>
            ) : (
              <p>Nenhum gargalo identificado neste conjunto.</p>
            )}
            <dl className="fair-evidence">
              <div>
                <dt>Ciclo médio</dt>
                <dd>{formatDuration(result.metrics.avgCycleSeconds)}</dd>
              </div>
              <div>
                <dt>P95 do ciclo</dt>
                <dd>{formatDuration(result.metrics.p95CycleSeconds)}</dd>
              </div>
              <div>
                <dt>Casos com retrabalho</dt>
                <dd>{formatPct(result.metrics.reworkRatePct)}</dd>
              </div>
            </dl>
            <h3>Diferenças observadas entre equipes</h3>
            <div className="table-wrap">
              <table>
                <caption>
                  Casos agrupados pela equipe registrada no primeiro evento
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Equipe</th>
                    <th scope="col">Casos</th>
                    <th scope="col">Ciclo médio</th>
                    <th scope="col">Casos com retrabalho</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.name}>
                      <th scope="row">{team.name}</th>
                      <td>{team.caseCount}</td>
                      <td>{formatDuration(team.avgCycleSeconds)}</td>
                      <td>{formatPct(team.reworkPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fair-small">
              Diferenças de composição e complexidade dos casos também afetam os
              resultados. Esta comparação não mede produtividade individual.
              Timestamps pontuais indicam intervalos observados, não tempo real
              de serviço ou espera.
            </p>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <p>
              {dataset.hypothesis} A hipótese abaixo reduz proporcionalmente os
              intervalos de entrada de uma atividade.
            </p>
            <div className="fair-simulation-form">
              <label>
                Atividade analisada
                <select
                  value={activity}
                  onChange={(event) => setActivity(event.target.value)}
                >
                  {result.model.nodes.map((node) => (
                    <option key={node.activity}>{node.activity}</option>
                  ))}
                </select>
              </label>
              <label>
                Redução do intervalo: {reduction}%
                <input
                  aria-label="Redução do intervalo"
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={reduction}
                  onChange={(event) => setReduction(Number(event.target.value))}
                />
              </label>
              <label>
                Capacidade estimada
                <select
                  aria-label="Capacidade estimada"
                  value={capacity}
                  onChange={(event) => setCapacity(Number(event.target.value))}
                >
                  <option value={1}>Manter capacidade (1×)</option>
                  <option value={1.25}>Aumentar em 25% (1,25×)</option>
                  <option value={1.5}>Aumentar em 50% (1,5×)</option>
                </select>
              </label>
            </div>
            <p className="fair-small">
              Prazo de referência fixo: {dataset.slaHours} horas por caso, igual
              no atual e no cenário. A capacidade é um multiplicador do modelo,
              não uma previsão de contratação ou filas.
            </p>
            <Comparison simulation={simulation} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <p>
              Hipótese atual: reduzir em {reduction}% o intervalo de entrada de{" "}
              <strong>{activity}</strong>, com capacidade de{" "}
              {capacity.toLocaleString("pt-BR")}×. Prazo de referência:{" "}
              {dataset.slaHours} horas.
            </p>
            <Comparison simulation={simulation} />
            <article className="fair-impact">
              <span className="eyebrow">Estimativa do modelo</span>
              <h3>
                {simulation.impactSummary.hoursSavedPer100Cases.toLocaleString(
                  "pt-BR",
                )}{" "}
                horas de redução acumulada por 100 casos
              </h3>
              <p>
                Equivale a{" "}
                {formatDuration(simulation.impactSummary.secondsSavedPerCase)}{" "}
                de redução média do ciclo por caso. Não representa
                automaticamente horas de trabalho ou economia financeira.
              </p>
            </article>
            <h3>Próximo passo em uma operação real</h3>
            <p>
              Validar o diagnóstico com a equipe, escolher uma mudança pequena e
              comparar ciclos e retrabalho antes e depois. A simulação não prevê
              demanda, filas, custos nem elimina os retornos do processo.
            </p>
            <Link className="button secondary" href="/pilot">
              Preparar um piloto com a equipe →
            </Link>
          </>
        ) : null}
        {step >= 3 ? (
          <p className="fair-model-notice">
            Estimativa baseada no modelo e nos dados sintéticos observados. A
            simulação preserva os caminhos e o retrabalho; altera apenas os
            intervalos associados à hipótese.
          </p>
        ) : null}
      </section>
      <footer className="fair-pagination">
        <button
          className="button secondary"
          type="button"
          disabled={step === 0}
          onClick={() => navigate(step - 1)}
        >
          ← Voltar
        </button>
        <span>Etapa {step + 1} de 5</span>
        {step < 4 ? (
          <button
            className="button"
            type="button"
            onClick={() => navigate(step + 1)}
          >
            Continuar →
          </button>
        ) : (
          <Link className="button" href="/demo/center">
            Explorar outro processo →
          </Link>
        )}
      </footer>
    </main>
  );
}
