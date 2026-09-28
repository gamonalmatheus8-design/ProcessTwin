import { NextResponse } from "next/server";
import { runCoreCycle } from "@/core/process/cycle";
import { isProcessEvent } from "@/core/process/events";
import type { SimulationScenario } from "@/core/process/types";
import { demoEvents, demoScenario } from "@/data/demo-process";

function isSimulationScenario(value: unknown): value is SimulationScenario {
  if (!value || typeof value !== "object") return false;

  const scenario = value as Record<string, unknown>;
  if (
    typeof scenario.name !== "string" ||
    !scenario.name.trim() ||
    !scenario.activityAdjustments ||
    typeof scenario.activityAdjustments !== "object" ||
    Array.isArray(scenario.activityAdjustments)
  ) {
    return false;
  }

  if (
    scenario.slaThresholdSeconds !== undefined &&
    (typeof scenario.slaThresholdSeconds !== "number" ||
      !Number.isFinite(scenario.slaThresholdSeconds) ||
      scenario.slaThresholdSeconds < 0)
  ) {
    return false;
  }

  return Object.values(scenario.activityAdjustments).every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const adjustment = value as Record<string, unknown>;

    const reductionIsValid =
      adjustment.waitReductionPct === undefined ||
      (typeof adjustment.waitReductionPct === "number" &&
        Number.isFinite(adjustment.waitReductionPct) &&
        adjustment.waitReductionPct >= 0 &&
        adjustment.waitReductionPct <= 100);
    const capacityIsValid =
      adjustment.capacityMultiplier === undefined ||
      (typeof adjustment.capacityMultiplier === "number" &&
        Number.isFinite(adjustment.capacityMultiplier) &&
        adjustment.capacityMultiplier > 0);

    return reductionIsValid && capacityIsValid;
  });
}

export async function GET() {
  return NextResponse.json(runCoreCycle(demoEvents, demoScenario));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "request body must be an object" }, { status: 400 });
  }

  const { events, scenario } = body as { events?: unknown; scenario?: unknown };

  if (!Array.isArray(events) || !events.length || !events.every(isProcessEvent)) {
    return NextResponse.json(
      { error: "events must contain valid caseId, activity and timestamp fields" },
      { status: 400 },
    );
  }

  if (scenario !== undefined && !isSimulationScenario(scenario)) {
    return NextResponse.json({ error: "scenario is invalid" }, { status: 400 });
  }

  return NextResponse.json(runCoreCycle(events, scenario));
}
