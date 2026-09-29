import Link from "next/link";
import { ImportWizard } from "@/features/import/components/import-wizard";

export default function NewProcessPage() {
  return <main className="app-shell"><header className="page-header"><div><span className="eyebrow">ProcessTwin AI · V1.4</span><h1>Analise qualquer processo</h1><p>Transforme o CSV da sua operação em processo reconstruído, gargalo, simulação e impacto.</p></div><Link className="text-link" href="/demo/intake">Experimentar intake demonstrativo →</Link></header><ImportWizard /></main>;
}
