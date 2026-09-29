# ProcessTwin AI — V1.3 Simulation Lab

## Objetivo

Transformar a simulação já existente no Core Cycle em uma experiência interativa, explicável e persistida.

Fluxo esperado:

Process Explorer
→ selecionar gargalo/atividade
→ abrir Simulation Lab
→ configurar hipótese
→ simular
→ comparar Atual × Simulado
→ salvar cenário e resultado

A V1.3 NÃO transforma o engine atual em um simulador industrial de filas. Ela expõe, com clareza, o modelo proporcional já existente.

## Princípio de credibilidade

O engine atual usa o intervalo observado entre eventos consecutivos como base e aplica um fator de melhoria.

Para uma atividade:

factor = (1 - waitReductionPct) / capacityMultiplier

simulatedElapsed = observedElapsed * factor

Limites existentes do engine:
- waitReductionPct: 0% a 95%
- capacityMultiplier: mínimo técnico 0.1
- fator final mínimo: 0.05

Na interface, não chamar esse intervalo de "tempo de serviço real" ou "fila real".

Usar termos como:
- atraso observado;
- intervalo observado;
- redução estimada do atraso;
- capacidade relativa estimada;
- cenário hipotético.

Mostrar aviso curto:
"Esta simulação é uma estimativa baseada nos intervalos observados no event log. Ela ainda não modela filas, concorrência ou utilização real de recursos."

## Rotas

### /processes/[processId]/simulation

Simulation Lab interativo.

Aceitar query opcional:

?activity=<nome-da-atividade>

Quando vindo do Process Explorer, pré-selecionar a atividade clicada.

### Integração com Explorer

No painel lateral de atividade do Process Explorer:
- se houver uma atividade selecionada, mostrar CTA "Simular melhoria";
- link para /processes/[processId]/simulation?activity=<activity encoded>.

Para o principal gargalo, o CTA deve ter maior destaque.

## Fonte de dados

Carregar server-side:
- process;
- análise concluída mais recente;
- dataset ligado à análise;
- process_model;
- bottleneck(s);
- process_events do dataset da análise;
- cenários anteriores do mesmo baseline_analysis_run_id;
- últimos resultados de simulação, se existirem.

Respeitar RLS integralmente.

Não usar service_role no browser.

## Permissões

Leitura:
- qualquer membro autorizado pela RLS pode ver cenários/resultados.

Criar/rodar cenário:
- owner;
- admin;
- analyst;
- criador da organização conforme políticas existentes.

Viewer não deve conseguir criar uma simulação.

A UI deve refletir a permissão, mas a segurança real deve continuar no backend/RLS.

## Parâmetros editáveis

### 1. Atividade alvo

Select com atividades do process_model.

Default:
1. query ?activity se válida;
2. principal gargalo;
3. primeira atividade do modelo.

Mostrar junto:
- cases;
- eventos;
- intervalo médio antes da atividade;
- se é o gargalo principal.

### 2. Redução estimada de atraso

Controle:
0% a 80% na UI.

Step:
5%.

Default sugerido:
30% para gargalo principal.

O engine continua aceitando até 95%, mas a UI limita a 80% para evitar cenários excessivamente otimistas por padrão.

Texto:
"Quanto do intervalo observado antes desta atividade poderia ser reduzido?"

### 3. Capacidade relativa

Controle:
1.0x a 3.0x.

Step:
0.1x.

Default:
1.0x.

Texto:
"Representa uma hipótese de aumento relativo de capacidade. Não equivale diretamente a contratar X pessoas."

Exemplos:
1.0x = sem aumento de capacidade.
1.5x = hipótese de 50% mais capacidade relativa.
2.0x = hipótese de capacidade dobrada.

### 4. SLA

Opcional.

Usuário pode:
- manter SLA automático;
- definir SLA manual em horas/minutos.

Se automático:
usar o comportamento atual do engine, p75 do baseline.

Se manual:
converter para slaThresholdSeconds.

Mostrar explicitamente qual SLA está sendo usado no resultado.

## Cenário

Campos:
- nome;
- descrição opcional;
- atividade alvo;
- waitReductionPct;
- capacityMultiplier;
- slaThresholdSeconds opcional.

Config persistida em simulation_scenarios.config.

Formato recomendado:

{
  "version": "v1",
  "activityAdjustments": {
    "Aprovação": {
      "waitReductionPct": 30,
      "capacityMultiplier": 1.5
    }
  },
  "slaThresholdSeconds": 28800,
  "assumptions": {
    "model": "proportional-observed-interval",
    "queueing": false
  }
}

## Execução server-side

Criar endpoint ou Server Action com responsabilidade equivalente a:

