# ProcessTwin AI — V1.5 Connectors + Automatic Sync

## Goal

Turn ProcessTwin from a manual-upload product into a continuously synchronized process intelligence system.

Target flow:

Connector
→ fetch/receive records
→ normalize
→ identify source event
→ deduplicate/idempotency
→ persist canonical events
→ mark process dirty
→ coalesce changes
→ run analysis
→ update Explorer / Simulation baseline

The V1.5 must not move connector-specific logic into the Process Mining Engine.

The Core Cycle remains universal.

---

## 1. Architectural principles

### 1.1 Exactly-once effect, not exactly-once transport

Do not assume a source, webhook, queue, cron, API or worker will execute only once.

The system must remain correct if:
- a webhook is delivered twice;
- a queue message is retried;
- a REST page is fetched twice;
- a Google Sheet is read again;
- a worker crashes after writing events but before acknowledging work;
- manual sync and scheduled sync happen at nearly the same time.

Correctness must come from database idempotency.

### 1.2 Connector collection is separate from process mining

Layers:

1. Source Connector
2. Sync Orchestrator
3. Normalization
4. Identity / Deduplication
5. Canonical Event Store
6. Analysis Scheduler
7. Existing Core Cycle

No connector should call mining logic directly while iterating source rows.

### 1.3 One canonical event schema

All sources converge into the existing ProcessTwin event schema:

- case_id
- activity
- event_time
- resource
- lifecycle
- cost
- status
- metadata

### 1.4 Mapping becomes stable configuration

Auto Mapping V2 helps configure a connector initially.

After activation, the mapping is versioned and frozen.

A future sync must not silently remap columns if the source schema changes.

Schema drift must create a needs_attention state.

### 1.5 Checkpoints advance only after durable success

A connector cursor/watermark must only advance after:
- source records were fetched;
- records were validated;
- dedupe/upsert completed;
- sync run was durably recorded.

If a run fails, the previous checkpoint remains valid.

---

## 2. High-level architecture

### Pull connector

Scheduler
→ enqueue connector_sync
→ worker claims connector
→ adapter fetches page
→ mapping + validation
→ event identity
→ upsert canonical events
→ store checkpoint
→ mark process dirty
→ acknowledge job

### Push connector

External system
→ webhook endpoint
→ signature validation
→ idempotency key
→ queue
→ worker
→ mapping + validation
→ event identity
→ upsert canonical events
→ mark process dirty

### Analysis

process dirty
→ analysis debounce window
→ one analysis job
→ Core Cycle
→ analysis_run
→ process_model
→ bottleneck

Do not execute a complete Core Cycle for every single incoming webhook.

---

## 3. Connector types

Initial architecture must support these types:

- recurring_csv
- google_sheets
- rest_api
- webhook
- sql_database

Implementation order for V1.5:

1. recurring_csv
2. google_sheets
3. generic REST API
4. generic webhook
5. SQL database after the first four are stable

The connector interface must support SQL without implementing it prematurely.

---

## 4. Connector adapter contract

Create a connector abstraction independent from UI.

Conceptually:

```ts
type ConnectorType =
  | "recurring_csv"
  | "google_sheets"
  | "rest_api"
  | "webhook"
  | "sql_database";

type ConnectorCapabilities = {
  mode: "pull" | "push";
  incremental: boolean;
  supportsSchemaDiscovery: boolean;
  supportsStableSourceIds: boolean;
  supportsUpdates: boolean;
};

type FetchContext = {
  checkpoint: unknown;
  limit: number;
};

type SourceRecord = {
  data: Record<string, unknown>;
  sourceId?: string;
  sourceUpdatedAt?: string;
};

type SourcePage = {
  records: SourceRecord[];
  nextCheckpoint?: unknown;
  hasMore: boolean;
};

interface ConnectorAdapter {
  type: ConnectorType;
  capabilities: ConnectorCapabilities;

  testConnection(): Promise<ConnectionTestResult>;
  discoverSchema(): Promise<SourceSchema>;

  fetchPage?(context: FetchContext): Promise<SourcePage>;

  validateWebhook?(
    request: Request
  ): Promise<ValidatedWebhookPayload>;
}
```

Connectors return source records.

They do not know how ProcessTwin mines a process.

---

## 5. Data model

V1.5 requires a migration.

Do not overload datasets with connector credentials or scheduler state.

### 5.1 connectors

