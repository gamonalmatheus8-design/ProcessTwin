import { notFound } from "next/navigation";
import { isDemoId, demoStep } from "@/features/demo-center/datasets";
import { getDemo } from "@/features/demo-center/model";
import { DemoJourney } from "@/features/demo-center/demo-journey";
export default async function DemoScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenario: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const [{ scenario }, query] = await Promise.all([params, searchParams]);
  if (!isDemoId(scenario)) notFound();
  return (
    <DemoJourney
      key={scenario}
      demo={getDemo(scenario)}
      initialStep={demoStep(
        typeof query.step === "string" ? query.step : undefined,
      )}
    />
  );
}
