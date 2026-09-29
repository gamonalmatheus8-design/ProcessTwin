# ProcessTwin AI — V1.4 Universal Data Intake / Multi-Nicho

## Objetivo

Fazer o ProcessTwin receber dados de diferentes segmentos com o mínimo de configuração manual possível.

A V1.4 deve permitir que um usuário sem conhecimento de process mining responda:

"O que você quer analisar?"

e selecione uma opção como:

- Produção
- Pedidos
- Entregas
- Chamados
- Matrículas
- Contratação
- Aprovações
- E-commerce
- Outro processo

A partir disso, o sistema deve orientar o upload, sugerir automaticamente o mapeamento das colunas e explicar a confiança de cada sugestão.

## Princípio arquitetural

Process Packs NÃO criam engines diferentes.

Todos os nichos convergem para o mesmo schema canônico:

- caseId
- activity
- timestamp
- resource

Campos futuros/opcionais já existentes no banco:
- lifecycle
- cost
- status
- metadata

O Process Mining Engine permanece universal.

## Fluxo V1.4

1. Selecionar tipo de processo
2. Selecionar/criar processo
3. Enviar CSV
4. Detectar estrutura
5. Auto Mapping
6. Mostrar confiança/evidência
7. Usuário confirma ou corrige
8. Validar
9. Importar
10. Executar Core Cycle
11. Abrir Process Explorer
12. Abrir Simulation Lab

## Process Packs

Criar catálogo estático e versionado.

Sugestão de tipos:

type ProcessPackId =
  | "production"
  | "orders"
  | "deliveries"
  | "tickets"
  | "enrollment"
  | "hiring"
  | "approvals"
  | "ecommerce"
  | "generic";

Cada pack deve definir:

- id
- label
- description
- exampleProcessName
- aliases por campo canônico
- keywords do domínio
- exemplos de atividades
- sugestões de campos metadata
- KPIs relevantes apenas para apresentação/contexto
- exemplos de arquivo

Process Pack NÃO altera matemática do engine.

## Packs iniciais

### Produção

Case ID provável:
- ordem_producao
- ordem
- op
- lote
- batch
- work_order

Activity:
- etapa
- operacao
- operação
- fase
- posto
- status

Resource:
- operador
- maquina
- máquina
- linha
- setor

### Pedidos

Case ID:
- pedido
- pedido_id
- numero_pedido
- order_id
- order_number

Activity:
- etapa
- status
- evento
- atividade

Resource:
- responsavel
- usuario
- atendente
- operador

### Entregas

Case ID:
- entrega_id
- shipment_id
- tracking_id
- codigo_rastreio
- pedido

Activity:
- status
- etapa
- evento
- checkpoint

Resource:
- motorista
- transportadora
- unidade
- hub

### Chamados

Case ID:
- ticket
- ticket_id
- chamado
- chamado_id
- incident_id

Activity:
- status
- etapa
- atividade
- evento

Resource:
- agente
- tecnico
- responsável
- squad

### Matrículas

Case ID:
- matricula_id
- inscrição
- inscricao_id
- aluno_id
- protocolo

Activity:
- etapa
- status
- situação
- situacao
- evento

Resource:
- atendente
- secretaria
- responsável
- setor

### Contratação

Case ID:
- candidatura_id
- candidato_id
- application_id
- processo_seletivo
- vaga_candidato

Activity:
- etapa
- status
- fase
- evento

Resource:
- recrutador
- entrevistador
- responsável
- rh

### Aprovações

Case ID:
- solicitacao_id
- request_id
- protocolo
- documento_id

Activity:
- etapa
- status
- aprovação
- aprovacao
- evento

Resource:
- aprovador
- responsável
- analista
- setor

### E-commerce

Case ID:
- pedido_id
- order_id
- numero_pedido
- checkout_id

Activity:
- status
- etapa
- evento
- fulfillment_status

Resource:
- operador
- sistema
- transportadora
- centro_distribuicao

### Outro processo

Pack genérico.

Usar aliases universais e inferência por conteúdo.

## Auto Mapping V2

Substituir o atual match binário por sistema de scoring.

Para cada combinação:

header → canonical field

calcular confiança entre 0 e 1.

A confiança deve combinar:

