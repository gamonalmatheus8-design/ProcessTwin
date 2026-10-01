"use client";

import { FormEvent, useMemo, useState } from "react";

type Stage = "Lead" | "Qualificado" | "Proposta" | "Negociação" | "Ganho";

type Lead = {
  id: number;
  company: string;
  contact: string;
  owner: string;
  stage: Stage;
  value: number;
  lastInteraction: string;
  nextAction: string;
  risk?: boolean;
};

type Task = {
  id: number;
  time: string;
  title: string;
  account: string;
  done: boolean;
};

const initialLeads: Lead[] = [
  { id: 1, company: "Atlas Logística", contact: "Marina Lopes", owner: "Matheus", stage: "Negociação", value: 86000, lastInteraction: "Hoje, 09:42", nextAction: "Enviar proposta final", risk: true },
  { id: 2, company: "Soma Educação", contact: "Lucas Neri", owner: "Matheus", stage: "Proposta", value: 54000, lastInteraction: "Ontem, 16:10", nextAction: "Follow-up em 2 dias" },
  { id: 3, company: "NovaBank", contact: "Carla Freitas", owner: "Ana", stage: "Qualificado", value: 120000, lastInteraction: "Ontem, 11:22", nextAction: "Agendar diagnóstico" },
  { id: 4, company: "Vitta Saúde", contact: "Pedro Reis", owner: "Ana", stage: "Lead", value: 28000, lastInteraction: "30 set, 14:03", nextAction: "Primeiro contato" },
  { id: 5, company: "Orbe Tecnologia", contact: "Julia Moraes", owner: "Matheus", stage: "Ganho", value: 74000, lastInteraction: "29 set, 17:45", nextAction: "Onboarding" },
  { id: 6, company: "Terra Engenharia", contact: "Bruno Lima", owner: "Rafael", stage: "Negociação", value: 63000, lastInteraction: "26 set, 10:18", nextAction: "Retomar negociação", risk: true },
  { id: 7, company: "Atria Varejo", contact: "Fernanda Paz", owner: "Rafael", stage: "Proposta", value: 41000, lastInteraction: "Hoje, 08:20", nextAction: "Revisar escopo" },
  { id: 8, company: "Lumina Foods", contact: "Caio Alves", owner: "Ana", stage: "Qualificado", value: 37000, lastInteraction: "30 set, 09:11", nextAction: "Enviar estudo de caso" },
];

const initialTasks: Task[] = [
  { id: 1, time: "09:30", title: "Revisar proposta", account: "Atlas Logística", done: true },
  { id: 2, time: "11:00", title: "Reunião de diagnóstico", account: "NovaBank", done: false },
  { id: 3, time: "14:00", title: "Follow-up comercial", account: "Soma Educação", done: false },
  { id: 4, time: "16:30", title: "Ligação de negociação", account: "Terra Engenharia", done: false },
];

