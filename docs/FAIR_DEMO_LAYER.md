# Fair Demo Layer — escola e empresa

A central `/demo/center` permite escolher uma escola ou empresa e percorrer dados → processo → gargalo → simulação → impacto. O link da home abre a central; as demonstrações técnicas anteriores continuam disponíveis em `/demo`.

## Cenários

- `/demo/center/enrollment`: Instituto Nova Geração, matrículas e retornos de documentação.
- `/demo/center/tuition`: Instituto Nova Geração, mensalidades e retornos da conciliação.
- `/demo/center/tickets`: NexaTech Solutions, chamados com prioridades, categorias e reaberturas.

Cada cenário contém 36 casos completos, equipes e identidades de evento estáveis. Datas e variação são determinísticas. A fábrica sintética inclui caminhos comuns e retrabalho; o DFG, as variantes, os indicadores e o gargalo são derivados pelo Core Cycle real. Não existem métricas de resultado digitadas para apresentação. As organizações, equipes e todos os registros são fictícios, com aviso visível no catálogo e na jornada.

## Interação e hipóteses

O grafo reutiliza ProcessGraph e VariantsPanel. O usuário pode selecionar atividades, variantes, usar zoom/pan e ajustar a visualização. O CSV completo é exportado por `/api/demo-center/[scenario]/csv`, com nome `synthetic-*.csv` e os campos event_id, case_id, activity, timestamp, resource, priority e category. O endpoint aceita somente os três cenários, sem arquivos ou fontes arbitrárias. O parser real valida as exportações nos testes.

A comparação usa simulateImprovement sem duplicar sua matemática. É possível escolher a atividade, reduzir o intervalo em 0–80% e ajustar capacidade em 1×, 1,25× ou 1,5×. Ciclo médio, P95 e casos no prazo são comparados com unidades e diferenças. O prazo de referência, escolhido para fins demonstrativos, é fixo para ambos os lados: 72h em matrículas, 120h em mensalidades e 48h em chamados. Não é um contrato de SLA de uma organização real.

Os intervalos vêm de timestamps pontuais. A simulação mantém os caminhos e o retrabalho e modifica proporcionalmente os intervalos de entrada associados à atividade. Não prevê filas, demanda, custos ou contratação. Redução acumulada de ciclo não equivale automaticamente a horas de trabalho ou economia financeira. A comparação de equipes agrupa casos pela equipe do primeiro evento e não avalia produtividade individual; composição e complexidade também influenciam os resultados.

Navegação direta por `?step=data|process|bottleneck|simulation|impact`, foco no título ao trocar etapa, reinício dos controles, layout responsivo e recuperação de erros/404. O URL conserva a etapa; os parâmetros da hipótese permanecem apenas em memória e reiniciam ao recarregar.

## Isolamento e validação

Não grava no Supabase, não exige login nem credencial privilegiada e não modifica RLS/migrations. A ativação remota da V1.5A.4 continua uma entrega separada pendente; a demo não prova que sync de produção está ativo. Dados sintéticos nunca devem ser descritos como resultados operacionais reais.

Testes verificam identidade/ordenação, casos completos, variantes e gargalos reais, equivalência das exportações com o Core, agrupamento de equipes, cenário neutro e melhoria estimada. Playwright verifica os três percursos, filtros escola/empresa, downloads, controles, reset, erro recuperável, foco e overflow no celular. A CI guarda screenshots sintéticos como artefatos para inspeção visual.