Public tenant-scoped metadata.

Suggested fields:

- id uuid PK
- organization_id
- process_id
- dataset_id
- type
- name
- status
- sync_mode
- schedule_minutes nullable
- process_pack_id nullable
- configuration jsonb
- credential_ref nullable
- created_by
- created_at
- updated_at

Status:

- draft
- active
- paused
- needs_attention
- needs_reauth
- disabled

Do not store clear-text passwords, OAuth refresh tokens or API keys in configuration.

### 5.2 connector_mappings

Versioned mapping configuration.

Fields:

- id
- connector_id
- version
- source_schema_hash
- canonical_mapping jsonb
- identity_config jsonb
- active
- created_by
- created_at

Only one active mapping per connector.

Example identity_config:

```json
{
  "strategy": "source_id",
  "fields": ["event_id"],
  "version": "v1"
}
```

or:

```json
{
  "strategy": "canonical_fingerprint",
  "version": "v1"
}
```

### 5.3 connector_sync_state

Machine state, separate from user-facing connector config.

Suggested fields:

- connector_id PK
- checkpoint jsonb
- watermark timestamptz nullable
- last_attempt_at
- last_success_at
- next_sync_at
- consecutive_failures
- lease_owner nullable
- lease_until nullable
- updated_at

Checkpoint may contain provider cursor tokens.

Do not expose this table broadly to clients.

### 5.4 sync_runs

Auditable execution history.

Fields:

- id
- organization_id
- process_id
- connector_id
- dataset_id
- trigger
- status
- checkpoint_before jsonb
- checkpoint_after jsonb
- started_at
- completed_at
- fetched_count
- accepted_count
- duplicate_count
- updated_count
- invalid_count
- page_count
- error_code
- error_message
- created_at

Trigger:

- manual
- scheduled
- webhook
- retry

Status:

- queued
- running
- succeeded
- partial
- failed
- canceled

### 5.5 process_events additions

Preserve the current canonical engine table.

Add nullable fields for connector-managed events:

- connector_id
- sync_run_id
- source_event_key
- source_payload_hash
- source_updated_at
- ingested_at

Manual V1.4 CSV events keep connector_id null.

Create uniqueness for connector events:

```
unique(connector_id, source_event_key)
where connector_id is not null
```

The exact index form should be reviewed against Postgres/Supabase migration constraints.

### 5.6 datasets

A connector should point to a long-lived live dataset.

Recommended model:

- manual CSV import = snapshot dataset
- connector-backed process = live dataset

One process can begin with one live dataset in V1.5.

Multiple connectors may feed the same live dataset in the future.

Do not create a new dataset on every sync run.

---

## 6. Event identity and idempotency

This is the most important part of V1.5.

Each incoming logical event receives a stable:

```
source_event_key
```

and a content hash:

```
source_payload_hash
```

### 6.1 Identity strategy priority

1. Provider stable event ID
2. User-selected stable source columns
3. Canonical event fingerprint

### 6.2 Provider ID

Example:

```
connector_id + external_event_id
```

Best strategy when available.

### 6.3 Selected columns

For sources without event IDs:

```
ticket_id + status + event_timestamp
```

or a user-configured unique source key.

### 6.4 Canonical fingerprint

Fallback:

Versioned canonical serialization of fields such as:

- case_id
- activity
- event_time ISO
- normalized resource
- lifecycle
- status

Then SHA-256.

Example conceptual input:

```
event_identity_v1
|case=P-501
|activity=approved
|time=2026-09-01T12:00:00Z
|resource=user-7
```

Never use unstable JSON property ordering.

Implement a deterministic serializer.

### 6.5 Duplicate behavior

If:

same source_event_key
+
same source_payload_hash

Then:

duplicate_count += 1
no new process_event
no update

### 6.6 Source update behavior

If:

same source_event_key
+
different source_payload_hash

Then:

update the canonical process_event
updated_count += 1
mark process dirty

Do not create a duplicate event.

The previous analysis artifacts remain immutable snapshots of calculated results.

Full temporal event revisioning can be introduced later if Time Machine requires exact source reconstruction.

---

## 7. Checkpoints and incremental sync

### 7.1 Cursor APIs

For APIs with cursor pagination:

- persist cursor only after the page is durably committed;
- retrying the same cursor is safe because of idempotency.

### 7.2 Updated-at APIs

Use a high-watermark.

Recommended pattern:

