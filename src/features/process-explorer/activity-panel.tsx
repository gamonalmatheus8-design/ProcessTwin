import type { Bottleneck, ProcessNode } from "@/core/process/types";
import Link from "next/link";
import { formatDuration, formatPct } from "./formatters";
import {
  getActivityCoveragePct,
  getActivityReworkPct,
} from "./selectors";

export function ActivityPanel({
  node,
  bottleneck,
  totalCases,
  simulationHrefBase,
  onClose,
}: {
  node: ProcessNode | null;
  bottleneck: Bottleneck | null;
  totalCases: number;
  simulationHrefBase: string;
  onClose: () => void;
}) {
  if (!node) {
    return (
      <aside className="activity-panel">
        <span className="eyebrow">Detalhes da atividade</span>
        <h3>Selecione uma etapa</h3>
        <p>Clique em um nó do processo para investigar seus indicadores.</p>
      </aside>
    );
  }

  const isBottleneck = bottleneck?.activity === node.activity;

  return (
    <aside className="activity-panel">
      <div className="activity-panel-heading">
        <div>
          <span className="eyebrow">Atividade</span>
          <h3>{node.activity}</h3>
        </div>
        <button
          aria-label="Fechar detalhes da atividade"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>

      <dl className="activity-stats">
        <div><dt>Cases</dt><dd>{node.caseCount}</dd></div>
        <div><dt>Eventos</dt><dd>{node.eventCount}</dd></div>
        <div><dt>Intervalo médio observado</dt><dd>{formatDuration(node.avgIncomingWaitSeconds)}</dd></div>
        <div><dt>Retrabalho</dt><dd>{formatPct(getActivityReworkPct(node))}</dd></div>
        <div><dt>Cobertura</dt><dd>{formatPct(getActivityCoveragePct(node, totalCases))}</dd></div>
      </dl>

      {isBottleneck && bottleneck ? (
        <div className="bottleneck-box">
          <span>Gargalo principal</span>
          <strong>{bottleneck.severity.toUpperCase()} · {bottleneck.score}/100</strong>
          <p>
            O score oficial combina intervalo observado, volume e retrabalho calculados pelo
            Bottleneck Engine.
          </p>
        </div>
      ) : (
        <div className="neutral-box">Esta atividade não é o gargalo principal da análise.</div>
      )}

      <Link
        className={`button simulation-cta${isBottleneck ? " primary" : " secondary"}`}
        href={`${simulationHrefBase}?activity=${encodeURIComponent(node.activity)}`}
      >
        Simular melhoria
      </Link>
    </aside>
  );
}
