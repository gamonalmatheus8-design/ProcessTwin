"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  Bottleneck,
  ProcessEdge,
  ProcessNode,
  ProcessVariant,
} from "@/core/process/types";
import { formatDuration } from "./formatters";
import { layoutProcessNodes } from "./graph-layout";
import {
  classifyActivityHealth,
  edgeKey,
  getVariantEdgeKeys,
  sortVariants,
} from "./selectors";

export function ProcessGraph({
  nodes,
  edges,
  variants,
  bottleneck,
  selectedActivity,
  selectedVariantIndex,
  onSelectActivity,
  responsive = false,
}: {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  variants: ProcessVariant[];
  bottleneck: Bottleneck | null;
  selectedActivity: string | null;
  selectedVariantIndex: number | null;
  onSelectActivity: (activity: string) => void;
  responsive?: boolean;
}) {
  const arrowId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 18, y: 18 });

  const layout = useMemo(
    () =>
      layoutProcessNodes(
        nodes,
        variants,
        responsive
          ? Math.min(4, Math.max(1, Math.floor((viewportWidth || 1100) / 262)))
          : undefined,
      ),
    [nodes, variants, responsive, viewportWidth],
  );

  const sortedVariants = useMemo(() => sortVariants(variants), [variants]);
  const selectedVariant =
    selectedVariantIndex === null
      ? null
      : (sortedVariants[selectedVariantIndex] ?? null);

  const selectedActivities = useMemo(
    () => new Set(selectedVariant?.path ?? []),
    [selectedVariant],
  );
  const selectedEdges = useMemo(
    () => getVariantEdgeKeys(selectedVariant),
    [selectedVariant],
  );

  const positionedByActivity = useMemo(
    () => new Map(layout.nodes.map((node) => [node.activity, node])),
    [layout.nodes],
  );

  useEffect(() => {
    if (!responsive || !viewportRef.current) return;
    const observer = new ResizeObserver((entries) =>
      setViewportWidth(entries[0].contentRect.width),
    );
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [responsive]);

  const fitView = () => {
    const viewport = viewportRef.current;
    if (!viewport || !layout.width || !layout.height) return;
    const nextZoom = Math.max(
      0.45,
      Math.min(
        1.15,
        (viewport.clientWidth - 36) / layout.width,
        (viewport.clientHeight - 36) / layout.height,
      ),
    );
    setZoom(nextZoom);
    setOffset({
      x: Math.max(18, (viewport.clientWidth - layout.width * nextZoom) / 2),
      y: Math.max(18, (viewport.clientHeight - layout.height * nextZoom) / 2),
    });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(fitView);
    return () => cancelAnimationFrame(frame);
    // fit only when the discovered model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("button")) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.ox + event.clientX - drag.x,
      y: drag.oy + event.clientY - drag.y,
    });
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section
      className="process-graph-shell"
      style={
        responsive
          ? { minHeight: Math.max(420, layout.height + 80) }
          : undefined
      }
    >
      <div className="graph-toolbar" aria-label="Controles do grafo">
        <button
          aria-label="Aumentar zoom"
          onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Diminuir zoom"
          onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))}
          type="button"
        >
          −
        </button>
        <button onClick={fitView} type="button">
          Ajustar
        </button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      <div
        className="process-graph-viewport"
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        ref={viewportRef}
      >
        <div
          className="process-graph-canvas"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          <svg
            aria-hidden="true"
            className="process-graph-edges"
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width}
          >
            {responsive ? (
              <defs>
                <marker
                  id={arrowId}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#718da4" />
                </marker>
              </defs>
            ) : null}
            {edges.map((edge, index) => {
              const source = positionedByActivity.get(edge.source);
              const target = positionedByActivity.get(edge.target);
              if (!source || !target) return null;

              const key = edgeKey(edge.source, edge.target);
              const highlighted = !selectedVariant || selectedEdges.has(key);
              const crossRow = responsive && source.y !== target.y;
              const leftward = responsive && target.x < source.x;
              const sx = crossRow
                ? source.x + source.width / 2
                : leftward
                  ? source.x
                  : source.x + source.width;
              const sy = crossRow
                ? source.y + (target.y > source.y ? source.height : 0)
                : source.y + source.height / 2;
              const tx = crossRow
                ? target.x + target.width / 2
                : leftward
                  ? target.x + target.width
                  : target.x;
              const ty = crossRow
                ? target.y + (target.y < source.y ? target.height : 0)
                : target.y + target.height / 2;
              const backward = responsive
                ? layout.nodes.indexOf(target) <= layout.nodes.indexOf(source)
                : tx <= sx;
              const returnDirection = responsive && leftward ? -1 : 1;
              const path = crossRow
                ? `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2} ${tx} ${(sy + ty) / 2} ${tx} ${ty}`
                : backward
                  ? `M ${sx} ${sy} C ${sx + 52 * returnDirection} ${Math.max(18, sy - 84)} ${tx - 52 * returnDirection} ${Math.max(18, ty - 84)} ${tx} ${ty}`
                  : `M ${sx} ${sy} C ${sx + (tx - sx) / 2} ${sy} ${sx + (tx - sx) / 2} ${ty} ${tx} ${ty}`;
              const labelX = (sx + tx) / 2 + (crossRow ? 44 : 0);
              const labelY = (sy + ty) / 2 - (crossRow ? 0 : 9);
              const strokeWidth = Math.max(
                1.5,
                Math.min(5, 1.5 + edge.count / 6),
              );

              return (
                <g
                  className={highlighted ? "graph-edge" : "graph-edge muted"}
                  key={`${key}-${index}`}
                >
                  <path
                    d={path}
                    style={{ strokeWidth }}
                    markerEnd={responsive ? `url(#${arrowId})` : undefined}
                  />
                  <text x={labelX} y={labelY}>
                    {edge.count} · {formatDuration(edge.avgWaitSeconds)}
                  </text>
                </g>
              );
            })}
          </svg>

          {layout.nodes.map((node) => {
            const isBottleneck = bottleneck?.activity === node.activity;
            const health = classifyActivityHealth(node, nodes, bottleneck);
            const muted =
              selectedVariant !== null &&
              !selectedActivities.has(node.activity);

            return (
              <button
                aria-label={`Abrir detalhes de ${node.activity}`}
                className={[
                  "process-node",
                  selectedActivity === node.activity ? "selected" : "",
                  muted ? "muted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-health={health}
                key={node.activity}
                onClick={() => onSelectActivity(node.activity)}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                }}
                type="button"
              >
                <span className="process-node-title">{node.activity}</span>
                <span className="process-node-data">
                  {node.caseCount} cases
                </span>
                <span className="process-node-data">
                  Intervalo {formatDuration(node.avgIncomingWaitSeconds)}
                </span>
                {isBottleneck ? (
                  <span className="process-node-badge">
                    Gargalo · {bottleneck.severity}
                  </span>
                ) : (
                  <span className="process-node-health">{health}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