```
source_updated_at >= watermark - overlap_window
```

Example overlap:

5 minutes.

The overlap intentionally fetches some records again.

Idempotency removes duplicates and protects against late-arriving records.

### 7.3 No incremental capability

Use snapshot-diff style sync.

Fetch source snapshot
→ compute event keys
→ upsert known/new events

Do not infer source deletions in V1.5 unless the provider exposes reliable delete/tombstone semantics.

---

## 8. Google Sheets strategy

Google Sheets does not provide a reliable row-level updated timestamp suitable for generic incremental event sync.

Therefore V1.5 should use:

snapshot read
→ event identity
→ hash comparison
→ dedupe/update

Identity rules:

Preferred:
- user selects a stable event ID column

Fallback:
- canonical fingerprint

Do not use physical row number as the durable event ID because sorting/inserting rows makes it unstable.

Set practical row limits and pagination/range handling.

If a mapped required column disappears, pause the connector as needs_attention.

---

## 9. REST API strategy

Connector configuration:

- base URL
- method (GET for first version)
- pagination mode
- record path
- source ID path
- updated-at path optional
- cursor path optional
- headers references through credential store
- request timeout
- rate limit configuration

Supported pagination patterns initially:

- cursor
- page number
- next URL

Avoid executing arbitrary user JavaScript transformations.

Transformation stays declarative through mapping paths.

Retry:

- 429
- 500
- 502
- 503
- 504

Use exponential backoff with jitter.

Auth 401/403 should move connector to needs_reauth instead of infinite retry.

---

## 10. Webhook strategy

Endpoint concept:

```
POST /api/connectors/webhook/[connectorId]
```

The endpoint must:

1. resolve connector;
2. verify connector status;
3. validate signature/secret;
4. enforce body size limit;
5. derive idempotency key;
6. enqueue payload or normalized source record;
7. return 202 quickly.

Do not execute a complete Core Cycle synchronously in the webhook request.

Webhook idempotency priority:

1. provider idempotency header
2. provider event_id
3. configured identity fields
4. payload fingerprint fallback

Webhook endpoint must not trust organization_id supplied by payload.

Organization/process come from connector configuration.

---

## 11. SQL connector strategy

Design support now, implementation after other connectors are stable.

Rules:

- read-only database credentials;
- server-side only;
- TLS required where supported;
- never expose credentials to browser;
- no arbitrary mutation SQL;
- V1.5 should prefer a configured table/view + selected columns;
- custom query support, if added, must be read-only and tightly validated.

Identity should prefer source primary key.

Incremental sync should prefer:
- updated_at
- monotonic sequence
- CDC cursor later

Do not build CDC in the first V1.5 release.

---

## 12. Secret handling

Connector metadata and credentials are different concerns.

Public connector rows contain only:

```
credential_ref
```

Actual secrets are stored through a server-only credential provider.

Required abstraction:

```ts
interface CredentialStore {
  put(secret): Promise<CredentialRef>;
  get(ref): Promise<Secret>;
  rotate(ref, secret): Promise<void>;
  delete(ref): Promise<void>;
}
```

Do not commit to storing provider secrets inside connector.configuration.

Implementation options should be evaluated during V1.5 implementation:
- Supabase Vault
- a server-only encrypted credential table
- another managed secret store

Whichever is selected must satisfy:

- no NEXT_PUBLIC secret;
- no client-readable tokens;
- secrets redacted from logs;
- credential access only from worker/server runtime;
- provider refresh tokens never returned to browser after initial OAuth exchange.

The existing Supabase publishable key remains client-safe.

If a privileged Supabase secret/service identity becomes necessary for background workers, it must exist only in server/worker environment and every worker query must still scope connector, organization and process explicitly.

---

## 13. Scheduling architecture

Do not create one cron job per connector.

Use one global scheduler.

Recommended:

Global scheduler every minute
→ find active pull connectors where next_sync_at <= now()
→ enqueue connector_sync messages

This scales much better than thousands of cron definitions.

Current Supabase platform supports Postgres Cron and durable Postgres-native queues; V1.5 can use these primitives, but application idempotency remains mandatory even when queue delivery is reliable.

### Queue message

Conceptually:

```json
{
  "connectorId": "...",
  "reason": "scheduled",
  "requestedAt": "..."
}
```

Do not put credentials or source payloads in scheduler messages.

---

## 14. Durable queue and worker

