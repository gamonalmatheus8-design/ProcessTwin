# Google Sheets + execução diária — V1.5B

## Entrega preparada

OAuth Google com escopo `spreadsheets.readonly`, offline consent, PKCE S256, estado aleatório vinculado ao browser, ator e processo, validade de dez minutos e consumo único. O callback deriva o usuário de getUser() e revalida Owner/Admin. A origem e redirect URI vêm de APP_ORIGIN confiável. Refresh tokens ficam cifrados em AES-256-GCM, com chave de 32 bytes fora do banco e AAD incluindo ator, processo e finalidade. Tabelas privadas têm RLS e nenhum grant para sessões ou serviço; as RPCs de servidor acessam os dados após autorização. Nenhum token vai para configuration, browser, URL de retorno ou logs.

Fluxo: conectar Google → indicar ID/link e aba → amostra de até 50 eventos → confirmar colunas e ID estável → revisar frequência → confirmar → validar novamente a fonte inteira → arquivar CSV privado → merge idempotente → analisar o dataset completo quando eventos mudarem. A fonte é lida apenas no host fixo sheets.googleapis.com, sem redirects, com limites de bytes, linhas, colunas e timeout. A grade inclui uma linha/coluna extra para detectar excesso sem truncamento silencioso. Datas devem ser texto ISO 8601; IDs devem ser texto estável, sem fórmulas variáveis ou arredondamento numérico.

Mapping confirmado permanece congelado. Colunas extras não utilizadas não causam remapeamento. Coluna usada ausente ou dados incompatíveis colocam o conector em needs_attention, sem alterar os eventos. Revisão explícita cria nova versão do mapping, mantém a identidade original e preserva versões antigas e histórico. Se a coluna de ID sumiu, deve ser restaurada; não há troca silenciosa de identidade. Pausa manual e desconexão impedem novas execuções; reconectar não retoma automaticamente — exige revisão.

## Agendamento e histórico

Vercel cron diário às 03:00 UTC (00h de Brasília), com até três conectores diários no piloto, limite transacional ao criar e execução concorrente limitada a três. Não é uma fila para grandes volumes. Rotina só funciona quando SHEETS_SCHEDULER_ENABLED=true e CRON_SECRET tem ao menos 32 caracteres; Preview bloqueia execução sem intervenção. Configure somente após validar o fluxo autenticado. Cron Vercel roda em produção, não em Preview. Frequência maior e mais conectores precisam de próxima entrega com capacidade e fila adequadas.

Ator vem de created_by armazenado, nunca de payload do cron; permissões são reavaliadas no banco. Dataset, conector e run são travados na mesma ordem usada pelo merge. Uma lease de cinco minutos e a verificação de run ativo evitam sobreposição manual/agendada. Solicitações interrompidas são encerradas na próxima tentativa; o merge mantém idempotência e revisão de análise. GET temporário pode ser repetido uma vez; erros permanentes pausam, autorização revogada exige reconectar e três falhas temporárias consecutivas exigem atenção. A próxima tentativa agendada é no dia seguinte, sem loop ilimitado.

Histórico mostra origem manual/agendada, duração, sucesso ou falha, novos/alterados/duplicados/inválidos e estado separado da análise. Falha de análise não desfaz ingestão; reanálise explícita usa o Core verdadeiro. Exclusões de linhas da planilha não apagam eventos existentes. A API ainda é síncrona e limitada a 60 segundos / 4 MB / 20.000 linhas / 64 colunas.

## Ativação remota — configuração e teste real pendentes

Em 01/10/2026, o histórico remoto foi consultado: `20261001022150_recurring_csv_server_boundary` e `20261001022225_google_sheets_scheduled_sync` já estão aplicadas. O SQL de cada arquivo foi comparado com `array_to_string(statements, E'\n')` do histórico; ambos são idênticos (MD5 `46d928a03597a73222aae4d0ae7317f7` e `7c68818af6c145b40d5d58b26163d9f0`). Os nomes locais foram reconciliados com as versões remotas, sem reaplicar SQL nem alterar histórico no banco.

Os grants remotos foram conferidos: funções antigas de merge/análise não são executáveis por anon, authenticated ou service_role; RPCs novas são exclusivas de service_role, com search_path vazio. Security Advisor mostra duas informações esperadas de RLS sem políticas nas tabelas privadas e o aviso preexistente de proteção contra senhas vazadas desativada. Performance Advisor mostra somente unused_index (INFO); não remover índices com base no baixo uso do piloto.

Configuração de secrets do servidor, fluxo autenticado CSV, OAuth Google real, planilha sintética e primeiro ciclo agendado ainda precisam de evidência. Os conectores disponíveis não oferecem escrita/listagem de env vars. O acesso ao painel pelo Cloud Browser exige login; a opção GitHub → Google retornou 502 / Connection refused antes de autenticar. Isso não comprova ausência das variáveis nem falha do aplicativo.
1. Configurar no servidor do Preview SUPABASE_SECRET_KEY (ou SERVICE_ROLE_KEY), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_ORIGIN e CONNECTOR_ENCRYPTION_KEY. Nunca usar NEXT_PUBLIC_ para esses valores. APP_ORIGIN deve ser a origem estável e protegida do Preview para esse teste; cadastrar exatamente `${APP_ORIGIN}/api/connectors/google/callback` no cliente OAuth Web do Google. Ativar Sheets API e cadastrar usuário de teste no consentimento. Credenciais não devem ser enviadas no chat ou no repositório.
2. Em instalações novas, aplicar as migrations canônicas em ordem. No projeto `gqlinlrsvktzqgkikxiw`, não reaplicar as duas migrations já registradas; consultar novamente o histórico e conferir grants/índices antes da ativação. Validar o conector CSV existente e a nova conexão Google com usuário autenticado.
3. Testar consentimento, amostra, primeira ingestão, repetição sem duplicação, edição de evento, schema drift, revisão, autorização revogada, pausa e histórico. Fazer esses testes com planilha sintética privada, sem dados pessoais reais.
4. Agendamento em produção exige integração/revisão da branch e configuração separada de APP_ORIGIN, callback OAuth, CRON_SECRET e SHEETS_SCHEDULER_ENABLED=true. Não promover ou habilitar produção apenas por um Preview aprovado. Aplicativo OAuth em modo Testing pode expirar o refresh token; lançamento público exige avaliar os requisitos atuais de verificação Google.

## Evidências e limites

Vitest cobre criptografia/AAD, CSRF, confirmação de schema, autenticação, leitura limitada e recuperação Google. PostgreSQL real cobre grants, isolamento, expiração/replay de OAuth, concorrência com conexões independentes, abandono, idempotência, pausa por drift, versão de mapping, identidade preservada e limite de falhas/capacidade. Playwright testa a interface com respostas sintéticas isoladas, incluindo confirmação e revisão no celular. Isso não comprova OAuth real, credenciais remotas ou execução do cron em produção.

`/test-fixtures/sheets` é uma fixture exclusiva de CI/local: exige E2E_FIXTURES=true e retorna 404 em qualquer ambiente Vercel. Não consulta nem grava Supabase; Playwright intercepta as respostas usadas nessa tela. Todas as demais demos e jornadas existentes continuam verificadas.

Referências: https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get ; https://vercel.com/docs/cron-jobs ; https://supabase.com/docs/guides/api/api-keys
