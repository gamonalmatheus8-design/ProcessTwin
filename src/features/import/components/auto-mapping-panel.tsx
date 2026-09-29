import { confidenceLabel } from "../auto-mapping";
import type { AutoMappingResult, CanonicalField, ColumnMapping } from "../types";

const fields: Array<{ key: CanonicalField; label: string; required: boolean }> = [
  { key: "caseId", label: "Case ID", required: true }, { key: "activity", label: "Atividade", required: true },
  { key: "timestamp", label: "Timestamp", required: true }, { key: "resource", label: "Recurso", required: false },
];

export function AutoMappingPanel({ headers, mapping, analysis, onChange }: { headers: string[]; mapping: ColumnMapping; analysis: AutoMappingResult; onChange: (mapping: ColumnMapping) => void }) {
  return <>
    {analysis.conflicts.length > 0 && <div className="warning-banner"><strong>Revise {analysis.conflicts.length} possível(is) ambiguidade(s).</strong><ul>{analysis.conflicts.map((conflict) => <li key={`${conflict.type}-${conflict.message}`}>{conflict.message}</li>)}</ul></div>}
    <div className="mapping-grid">{fields.map((field) => {
      const suggestion = analysis.suggestions[field.key];
      const selectedColumn = mapping[field.key];
      const isManual = Boolean(selectedColumn && selectedColumn !== suggestion.column);
      return <article className="mapping-card" key={field.key}>
        <label>{field.label} {field.required && <em>obrigatório</em>}<select value={selectedColumn ?? ""} onChange={(event) => onChange({ ...mapping, [field.key]: event.target.value || undefined })}><option value="">Não mapear</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>
        <div className="mapping-confidence">
          {isManual
            ? <><span className="confidence confidence-manual">Escolha manual</span><span>Sugestão automática: {suggestion.column ?? "nenhuma"}</span></>
            : <><span className={`confidence confidence-${confidenceLabel(suggestion.confidence).toLowerCase()}`}>{confidenceLabel(suggestion.confidence)} · {Math.round(suggestion.confidence * 100)}%</span><span>score {suggestion.score}</span></>}
        </div>
        <details><summary>{isManual ? "Como o Auto Mapping avaliou?" : "Por que esta sugestão?"}</summary><ul>{suggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{suggestion.alternatives.length > 0 && <p>Alternativas: {suggestion.alternatives.map((item) => `${item.column} (${Math.round(item.confidence * 100)}%)`).join(", ")}</p>}</details>
      </article>;
    })}</div>
  </>;
}
