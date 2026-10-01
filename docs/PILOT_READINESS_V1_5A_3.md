# V1.5A.3 — preparação para pilotos verificáveis

O usuário agora encontra um caminho entre o Explorer, a central de conectores e a importação. `/pilot` orienta empresas e escolas a preparar uma exportação, configurar uma fonte recorrente, comprovar atualização/reenvio e conferir uma hipótese de melhoria com a equipe. Os exemplos de pedidos e matrículas são fictícios.

## Experiência

- Estados de conector, sincronização, identidade e análise aparecem em português na central e no resultado.
- Falhas explicam como recuperar a exportação; resultados parciais orientam a correção dos registros inválidos.
- Uma seleção inválida limpa o arquivo anterior. Leituras concorrentes do primeiro CSV não podem substituir a seleção mais recente. O wizard bloqueia arquivos fora dos limites, cabeçalhos normalizados conflitantes e mais de 20% de registros inválidos.
- O login conserva um destino interno validado, permitindo retornar à tela protegida solicitada. Destinos externos, caminhos ambíguos e ciclos de autenticação são recusados.

## Segurança e reprodução

As 16 tabelas públicas herdavam privilégios de manutenção desnecessários para sessões do navegador. A migração `20260930234815_restrict_client_maintenance_privileges.sql` revoga `TRUNCATE`, `REFERENCES` e `TRIGGER` de `authenticated` e `anon`. RLS não protege `TRUNCATE`; o acesso necessário por DML e pelos RPCs continua disponível.

A fundação ausente foi capturada separadamente, sem inventar entradas no histórico remoto. Consulte [procedimento e limites do baseline](../supabase/baselines/README.md). A instalação descartável reproduz o contrato estrutural do projeto real depois de todas as migrações.

## Validação técnica

Comandos: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:sync-db` e `npm run test:e2e`. A suíte de banco exige o banco descartável descrito no README. Playwright inicia o build de produção na porta 3100; instale Chromium com `npx playwright install chromium` ou defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para um executável local. A CI instala Chromium e executa as jornadas após build e PostgreSQL.

Resultado local: 164 testes de aplicação, 22 testes em PostgreSQL e 4 jornadas de navegador, totalizando 190 testes. Typecheck e build aprovados. As jornadas verificam reenvio no demo, guia de matrícula e download, retorno após autenticação e rotas públicas anteriores; os testes de banco verificam permissões, concorrência e persistência, incluindo a ausência de grants de manutenção e a equivalência do contrato.

Na conta de teste do Preview foi criado somente o processo `Piloto V1.5A.3 — CSV recorrente (dados fictícios)`. A importação inicial, o wizard e as sincronizações exercitam Auth, API, Storage privado, RPCs e Core Cycle reais. Primeira exportação: 100 eventos novos. Segunda: 20 novos, 3 atualizados e 100 duplicados, com 120 eventos canônicos. Reenvio: 123 duplicados, nenhuma alteração e nenhuma nova análise. As verificações adicionais e o commit publicado constam no relatório de entrega.

## O que ainda precisa de um piloto operacional

Os testes técnicos e os dados fictícios não demonstram redução real de custos, tempo de ciclo ou retrabalho em uma organização. Um piloto operacional deve registrar responsável, período, meta, problemas de uso, confirmação dos diagnósticos e medidas antes/depois. A equipe deve conseguir executar o ciclo sem assistência contínua.

O envio continua manual; somente Owner/Admin gerencia sync. Não foram introduzidos scheduler, conectores OAuth, tarefas de equipe ou execução autônoma de melhorias. A guia orienta o registro externo das ações, e a simulação continua sendo uma estimativa.

O Security Advisor manteve o aviso anterior de proteção contra senhas vazadas desativada, sem novos findings após a migração. A configuração de Auth continua pendente: [orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