Use a durable queue for sync jobs.

One logical queue:

```
connector-sync
```

Worker:

1. receive message;
2. acquire connector lease;
3. skip if connector inactive;
4. create sync_run;
5. fetch one or more pages;
6. persist events idempotently;
7. commit checkpoint;
8. mark process dirty;
9. mark sync_run succeeded;
10. acknowledge message.

If worker crashes after event commit but before ack:

message may be retried.

Idempotency guarantees no duplicate events.

---

## 15. Concurrency control

Never allow two active sync workers for the same connector.

Use a database lease rather than an in-memory lock.

Lease fields:

- lease_owner
- lease_until

Acquire with an atomic conditional update.

Lease must expire automatically if worker dies.

Manual sync and scheduled sync use the same lease.

Do not rely only on the queue to prevent concurrent work.

---

## 16. Analysis debounce / coalescing

This is required for webhooks and frequent connectors.

Never run analysis for every individual event.

Create process analysis state concept:

- process_id
- dirty_since
- last_analysis_at
- next_analysis_at
- pending_event_count

When a successful sync adds/updates data:

mark process dirty.

Analysis scheduler runs when:

- next_analysis_at <= now()
- and no analysis already running

Suggested default:

5 minute debounce

or immediate when manual user explicitly requests "Sync and analyze now".

Multiple webhook deliveries within the window produce one analysis.

---

## 17. Schema drift

On connector creation:

discover schema
→ Auto Mapping V2
→ user confirms
→ save source_schema_hash
→ mapping version 1

On later sync:

### Safe additive drift

New unmapped source columns:

continue sync
log warning

### Breaking drift

Mapped required column missing:

do not silently remap

connector.status = needs_attention

sync_run = failed/partial

do not advance checkpoint

### Significant profile drift

Examples:

timestamp column stops parsing
activity becomes empty
case ID becomes mostly missing

stop or quarantine according to severity.

Do not silently guess a new mapping during an automated sync.

---

## 18. Invalid records

A sync can contain valid and invalid records.

Define threshold.

Example:

If invalid ratio <= 5%:
- persist valid events
- sync status partial
- expose invalid_count
- keep connector active

If invalid ratio > 5%:
- do not advance checkpoint
- needs_attention
- sync failed

Exact threshold should be configurable later.

Do not store raw sensitive row values in error logs.

Errors should identify:
- source record position/key where possible
- field
- validation reason

---

## 19. Failure classification

### Transient

Examples:
- timeout
- 429
- 5xx
- network issue

Action:
retry with exponential backoff + jitter.

### Authentication

401 / 403 from source.

Action:
connector.status = needs_reauth

No aggressive retries.

### Schema / mapping

Required source field missing.

Action:
connector.status = needs_attention

### Data quality

Invalid ratio over threshold.

Action:
needs_attention

### Internal analysis failure

Ingestion can succeed while analysis fails.

Do not roll back successfully ingested canonical events.

Record downstream analysis failure separately.

---

## 20. Retry policy

Suggested default:

attempt 1: immediate
attempt 2: +30 sec
attempt 3: +2 min
attempt 4: +10 min
attempt 5: +30 min

Use jitter.

After max attempts:
- sync_run failed
- increment consecutive_failures
- connector may become needs_attention depending on error class

A later scheduled run may recover transient issues.

---

## 21. Raw data retention

Do not make raw source payload storage mandatory.

Canonical process_events remain the primary analytical data.

For debugging/replay:

- recurring CSV may retain original uploaded files in private Storage;
- other connector payload retention should be opt-in or short-lived;
- webhook bodies should not be logged by default;
- OAuth tokens and API credentials never belong in sync logs.

---

## 22. Observability

Connector UI needs an operational view.

Show:

- status
- last success
- last attempt
- next scheduled sync
- last duration
- fetched
- accepted
- duplicates
- updated
- invalid
- consecutive failures

Sync run detail:

- connector
- trigger
- start/end
- checkpoint moved or not
- metrics
- error category
- sanitized error

Never show secret headers/tokens.

---

## 23. Permissions

Suggested:

### Viewer

- read connector status
- read sync history

### Analyst

- read
- trigger manual sync
- inspect mapping
- cannot manage credentials

### Admin / Owner

- create connector
- OAuth/connect credentials
- edit mapping
- pause/resume
- rotate credentials
- delete/disable connector