runProcessSimulation(processId, payload)

Passos:

1. autenticar usuário;
2. carregar processo via RLS;
3. carregar analysis_run concluída selecionada/mais recente;
4. verificar que activity pertence ao process_model;
5. validar payload em runtime;
6. carregar process_events do dataset da análise;
7. converter para ProcessEvent;
8. criar simulation_scenario;
9. criar simulation_run status=running;
10. executar simulateImprovement();
11. persistir simulation_results;
12. atualizar simulation_run status=completed;
13. retornar resultado + IDs persistidos.

Em erro após criação do run:
- simulation_run.status = failed;
- error_message com mensagem segura;
- não retornar stack trace ao cliente.

Não duplicar a matemática do engine no route handler.

## Validação de runtime

Não confiar em TypeScript no boundary HTTP.

Validar:
- processId UUID;
- name não vazio e com limite razoável;
- activity string não vazia;
- activity existente no modelo;
- waitReductionPct número finito entre 0 e 80 para UI/API V1.3;
- capacityMultiplier número finito entre 1 e 3;
- SLA opcional, número positivo dentro de um limite razoável;
- description opcional com limite de tamanho.

Rejeitar NaN, Infinity e strings numéricas não convertidas silenciosamente.

## Persistência

### simulation_scenarios

organization_id
process_id
baseline_analysis_run_id
name
description
config
created_by

### simulation_runs

organization_id
process_id
scenario_id
status
iterations

Para V1.3:
iterations = 1

Observação:
A coluna existe para evolução futura. O engine atual é determinístico e não executa Monte Carlo.

random_seed = null.

### simulation_results

organization_id
process_id
simulation_run_id
baseline_metrics
simulated_metrics
deltas
impact_summary

Persistir exatamente o resultado retornado pelo engine, sem recomputar no frontend.

## UX do Simulation Lab

### Cabeçalho

Processo
Dataset
Análise base
Atividade alvo

Breadcrumb:
Process Explorer → Simulation Lab

### Coluna esquerda — Configuração

Card "Hipótese"

Atividade
[ Aprovação ▼ ]

Redução estimada de atraso
[---------30%---------]

Capacidade relativa
[---------1.5x--------]

SLA
(•) Automático
( ) Manual
[ 8h 00min ]

Nome do cenário
[ Aprovação + capacidade ]

[ Simular impacto ]

### Coluna direita — Preview da hipótese

Antes de executar:
- atividade;
- intervalo observado atual;
- principal gargalo ou não;
- fórmula simplificada;
- aviso de modelo proporcional.

Exemplo:

Aprovação
Intervalo observado: 5h02

Hipótese:
-30% de atraso
1.5x de capacidade relativa

Modelo:
estimativa proporcional sobre intervalos observados.

## Resultado Atual × Simulado

Após executar, mostrar comparação forte.

### KPI cards

Ciclo médio
Atual: 6h53
Simulado: 4h48
Variação: -30.3%

P95
Atual: 8h30
Simulado: 6h05
Variação: -28.4%

SLA
Atual: 70%
Simulado: 90%
+20 p.p.

Throughput potencial
+43.2%

Tempo economizado por case
2h05

Horas economizadas / 100 cases
208.3h

## Gráfico comparativo

Implementar visual simples e confiável.

Não precisa adicionar biblioteca de chart se não for necessário.

Pode usar barras horizontais CSS/SVG para:
- ciclo médio;
- P95;
- SLA.

Sempre mostrar números junto da visualização.

Não depender apenas de cor.

## Opportunity Card

Mostrar uma conclusão determinística.

Exemplo:

"Neste cenário, reduzir 30% do atraso observado em Aprovação e considerar capacidade relativa de 1.5x reduz o ciclo médio estimado de 6h53 para 4h48. Isso representa 2h05 economizadas por case e 208h a cada 100 cases."

Se throughputGainPct positivo:
"Inclui ganho potencial de throughput de 43.2%."

Não usar IA generativa.

## Estado "sem melhoria"

Se cenário não produz melhoria:
- não pintar como sucesso;
- mostrar "Este cenário não alterou significativamente os indicadores.";
- permitir editar e simular novamente.

## Estado "cenário extremo"

Se combinação produzir resultado muito agressivo:
mostrar aviso visual quando:
- waitReductionPct >= 70;
- capacityMultiplier >= 2.5;
- fator efetivo <= 0.15.

Texto:
"Cenário agressivo. Interprete o resultado como hipótese exploratória, não como previsão operacional."

## Histórico

Na parte inferior, listar até 10 cenários recentes do baseline atual.

