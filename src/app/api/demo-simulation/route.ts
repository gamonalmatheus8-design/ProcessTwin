import { NextResponse } from "next/server";
import { buildProcessModel } from "@/core/process/mining";
import { simulateImprovement } from "@/core/process/simulation";
import { demoEvents } from "@/data/demo-process";
import { validateSimulationPayload } from "@/features/simulation-lab/validation";

const model = buildProcessModel(demoEvents);
const activities = model.nodes.map((node) => node.activity);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser JSON válido." }, { status: 400 });
  }

  const validation = validateSimulationPayload(body, activities);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const payload = validation.value;
  const result = simulateImprovement(demoEvents, {
    name: payload.name,
    activityAdjustments: {
      [payload.activity]: {
        waitReductionPct: payload.waitReductionPct,
        capacityMultiplier: payload.capacityMultiplier,
      },
    },
    ...(payload.slaThresholdSeconds === undefined
      ? {}
      : { slaThresholdSeconds: payload.slaThresholdSeconds }),
  });

  return NextResponse.json({
    scenarioId: "demo",
    runId: "demo",
    createdAt: new Date().toISOString(),
    payload,
    result,
  });
}