const stages: Stage[] = ["Lead", "Qualificado", "Proposta", "Negociação", "Ganho"];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function CrmDashboard() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "Todos">("Todos");
  const [period, setPeriod] = useState("30 dias");
  const [showNewLead, setShowNewLead] = useState(false);
  const [form, setForm] = useState({ company: "", contact: "", value: "", stage: "Lead" as Stage });

  const pipelineValue = useMemo(
    () => leads.filter((lead) => lead.stage !== "Ganho").reduce((sum, lead) => sum + lead.value, 0),
    [leads],
  );
  const wonValue = useMemo(
    () => leads.filter((lead) => lead.stage === "Ganho").reduce((sum, lead) => sum + lead.value, 0),
    [leads],
  );
  const conversionRate = leads.length ? (leads.filter((lead) => lead.stage === "Ganho").length / leads.length) * 100 : 0;
  const avgTicket = leads.length ? leads.reduce((sum, lead) => sum + lead.value, 0) / leads.length : 0;

  const filteredLeads = leads.filter((lead) => {
    const matchesStage = stageFilter === "Todos" || lead.stage === stageFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [lead.company, lead.contact, lead.owner, lead.stage].some((value) => value.toLowerCase().includes(term));
    return matchesStage && matchesSearch;
  });

  const pipeline = stages.map((stage) => ({
    stage,
    count: leads.filter((lead) => lead.stage === stage).length,
    value: leads.filter((lead) => lead.stage === stage).reduce((sum, lead) => sum + lead.value, 0),
  }));

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function addLead(event: FormEvent) {
    event.preventDefault();
    const value = Number(form.value.replace(/\D/g, "")) || 0;
    if (!form.company.trim() || !form.contact.trim()) return;
    setLeads((current) => [{
      id: Date.now(),
      company: form.company.trim(),
      contact: form.contact.trim(),
      owner: "Matheus",
      stage: form.stage,
      value,
      lastInteraction: "Agora",
      nextAction: "Definir próxima ação",
    }, ...current]);
    setForm({ company: "", contact: "", value: "", stage: "Lead" });
    setShowNewLead(false);
  }

  return (
    <main className="crm-app">
      <aside className="crm-sidebar">
        <div className="crm-brand">
          <strong>CRM</strong>
          <span>Sales workspace</span>
        </div>

        <nav className="crm-nav" aria-label="Navegação CRM">
          <div>
            <span>Workspace</span>
            <button className="active">Dashboard</button>
            <button>Leads</button>
            <button>Contatos</button>
            <button>Empresas</button>
          </div>
          <div>
            <span>Vendas</span>
            <button>Pipeline</button>
            <button>Atividades</button>
            <button>Tarefas</button>
          </div>
          <div>
            <span>Análise</span>
            <button>Relatórios</button>
            <button>Metas</button>
          </div>
        </nav>

        <div className="crm-sidebar-footer">
          <button>Configurações</button>
          <div className="crm-user">
            <span>MG</span>
            <div><strong>Matheus</strong><small>Administrador</small></div>
          </div>
        </div>
      </aside>

      <section className="crm-workspace">
        <header className="crm-topbar">
          <div className="crm-search">
            <input
              aria-label="Buscar no CRM"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar empresa, contato ou responsável"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="crm-top-actions">
            <button className="crm-icon-button" aria-label="Notificações">3</button>
            <button className="crm-primary" onClick={() => setShowNewLead(true)}>+ Novo lead</button>
          </div>
        </header>

        <div className="crm-content">
          <header className="crm-page-head">
            <div>
              <span>Dashboard comercial</span>
              <h1>Visão geral</h1>
              <p>Acompanhe pipeline, atividades e oportunidades que precisam de atenção.</p>
            </div>
            <select aria-label="Período do dashboard" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option>7 dias</option>
              <option>30 dias</option>
              <option>90 dias</option>
            </select>
          </header>

          <section className="crm-kpis" aria-label="Indicadores comerciais">
            <article><span>Pipeline aberto</span><strong>{currency.format(pipelineValue)}</strong><small>+12,4% vs. período anterior</small></article>
            <article><span>Negócios abertos</span><strong>{leads.filter((lead) => lead.stage !== "Ganho").length}</strong><small>{leads.filter((lead) => lead.risk).length} precisam de atenção</small></article>
            <article><span>Receita ganha</span><strong>{currency.format(wonValue)}</strong><small>Período: {period}</small></article>
            <article><span>Conversão</span><strong>{conversionRate.toFixed(1)}%</strong><small>Lead → ganho</small></article>
            <article><span>Ticket médio</span><strong>{currency.format(avgTicket)}</strong><small>Todos os negócios</small></article>
          </section>

          <div className="crm-grid-main">
            <section className="crm-panel crm-pipeline-panel">
              <header><div><span>Pipeline</span><h2>Negócios por etapa</h2></div><button onClick={() => setStageFilter("Todos")}>Ver todos</button></header>
              <div className="crm-pipeline">
                {pipeline.map((item) => (
                  <button
                    key={item.stage}
                    className={stageFilter === item.stage ? "active" : ""}
                    onClick={() => setStageFilter(stageFilter === item.stage ? "Todos" : item.stage)}
                  >
                    <span>{item.stage}</span>
                    <strong>{currency.format(item.value)}</strong>
                    <small>{item.count} negócio{item.count === 1 ? "" : "s"}</small>
                    <i style={{ width: `${Math.max(8, (item.value / Math.max(...pipeline.map((p) => p.value), 1)) * 100)}%` }} />
                  </button>
                ))}
              </div>
            </section>

            <section className="crm-panel crm-revenue-panel">
              <header><div><span>Performance</span><h2>Receita por mês</h2></div><small>Últimos 6 meses</small></header>
              <div className="crm-chart" aria-label="Gráfico de receita mensal">
                {[
                  ["Mai", 42], ["Jun", 55], ["Jul", 48], ["Ago", 68], ["Set", 76], ["Out", 88],
                ].map(([month, height]) => (
                  <div key={month}>
                    <i style={{ height: `${height}%` }} />
                    <span>{month}</span>
                  </div>
                ))}
              </div>
              <div className="crm-chart-summary">
                <div><span>Receita</span><strong>{currency.format(356000)}</strong></div>
                <div><span>Meta</span><strong>82%</strong></div>
              </div>
            </section>
          </div>

          <div className="crm-grid-secondary">
            <section className="crm-panel">
              <header><div><span>Hoje</span><h2>Próximas atividades</h2></div><button>Ver agenda</button></header>
              <div className="crm-task-list">
                {tasks.map((task) => (
                  <label key={task.id} className={task.done ? "done" : ""}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <time>{task.time}</time>
                    <span><strong>{task.title}</strong><small>{task.account}</small></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="crm-panel">
              <header><div><span>Atenção</span><h2>Negócios em risco</h2></div><small>{leads.filter((lead) => lead.risk).length} negócios</small></header>
              <div className="crm-risk-list">
                {leads.filter((lead) => lead.risk).map((lead) => (
                  <article key={lead.id}>
                    <div><strong>{lead.company}</strong><span>{lead.nextAction}</span></div>
                    <div><strong>{currency.format(lead.value)}</strong><span>{lead.owner}</span></div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="crm-panel crm-leads-panel">
            <header>
              <div><span>Pipeline</span><h2>Leads e oportunidades</h2></div>
              <div className="crm-table-actions">
                <select aria-label="Filtrar por estágio" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as Stage | "Todos")}>
                  <option value="Todos">Todos os estágios</option>
                  {stages.map((stage) => <option key={stage}>{stage}</option>)}
                </select>
                <button onClick={() => setShowNewLead(true)}>Adicionar</button>
              </div>
            </header>
            <div className="crm-table-wrap">
              <table>
                <thead><tr><th>Empresa</th><th>Contato</th><th>Responsável</th><th>Estágio</th><th>Valor</th><th>Última interação</th><th>Próxima ação</th></tr></thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td><strong>{lead.company}</strong>{lead.risk && <span className="crm-risk-dot" title="Negócio em risco" />}</td>
                      <td>{lead.contact}</td>
                      <td>{lead.owner}</td>
                      <td><span className="crm-stage">{lead.stage}</span></td>
                      <td><strong>{currency.format(lead.value)}</strong></td>
                      <td>{lead.lastInteraction}</td>
                      <td>{lead.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredLeads.length && <p className="crm-empty">Nenhum lead encontrado com os filtros atuais.</p>}
          </section>
        </div>
      </section>

      {showNewLead && (
        <div className="crm-modal-backdrop" role="presentation" onMouseDown={() => setShowNewLead(false)}>
          <section className="crm-modal" role="dialog" aria-modal="true" aria-labelledby="new-lead-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>Novo registro</span><h2 id="new-lead-title">Adicionar lead</h2></div><button aria-label="Fechar" onClick={() => setShowNewLead(false)}>×</button></header>
            <form onSubmit={addLead}>
              <label>Empresa<input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Nome da empresa" /></label>
              <label>Contato<input required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Nome do contato" /></label>
              <label>Valor estimado<input inputMode="numeric" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Ex.: 50000" /></label>
              <label>Estágio<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              <div className="crm-modal-actions"><button type="button" onClick={() => setShowNewLead(false)}>Cancelar</button><button className="crm-primary" type="submit">Adicionar lead</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
