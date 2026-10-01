import { AppShell } from "@/components/layout/app-shell";
import { PilotGuide } from "@/features/pilot/pilot-guide";

export default function PilotPage() {
  return (
    <AppShell active="pilot" eyebrow="Adoption / Pilot guide">
      <PilotGuide />
    </AppShell>
  );
}
