"use client";

import { useMemo, useState } from "react";
import type { ProcessExplorerData } from "./types";
import { ActivityPanel } from "./activity-panel";
import { ExecutiveInsight } from "./executive-insight";
import { ProcessGraph } from "./process-graph";
import { ProcessKpis } from "./process-kpis";
import { VariantsPanel } from "./variants-panel";
import { formatDateTime } from "./formatters";

export function ProcessExplorer({
  data,
  simulationHrefBase = `/processes/${data.process.id}/simulation`,
}: {
  data: ProcessExplorerData;
  simulationHrefBase?: string;
}) {
  const primaryBottleneck = data.bottlenecks[0] ?? null;
  const [selectedActivity, setSelectedActivity] = useState<string | null>(
    primaryBottleneck?.activity ?? data.model.nodes[0]?.activity ?? null,
  );
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  const selectedNode = useMemo(
    () => data.model.nodes.find((node) => node.activity === selectedActivity) ?? null,
    [data.model.nodes, selectedActivity],
  );

  const selectedBottleneck =
    selectedNode && primaryBottleneck?.activity === selectedNode.activity
      ? primaryBottleneck
      : null;

  return (
    <div className="process-explorer">
      <header className="explorer-header">
        <div>
          <span className="eyebrow">Process Explorer · V1.2</span>
          <h1>{data.process.name}</h1>
          <p>
            Dataset {data.dataset.originalFilename ?? data.dataset.name} · análise concluída{" "}
            {formatDateTime(data.analysis.completedAt ?? data.analysis.createdAt)}
          </p>
        </div>
        <div className="explorer-status">
          <span>Processo</span>
          <strong>{data.process.status}</strong>
        </div>
      </header>

      <ProcessKpis
        activityCount={data.model.nodes.length}
        metrics={data.model.metrics}
        variantCount={data.model.variants.length}
      />

      <ExecutiveInsight
        bottleneck={primaryBottleneck}
        nodes={data.model.nodes}
        totalCases={data.model.metrics.caseCount}
      />

      <div className="explorer-workspace">
        <ProcessGraph
          bottleneck={primaryBottleneck}
          edges={data.model.edges}
          nodes={data.model.nodes}
          onSelectActivity={setSelectedActivity}
          selectedActivity={selectedActivity}
          selectedVariantIndex={selectedVariantIndex}
          variants={data.model.variants}
        />
        <ActivityPanel
          bottleneck={selectedBottleneck}
          node={selectedNode}
          onClose={() => setSelectedActivity(null)}
          simulationHrefBase={simulationHrefBase}
          totalCases={data.model.metrics.caseCount}
        />
      </div>

      <VariantsPanel
        onSelect={setSelectedVariantIndex}
        selectedIndex={selectedVariantIndex}
        totalCases={data.model.metrics.caseCount}
        variants={data.model.variants}
      />
    </div>
  );
}
