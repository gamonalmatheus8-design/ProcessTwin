import { PROCESS_PACKS, type ProcessPackId } from "../process-packs";

export function ProcessPackSelector({ value, onChange }: { value?: ProcessPackId; onChange: (value: ProcessPackId) => void }) {
  return <div className="pack-grid">
    {PROCESS_PACKS.map((pack) => <button className={value === pack.id ? "pack-card selected" : "pack-card"} key={pack.id} onClick={() => onChange(pack.id)} type="button" aria-pressed={value === pack.id}>
      <strong>{pack.label}</strong><span>{pack.description}</span><small>{pack.examples[0]}</small>
    </button>)}
  </div>;
}