### A. Header similarity

Exemplo:
numero_pedido vs aliases de caseId.

Pode usar:
- igualdade após normalizeHeader;
- token overlap;
- prefix/suffix;
- distância simples ou similarity determinística.

Não usar LLM nesta versão.

### B. Process Pack boost

Se o pack for "tickets":

ticket_id → caseId deve receber boost forte.

Se for "production":

ordem_producao → caseId deve receber boost forte.

### C. Data profiling

Avaliar amostra limitada de linhas.

Case ID tende a:
- repetir entre várias linhas;
- ter cardinalidade menor que número de eventos;
- não ser timestamp.

Activity tende a:
- repetir bastante;
- possuir cardinalidade moderada;
- ser categórica.

Timestamp tende a:
- ter alta taxa de parse de data/hora.

Resource tende a:
- ser opcional;
- categórica;
- repetir entre eventos.

Nunca enviar todo arquivo a qualquer serviço externo.

## Confidence

Retornar por campo:

{
  field: "caseId",
  column: "numero_pedido",
  confidence: 0.98,
  reasons: [
    "alias exato do pack Pedidos",
    "valores se repetem entre eventos"
  ]
}

Faixas de UI:

>= 0.90
Alta confiança

0.70–0.89
Boa confiança

0.50–0.69
Revisar

< 0.50
Não selecionar automaticamente

Campos obrigatórios só podem avançar quando mapeados.

## Conflitos

Uma coluna não pode mapear para dois campos.

Resolver globalmente, não campo a campo isoladamente.

Exemplo:
"status" pode parecer activity e status metadata.

Na V1.4, como activity é obrigatório, priorizar activity quando evidências forem maiores.

Mostrar conflito ao usuário quando diferença de score for pequena.

## Auto-detect do Process Pack

A tela começa perguntando explicitamente o processo, então o pack selecionado é a fonte principal.

Opcionalmente, após ler headers, o sistema pode indicar:

"Os dados parecem mais próximos de Chamados do que Pedidos."

Não trocar automaticamente sem confirmação.

## UI — entrada

Primeira tela:

O que você quer analisar?

Cards:
Produção
Pedidos
Entregas
Chamados
Matrículas
Contratação
Aprovações
E-commerce
Outro processo

Cada card:
- título
- descrição curta
- exemplo

Exemplo:

Chamados

Descubra onde tickets ficam parados, quais etapas concentram atraso e onde existe retrabalho.

## UI — Auto Mapping

Após upload:

"Detectamos a estrutura do seu arquivo."

Exemplo:

Case ID
numero_ticket
Confiança 98%
Alta

Atividade
status_chamado
Confiança 94%
Alta

Timestamp
data_movimento
Confiança 91%
Alta

Recurso
tecnico
Confiança 83%
Boa

Ação:
"Confirmar mapeamento"

Secundária:
"Ajustar manualmente"

O usuário continua no controle.

## Explicabilidade

Cada sugestão deve poder mostrar "Por que?"

Exemplo:

numero_ticket → Case ID

- nome da coluna corresponde ao pack Chamados;
- 240 valores únicos em 1.430 linhas;
- cada ID aparece em média 5,9 vezes.

Não usar texto genérico de IA.

## Data Profile

Depois de parsear o CSV, gerar profile limitado:

por coluna:
- total preenchido
- total vazio
- uniqueCount
- uniquenessRatio
- timestampParseRatio
- numericRatio
- sampleValues limitados

Não persistir profile completo se não for necessário.

Nunca armazenar amostras sensíveis em logs.

## Campos adicionais

A V1.4 pode detectar, mas não precisa integrar completamente ao engine:

- status
- lifecycle
- cost

Se identificados:
mostrar:

"Campo adicional detectado"

O usuário pode optar por mapear.

Para não ampliar demais o backend, é aceitável persistir como metadata na V1.4 se a rota atual ainda não suporta campos dedicados.

Não quebrar ProcessEvent atual sem necessidade.

## Compatibilidade

CSV continua obrigatório nesta versão.

Não implementar ainda:
- XLSX
- Google Sheets
- API REST
- Webhooks
- DB connectors

Isso pertence à V1.5.

## Processo novo

