# ProcessTwin V1 — Core Cycle

## Objetivo de aceitação

A V1 é considerada funcional quando um conjunto de eventos percorre todo este ciclo sem valores de resultado hardcoded:

event log
→ reconstrução do processo
→ detecção do gargalo
→ cenário de melhoria
→ simulação
→ comparação de impacto

## Implementação atual

- `buildProcessModel`: agrupa por case, ordena eventos, descobre transições, variantes, ciclo e retrabalho.
- `findPrimaryBottleneck`: pontua atividades usando espera, volume e retrabalho.
- `simulateImprovement`: aplica ajustes de redução de espera e capacidade às etapas.
- `runCoreCycle`: compõe o pipeline completo.
- `/api/demo-cycle`: expõe o ciclo em JSON e aceita POST de eventos.
- `/demo`: demonstra visualmente o ciclo usando um dataset controlado.

## Contrato mínimo de evento

```ts
{
  caseId: string
  activity: string
  timestamp: string // ISO-8601
  resource?: string
}
```

## Limite consciente da simulação V1

A simulação desta primeira versão é baseada no tempo entre eventos observado no log. Ela não pretende ainda ser um modelo de filas industriais completo. Sua função é provar a arquitetura e permitir evolução posterior sem quebrar o contrato das demais camadas.

## Próximas etapas

1. Parser CSV com mapeamento de colunas.
2. Persistência no Supabase.
3. Testes unitários do engine.
4. Interface interativa do Simulation Lab.
5. Process Explorer em grafo.
6. Evolução do modelo de simulação.
