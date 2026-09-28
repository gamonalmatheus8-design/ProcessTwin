import Link from "next/link";
import { ImportWizard } from "@/features/import/components/import-wizard";

export default function NewProcessPage() {
  return <main className="app-shell"><header className="page-header"><div><span className="eyebrow">ProcessTwin AI · V1.1</span><h1>Analise seu processo real</h1><p>Transforme um event log CSV em processo reconstruído, gargalo, simulação e impacto.</p></div><Link className="text-link" href="/demo">Ver dataset demonstrativo →</Link></header><ImportWizard /></main>;
}
