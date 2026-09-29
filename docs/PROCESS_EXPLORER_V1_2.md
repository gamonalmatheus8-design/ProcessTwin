# ProcessTwin AI — V1.2 Process Explorer

## Objetivo

Transformar o resultado analítico já produzido pela V1.1 em uma experiência visual empresarial que permita compreender rapidamente:

1. como o processo realmente acontece;
2. onde está o gargalo;
3. quanto cada etapa pesa no fluxo;
4. quais caminhos alternativos existem;
5. onde o usuário deve investigar primeiro.

A V1.2 não deve alterar o Process Mining Engine, Bottleneck Engine ou Simulation Engine sem necessidade comprovada.

## Princípio de produto

O Process Explorer deve responder, em menos de 30 segundos:

- Qual é o fluxo principal?
- Qual etapa está atrasando o processo?
- Quantos casos passam por cada etapa?
- Onde existe retrabalho?
- Quais variantes do processo são mais frequentes?
- Qual transição concentra mais espera?

## Rotas

### /processes/[processId]

Página executiva do processo.

Exibe:
- nome e status;
- dataset/análise mais recente;
- KPIs principais;
- gargalo atual;
- CTA para abrir o Process Explorer.

### /processes/[processId]/explorer

Visualização interativa completa.

A página deve carregar o último `process_model` concluído do processo e o bottleneck correspondente ao mesmo `analysis_run`.

Não recalcular o processo no cliente.

## Fonte de dados

Usar dados persistidos existentes:

- processes
- datasets
- analysis_runs
- process_models
- bottlenecks

Respeitar integralmente RLS.

O frontend não deve receber dados de outra organização.

## Cabeçalho do Explorer

Mostrar:

- nome do processo;
- dataset analisado;
- horário/data da análise;
- total de cases;
- total de eventos;
- ciclo médio;
- P95;
- retrabalho;
- quantidade de atividades;
- quantidade de variantes.

## Grafo interativo

Usar uma biblioteca adequada de graph UI, preferencialmente `@xyflow/react`.

Para layout automático, usar uma solução simples e determinística como `@dagrejs/dagre` ou equivalente compatível.

O grafo é somente leitura nesta versão.

### Nós

Cada atividade vira um nó.

Mostrar diretamente no nó:

- nome da atividade;
- número de cases;
- espera média antes da atividade;
- indicador visual de saúde.

O nó do principal gargalo deve ficar claramente destacado.

O tamanho ou peso visual pode refletir volume, mas sem tornar o layout instável.

### Heatmap

A intensidade visual do nó deve ser baseada principalmente em `avgIncomingWaitSeconds`, normalizado dentro do processo.

Faixas sugeridas:

- saudável;
- atenção;
- alto;
- crítico.

O bottleneck calculado pelo engine sempre deve ter prioridade sobre a classificação visual.

Não inventar um score novo no frontend.

### Transições

Cada `ProcessEdge` vira uma aresta.

Mostrar:

- source → target;
- quantidade de ocorrências;
- espera média da transição.

A espessura da aresta pode variar de acordo com `count`.

Evitar labels sobrepostos.

### Interações

O usuário deve conseguir:

- zoom;
- pan;
- fit view;
- clicar em um nó;
- clicar ou selecionar uma variante;
- voltar à visão completa.

Não permitir arrastar nós para editar o processo de forma persistente nesta versão.

## Painel lateral de atividade

Ao clicar em um nó, abrir um painel lateral.

Mostrar:

- atividade;
- cases afetados;
- eventos;
- espera média;
- retrabalho da atividade;
- participação no total de cases;
- se é ou não o principal gargalo;
- bottleneck score, se aplicável;
- severidade, se aplicável;
- evidências do bottleneck, se aplicável.

Exemplo:

Aprovação

Cases: 12
Eventos: 13
Espera média: 5h31
Retrabalho: 7,7%
Cobertura do processo: 100%
Gargalo: crítico
Score: 92/100

## Painel de transição

Opcional se couber no escopo sem prejudicar a estabilidade.

Ao selecionar uma aresta:

- origem;
- destino;
- volume;
- espera média;
- percentual dos cases que passam por ela.

Se isso complicar muito a implementação, priorizar o painel de atividade.

## Variantes

Criar uma seção lateral ou inferior com as variantes encontradas.

Mostrar as 5 principais inicialmente.

Para cada variante:

- posição;
- caminho;
- caseCount;
- percentual do total de cases.

Exemplo:

1. Pedido → Análise → Aprovação → Expedição
72%

2. Pedido → Análise → Correção → Análise → Aprovação → Expedição
18%

### Seleção de variante

Ao selecionar uma variante:

