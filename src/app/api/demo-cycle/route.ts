import { NextResponse } from "next/server";
import { runCoreCycle } from "@/core/process/cycle";
import type { ProcessEvent, SimulationScenario } from "@/core/process/types";
import { demoEvents, demoScenario } from "@/data/demo-process";

function isValidEvent(value: unknown): value is ProcessEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.caseId === "string" &&
    typeof event.activity === "string" &&
    typeof event.timestamp === "string" &&
    !Number.isNaN(Date.parse(event.timestamp))
  );
}

export async function GET() {
  return NextResponse.json(runCoreCycle(demoEvents, demoScenario));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    events?: unknown[];
    scenario?: SimulationScenario;
  };

  if (!Array.isArray(body.events) || !body.events.length || !body.events.every(isValidEvent)) {
    return NextResponse.json(
      { error: "events must contain valid caseId, activity and timestamp fields" },
      { status: 400 },
    );
  }

  const scenario = body.scenario ?? {
    name: "Cenário sem alterações",
    activityAdjustments: {},
  };

  return NextResponse.json(runCoreCycle(body.events, scenario));
}
