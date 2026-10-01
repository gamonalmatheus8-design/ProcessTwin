# ProcessTwin Premium Frontend — V1.6

## North star

A referência visual desta entrega é o dashboard escuro enviado pelo proprietário em 01/10/2026: sidebar compacta, canvas navy quase preto, superfícies discretas, alta densidade informacional, hierarquia forte de KPIs, gráficos integrados e azul usado com disciplina.

A implementação adapta essa linguagem para Process Mining e Digital Twin. Não copia marca, textos, conteúdo ou estrutura proprietária da referência.

## Reference lock

**Direção primária:** dark enterprise analytics workbench.

**Preservar:**
- sidebar fixa e compacta;
- topbar discreta;
- fundo #070A12 / navy quase preto;
- superfícies com pequena diferença de luminância;
- bordas hairline;
- poucos shadows;
- azul operacional apenas para ação, seleção e dados;
- números tabulares;
- layouts densos no desktop;
- gráficos e tabelas como conteúdo principal.

**Borrowed craft rules:**
- tipografia sans neutra, uma família;
- tracking consistente em labels pequenas;
- máximo de níveis de texto;
- cards somente quando ajudam interação/agrupamento;
- estados semânticos preservam verde/amarelo/vermelho;
- evitar violet/indigo, glassmorphism e gradients decorativos em excesso.

**Rejeitar:**
- dashboard genérico de IA;
- roxo/violeta;
- glow em todos os componentes;
- glassmorphism generalizado;
- card para cada bloco;
- tipografia editorial/serif;
- alterações de lógica de negócio para fins visuais.

## Tokens

- background: #070A12
- sidebar: #090D18
- surface: #0F1420
- surface-raised: #141B29
- text: #F4F7FB
- secondary text: #A6B0C0
- muted text: #707C90
- accent: #3B82F6
- success: #3CCF8E
- warning: #E7B84F
- danger: #F06472
- radius: 5 / 7 / 10 / 12 px
- border: rgba(255,255,255,.075)

## Entrega

- tokens escuros centralizados;
- novo tema operacional;
- AppShell com marca, navegação e status;
- landing pública com preview analítico;
- Process Overview com volume de atividades e variantes reais;
- Process Explorer refinado sem alterar motor;
- Simulation Lab refinado sem alterar cálculo;
- Connector Center e Sync History integrados ao mesmo sistema;
- Auth, Intake e demos herdam o design system.

## Restrições

A entrega não altera:
- Core Cycle;
- métricas;
- simulação;
- Supabase/RLS;
- OAuth;
- Google Sheets;
- sync;
- identidade de eventos.

## QA esperado

Validar:
- 1440px;
- 1024px;
- 768px;
- 390px;
- overflow;
- foco e teclado;
- contraste;
- tabelas;
- Process Explorer;
- Connector Center;
- Auth;
- Home.