Ao escolher um Process Pack, sugerir nome:

Produção → "Processo de Produção"
Chamados → "Atendimento de Chamados"
Contratação → "Processo de Contratação"

Usuário pode editar.

## Processo existente

Se escolher processo existente:
- manter seu nome;
- permitir selecionar pack apenas para ajudar o mapping da nova importação.

Pack não precisa ser persistido no banco na V1.4.

Se persistência for útil, preferir metadata/config existente antes de migration; só criar migration se houver necessidade clara.

## Backend

O servidor deve reexecutar:
- parse;
- mapping validation;
- normalization;
- validation.

Nunca confiar apenas no mapping/confidence calculado no navegador.

O servidor não precisa confiar no score do cliente.

O score é UX; o mapping confirmado é dado do request e deve ser validado.

## Módulos sugeridos

src/features/import/process-packs.ts
src/features/import/profiling.ts
src/features/import/auto-mapping.ts
src/features/import/auto-mapping.test.ts
src/features/import/profiling.test.ts

Atualizar:
src/features/import/mapping.ts
src/features/import/types.ts
src/features/import/components/import-wizard.tsx

Preferir dividir o wizard em componentes menores se o arquivo crescer demais.

## API interna desejada

profileColumns(parsed)

returns ColumnProfile[]

suggestColumnMappingV2({
  headers,
  profiles,
  processPack
})

returns {
  mapping,
  suggestions,
  conflicts
}

## Determinismo

Mesmo arquivo + mesmo pack devem produzir exatamente o mesmo mapping e confiança.

Sem randomness.

## Segurança e privacidade

- nenhuma amostra enviada a LLM;
- nenhuma coluna enviada a serviço externo;
- não logar valores de linhas;
- manter upload privado;
- RLS intacto;
- server-side revalidation;
- sem service_role no cliente.

## Testes

Adicionar cobertura para:

### Packs
- IDs únicos
- aliases normalizados
- todos os packs possuem campos obrigatórios
- generic funciona

### Profiling
- timestampParseRatio
- uniquenessRatio
- empty ratio
- categorical detection
- datasets vazios

### Auto Mapping
- Pedidos
- Chamados
- Produção
- Matrículas
- RH/Contratação
- Entregas
- Aprovações
- E-commerce
- generic

### Ambiguidade
- coluna "status"
- múltiplos IDs
- timestamp com nome estranho
- duas colunas com scores próximos

### Regressão
- aliases atuais continuam funcionando
- importação atual continua funcionando
- 100% deterministic

## Demo

Criar exemplos pequenos em:

examples/packs/

production.csv
orders.csv
deliveries.csv
tickets.csv
enrollment.csv
hiring.csv
approvals.csv
ecommerce.csv

Cada exemplo deve ser pequeno e demonstrável.

Adicionar uma página demo opcional:

/demo/intake

Ela permite trocar de Process Pack e visualizar o mapping sugerido sem persistência.

## Critérios de aceite

1. tela "O que você quer analisar?" existe;
2. 9 opções incluindo Outro processo;
3. cada opção possui Process Pack real;
4. upload CSV continua funcionando;
5. Auto Mapping usa score/confidence;
6. data profiling influencia o score;
7. pack selecionado influencia o score;
8. usuário vê confiança;
9. usuário pode corrigir mapping;
10. conflitos são tratados;
11. campos obrigatórios continuam sendo validados;
12. server-side revalidation preservada;
13. fluxo antigo não quebra;
14. dados continuam indo para o mesmo Core Cycle;
15. Process Explorer continua funcionando;
16. Simulation Lab continua funcionando;
17. exemplos de múltiplos nichos adicionados;
18. testes/typecheck/build passam;
19. Vercel Preview READY;
20. /demo/intake funciona.

## Fora de escopo V1.4

- conectores externos;
- ingestão incremental;
- webhooks;
- monitoring;
- alertas;
- automações;
- LLM para mapping;
- alteração do Process Mining Engine;
- modelos separados por nicho.

## Resultado esperado

O usuário deve sentir que o ProcessTwin entende o contexto da empresa sem que ele precise aprender o schema interno.

Mensagem de produto:

"Escolha o processo. Envie os dados. O ProcessTwin organiza o restante."
