import type { ProcessVariant } from "@/core/process/types";
import { formatPct } from "./formatters";
import { getVariantPct, sortVariants } from "./selectors";

export function VariantsPanel({
  variants,
  totalCases,
  selectedIndex,
  onSelect,
}: {
  variants: ProcessVariant[];
  totalCases: number;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}) {
  const top = sortVariants(variants).slice(0, 5);

  return (
    <aside className="variants-panel">
      <div className="variants-heading">
        <div>
          <span className="eyebrow">Variantes</span>
          <h3>Principais caminhos</h3>
        </div>
        <button
          className={selectedIndex === null ? "variant-reset active" : "variant-reset"}
          onClick={() => onSelect(null)}
          type="button"
        >
          Todas
        </button>
      </div>

      <div className="variant-list">
        {top.map((variant, index) => (
          <button
            className={selectedIndex === index ? "variant-card selected" : "variant-card"}
            key={`${variant.path.join("→")}-${index}`}
            onClick={() => onSelect(index)}
            type="button"
          >
            <div className="variant-card-meta">
              <strong>#{index + 1}</strong>
              <span>{variant.caseCount} cases · {formatPct(getVariantPct(variant, totalCases))}</span>
            </div>
            <span className="variant-path">{variant.path.join(" → ")}</span>
          </button>
        ))}
      </div>

      {selectedIndex !== null && top[selectedIndex] ? (
        <p className="variant-caption">
          {top[selectedIndex].caseCount} cases seguiram esta variante.
        </p>
      ) : null}
    </aside>
  );
}
