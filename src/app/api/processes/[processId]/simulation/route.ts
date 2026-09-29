import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  runProcessSimulation,
  SimulationRequestError,
} from "@/features/simulation-lab/runner";
import { createSupabaseSimulationStore } from "@/features/simulation-lab/supabase-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ processId: string }> },
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da requisição deve ser JSON válido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { processId } = await params;
    const execution = await runProcessSimulation({
      store: createSupabaseSimulationStore(supabase),
      processId,
      userId: user.id,
      payload,
    });
    return NextResponse.json(execution, { status: 201 });
  } catch (error) {
    if (error instanceof SimulationRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Simulation execution failed", error);
    return NextResponse.json(
      { error: "Não foi possível executar a simulação agora." },
      { status: 500 },
    );
  }
}
