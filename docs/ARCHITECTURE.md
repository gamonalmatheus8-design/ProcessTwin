# ProcessTwin AI — Arquitetura de Produto

## Objetivo

Construir uma plataforma 100% digital que transforma logs de eventos empresariais em um gêmeo digital do processo, identifica gargalos, mede impacto operacional e permite testar cenários "e se?" antes de mudanças reais.

## Princípio da V1

A V1 precisa ser demonstrável de ponta a ponta sem depender de serviços experimentais:

CSV / Demo Dataset
  -> Importação e validação
  -> Normalização de eventos
  -> Process Mining Engine
  -> Modelo visual do processo
  -> Bottleneck Engine
  -> Simulation Lab
  -> Comparação Atual x Simulado
  -> Insights explicáveis

## Stack

- Next.js App Router + TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage para arquivos importados
- Row Level Security em todas as tabelas expostas
- Vercel para deploy
- Engine analítico inicial em TypeScript
- Python somente em uma fase posterior, caso simulações avançadas ou modelos estatísticos justifiquem um worker separado

## Formato mínimo do event log

Campos obrigatórios:
- case_id
- activity
- timestamp

Campos opcionais:
- resource
- cost
- status
- metadata

Exemplo:

case_id,activity,timestamp,resource
PED-001,Pedido recebido,2026-09-28T08:00:00Z,Portal
PED-001,Análise,2026-09-28T08:12:00Z,Ana
PED-001,Aprovação,2026-09-28T09:08:00Z,Carlos
PED-001,Expedição,2026-09-28T11:42:00Z,Equipe A

## Fluxo funcional

1. Usuário cria um processo ou abre um dataset demonstrativo.
2. Importa CSV e confirma o mapeamento das colunas.
3. O sistema valida e normaliza o event log.
4. O Process Mining Engine constrói atividades, transições, variantes e métricas.
5. O Process Map mostra o processo real com frequência e tempo de espera.
6. O Bottleneck Engine classifica gargalos com justificativas mensuráveis.
7. O usuário cria um cenário no Simulation Lab.
8. O Simulation Engine executa o cenário.
9. O sistema compara Atual x Simulado.
10. O Insight Engine explica o que mudou e por quê.

## Telas da V1

### Command Center
Visão executiva com processos, tempo médio, SLA, casos analisados, gargalos e oportunidades estimadas.

### Process Explorer
Grafo interativo com nós, transições, volume, tempo médio, retrabalho e heatmap de gargalos.

### Case Explorer
Timeline de um caso individual para mostrar exatamente como ele percorreu o processo.

### Bottleneck Lab
Ranking explicável dos gargalos, impactos e causas observadas nos dados.

### Simulation Lab
Editor de cenários "e se?" para capacidade, duração, automação e volume.

### Compare
Comparação Atual x Simulado com ciclo, espera, SLA, throughput e utilização.

### Time Machine
Reprodução visual acelerada dos eventos do processo ao longo de um período.

## Modelo de dados proposto

### organizations
Tenant empresarial.

### organization_members
Associação entre usuários e organizações.

### processes
Processos cadastrados.

### datasets
Importações e datasets demonstrativos associados a um processo.

### process_events
Event log normalizado. Fonte primária das análises.

### analysis_runs
Registro de cada execução do engine.

### process_models
Snapshot calculado do modelo: grafo, variantes e métricas agregadas em JSONB.

### bottlenecks
Gargalos detectados com score, evidências e impacto estimado.

### simulation_scenarios
Configuração do cenário criado pelo usuário.

### simulation_runs
Execução de uma simulação e estado do processamento.

### simulation_results
Métricas consolidadas do cenário e comparação com a baseline.

### insights
Insights gerados a partir de métricas verificáveis.

## Regras do Bottleneck Engine V1

O score de gargalo considera:
- tempo médio de espera antes da atividade;
- tempo de ciclo associado à atividade;
- volume de casos;
- taxa de retrabalho;
- impacto no SLA;
- crescimento de fila ao longo do tempo quando disponível.

O sistema sempre deve apresentar evidências, evitando diagnósticos vagos.

## Simulation Engine V1

A primeira versão usa um modelo controlado e explicável. Cada atividade pode ter:
- duração média;
- variação de duração;
- capacidade;
- percentual de automação;
- limite de fila.

A simulação reproduz casos ao longo do fluxo e calcula:
- cycle time;
- waiting time;
- throughput;
- SLA compliance;
- resource utilization.

## Diferenciais para a feira

### Time Machine
Anima o processo real e mostra visualmente a formação de filas e gargalos.

### Heatmap operacional
O grafo muda de intensidade conforme tempo de espera e sobrecarga.

### Scenario Compare
Mostra lado a lado a operação observada e a simulação proposta.

### Opportunity Card
Traduz a melhoria simulada em impacto: horas economizadas, aumento de SLA e redução de espera.

### Demo Mode
Datasets prontos de diferentes setores permitem demonstrar o produto mesmo sem upload externo.

## Segurança

- RLS em todas as tabelas do schema public.
- Dados sempre associados a organization_id.
- Chaves secretas nunca são expostas no cliente.
- Uploads validados no servidor.
- Arquivos CSV armazenados em bucket privado.
- Cálculos e operações sensíveis executados no servidor.

## O que NÃO entra na V1

- microserviço Python separado;
- machine learning sem base estatística justificável;
- integração com ERP externo;
- dezenas de dashboards secundários;
- chatbot genérico;
- billing;
- marketplace;
- app mobile.

A V1 deve provar uma única promessa: transformar dados de processo em um modelo visual confiável, encontrar um gargalo e testar uma mudança mensurável.
