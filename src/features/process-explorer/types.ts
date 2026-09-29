import type {
  Bottleneck,
  ProcessEdge,
  ProcessMetrics,
  ProcessNode,
  ProcessVariant,
} from "@/core/process/types";

export type ProcessExplorerData = {
  process: {
    id: string;
    name: string;
    status: string;
  };
  dataset: {
    id: string;
    name: string;
    originalFilename: string | null;
    createdAt: string;
  };
  analysis: {
    id: string;
    createdAt: string;
    completedAt: string | null;
  };
  model: {
    nodes: ProcessNode[];
    edges: ProcessEdge[];
    variants: ProcessVariant[];
    metrics: ProcessMetrics;
  };
  bottlenecks: Bottleneck[];
};

export type ProcessExplorerLoadResult =
  | { kind: "ok"; data: ProcessExplorerData }
  | { kind: "no-analysis"; process: ProcessExplorerData["process"] }
  | { kind: "not-found" };

export type ActivityHealth = "healthy" | "attention" | "high" | "critical";

export type PositionedNode = ProcessNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};