Mostrar:
- nome;
- data;
- atividade;
- redução;
- capacidade;
- ciclo simulado;
- throughput potencial.

Clique em um cenário:
- carrega sua configuração e resultado para leitura;
- não reexecuta automaticamente.

Ação:
"Duplicar cenário" pode preencher o formulário com config anterior, sem sobrescrever o original.

Não implementar edição destrutiva nesta versão.

## Integração com Process Explorer

Adicionar botão:
"Simular melhoria"

No principal gargalo:
CTA destacado.

Para outras atividades:
CTA secundário.

Ao voltar do Simulation Lab:
link "Voltar ao Process Explorer".

## Demo pública

Criar:
/demo/simulation

Usar demoEvents + demoScenario/Core Engine em memória.

Não persistir demo pública no Supabase.

A página deve permitir mexer nos controles localmente e executar o engine em endpoint/demo seguro ou client-only apenas se nenhuma lógica sensível for duplicada.

Preferência:
usar uma rota de demo que execute o mesmo simulateImprovement server-side com dataset fixo.

Objetivo:
permitir testar visual e interação sem login.

## Segurança

- não usar service_role no browser;
- não aceitar organization_id arbitrário do cliente;
- derivar organization/process/dataset do processo autorizado;
- confiar em RLS como segunda barreira;
- validar activity contra o modelo do baseline;
- não confiar em IDs de analysis_run enviados pelo cliente sem verificar relação com process;
- não expor process_events de outra organização;
- não expor stack trace;
- não salvar cenário se usuário não tiver permissão;
- não permitir viewer executar simulação.

## Performance

V1.3 trabalha com o dataset da análise base.

Para datasets pequenos/médios:
- carregar eventos server-side;
- executar engine no servidor;
- persistir resultado.

Não enviar todos os process_events ao browser.

Se eventos ultrapassarem limite operacional futuro, retornar erro claro e registrar dívida técnica para job assíncrono. Não implementar fila/job nesta versão.

## Testes

Adicionar testes para:

### Validação
- payload válido;
- activity inexistente;
- redução negativa;
- redução > 80;
- capacity < 1;
- capacity > 3;
- SLA inválido;
- NaN/Infinity;
- nome vazio.

### Execução
- usa exatamente simulateImprovement;
- cenário reduz ciclo quando hipótese é positiva;
- resultado determinístico;
- cenário 0%/1x preserva baseline;
- SLA manual é respeitado;
- activity adjustment afeta somente transições cujo evento atual é a atividade alvo.

### Persistência
- cenário criado com baseline_analysis_run correto;
- simulation_run completed em sucesso;
- simulation_result persistido;
- simulation_run failed em erro após criação;
- viewer bloqueado/RLS ou camada de autorização;
- processo sem acesso retorna 404/403 coerente sem revelar tenant.

### UI helpers
- cálculo de fator efetivo;
- classificação de cenário agressivo;
- Opportunity Card;
- formatação Atual × Simulado.

Preservar todos os testes anteriores.

## Critérios de aceite

A V1.3 está pronta quando:

1. o Explorer oferece "Simular melhoria";
2. /processes/[processId]/simulation abre com atividade correta pré-selecionada;
3. usuário autorizado configura redução/capacidade/SLA;
4. payload é validado em runtime;
5. eventos permanecem server-side;
6. engine existente é reutilizado;
7. scenario/run/result são persistidos;
8. Atual × Simulado é exibido claramente;
9. impacto mostra tempo/case, horas/100 cases, SLA e throughput;
10. aviso de limitação do modelo está visível;
11. histórico dos últimos cenários é exibido;
12. demo pública funciona;
13. viewer não consegue executar;
14. RLS continua intacto;
15. npm test passa;
16. npm run typecheck passa;
17. npm run build passa;
18. Vercel Preview fica READY e sem runtime errors.

## Fora de escopo

Não implementar:
- Monte Carlo;
- filas reais;
- SimPy;
- resource pools reais;
- concorrência;
- calendários de turno;
- custos financeiros completos;
- otimização automática;
- IA generativa;
- "melhor cenário" automático;
- Python;
- jobs assíncronos;
- comparação histórica entre datasets;
- Time Machine.

## Resultado de demonstração

A pessoa deve conseguir:

1. abrir o gargalo Aprovação;
2. clicar em "Simular melhoria";
3. definir 30% menos atraso e 1.5x de capacidade;
4. clicar em simular;
5. ver Atual × Simulado;
6. entender quantas horas seriam economizadas;
7. salvar e rever o cenário.

Mensagem de produto:

"Não estamos apenas mostrando onde o processo trava. Estamos permitindo testar, com dados reais, o que aconteceria se esse gargalo melhorasse."
