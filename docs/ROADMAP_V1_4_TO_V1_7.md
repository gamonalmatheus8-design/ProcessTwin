# ProcessTwin AI — Roadmap V1.4 → V1.7

## V1.4 — Universal Intake / Multi-Nicho

Objetivo:
Permitir que empresas de diferentes segmentos importem seus dados sem precisar entender previamente o schema interno do ProcessTwin.

Fluxo:

O que você quer analisar?
→ Process Pack
→ arquivo
→ Auto Mapping
→ confiança
→ confirmação
→ validação
→ importação
→ Process Mining
→ gargalo
→ Simulation Lab

Núcleo:
- Universal Data Intake
- Auto Mapping
- Process Packs
- detecção de intenção/processo
- confiança por coluna
- sugestão de campos extras
- "Outro processo" genérico

## V1.5 — Conectores + atualização automática

Objetivo:
Eliminar dependência do upload manual recorrente.

Fontes prioritárias:
- CSV recorrente
- Google Sheets
- API REST
- Webhook
- banco SQL
- integrações especializadas depois

Fluxo:
Conector
→ ingestão incremental
→ normalização
→ deduplicação
→ atualização de dataset/process events
→ nova analysis_run

Princípios:
- idempotência
- checkpoints
- cursor/since timestamp
- logs de sincronização
- sem duplicar eventos

## V1.6 — Monitoring / Alertas

Objetivo:
Transformar o ProcessTwin de ferramenta de análise em monitor contínuo.

Detectar:
- aumento de ciclo médio
- aumento de P95
- novo gargalo
- piora de SLA
- crescimento de retrabalho
- mudança de variante dominante
- aumento anormal de volume

Alertas:
- dentro do app
- e-mail/webhook posteriormente

Comparação:
baseline anterior
vs
janela atual

Não gerar alerta por qualquer oscilação; exigir limiar configurável.

## V1.7 — Automation Layer

Objetivo:
Permitir ação automática ou assistida sobre problemas detectados.

Fluxo:
DETECTAR
→ EXPLICAR
→ SIMULAR
→ RECOMENDAR
→ EXECUTAR

Primeiras automações seguras:
- criar alerta
- abrir tarefa
- disparar webhook
- enviar notificação
- solicitar revisão/aprovação

Não executar alterações destrutivas em sistemas externos sem confirmação.

## Direção de produto

O ProcessTwin deve evoluir de:

"analise meu CSV"

para:

"conecte seu processo uma vez e acompanhe continuamente onde ele está perdendo tempo e quais melhorias teriam maior impacto."
