"use client";
import Link from "next/link";
import { useState } from "react";
import { DEMO_NOTICE, type DemoId } from "./datasets";
import {
  formatDuration,
  formatPct,
} from "@/features/process-explorer/formatters";

export type DemoSummary = {
  id: DemoId;
  sector: "school" | "company";
  organization: string;
  name: string;
  description: string;
  cases: number;
  events: number;
  rework: number;
  avgCycle: number;
};
export function DemoCenter({ scenarios }: { scenarios: DemoSummary[] }) {
  const [sector, setSector] = useState<"all" | "school" | "company">("all");
  const visible = scenarios.filter(
    (scenario) => sector === "all" || scenario.sector === sector,
  );
  return (
    <main className="fair-page">
      <nav className="fair-topbar" aria-label="Navegação principal">
        <Link href="/" className="fair-brand">
          ProcessTwin <span>AI</span>
        </Link>
        <Link href="/pilot">Preparar um piloto →</Link>
      </nav>
      <header className="fair-hero">
        <span className="eyebrow">Central de demonstrações</span>
        <h1>Da operação à próxima decisão.</h1>
        <p>
          Veja como registros de uma escola e de uma empresa revelam caminhos,
          retrabalho e oportunidades de melhoria pelo mesmo motor.
        </p>
        <p className="fair-notice">
          {DEMO_NOTICE} As organizações e equipes são fictícias.
        </p>
      </header>
      <div
        className="fair-selector"
        role="group"
        aria-label="Tipo de organização"
      >
        {(
          [
            ["all", "Todos"],
            ["school", "Escola"],
            ["company", "Empresa"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={sector === value}
            onClick={() => setSector(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="fair-catalog" aria-label="Demonstrações disponíveis">
        {visible.map((scenario) => (
          <article className="fair-scenario" key={scenario.id}>
            <span className="eyebrow">
              {scenario.sector === "school"
                ? "Educação"
                : "Operação empresarial"}
            </span>
            <p className="fair-organization">{scenario.organization}</p>
            <h2>{scenario.name}</h2>
            <p>{scenario.description}</p>
            <dl className="fair-card-stats">
              <div>
                <dt>Casos</dt>
                <dd>{scenario.cases}</dd>
              </div>
              <div>
                <dt>Ciclo médio</dt>
                <dd>{formatDuration(scenario.avgCycle)}</dd>
              </div>
              <div>
                <dt>Casos com retrabalho</dt>
                <dd>{formatPct(scenario.rework)}</dd>
              </div>
            </dl>
            <p className="fair-small">
              {scenario.events} eventos sintéticos · resultados calculados
            </p>
            <Link className="button" href={`/demo/center/${scenario.id}`}>
              Explorar {scenario.name.toLowerCase()} →
            </Link>
          </article>
        ))}
      </section>
      <section className="fair-method">
        <h2>Uma jornada de cinco etapas</h2>
        <p>
          Dados → processo → gargalo → simulação → impacto. Explore o fluxo,
          altere uma hipótese e compare os resultados estimados.
        </p>
        <Link className="text-link" href="/demo">
          Ver demonstração técnica anterior →
        </Link>
      </section>
    </main>
  );
}
