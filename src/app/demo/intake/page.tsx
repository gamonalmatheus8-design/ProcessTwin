"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { suggestColumnMappingV2 } from "@/features/import/auto-mapping";
import { AutoMappingPanel } from "@/features/import/components/auto-mapping-panel";
import { ProcessPackSelector } from "@/features/import/components/process-pack-selector";
import { DEMO_CSV_BY_PACK } from "@/features/import/demo-data";
import { parseCsv } from "@/features/import/parser";
import { getProcessPack, type ProcessPackId } from "@/features/import/process-packs";
import { profileColumns } from "@/features/import/profiling";
import type { ColumnMapping } from "@/features/import/types";
import { validateAndNormalizeCsv } from "@/features/import/validation";

export default function IntakeDemoPage() {
  const [packId, setPackId] = useState<ProcessPackId>("orders");
  const [manualMapping, setManualMapping] = useState<ColumnMapping | null>(null);
  const pack = getProcessPack(packId)!;
  const parsed = useMemo(() => parseCsv(DEMO_CSV_BY_PACK[packId]), [packId]);
  const profiles = useMemo(() => profileColumns(parsed), [parsed]);
  const analysis = useMemo(() => suggestColumnMappingV2({ headers: parsed.headers, profiles, processPack: pack }), [pack, parsed, profiles]);
  const mapping = manualMapping ?? analysis.mapping;
  const validation = useMemo(() => validateAndNormalizeCsv(parsed, mapping), [mapping, parsed]);

  const selectPack = (next: ProcessPackId) => { setPackId(next); setManualMapping(null); };

  return <main className="app-shell intake-demo"><header className="page-header"><div><span className="eyebrow">ProcessTwin AI · V1.4</span><h1>Universal Intake</h1><p>Veja como o mesmo schema canônico entende a linguagem de nove tipos de processo.</p></div><Link className="text-link" href="/processes/new">Importar meu CSV →</Link></header>
    <section className="panel"><h2>O que você quer analisar?</h2><ProcessPackSelector value={packId} onChange={selectPack} /></section>
    <section className="panel"><span className="eyebrow">Exemplo · {pack.label}</span><h2>Auto Mapping V2</h2><p>O profiling usa somente uma amostra local e limitada. Nenhum valor é enviado a serviços externos.</p><AutoMappingPanel headers={parsed.headers} mapping={mapping} analysis={analysis} onChange={setManualMapping} /></section>
    <section className="panel"><span className="eyebrow">Schema canônico</span><h2>Prévia normalizada</h2><div className="summary-grid">{[["Linhas", validation.summary.totalRows], ["Válidas", validation.summary.validRows], ["Cases", validation.summary.caseCount], ["Atividades", validation.summary.activityCount]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="table-wrap"><table><thead><tr><th>caseId</th><th>activity</th><th>timestamp</th><th>resource</th></tr></thead><tbody>{validation.preview.map((event, index) => <tr key={`${event.caseId}-${index}`}><td>{event.caseId}</td><td>{event.activity}</td><td>{event.timestamp}</td><td>{event.resource ?? "—"}</td></tr>)}</tbody></table></div></section>
  </main>;
}