Backend enforcement is mandatory.

UI permissions alone are not security.

---

## 24. Analysis consistency

Existing analysis_runs point to a dataset.

For connector-backed processes:

- use the long-lived live dataset;
- analysis_run captures computed snapshot metrics/model at that time;
- only trigger new analysis when accepted_count + updated_count > 0.

Old analysis artifacts remain unchanged.

A future Time Machine feature can add full event temporal versioning if exact historical event reconstruction is required.

---

## 25. V1.5 UI

### Connector center

Route concept:

```
/processes/[processId]/connectors
```

Cards:

- CSV recorrente
- Google Sheets
- REST API
- Webhook
- Banco SQL

Show:

Connected / Paused / Needs attention / Needs reauth

### Connector setup

1. Choose source
2. Authenticate/configure
3. Test connection
4. Discover schema
5. Auto Mapping V2
6. Configure event identity
7. Configure schedule
8. Initial sync
9. Review results
10. Activate

### Sync history

Last runs table.

Manual button:

```
Sincronizar agora
```

Manual sync must use the same queue/worker path as scheduled sync.

No special bypass implementation.

---

## 26. Initial connector behavior

### recurring_csv

Purpose:
repeatedly upload a new export from the same business system while preserving dedupe.

Flow:
upload file
→ same saved mapping
→ idempotent merge into live dataset

This is the safest first connector and validates the entire sync architecture before OAuth/API complexity.

### google_sheets

Pull connector.

Initial release:
- selected spreadsheet
- selected sheet/range
- snapshot sync
- stable ID column strongly recommended
- schedule: 5/15/30/60 minutes

### rest_api

Generic GET connector.

Initial release:
- JSON array/path
- pagination
- auth header from secret store
- stable ID path recommended
- optional updated_at path

### webhook

Push connector.

Initial release:
- one generated endpoint
- signing secret
- JSON mapping
- idempotency key
- 202 response
- async processing

---

## 27. Out of scope for first V1.5

Do not implement yet:

- full CDC
- Kafka
- RabbitMQ
- arbitrary ETL scripting
- JavaScript user transformations
- bidirectional writes
- automatic destructive source reconciliation
- automatic source deletions
- hundreds of provider-specific integrations
- AI mapping changes during active sync
- running Core Cycle on every webhook
- real-time websocket mining
- external automation actions

---

## 28. Implementation phases

### V1.5A — Sync foundation

- schema
- live dataset
- connector abstraction
- sync_runs
- event identity
- idempotent upsert
- connector lease
- manual sync
- recurring CSV

### V1.5B — Scheduler

- global scheduler
- durable queue
- worker
- retries
- debounce
- sync history UI

### V1.5C — Google Sheets

- OAuth
- schema discovery
- snapshot diff
- schedule

### V1.5D — REST + Webhook

- generic REST GET
- pagination
- credentials
- webhook endpoint
- signature
- async ingestion

### V1.5E — SQL connector

Only after the above architecture is stable.

---

## 29. Acceptance criteria

The sync foundation is ready when:

1. connector-specific code is outside Core Cycle;
2. connector config and credentials are separated;
3. mapping is versioned;
4. schema drift cannot silently remap required fields;
5. one logical event cannot be duplicated by retries;
6. same event key + same hash is a no-op;
7. same event key + changed hash updates the canonical event;
8. checkpoint only advances after successful persistence;
9. manual and scheduled sync use the same worker path;
10. two workers cannot sync the same connector concurrently;
11. queue retry does not duplicate process_events;
12. one global scheduler handles all connectors;
13. frequent events are coalesced before analysis;
14. analysis runs only when canonical data changed;
15. connector sync history is auditable;
16. transient/auth/schema/data errors are classified;
17. secrets never appear in browser or logs;
18. recurring CSV works end-to-end first;
19. existing V1.4 manual import still works;
20. Process Explorer still works;
21. Simulation Lab still works;
22. RLS remains correct for public metadata;
23. background privileged access is isolated server-side;
24. tests cover duplicate delivery and crash/retry cases;
25. GitHub Actions passes;
26. Vercel Preview is READY;
27. Supabase Security Advisor has no findings.

---

## 30. Product result

The V1.5 should change the product promise from:

"Envie um CSV e descubra seu processo."

to:

"Conecte seu processo uma vez. O ProcessTwin mantém os dados sincronizados e atualiza a análise automaticamente."
