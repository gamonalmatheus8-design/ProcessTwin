# V1.5A.4 — fechamento da fronteira de confiança do sync

## Problema e comportamento

As RPCs anteriores aceitavam eventos canônicos, hashes e resultados de análise de qualquer sessão Owner/Admin. Autorização por tenant não comprova que o payload veio do parser ou do Core Cycle. Agora somente o servidor autenticado pode enviar esses payloads; a API recebe CSV ou pedido de retry, nunca métricas fornecidas pelo cliente.

A rota valida `getUser()`, processo e papel antes de criar um cliente independente de escrita. O cliente usa `SUPABASE_SECRET_KEY` (preferido) ou `SUPABASE_SERVICE_ROLE_KEY`, exclusivamente no servidor, sem cookies nem sessão persistida. `p_actor` vem do usuário verificado, nunca do formulário. As RPCs `recurring_csv_merge_server` e `recurring_csv_analysis_server` aceitam somente `service_role`, verificam a identidade do ator e consultam novamente Owner/Admin no banco. O tenant permanece derivado do processo/run autorizado.

As funções históricas `recurring_csv_merge` e `recurring_csv_analysis` continuam definidas, mas PUBLIC, anon, authenticated e service_role perdem EXECUTE, tanto no wrapper público como na implementação privada. Nenhuma migration anterior foi removida ou alterada.

O merge exige o caminho exato do run e a existência do objeto no bucket privado. O parser e o Core Cycle reais seguem no servidor. Locks, índices estáveis, revisão, retry de resposta perdida e ingestão independente da análise permanecem. Políticas restritivas bloqueiam escrita direta de resultados live em analysis_runs, process_models e bottlenecks; o pipeline snapshot conserva suas permissões.

## Banco

Migration: `20261001022150_recurring_csv_server_boundary.sql`.

Inclui índices para `sync_runs(mapping_id)` e `sync_runs(analysis_run_id)`, as RPCs de servidor, revogações e políticas live. O baseline V1.5A.3 e seu contrato capturado permanecem como referência histórica. A suíte verifica esse pré-requisito antes de aplicar V1.5A.4 e testa explicitamente as novas diferenças; não substitui o snapshot apenas para acomodar uma mudança local.

## Verificação

- Aplicação: parser, Core Cycle, drift, idempotência, recuperação e análise.
- API: usuário verificado como ator; papel e tenant; indisponibilidade de credencial retorna 503 antes de criar conector/run, sem expor detalhes.
- PostgreSQL independente: concorrência, retry, grants públicos/privados, ator ausente/fora do tenant/com papel revogado, archive ausente, escrita direta de resultados live e regressão snapshot.
- Typecheck, build e jornadas Playwright existentes.

## Ativação e limites

Esta entrega prepara código e migration. Não presumir que o banco remoto ou as variáveis do Preview foram atualizados. Configurar a credencial exclusivamente no ambiente servidor do Preview, aplicar a migration em ambiente aprovado e verificar o sync autenticado antes de habilitar a versão para usuários. O build e as demos públicas não exigem a credencial. Sem ela, a API de sync retorna 503 e não inicia uma operação.

A chave privilegiada tem acesso amplo ao projeto: permanece protegida pelo módulo `server-only`, jamais em NEXT_PUBLIC, logs, respostas ou configuração de conector. Comprometimento do servidor/chave continua fora da garantia; as RPCs não recalculam o Core em SQL. Fluxos snapshot ainda usam o modelo de autorização existente e não foram redesenhados nesta entrega.

Sem scheduler, OAuth, novos conectores ou Fair Demo Layer. Sem merge em main ou publicação manual em produção.
