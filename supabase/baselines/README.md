# Fundação reproduzível do ProcessTwin

A fundação anterior foi criada no Supabase sem uma migração inicial registrada. O arquivo `20260930234128_foundation_baseline.sql` captura essa estrutura, sem dados de usuários, como pré-requisito separado. Sua data identifica a captura; não representa uma migração histórica aplicada ao projeto existente.

## Projeto Supabase novo

1. Crie um projeto dedicado, com as estruturas gerenciadas de Auth e Storage já disponíveis e sem tabelas da aplicação em `public`.
2. Execute o conteúdo completo de `20260930234128_foundation_baseline.sql` uma única vez, em uma transação, usando uma conexão administrativa ou o SQL Editor. Por `psql`, use `psql "$NEW_PROJECT_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/baselines/20260930234128_foundation_baseline.sql`. A variável deve apontar exclusivamente para o projeto novo; não salve sua senha no repositório.
3. Vincule a CLI ao projeto novo (`supabase link --project-ref <novo-project-ref>`), confira o destino e execute `supabase db push --dry-run`. Aplique as migrações rastreadas com `supabase db push` após revisar o plano. Não abra a aplicação para usuários antes de concluir esse passo: as migrações corrigem as políticas herdadas e acrescentam os RPCs.
4. Execute `supabase/schema-contract.sql`. Compare o JSON `contract` com `schema-contract.json`, capturado do projeto de referência após todas as migrações da V1.5A.3. Confira também Auth, URLs de callback, variáveis de ambiente e as políticas do bucket privado `process-datasets`.

O baseline recusa um schema `public` com tabelas e exige `auth.users` e `storage.objects`. Ele cria o bucket privado com os limites capturados. Não provisiona Auth, usuários, segredos, serviços, provedores ou configurações de autenticação.

## Projeto existente

Não execute o baseline. Mantenha o histórico remoto atual e aplique somente migrações realmente pendentes. Não use `migration repair` para registrar uma aplicação fictícia do baseline. O novo arquivo `20260930234815_restrict_client_maintenance_privileges.sql` corresponde à versão efetivamente aplicada no projeto de referência.

`supabase db reset` sozinho ainda não instala essa fundação: ela permanece fora de `migrations` para não alterar o histórico remoto existente. Em uma instalação local descartável, carregue a fundação antes de reproduzir as migrações.

## Verificação automatizada

`npm run test:sync-db` exige um PostgreSQL vazio chamado `processtwin_sync_test`, indicado por `TEST_DATABASE_URL`. A suíte instala infraestrutura mínima **somente de teste** de Auth/Storage, carrega o baseline e todas as migrações em ordem e compara o contrato com o projeto real. Nunca aponte essa suíte para um projeto Supabase existente: ela remove dados de teste entre casos.

O contrato cobre tabelas, colunas, defaults, constraints, índices, RLS, políticas, assinaturas/privilégios/configurações das funções, triggers e configuração do bucket. Não contém linhas de negócio, usuários ou objetos armazenados. Não é um backup de dados ou uma comparação dos corpos das funções; o comportamento dos RPCs é verificado pela suíte de integração.

Ao mudar intencionalmente o schema, crie uma migração, valide-a no ambiente adequado e revise uma nova captura do contrato. Não atualize o snapshot apenas para silenciar uma divergência.
