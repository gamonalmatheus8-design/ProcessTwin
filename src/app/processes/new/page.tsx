import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ImportWizard } from "@/features/import/components/import-wizard";

export default function NewProcessPage() {
  return (
    <AppShell active="intake" eyebrow="Data onboarding">
      <header className="pt-page-heading">
        <div>
          <span className="eyebrow">Universal Intake</span>
          <h1>Transforme um event log em um processo analisável.</h1>
          <p>
            O ProcessTwin perfila o arquivo, sugere o mapeamento, valida os eventos
            e só então executa a análise.
          </p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/demo/intake">Ver intake demonstrativo</Link>
        </div>
      </header>
      <ImportWizard />
    </AppShell>
  );
}
