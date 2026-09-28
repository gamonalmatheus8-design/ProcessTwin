# ProcessTwin AI — Banco de Dados V1

## Ciclo que a base deve suportar

1. Receber dados de processo.
2. Normalizar o event log.
3. Reconstruir o processo.
4. Identificar gargalos com evidências.
5. Criar um cenário de melhoria.
6. Simular o cenário.
7. Comparar baseline e simulação.
8. Mostrar o impacto.

## Modelo relacional

organizations
  └── organization_members
  └── processes
      └── datasets
          └── process_events
          └── analysis_runs
              └── process_models
              └── bottlenecks
              └── insights
              └── simulation_scenarios
                  └── simulation_runs
                      └── simulation_results
                      └── insights

## Tabelas

### organizations
Tenant empresarial. Cada dado funcional do sistema pertence a uma organização.

### organization_members
Membros e papéis: owner, admin, analyst e viewer.

### processes
Processos empresariais cadastrados.

### datasets
Arquivos ou conjuntos de eventos importados para um processo.

### process_events
Fonte primária do Process Mining Engine.

Campos centrais:
- case_id
- activity
- event_time
- resource
- lifecycle
- cost
- status
- metadata

### analysis_runs
Execuções rastreáveis do motor analítico.

### process_models
Snapshot calculado do processo: grafo, métricas e variantes.

### bottlenecks
Gargalos detectados, score, ranking e evidências.

### simulation_scenarios
Configuração editável do cenário "e se?".

### simulation_runs
Execução rastreável da simulação.

### simulation_results
Baseline, métricas simuladas, deltas e resumo de impacto.

### insights
Conclusões explicáveis vinculadas a uma análise ou simulação.

## Segurança

- RLS habilitado em todas as tabelas do schema public.
- anon não possui acesso às tabelas funcionais.
- authenticated recebe somente os grants necessários e continua sujeito ao RLS.
- Cada registro é isolado por organization_id.
- Relações críticas usam FKs compostos com organization_id para impedir referência cruzada entre tenants.
- viewer: leitura.
- analyst: leitura + operação analítica.
- admin/owner: operação e exclusão.
- Arquivos CSV ficam no bucket privado process-datasets.
- O primeiro diretório do arquivo deve ser o organization_id.
- Chaves secret/service_role nunca vão para o navegador.

## Storage

Bucket privado: process-datasets

Formato recomendado:

<organization_id>/<process_id>/<dataset_id>/<arquivo.csv>

## Estado da validação

- Security Advisor: sem findings.
- Foreign keys: indexadas.
- Avisos remanescentes de performance: apenas unused_index, esperado enquanto o banco está vazio.