- destacar no grafo os nós e transições pertencentes ao caminho;
- reduzir visualmente o destaque das demais;
- mostrar o número de cases daquela variante.

Adicionar ação "Todas as variantes".

A seleção é visual. Não recalcular métricas.

## Insight executivo

Acima ou ao lado do grafo, mostrar uma conclusão curta baseada estritamente nos dados existentes.

Exemplo:

"Principal gargalo: Aprovação. A etapa apresenta a maior espera média do processo e afeta 100% dos cases analisados."

Não usar LLM nesta versão.

O texto deve ser montado deterministicamente a partir de `bottlenecks` e `process_model`.

## Estados da página

### Loading
Skeleton ou estado de carregamento profissional.

### Sem análise
Se o processo existe, mas não possui `process_model` concluído:

"Este processo ainda não possui uma análise disponível."

CTA:
"Importar dados"

### Erro
Mensagem clara, sem expor stack trace.

### Processo inexistente ou sem acesso
Usar resposta adequada, sem revelar existência de processo pertencente a outra organização.

## Navegação após importação

Após a V1.1 concluir uma importação com sucesso, o resultado deve oferecer:

"Abrir Process Explorer"

Link:

/processes/<processId>/explorer

O resultado atual da importação não precisa ser removido.

## Componentes sugeridos

src/features/process-explorer/

- process-explorer.tsx
- process-graph.tsx
- process-node.tsx
- activity-panel.tsx
- variants-panel.tsx
- process-kpis.tsx
- executive-insight.tsx
- graph-layout.ts
- selectors.ts
- formatters.ts
- types.ts

Não é obrigatório seguir exatamente esses nomes, mas preservar separação de responsabilidades.

## Camada de dados

Criar uma função server-side para carregar o Explorer.

Exemplo conceitual:

getLatestProcessExplorerData(processId)

Ela deve:

1. buscar o processo acessível ao usuário;
2. buscar a análise concluída mais recente;
3. carregar process_model ligado ao analysis_run;
4. carregar bottleneck(s) desse analysis_run;
5. carregar dataset relacionado;
6. devolver um view model estável para a UI.

Evitar múltiplos fetches client-side desnecessários.

## Performance

- não renderizar centenas de labels simultaneamente se prejudicar legibilidade;
- evitar recalcular layout em todo render;
- memoizar layout derivado;
- fitView somente quando apropriado;
- considerar limitar visualmente variantes muito raras em logs grandes, sem apagar os dados originais.

Nesta V1.2, priorizar datasets pequenos e médios com comportamento estável.

## Responsividade

Desktop é prioridade porque o produto será demonstrado em tela grande.

Ainda assim:

- não quebrar em tablet;
- em telas menores, permitir scroll;
- painel lateral pode virar drawer/bloco abaixo do grafo.

## Acessibilidade

- botões com nomes claros;
- foco visível;
- nós clicáveis acessíveis por teclado quando a biblioteca permitir;
- não depender somente de cor para indicar gargalo;
- incluir badge/texto como "Gargalo" e "Crítico".

## Testes

Adicionar testes para:

- transformação de `ProcessModel` em nodes/edges da biblioteca;
- classificação visual de health/heat;
- layout determinístico;
- cálculo de participação da atividade;
- cálculo percentual das variantes;
- seleção de variante destacando somente o caminho correto;
- criação do insight executivo;
- estado sem análise;
- autorização/404 da camada server-side quando aplicável.

Preservar todos os testes existentes.

## Critérios de aceite

A V1.2 está concluída quando:

1. um processo analisado pode ser aberto em `/processes/[processId]/explorer`;
2. o grafo é construído a partir do `process_model` persistido;
3. atividades e transições são visíveis;
4. o principal gargalo está claramente destacado;
5. clicar em uma atividade abre suas métricas;
6. as principais variantes são listadas;
7. selecionar uma variante destaca o caminho no grafo;
8. os KPIs do processo são exibidos;
9. o insight executivo usa apenas dados calculados;
10. o fluxo de importação da V1.1 oferece link para o Explorer;
11. `/demo` continua funcionando;
12. todos os testes, typecheck e build passam.

## Fora de escopo

Não implementar ainda:

- Time Machine;
- edição manual do processo;
- BPMN completo;
- IA generativa;
- chatbot;
- simulação avançada de filas;
- Python;
- colaboração em tempo real;
- filtros por período complexos;
- comparação entre múltiplos datasets;
- exportação PDF;
- integrações externas.

## Resultado esperado para demonstração

A pessoa deve conseguir olhar para o Explorer e dizer imediatamente:

"Entendi como esse processo funciona e onde está travando."

Esse é o objetivo da V1.2.


## Preview deployment

A V1.2 deve ser validada em Preview Deployment antes do merge para `main`.
